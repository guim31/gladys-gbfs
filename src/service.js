// -----------------------------------------------------------------------------
// The integration at runtime: the networks and stations watched, the readings
// behind them (one Network per network, src/network.js), the refresh timers,
// the published devices and states, the configuration actions and the scene
// triggers.
//
// Data flow:
//   - catalog of MobilityData (systems.csv): read on demand (search, add a
//     network), kept a day (src/catalog.js);
//   - station_information of each network: at most once a day, cached in /data;
//   - station_status of each network with a watched station: at the
//     configured pace, never faster than its ttl, conditional when possible.
// -----------------------------------------------------------------------------

import { createHash } from 'node:crypto';
import { createLogger } from '@gladysassistant/integration-sdk';
import { Catalog, searchCatalog } from './catalog.js';
import { DEFAULT_CONFIG, normalizeConfig } from './config.js';
import {
  STATION_TYPE,
  buildStationDevice,
  clip,
  prettyStationName,
  slug,
  stationPlatformId,
  stationStates,
} from './devices.js';
import { hostOf } from './http.js';
import { REPORTS, TEXT, lines, render, say } from './messages.js';
import { Network } from './network.js';
import { distanceMeters, formatDistance, nearest, normalize, searchByName } from './search.js';
import { JsonFile, dataDirectory } from './store.js';

const logger = createLogger({ name: 'gbfs' });

export const MAX_NETWORKS = 5;
export const MAX_STATIONS = 30;
export const SEARCH_RESULTS = 10;
// Unchanged states (a station always full) are sent again this often, or the
// dashboard shows "no recent value" after 48 hours.
export const HEARTBEAT_MS = 6 * 3600 * 1000;
const HOURLY_MS = 3600 * 1000;

export const TRIGGERS = {
  BIKES_LOW: 'bikes_low',
  BIKES_BACK: 'bikes_back',
  DOCKS_LOW: 'docks_low',
  DOCKS_BACK: 'docks_back',
};
// The thresholds offered by the triggers (the scene filters only compare for
// equality: an event is fired for every threshold crossed).
export const THRESHOLDS = [0, 1, 2, 3, 5, 10];
export const BIKE_KINDS = ['any', 'mechanical', 'electric'];
const KIND_FIELD = { any: 'bikes', mechanical: 'mechanical', electric: 'electric' };

/** An error whose message is already written for the user, in every language. */
export class UserError extends Error {
  constructor(messages) {
    super(messages.en);
    this.messages = messages;
  }
}

const reportError = (key, params) => new UserError(render(REPORTS, key, params));

/** The key of a network added by URL, outside the catalog: "url" and a hash of the URL. */
export const urlNetworkKey = (url) =>
  `url${createHash('sha1').update(url).digest('hex').slice(0, 8)}`;

/** The key of a catalog network: its system id, as an external id piece. */
export const catalogNetworkKey = (id) => slug(id).toLowerCase();

const isUrl = (value) => /^https?:\/\/\S+$/i.test(value);

export class BikeShare {
  /**
   * @param {object} options
   * @param {object} options.gladys GladysIntegration (or the SDK's fake)
   * @param {object} options.store persistence of the watch list (src/store.js)
   * @param {typeof fetch} [options.fetch]
   * @param {() => number} [options.now]
   * @param {boolean} [options.timers] false in the tests: they call the refreshes
   * @param {string} [options.dataDir]
   * @param {string} [options.catalogUrl]
   */
  constructor({
    gladys,
    store,
    fetch = globalThis.fetch,
    now = Date.now,
    timers = true,
    dataDir = dataDirectory(),
    catalogUrl,
  }) {
    this.gladys = gladys;
    this.store = store;
    this.fetch = fetch;
    this.now = now;
    this.useTimers = timers;
    this.dataDir = dataDir;
    this.catalog = new Catalog({
      fetch,
      now,
      url: catalogUrl,
      cache: new JsonFile(dataDir, 'catalog.json'),
    });
    this.config = normalizeConfig(DEFAULT_CONFIG);
    this.watch = { networks: [], stations: [] };
    this.networks = new Map(); // key → Network
    this.publishFailed = false;
    this.timer = null;
    this.hourlyTimer = null;
    this.stopped = false;
    this.refreshing = null;
    this.loading = Promise.resolve();
  }

