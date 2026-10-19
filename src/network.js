// -----------------------------------------------------------------------------
// One bike sharing network at runtime: its gbfs.json, its station list
// (station_information, read at most once a day, cached in /data) and the
// last reading of its stations (station_status).
//
// Pace: station_status is read at the configured interval (one minute at
// least), never faster than its `ttl`. A `ttl` longer than five minutes is not
// honored: Vélib' announces an hour for data refreshed every minute.
// -----------------------------------------------------------------------------

import {
  feedTtl,
  feedUrls,
  feedVersion,
  parseStations,
  parseStatus,
  parseVehicleTypes,
  systemName,
} from './gbfs.js';
import { HttpError, getBuffer, getJson, hostOf, parseJson } from './http.js';

export const STATION_LIST_MAX_AGE_MS = 24 * 3600 * 1000;
export const MAX_TTL_HONORED_S = 300;
// station_information of the biggest networks (Citi Bike: 2,500 stations) is
// about 1 MB; a cap well above, still parsed in memory within the 256 MB sandbox.
const MAX_FEED_BYTES = 8e6;
const DEFAULT_BACKOFF_MS = 5 * 60 * 1000;

/** An error of the network itself (not of the connection), with a code. */
export class FeedError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export class Network {
  /**
   * @param {object} options
   * @param {{ key: string, name: string, url: string, split?: boolean }} options.info
   *   the entry of watch.json (updated in place: name, split)
   * @param {typeof fetch} options.fetch
   * @param {() => number} options.now
   * @param {import('./store.js').JsonFile} [options.cache]
   * @param {() => string} [options.language]
   */
  constructor({ info, fetch, now, cache = null, language = () => 'en' }) {
    this.info = info;
    this.fetch = fetch;
    this.now = now;
    this.cache = cache;
    this.language = language;
    this.urls = null;
    this.version = null;
    this.kinds = new Map();
    this.stations = null; // Map(id → station)
    this.stationsAt = null;
    this.systemName = '';
    this.ttl = 0;
    this.status = null; // Map(id → status)
    this.statusAt = null;
    this.etag = null;
    this.bytes = 0;
    this.error = null;
    this.retryAt = 0;
    this.okAt = null; // last good reading
    this.previousAt = null; // the one before
  }

  get key() {
    return this.info.key;
  }

  /** gbfs.json → the feed URLs; a network without stations is refused. */
  async discover() {
    const discovery = await getJson(this.fetch, this.info.url, { maxBytes: 1e6 });
    const urls = feedUrls(discovery, this.language());
    if (!urls.station_information || !urls.station_status) {
      throw new FeedError(
        'NO_STATIONS',
        `${hostOf(this.info.url)}: no station feed (a free-floating system?)`,
      );
    }
    this.urls = urls;
    this.version = feedVersion(discovery);
    return urls;
  }

  /**
   * The station list: from memory, from /data if less than a day old, else
   * downloaded. Concurrent calls share one download; a failed download falls
   * back on the list already known, even old (the status feed may still answer).
   */
  ensureStations(options = {}) {
    if (!this.listing) {
      this.listing = this.loadStations(options).finally(() => {
        this.listing = null;
      });
    }
    return this.listing;
  }

  async loadStations({ force = false } = {}) {
    const fresh = (at) => at && this.now() - at < STATION_LIST_MAX_AGE_MS;
    if (!force && this.stations && fresh(this.stationsAt)) {
      return this.stations;
    }
    let saved = null;
    if (!this.stations && this.cache) {
      saved = await this.cache.load();
      const usable =
        saved?.url === this.info.url &&
        saved.language === this.language() &&
        Array.isArray(saved.stations);
      if (!usable) {
        saved = null;
      } else if (!force && fresh(saved.readAt)) {
        this.adopt(saved);
        return this.stations;
      }
    }
    try {
      await this.download();
    } catch (err) {
      this.postpone(err);
      if (!force && (this.stations || saved)) {
        if (!this.stations) {
          this.adopt(saved);
        }
        return this.stations;
      }
      throw err;
    }
    return this.stations;
  }

