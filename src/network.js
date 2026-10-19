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
// station_information of the biggest networks (Citi Bike: 2,300 stations) is
// about 1 MB; a cap well above, for the 256 MB sandbox.
const MAX_FEED_BYTES = 20e6;

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

  /** The station list: from memory, from /data if less than a day old, else downloaded. */
  async ensureStations({ force = false } = {}) {
    const fresh = (at) => at && this.now() - at < STATION_LIST_MAX_AGE_MS;
    if (!force && this.stations && fresh(this.stationsAt)) {
      return this.stations;
    }
    if (!force && !this.stations && this.cache) {
      const saved = await this.cache.load();
      if (
        saved?.url === this.info.url &&
        saved.language === this.language() &&
        Array.isArray(saved.stations) &&
        fresh(saved.readAt)
      ) {
        this.adopt(saved);
        return this.stations;
      }
    }
    await this.discover();
    const information = await getJson(this.fetch, this.urls.station_information, {
      maxBytes: MAX_FEED_BYTES,
      timeoutMs: 30000,
    });
    const stations = parseStations(information, this.language());
    if (stations.length === 0) {
      throw new FeedError('NO_STATIONS', `${hostOf(this.info.url)}: the station list is empty`);
    }
    // Both optional: the vehicle types (2.1+) and the name of the system.
    let kinds = [];
    if (this.urls.vehicle_types) {
      try {
        kinds = [
          ...parseVehicleTypes(
            await getJson(this.fetch, this.urls.vehicle_types, { maxBytes: 1e6 }),
          ),
        ];
      } catch {
        // The ids ("mechanical", "ebike"…) are guessed instead.
      }
    }
    let name = '';
    if (this.urls.system_information) {
      try {
        name = systemName(
          await getJson(this.fetch, this.urls.system_information, { maxBytes: 1e6 }),
          this.language(),
        );
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
    return this.stations;
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
  async readStatus() {
    if (!this.stations) {
      await this.ensureStations();
    } else if (!this.urls) {
      await this.discover();
    }
    try {
      const response = await getBuffer(this.fetch, this.urls.station_status, {
        maxBytes: MAX_FEED_BYTES,
        etag: this.status ? this.etag : null,
      });
      this.statusAt = this.now();
      if (response.notModified) {
        return this.status;
      }
      const document = parseJson(response.body, this.urls.station_status);
      if (!Array.isArray(document?.data?.stations)) {
        throw new HttpError(`${hostOf(this.urls.station_status)}: not a station_status feed`);
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
      return stations;
    } catch (err) {
      if (err.retryAfterMs) {
        this.retryAt = this.now() + Math.min(err.retryAfterMs, 3600 * 1000);
      }
      // The operator may have moved its feeds: discovered again next time.
      if (err.status === 404 || err.status === 410) {
        this.urls = null;
      }
      throw err;
    }
  }
}
