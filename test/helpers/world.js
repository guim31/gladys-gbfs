// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys, a fake `fetch` serving the
// real (reduced) GBFS feeds of five networks and the MobilityData catalog, a
// manual clock, a temporary /data, and the integration wired on top through
// registerHandlers. Nothing touches the network.
//
// Networks of the fixtures (captured on 2026-10-19):
//   Paris     Vélib' Metropole  "1.0" (no version field), numeric ids, 0/1 flags,
//                               num_bikes_available_types, ttl 3600
//   nantes    Naolib            3.0, localized upper-case names, one bike type
//   v_lille   V'lille           2.3, one human bike type, ttl 0, a station
//                               missing from station_status
//   velibeo   Vélibéo           3.0, electric bikes and scooters at stations
//   lyft_nyc  Citi Bike         2.3, classic and e-bikes (vehicle_types)
// -----------------------------------------------------------------------------

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { CATALOG_URL } from '../../src/catalog.js';
import { feedUrls } from '../../src/gbfs.js';
import { Store } from '../../src/store.js';

process.env.LOG_LEVEL ??= 'silent';

export const fixture = (name) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url));
export const fixtureJson = (name) => JSON.parse(fixture(name).toString('utf8'));

// 2026-10-19 18:23:20 in Paris, just after the capture.
export const FIXTURE_TIME = 1792427000000;

export const NETWORKS = {
  velib: {
    id: 'Paris',
    url: 'https://velib-metropole-opendata.smovengo.cloud/opendata/Velib_Metropole/gbfs.json',
  },
  nantes: { id: 'nantes', url: 'https://api.cyclocity.fr/contracts/nantes/gbfs/v3/gbfs.json' },
  vlille: { id: 'v_lille', url: 'https://media.ilevia.fr/opendata/gbfs.json' },
  velibeo: { id: 'velibeo', url: 'https://api.gbfs.v3.0.ecovelo.mobi/velibeo/gbfs.json' },
  citi: { id: 'lyft_nyc', url: 'https://gbfs.citibikenyc.com/gbfs/2.3/gbfs.json' },
};

/** The fixture routes of a network: gbfs.json and every feed captured. */
export function networkRoutes(name) {
  const discovery = fixtureJson(`gbfs/${name}-gbfs.json`);
  const routes = { [NETWORKS[name].url]: discovery };
  // Every language list (Citi Bike: en, fr, es) serves the same captures.
  for (const language of ['en', 'fr', 'es']) {
    for (const [feed, url] of Object.entries(feedUrls(discovery, language))) {
      try {
        routes[url] ??= fixtureJson(`gbfs/${name}-${feed}.json`);
      } catch {
        // Not captured: a 404.
      }
    }
  }
  return routes;
}

/** The URL of a feed of a fixture network. */
export const feedUrl = (name, feed, language = 'fr') =>
  feedUrls(fixtureJson(`gbfs/${name}-gbfs.json`), language)[feed];

/**
 * A fake `fetch`: `routes[url]` is a Buffer, a JSON value, a status number,
 * an Error (network failure), a Response or a function of the request
 * returning one of them. Every call is recorded in `calls`.
 */