  async download() {
    await this.discover();
    const information = await getJson(this.fetch, this.urls.station_information, {
      maxBytes: MAX_FEED_BYTES,
      timeoutMs: 30000,
    });
    const stations = parseStations(information, this.language());
    if (stations.length === 0) {
      throw new FeedError('NO_STATIONS', `${hostOf(this.info.url)}: the station list is empty`);
    }
    // Both optional: the vehicle types (2.1+) and the name of the system. A
    // failure keeps what was known: forgetting the types for a day would count
    // every e-bike as mechanical.
    let kinds = [...this.kinds];
    if (this.urls.vehicle_types) {
      try {
        kinds = [
          ...parseVehicleTypes(
            await getJson(this.fetch, this.urls.vehicle_types, { maxBytes: 1e6 }),
          ),
        ];
      } catch {
        // The ids ("mechanical", "ebike"…) are guessed when nothing is known.
      }
    }
    let name = this.systemName;
    if (this.urls.system_information) {
      try {
        name =
          systemName(
            await getJson(this.fetch, this.urls.system_information, { maxBytes: 1e6 }),
            this.language(),
          ) || name;
      } catch {
        // The name of the catalog, or the host, stays.
      }
    }
    const snapshot = {
      url: this.info.url,
      language: this.language(),
      readAt: this.now(),
      urls: this.urls,
      version: this.version,
      kinds,
      name,
      stations,
    };
    this.adopt(snapshot);
    await this.cache?.save(snapshot);
  }

  /** A 429 or a 503 postpones the next request: as asked, else 5 minutes. */
  postpone(err) {
    if (err?.status === 429 || err?.status === 503) {
      const wait = err.retryAfterMs ?? DEFAULT_BACKOFF_MS;
      this.retryAt = this.now() + Math.min(wait, 3600 * 1000);
    }
  }

  adopt(snapshot) {
    this.urls = snapshot.urls;
    this.version = snapshot.version ?? null;
    this.kinds = new Map(snapshot.kinds ?? []);
    this.systemName = snapshot.name ?? '';
    this.stations = new Map(snapshot.stations.map((station) => [station.id, station]));
    this.stationsAt = snapshot.readAt;
  }

  /** Seconds between two readings: the configured pace, never faster than the ttl. */
  interval(configSeconds) {
    return Math.max(configSeconds, Math.min(this.ttl, MAX_TTL_HONORED_S));
  }

  /** Whether a reading is due (a 429 or 503 postpones it as asked). */
  due(configSeconds) {
    const now = this.now();
    if (now < this.retryAt) {
      return false;
    }
    // A margin: the timer ticks at the configured pace, a little late.
    return !this.statusAt || now - this.statusAt >= this.interval(configSeconds) * 1000 - 5000;
  }

  /**
   * Reads station_status. Resolves the stations Map, also when the server
   * answers 304 (unchanged).
   */
  readStatus() {
    if (!this.reading) {
      this.reading = this.fetchStatus().finally(() => {
        this.reading = null;
      });
    }
    return this.reading;
  }

  async fetchStatus() {
    try {
      if (!this.stations) {
        await this.ensureStations();
      } else if (!this.urls) {
        await this.discover();
      }
    } catch (err) {
      this.postpone(err);
      throw err;
    }
    const url = this.urls.station_status;
    try {
      const response = await getBuffer(this.fetch, url, {
        maxBytes: MAX_FEED_BYTES,
        etag: this.status ? this.etag : null,
      });
      this.statusAt = this.now();
      if (response.notModified) {
        this.previousAt = this.okAt;
        this.okAt = this.statusAt;
        return this.status;
      }
      const document = parseJson(response.body, url);
      if (!Array.isArray(document?.data?.stations)) {
        throw new HttpError(`${hostOf(url)}: not a station_status feed`);
      }
      const { stations, split } = parseStatus(document, this.kinds);
      this.ttl = feedTtl(document);
      this.etag = response.etag;
      this.bytes = response.body.length;
      // Once told apart, the bikes stay split: features never come and go.
      if (split && !this.info.split) {
        this.info.split = true;
      }
      this.status = stations;
      // When the previous good reading was made: a comparison with a reading
      // hours old would fire stale threshold crossings.
      this.previousAt = this.okAt;
      this.okAt = this.statusAt;
      return stations;
    } catch (err) {
      this.statusAt = this.now();
      this.postpone(err);
      // The operator may have moved its feeds: discovered again next time.
      if (err.status === 404 || err.status === 410) {
        this.urls = null;
      }
      throw err;
    }
  }

  /** Whether the last good reading is too old to be shown as current (3 intervals). */
  stale(configSeconds) {
    return !this.okAt || this.now() - this.okAt > 3 * this.interval(configSeconds) * 1000 + 5000;
  }
}