  // --- lifecycle --------------------------------------------------------------

  async start(config) {
    this.config = config;
    const saved = await this.store.load();
    const networks = Array.isArray(saved.networks)
      ? saved.networks.filter((n) => n?.key && n.url)
      : [];
    this.watch = {
      networks,
      stations: Array.isArray(saved.stations)
        ? saved.stations.filter((s) => s?.id && networks.some((n) => n.key === s.network))
        : [],
    };
    // Only when /data lost its list: a station removed by the user keeps its
    // device in Gladys, and must not come back at the next start.
    if (!Array.isArray(saved.networks)) {
      await this.restoreFromDevices();
    }
    for (const info of this.watch.networks) {
      this.addNetworkRuntime(info);
    }
    await this.publishDiscovered();
    this.schedule();
    logger.info(
      `Started: ${this.watch.networks.length} network(s), ${this.watch.stations.length} station(s) watched`,
    );
    // Station lists (from /data, else downloaded) and a first reading, in the
    // background: actions wait for it, widgets and scene actions say so.
    this.loading = this.loadData().catch((err) => logger.error('Data load failed', err));
  }

  /** Gladys restarted: everything again, the states included. */
  async resync(config) {
    this.config = config;
    this.gladys.forgetPublishedStates?.();
    await this.publishDiscovered();
    await this.publishAllStates();
  }

  async reconfigure(config) {
    this.config = config;
    this.schedule();
    await this.publishDiscovered();
    await this.refresh();
  }