export function createFetch(overrides = {}) {
  const routes = {
    [CATALOG_URL]: fixture('catalog/systems-sample.csv'),
    ...Object.keys(NETWORKS).reduce((all, name) => ({ ...all, ...networkRoutes(name) }), {}),
    ...overrides,
  };
  const calls = [];
  const fetch = async (url, init = {}) => {
    calls.push({ url, headers: init.headers ?? {} });
    let route = routes[url];
    if (typeof route === 'function') {
      route = await route(url, init);
    }
    if (route instanceof Error) {
      throw route;
    }
    if (route === undefined) {
      return new Response('not found', { status: 404 });
    }
    if (route instanceof Response) {
      return route;
    }
    if (typeof route === 'number') {
      return new Response(route === 304 ? null : 'error', { status: route });
    }
    if (Buffer.isBuffer(route) || route instanceof Uint8Array) {
      return new Response(route, { status: 200 });
    }
    return new Response(JSON.stringify(route), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  return { fetch, calls, routes };
}

/** A manual clock. */
export function createClock(start = FIXTURE_TIME) {
  const clock = {
    time: start,
    now: () => clock.time,
    advance(ms) {
      clock.time += ms;
    },
  };
  return clock;
}

// Place de l'Hôtel de Ville, Paris.
export const HOUSE = {
  id: 'h1',
  name: 'Maison',
  selector: 'maison',
  latitude: 48.8566,
  longitude: 2.3522,
};

/**
 * @param {object} [options]
 * @param {object} [options.config] raw integration config
 * @param {object} [options.network] from createFetch
 * @param {Array} [options.devices] devices already created in Gladys
 * @param {Array} [options.houses]
 * @param {object} [options.saved] content of /data/watch.json before the start
 * @param {boolean} [options.connect]
 * @param {string[]} [options.networks] networks added once connected (Vélib' by default)
 */
export async function createWorld({
  config = {},
  network = createFetch(),
  devices = [],
  houses = [HOUSE],
  saved,
  connect = true,
  clock = createClock(),
  dataDir = mkdtempSync(join(tmpdir(), 'gladys-gbfs-')),
  networks = ['Paris'],
} = {}) {
  const gladys = createFakeGladys({ config, devices, houses });
  const store = new Store(dataDir);
  if (saved) {
    await store.save(saved);
    await store.flush();
  }
  const app = registerHandlers(gladys, {
    store,
    fetch: network.fetch,
    timers: false,
    now: clock.now,
    dataDir,
  });
  const world = {
    gladys,
    fake: gladys.fake,
    app,
    service: app.service,
    network,
    clock,
    store,
    dataDir,
  };
  if (connect) {
    await gladys.connect();
    await app.ready;
    await app.service.loading;
    for (const id of networks) {
      await action(world, 'add_network', { network: id });
    }
  }
  return world;
}

/** Run a configuration action; resolves with its message (multi-language). */
export async function action(world, key, fields = {}) {
  const ack = await world.fake.action(key, fields);
  if (!ack.success) {
    throw new Error(`${key} failed: ${ack.error}`);
  }
  return ack.data.message;
}

/** The device published for a name part or a predicate, from the last discovery list. */
export const discovered = (world, predicate) =>
  world.fake.discoveredDevices.find(
    typeof predicate === 'function' ? predicate : (d) => d.name.includes(predicate),
  );

/** Create a discovered device in Gladys, as the user would. */
export async function create(world, predicate) {
  const device = discovered(world, predicate);
  if (!device) {
    throw new Error(`${predicate} is not in the discovered devices`);
  }
  await world.fake.deviceCreated(device);
  return device;
}

/** External id of one feature of a device. */
export const featureId = (device, key) =>
  device.features.find((feature) => feature.external_id.endsWith(`:${key}`))?.external_id;

/** One refresh cycle, `seconds` later. */
export async function cycle(world, seconds = 60) {
  world.clock.advance(seconds * 1000);
  await world.service.refresh();
}

/** Replaces the status of one station in the served station_status of a network. */
export function setStatus(world, name, stationId, changes) {
  const url = feedUrl(name, 'station_status');
  const document = structuredClone(world.network.routes[url]);
  for (const station of document.data.stations) {
    if (String(station.station_id) === String(stationId)) {
      Object.assign(station, changes);
    }
  }
  world.network.routes[url] = document;
  return document;
}

/** Captures what the integration logs, at a level. */
export function captureLogs(t, level = 'info') {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = level;
  const lines = [];
  const record = (...args) => {
    const text = args.map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(' ');
    const match = /^\[[^\]]+\] \[(\w+)\]/.exec(text);
    lines.push({ level: match ? match[1].toLowerCase() : 'raw', text });
  };
  t.mock.method(console, 'log', record);
  t.mock.method(console, 'error', record);
  t.after(() => {
    process.env.LOG_LEVEL = previous;
  });
  return lines;
}