  async stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    clearTimeout(this.hourlyTimer);
    await this.store.flush();
  }

  schedule() {
    if (!this.useTimers || this.stopped) {
      return;
    }
    clearTimeout(this.timer);
    clearTimeout(this.hourlyTimer);
    // A callback still running when the schedule changes must not start a
    // second chain: each chain only continues while it is the current one.
    this.generation = (this.generation ?? 0) + 1;
    const generation = this.generation;
    const current = () => !this.stopped && this.generation === generation;
    const tick = () => {
      this.timer = setTimeout(async () => {
        await this.refresh();
        if (current()) {
          tick();
        }
      }, this.config.refreshSeconds * 1000);
      this.timer.unref?.();
    };
    tick();
    const hourly = () => {
      this.hourlyTimer = setTimeout(async () => {
        await this.hourlyCheck().catch((err) => logger.warn(`Daily check failed: ${err.message}`));
        if (current()) {
          hourly();
        }
      }, HOURLY_MS);
      this.hourlyTimer.unref?.();
    };
    hourly();
  }

  addNetworkRuntime(info) {
    const network = new Network({
      info,
      fetch: this.fetch,
      now: this.now,
      cache: new JsonFile(this.dataDir, `stations-${info.key}.json`),
      language: () => this.config.language,
    });
    this.networks.set(info.key, network);
    return network;
  }

  /** The networks with a watched station. */
  activeNetworks() {
    return [...this.networks.values()].filter((network) =>
      this.watch.stations.some((station) => station.network === network.key),
    );
  }

  async loadData() {
    for (const network of this.activeNetworks()) {
      await this.loadStations(network).catch(() => {});
    }
    await this.refresh();
  }

  /** The station list of a network; a failure is logged once, until it works again. */
  async loadStations(network, options) {
    try {
      const stations = await network.ensureStations(options);
      if (network.listError) {
        logger.info(`${network.info.name}: station list read again`);
      }
      network.listError = null;
      return stations;
    } catch (err) {
      if (!network.listError) {
        logger.warn(`${network.info.name}: cannot read the station list: ${err.message}`);
      }
      network.listError = err.message;
      throw err;
    }
  }

  /** Hourly: station lists older than a day are read again. */
  async hourlyCheck() {
    for (const network of this.activeNetworks()) {
      await this.loadStations(network).catch(() => {});
    }
  }

  /** The networks and stations of the devices created in Gladys but missing from /data. */
  async restoreFromDevices() {
    let devices;
    try {
      devices = await this.gladys.getDevices();
    } catch (err) {
      logger.warn(`Cannot read the devices of the integration: ${err.message}`);
      return;
    }
    const param = (device, name) => device.params?.find((p) => p.name === name)?.value;
    let changed = false;
    for (const device of devices ?? []) {
      const key = param(device, 'network');
      const id = param(device, 'station_id');
      const url = param(device, 'gbfs_url');
      if (!key || !id || !url) {
        continue;
      }
      if (!this.watch.networks.some((n) => n.key === key)) {
        this.watch.networks.push({
          key,
          name: param(device, 'network_name') || hostOf(url),
          url,
          split: (device.features ?? []).some((f) => /:mechanical$/.test(f.external_id)),
        });
      }
      if (!this.watch.stations.some((s) => s.network === key && s.id === id)) {
        this.watch.stations.push({
          network: key,
          id,
          name: param(device, 'station_name') || String(device.name ?? id).replace(/^[^·]*· /, ''),
          shortName: param(device, 'short_name') || '',
          capacity: Number(param(device, 'capacity')) || 0,
        });
        changed = true;
      }
    }
    if (changed) {
      logger.info('Watched stations restored from the Gladys devices');
      await this.save();
    }
  }

  save() {
    return this.store.save(this.watch);
  }

  // --- devices ----------------------------------------------------------------

  networkOf(station) {
    return this.networks.get(station.network) ?? null;
  }

  stationDevice(station) {
    const network = this.networkOf(station);
    return network
      ? buildStationDevice(this.gladys, station, network.info, this.config.language)
      : null;
  }

  stationDeviceId(station) {
    return this.gladys.externalIds(STATION_TYPE, stationPlatformId(station.network, station.id))
      .device;
  }

  async publishDiscovered() {
    const devices = this.watch.stations
      .map((station) => this.stationDevice(station))
      .filter(Boolean);
    try {
      await this.gladys.publishDiscoveredDevices(devices);
    } catch (err) {
      logger.warn(`Cannot publish the discovered devices: ${err.message}`);
    }
  }

  isCreated(externalId) {
    return (this.gladys.devices ?? []).some((device) => device.external_id === externalId);
  }

  stationOfDevice(externalId) {
    return this.watch.stations.find((station) => this.stationDeviceId(station) === externalId);
  }

  /** The last reading of a station, or null. */
  statusOf(station) {
    return this.networkOf(station)?.status?.get(station.id) ?? null;
  }

  async publish(states) {
    if (states.length === 0) {
      return;
    }
    try {
      await this.gladys.publishChangedStates(states, { heartbeat: HEARTBEAT_MS });
      if (this.publishFailed) {
        this.publishFailed = false;
        logger.info('States published again');
      }
    } catch (err) {
      // Gladys restarting: said once, the next refresh sends them again.
      if (!this.publishFailed) {
        logger.warn(`Cannot publish ${states.length} state(s): ${err.message}`);
      }
      this.publishFailed = true;
    }
  }

  statesOf(station) {
    const status = this.statusOf(station);
    const network = this.networkOf(station);
    return status && network ? stationStates(this.gladys, station, network.info, status) : [];
  }

  async publishAllStates() {
    const states = [];
    for (const station of this.watch.stations) {
      if (this.isCreated(this.stationDeviceId(station))) {
        states.push(...this.statesOf(station));
      }
    }
    await this.publish(states);
  }

  /** A device was just added in Gladys: its states, all of them, now. */
  async onDeviceCreated(device) {
    const station = this.stationOfDevice(device?.external_id);
    if (!station) {
      return;
    }
    await this.publish(this.statesOf(station));
    this.gladys.requestWidgetRefresh?.('stations')?.catch?.(() => {});
  }

  // --- refresh ------------------------------------------------------------------

  /** One refresh of every network due; concurrent calls share it. */
  refresh() {
    if (!this.refreshing) {
      this.refreshing = this.refreshAll()
        .catch((err) => logger.warn(`Refresh failed: ${err.message}`))
        .finally(() => {
          this.refreshing = null;
        });
    }
    return this.refreshing;
  }

  async refreshAll() {
    for (const network of this.activeNetworks()) {
      if (network.due(this.config.refreshSeconds)) {
        await this.refreshNetwork(network);
      }
    }
  }

  async refreshNetwork(network) {
    const wasSplit = Boolean(network.info.split);
    const previous = network.status;
    try {
      await network.readStatus();
      if (network.error) {
        logger.info(`${network.info.name}: station feed back`);
      }
      network.error = null;
    } catch (err) {
      if (!network.error) {
        logger.warn(`${network.info.name}: station feed unavailable: ${err.message}`);
      }
      network.error = err.message;
      return;
    }
    logger.debug(`${network.info.name}: stations read`);
    if (network.info.split !== wasSplit) {
      await this.save();
      await this.publishDiscovered();
    }
    // A comparison with a reading hours old (a feed back after an outage)
    // would fire crossings that are no longer news.
    const recent =
      network.previousAt !== null &&
      network.okAt - network.previousAt <=
        2 * network.interval(this.config.refreshSeconds) * 1000 + 5000;
    const states = [];
    const events = [];
    for (const station of this.watch.stations.filter((s) => s.network === network.key)) {
      const status = network.status.get(station.id);
      if (!status) {
        continue;
      }
      const deviceId = this.stationDeviceId(station);
      // Only a created device can be picked by a scene: no events for the others.
      if (!this.isCreated(deviceId)) {
        continue;
      }
      states.push(...stationStates(this.gladys, station, network.info, status));
      const before = previous?.get(station.id);
      if (before && before !== status && recent) {
        events.push(...this.thresholdEvents(station, network, deviceId, before, status));
      }
    }
    await this.publish(states);
    for (const { key, data } of events) {
      await this.fire(key, data);
    }
  }

  /** The thresholds crossed between two readings: bikes of each kind, docks. */
  thresholdEvents(station, network, deviceId, before, after) {
    const events = [];
    const common = {
      station: deviceId,
      station_name: station.name,
      bikes: after.bikes,
      mechanical: after.mechanical,
      electric: after.electric,
      docks: after.docks,
    };
    const crossings = (from, to) =>
      THRESHOLDS.flatMap((threshold) => {
        if (from > threshold && to <= threshold) {
          return [{ threshold, down: true }];
        }
        if (from <= threshold && to > threshold) {
          return [{ threshold, down: false }];
        }
        return [];
      });
    const kinds = network.info.split ? BIKE_KINDS : ['any'];
    for (const kind of kinds) {
      const field = KIND_FIELD[kind];
      for (const { threshold, down } of crossings(before[field], after[field])) {
        events.push({
          key: down ? TRIGGERS.BIKES_LOW : TRIGGERS.BIKES_BACK,
          data: { ...common, bike_type: kind, threshold: String(threshold) },
        });
      }
    }
    for (const { threshold, down } of crossings(before.docks, after.docks)) {
      events.push({
        key: down ? TRIGGERS.DOCKS_LOW : TRIGGERS.DOCKS_BACK,
        data: { ...common, threshold: String(threshold) },
      });
    }
    return events;
  }

  async fire(key, data) {
    try {
      await this.gladys.publishSceneEvent(key, data);
      if (this.fireFailed) {
        this.fireFailed = false;
        logger.info('Scene triggers fired again');
      }
    } catch (err) {
      if (!this.fireFailed) {
        logger.warn(`Cannot fire the ${key} trigger: ${err.message}`);
      }
      this.fireFailed = true;
    }
  }

  // --- configuration actions --------------------------------------------------

  async catalogForAction() {
    try {
      return await this.catalog.load();
    } catch (err) {
      throw reportError('catalogFailed', { reason: err.message });
    }
  }

  networkLine(entry, language) {
    const place = [entry.location, entry.country].filter(Boolean).join(', ');
    const versions = entry.versions.length > 0 ? ` · GBFS ${entry.versions.join(', ')}` : '';
    const auth = entry.auth ? ` — ${say(REPORTS, language, 'keyNeeded')}` : '';
    return `• ${clip(entry.name, 50)}${place ? ` — ${clip(place, 40)}` : ''} [${entry.id}]${versions}${auth}`;
  }

  async searchNetworks({ query } = {}) {
    if (!normalize(query)) {
      throw reportError('noNetworkQuery');
    }
    const found = searchCatalog(await this.catalogForAction(), query).slice(0, SEARCH_RESULTS);
    if (found.length === 0) {
      throw reportError('noNetworkMatch', { query });
    }
    return Object.fromEntries(
      Object.keys(REPORTS).map((language) => [
        language,
        [
          say(REPORTS, language, 'foundNetworks', { count: found.length }),
          ...found.map((entry) => this.networkLine(entry, language)),
          say(REPORTS, language, 'addNetworkHint'),
        ].join('\n'),
      ]),
    );
  }

  /** The network meant by an action: a catalog id, a catalog name, or a gbfs.json URL. */
  async resolveNetwork(query) {
    const wanted = String(query ?? '').trim();
    if (!wanted) {
      throw reportError('noNetworkQuery');
    }
    if (isUrl(wanted)) {
      // A URL of the catalog gets the catalog's key and name; the catalog
      // being down only costs that.
      const entry = await this.catalog.find(wanted).catch(() => null);
      return entry
        ? { key: catalogNetworkKey(entry.id), name: entry.name, url: entry.url, auth: entry.auth }
        : { key: urlNetworkKey(wanted), name: '', url: wanted, auth: false };
    }
    const entries = await this.catalogForAction();
    let entry = entries.find((e) => e.id.toLowerCase() === wanted.toLowerCase());
    if (!entry) {
      const named = entries.filter((e) => normalize(e.name) === normalize(wanted));
      const found = named.length > 0 ? named : searchCatalog(entries, wanted);
      if (found.length === 0) {
        throw reportError('noNetworkMatch', { query: wanted });
      }
      if (found.length > 1) {
        throw new UserError(
          perLanguage((language) => [
            say(REPORTS, language, 'ambiguousNetwork', { query: wanted }),
            ...found.slice(0, SEARCH_RESULTS).map((e) => this.networkLine(e, language)),
          ]),
        );
      }
      [entry] = found;
    }
    return { key: catalogNetworkKey(entry.id), name: entry.name, url: entry.url, auth: entry.auth };
  }

  async addNetwork({ network: query } = {}) {
    const resolved = await this.resolveNetwork(query);
    if (resolved.auth) {
      throw reportError('keyRefused', { name: resolved.name });
    }
    const existing = this.watch.networks.find((n) => n.key === resolved.key);
    if (existing && existing.url === resolved.url) {
      throw reportError('networkKnown', { name: existing.name });
    }
    if (!existing && this.watch.networks.length >= MAX_NETWORKS) {
      throw reportError('tooManyNetworks', { max: MAX_NETWORKS });
    }
    const info = existing
      ? { ...existing, url: resolved.url }
      : { key: resolved.key, name: resolved.name, url: resolved.url, split: false };
    const network = new Network({
      info,
      fetch: this.fetch,
      now: this.now,
      cache: new JsonFile(this.dataDir, `stations-${info.key}.json`),
      language: () => this.config.language,
    });
    try {
      await network.ensureStations({ force: true });
    } catch (err) {
      throw err.code === 'NO_STATIONS'
        ? reportError('noStations', { name: info.name || hostOf(info.url) })
        : reportError('networkFailed', {
            name: info.name || hostOf(info.url),
            reason: err.message,
          });
    }
    info.name = clip(info.name || network.systemName || hostOf(info.url), 40);
    // Scooters or cars parked at stations (Bird, Citiz…): nothing to count.
    const kinds = [...network.kinds.values()];
    if (kinds.length > 0 && !kinds.some((kind) => kind.bicycle)) {
      throw reportError('noBikes', { name: info.name });
    }
    // A first reading tells whether the bikes are told apart.
    await network.readStatus().catch(() => {});
    if (existing) {
      Object.assign(existing, info);
      network.info = existing;
    } else {
      this.watch.networks.push(info);
    }
    this.networks.set(info.key, network);
    await this.save();
    await this.publishDiscovered();
    logger.info(`Network ${existing ? 'updated' : 'added'}: ${info.name}`);
    return render(REPORTS, existing ? 'networkUpdated' : 'networkAdded', {
      name: info.name,
      count: network.stations.size,
      split: Boolean(info.split),
    });
  }

  /** The networks an action is about: the one named, else all. */
  networksFor(query) {
    const all = [...this.networks.values()];
    if (all.length === 0) {
      throw reportError('noNetwork');
    }
    const wanted = normalize(query);
    if (!wanted) {
      return all;
    }
    const found = all.filter(
      (network) => normalize(network.info.name) === wanted || normalize(network.key) === wanted,
    );
    if (found.length === 0) {
      throw reportError('unknownNetwork', {
        query: String(query),
        networks: all.map((network) => `${network.info.name} [${network.key}]`).join(', '),
      });
    }
    return found;
  }

  /** Every station of the networks, for a search: `{ name, lat, lon, network, station }`. */
  async stationsOf(networks) {
    const items = [];
    for (const network of networks) {
      try {
        await this.loadStations(network);
      } catch (err) {
        throw reportError('networkFailed', { name: network.info.name, reason: err.message });
      }
      for (const station of network.stations.values()) {
        items.push({
          name: station.name,
          lat: station.lat,
          lon: station.lon,
          network,
          station,
        });
      }
    }
    return items;
  }

  /** The located houses of Gladys: `{ name, selector, lat, lon }[]`. */
  async houses() {
    try {
      const houses = await this.gladys.getHouses();
      return (houses ?? [])
        .filter((h) => Number.isFinite(h.latitude) && Number.isFinite(h.longitude))
        .map((h) => ({ name: h.name, selector: h.selector, lat: h.latitude, lon: h.longitude }));
    } catch (err) {
      logger.warn(`Cannot read the position of the houses: ${err.message}`);
      return [];
    }
  }

  /** The house picked (selector), else the first located one, or null. */
  async home(selector) {
    const houses = await this.houses();
    const wanted = String(selector ?? '').trim();
    return (wanted && houses.find((h) => h.selector === wanted)) || houses[0] || null;
  }

  /** "21 méca · 4 élec · 10 places", "5 vélos · 10 places", "hors service". */
  countsText(network, status, language) {
    if (!status) {
      return '';
    }
    if (!status.installed || !status.renting) {
      return say(TEXT, language, 'closed');
    }
    return network.info.split
      ? say(TEXT, language, 'countsSplit', status)
      : say(TEXT, language, 'counts', status);
  }

  stationLine({ network, station }, distance, withNetwork, language) {
    const status = network.status?.get(station.id) ?? null;
    const parts = [
      `• ${withNetwork ? `${network.info.name} · ` : ''}${clip(prettyStationName(station.name), 50)} [${station.id}]`,
      distance === null || distance === undefined ? null : formatDistance(distance, language),
      this.countsText(network, status, language) || null,
    ];
    return parts.filter(Boolean).join(' — ');
  }

  async searchStations({ query, network: networkQuery, house } = {}) {
    const networks = this.networksFor(networkQuery);
    const items = await this.stationsOf(networks);
    const home = await this.home(house);
    let found;
    let header;
    if (normalize(query)) {
      const exact = items.filter(
        ({ station }) =>
          station.id === String(query).trim() || station.shortName === String(query).trim(),
      );
      found = [
        ...exact.map((item) => ({ item, distance: null })),
        ...searchByName(items, query, { near: home }).filter(({ item }) => !exact.includes(item)),
      ].slice(0, SEARCH_RESULTS);
      if (found.length === 0) {
        throw reportError('noStationMatch', { query });
      }
      header = render(REPORTS, 'foundStations', { count: found.length });
    } else {
      if (!home) {
        throw reportError('noQuery');
      }
      found = nearest(items, home, SEARCH_RESULTS);
      header = render(REPORTS, 'closestStations', { house: home.name });
    }
    const withNetwork = networks.length > 1;
    const distanceOf = ({ item, distance }) =>
      distance ?? (home ? distanceMeters(home, item) : null);
    return Object.fromEntries(
      Object.keys(REPORTS).map((language) => [
        language,
        [
          header[language],
          ...found.map((entry) =>
            this.stationLine(entry.item, distanceOf(entry), withNetwork, language),
          ),
          say(REPORTS, language, 'addStationHint'),
        ].join('\n'),
      ]),
    );
  }

  /** The station meant by an identifier, a number or a name: `{ network, station }`. */
  async resolveStation(query, networkQuery) {
    const wanted = String(query ?? '').trim();
    if (!wanted) {
      throw reportError('noStationQuery');
    }
    const items = await this.stationsOf(this.networksFor(networkQuery));
    let found = items.filter(({ station }) => station.id === wanted);
    if (found.length === 0) {
      found = items.filter(({ station }) => station.shortName && station.shortName === wanted);
    }
    if (found.length === 0) {
      found = items.filter(({ station }) => normalize(station.name) === normalize(wanted));
    }
    if (found.length === 0) {
      found = searchByName(items, wanted).map(({ item }) => item);
    }
    if (found.length === 0) {
      throw reportError('noStationMatch', { query: wanted });
    }
    if (found.length > 1) {
      throw new UserError(
        perLanguage((language) => [
          say(REPORTS, language, 'ambiguousStation', { query: wanted }),
          ...found
            .slice(0, SEARCH_RESULTS)
            .map((item) => this.stationLine(item, null, true, language)),
        ]),
      );
    }
    return found[0];
  }

  async addStation({ station: query, network: networkQuery } = {}) {
    const { network, station } = await this.resolveStation(query, networkQuery);
    const name = prettyStationName(station.name);
    if (this.watch.stations.some((s) => s.network === network.key && s.id === station.id)) {
      throw reportError('stationKnown', { name });
    }
    if (this.watch.stations.length >= MAX_STATIONS) {
      throw reportError('tooManyStations', { max: MAX_STATIONS });
    }
    this.watch.stations.push({
      network: network.key,
      id: station.id,
      name,
      shortName: station.shortName,
      capacity: station.capacity,
    });
    if (!network.status) {
      await this.refreshNetwork(network);
    }
    await this.save();
    await this.publishDiscovered();
    logger.info(`Station added: ${network.info.name} · ${name}`);
    return render(REPORTS, 'stationAdded', { name, network: network.info.name });
  }

  async remove({ name: query } = {}) {
    const wanted = normalize(query);
    const raw = String(query ?? '').trim();
    // The identifier first, then the number, then the name: two networks may
    // both have a "Gare".
    let matches = [];
    for (const test of [
      (entry) => entry.id === raw,
      (entry) => entry.shortName && entry.shortName === raw,
      (entry) => normalize(entry.name) === wanted,
    ]) {
      if (wanted && matches.length === 0) {
        matches = this.watch.stations.filter(test);
      }
    }
    if (matches.length > 1) {
      throw new UserError(
        perLanguage((language) => [
          say(REPORTS, language, 'ambiguousStation', { query: raw }),
          ...matches.map((entry) => {
            const network = this.networks.get(entry.network);
            return `• ${network?.info.name ?? entry.network} · ${entry.name} [${entry.id}]`;
          }),
        ]),
      );
    }
    const station = matches[0] ?? null;
    const network =
      wanted && !station
        ? this.watch.networks.find(
            (entry) => normalize(entry.name) === wanted || normalize(entry.key) === wanted,
          )
        : null;
    if (!station && !network) {
      throw reportError('notWatched', { query: raw });
    }
    if (station) {
      this.watch.stations = this.watch.stations.filter((entry) => entry !== station);
      await this.save();
      await this.publishDiscovered();
      logger.info(`Station removed: ${station.name}`);
      return render(REPORTS, 'stationRemoved', { name: station.name });
    }
    const count = this.watch.stations.filter((entry) => entry.network === network.key).length;
    this.watch.stations = this.watch.stations.filter((entry) => entry.network !== network.key);
    this.watch.networks = this.watch.networks.filter((entry) => entry !== network);
    await this.networks.get(network.key)?.cache?.remove();
    this.networks.delete(network.key);
    await this.save();
    await this.publishDiscovered();
    logger.info(`Network removed: ${network.name}`);
    return render(REPORTS, 'networkRemoved', { name: network.name, count });
  }

  status() {
    const now = this.now();
    const language = this.config.language;
    const time = (ms) =>
      new Intl.DateTimeFormat(language, {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: process.env.TZ || 'Europe/Paris',
      }).format(ms);
    const blocks = [render(REPORTS, 'watchedNetworks', { count: this.watch.networks.length })];
    for (const info of this.watch.networks) {
      const network = this.networks.get(info.key);
      const stations = this.watch.stations.filter((s) => s.network === info.key);
      const interval = network.interval(this.config.refreshSeconds);
      const megabytesPerHour = Math.round((network.bytes * 3600) / interval / 1e5) / 10;
      blocks.push(
        `■ ${info.name} [${info.key}]${network.version ? ` · GBFS ${network.version}` : ''}`,
        network.stations
          ? render(REPORTS, 'stationList', {
              count: network.stations.size,
              date: time(network.stationsAt),
            })
          : render(REPORTS, 'stationListMissing'),
        stations.length === 0
          ? null
          : network.statusAt
            ? render(REPORTS, 'reading', {
                age: Math.round((now - network.statusAt) / 1000),
                interval,
                volume: megabytesPerHour.toLocaleString(language),
              })
            : render(REPORTS, 'readingWaiting'),
        render(REPORTS, 'watchedStations', { count: stations.length }),
        stations.length === 0
          ? null
          : Object.fromEntries(
              Object.keys(REPORTS).map((lang) => [
                lang,
                stations
                  .map((station) => {
                    const counts = this.countsText(network, this.statusOf(station), lang);
                    return `• ${station.name} [${station.id}]${counts ? ` — ${counts}` : ''}`;
                  })
                  .join('\n'),
              ]),
            ),
        network.error || network.listError
          ? render(REPORTS, 'lastError', {
              error: [network.listError, network.error].filter(Boolean).join(' / '),
            })
          : null,
      );
    }
    if (this.watch.networks.length === 0) {
      blocks.push(render(REPORTS, 'noNetworkYet'));
    }
    return lines(...blocks);
  }

  /** A sentence for a scene: "Préfecture : 4 vélos (3 méca, 1 élec), 29 places libres." */
  sentence(station, status, language) {
    const network = this.networkOf(station);
    const params = { name: station.name, ...status };
    if (!status.installed || !status.renting) {
      return say(TEXT, language, 'sentenceClosed', params);
    }
    const base = say(TEXT, language, network?.info.split ? 'sentenceSplit' : 'sentence', params);
    return status.returning ? base : `${base} ${say(TEXT, language, 'noReturn')}`;
  }
}

/** A message built line by line in every language: `{ en, fr, de, es }`. */
function perLanguage(build) {
  return Object.fromEntries(
    Object.keys(REPORTS).map((language) => [language, build(language).join('\n')]),
  );
}
