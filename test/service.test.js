// -----------------------------------------------------------------------------
// The integration end to end against the SDK's fake Gladys and the real
// (reduced) feeds: catalog search, networks and stations added, devices and
// states, pace of the readings, scene triggers, persistence, errors.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CATALOG_URL } from '../src/catalog.js';
import { TRIGGERS, urlNetworkKey } from '../src/service.js';
import {
  NETWORKS,
  action,
  create,
  createFetch,
  createWorld,
  cycle,
  discovered,
  featureId,
  feedUrl,
  setStatus,
} from './helpers/world.js';

const GODARD = '213688169'; // Vélib' "Benjamin Godard - Victor Hugo", 21 + 4 bikes
const statusUrl = (name) => feedUrl(name, 'station_status');
const callsTo = (world, url) => world.network.calls.filter((call) => call.url === url).length;

async function watching(t, { station = GODARD, networks = ['Paris'], ...options } = {}) {
  const world = await createWorld({ networks, ...options });
  t.after(() => world.app.stop());
  await action(world, 'add_station', { station });
  return world;
}

test('the catalog finds a network by name, city or id, accents ignored', async (t) => {
  const world = await createWorld({ networks: [] });
  t.after(() => world.app.stop());
  const velib = await action(world, 'search_networks', { query: 'velib' });
  assert.match(velib.fr, /Vélib' Metropole — Paris, FR \[Paris\] · GBFS 1\.0/);
  assert.match(velib.fr, /« Ajouter un réseau »/);
  const nantes = await action(world, 'search_networks', { query: 'Nantes' });
  assert.match(nantes.en, /Naolib — Nantes, FR \[nantes\]/);
  // A system that needs a key says so.
  const lime = await action(world, 'search_networks', { query: 'wetzikon' });
  assert.match(lime.en, /needs a key, not supported/);
  const none = await action(world, 'search_networks', { query: 'Atlantis' });
  assert.match(none.fr, /Aucun réseau ne correspond à « Atlantis »/);
});

test('a catalog network is added with its stations and whether bikes are told apart', async (t) => {
  const world = await createWorld({ networks: [] });
  t.after(() => world.app.stop());
  const velib = await action(world, 'add_network', { network: 'Paris' });
  assert.match(
    velib.fr,
    /^Vélib' Metropole ajouté : 11 stations, vélos mécaniques et électriques distingués/,
  );
  const naolib = await action(world, 'add_network', { network: 'Naolib' });
  assert.match(naolib.en, /^Naolib added: 9 stations\. /);
  assert.deepEqual(
    world.service.watch.networks.map((n) => [n.key, n.name, n.split]),
    [
      ['paris', "Vélib' Metropole", true],
      ['nantes', 'Naolib', false],
    ],
  );
  const again = await action(world, 'add_network', { network: 'paris' });
  assert.match(again.en, /already added/);
});

test('a network given by its gbfs.json URL: the catalog key when listed, a hash otherwise', async (t) => {
  const url = 'https://example.org/gbfs/gbfs.json';
  const network = createFetch({
    [url]: { ...(await import('./helpers/world.js')).fixtureJson('gbfs/vlille-gbfs.json') },
  });
  const world = await createWorld({ networks: [], network });
  t.after(() => world.app.stop());
  await action(world, 'add_network', { network: NETWORKS.citi.url });
  assert.equal(world.service.watch.networks[0].key, 'lyft_nyc');
  assert.equal(world.service.watch.networks[0].name, 'Citi Bike');
  const custom = await action(world, 'add_network', { network: url });
  // Outside the catalog: named after system_information.
  assert.match(custom.en, /^V'lille added: 9 stations/);
  assert.equal(world.service.watch.networks[1].key, urlNetworkKey(url));
});

test('free-floating systems, systems with a key and broken feeds are refused', async (t) => {
  const bird = 'https://mds.bird.co/gbfs/v2/public/bordeaux/gbfs.json';
  const network = createFetch({
    [bird]: { data: { en: { feeds: [{ name: 'free_bike_status', url: 'https://x/f.json' }] } } },
  });
  const world = await createWorld({ networks: [], network });
  t.after(() => world.app.stop());
  const refused = await action(world, 'add_network', { network: 'bird-bordeaux' });
  assert.match(refused.en, /publishes no stations \(free-floating/);
  const key = await action(world, 'add_network', { network: 'lime_wetzikon' });
  assert.match(key.fr, /demande une clé d'accès/);
  const broken = await action(world, 'add_network', { network: 'toulouse' });
  assert.match(broken.en, /VélÔToulouse cannot be read \(api\.cyclocity\.fr: HTTP 404\)/);
  assert.deepEqual(world.service.watch.networks, []);
});

test('the catalog unreachable: said, and kept from /data once read', async (t) => {
  const network = createFetch();
  const world = await createWorld({ networks: [], network });
  t.after(() => world.app.stop());
  await action(world, 'search_networks', { query: 'Paris' });
  network.routes[CATALOG_URL] = 503;
  const restarted = await createWorld({ networks: [], network, dataDir: world.dataDir });
  t.after(() => restarted.app.stop());
  const found = await action(restarted, 'search_networks', { query: 'Paris' });
  assert.match(found.en, /Vélib'/);
  const fresh = await createWorld({ networks: [], network });
  t.after(() => fresh.app.stop());
  const failed = await action(fresh, 'search_networks', { query: 'Paris' });
  assert.match(
    failed.en,
    /The catalog of networks cannot be read \(raw\.githubusercontent\.com: HTTP 503\)/,
  );
});

test('stations around the home, by name, by number, with their bikes', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const around = await action(world, 'search_stations', {});
  const lines = around.fr.split('\n');
  assert.equal(lines[0], 'Les stations les plus proches de Maison :');
  assert.match(
    lines[1],
    /^• Lobau - Hôtel de Ville \[98187918\] — 90 m — 47 méca · 10 élec · 2 places$/,
  );
  assert.equal(lines.length, 12);
  const rivoli = await action(world, 'search_stations', { query: 'rivoli' });
  assert.match(rivoli.en, /^2 station\(s\) found:/);
  const byCode = await action(world, 'search_stations', { query: '16107' });
  assert.match(
    byCode.en.split('\n')[1],
    /Benjamin Godard - Victor Hugo \[213688169\] — 5\.7 km — /,
  );
  const closed = await action(world, 'search_stations', { query: 'Tour de France' });
  assert.match(closed.fr, /Station Tour de France \[21584689525\] — .* — hors service/);
});

test('without a query nor a located house, the search asks for a name', async (t) => {
  const world = await createWorld({ houses: [] });
  t.after(() => world.app.stop());
  const message = await action(world, 'search_stations', {});
  assert.match(message.en, /Type a station name/);
});

test('a station added becomes a device to discover, named after its network', async (t) => {
  const world = await watching(t);
  const device = discovered(world, 'Benjamin Godard');
  assert.equal(device.name, "Vélib' Metropole · Benjamin Godard - Victor Hugo");
  assert.equal(device.should_poll, false);
  assert.deepEqual(
    device.features.map((f) => f.external_id.split(':').pop()),
    ['bikes', 'mechanical', 'electric', 'docks', 'installed', 'renting', 'returning'],
  );
  assert.equal(device.features[0].max, 35);
  assert.match(device.external_id, /:station:paris-213688169$/);
  const again = await action(world, 'add_station', { station: GODARD });
  assert.match(again.en, /already watched/);
});

test('Naolib: upper-case names made readable, no mechanical/electric split', async (t) => {
  const world = await watching(t, { networks: ['nantes'], station: 'préfecture' });
  const device = discovered(world, 'Préfecture');
  assert.equal(device.name, 'Naolib · Préfecture');
  assert.deepEqual(
    device.features.map((f) => f.external_id.split(':').pop()),
    ['bikes', 'docks', 'installed', 'renting', 'returning'],
  );
  assert.deepEqual(
    device.features.map((f) => f.name),
    [
      'Vélos disponibles',
      'Places libres',
      'Station en service',
      'Location possible',
      'Retour possible',
    ],
  );
});

test('an ambiguous station name lists the candidates', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const message = await action(world, 'add_station', { station: 'Rivoli' });
  assert.match(message.en, /Several stations match "Rivoli"/);
  assert.match(message.en, /Archives - Rivoli \[128880156\]/);
});

test('creating the device publishes all its states at once, and nudges the widget', async (t) => {
  const world = await watching(t);
  const device = await create(world, 'Benjamin Godard');
  const state = (key) => world.fake.lastState(featureId(device, key));
  assert.deepEqual(
    ['bikes', 'mechanical', 'electric', 'docks', 'installed', 'renting', 'returning'].map(state),
    [25, 21, 4, 10, 1, 1, 1],
  );
  assert.deepEqual(world.fake.widgetRefreshes, ['stations']);
});

test("Vélib' announces a ttl of an hour: read every 5 minutes, not every minute", async (t) => {
  const world = await watching(t);
  await create(world, 'Benjamin Godard');
  const before = callsTo(world, statusUrl('velib'));
  for (let i = 0; i < 4; i += 1) {
    await cycle(world, 60);
  }
  assert.equal(callsTo(world, statusUrl('velib')), before);
  await cycle(world, 60);
  assert.equal(callsTo(world, statusUrl('velib')), before + 1);
});

test('Naolib (ttl 1 s): read at the configured pace, conditional when the server allows', async (t) => {
  let served = 0;
  const document = (await import('./helpers/world.js')).fixtureJson(
    'gbfs/nantes-station_status.json',
  );
  const network = createFetch({
    [statusUrl('nantes')]: (url, init) => {
      served += 1;
      if (init.headers['if-none-match'] === '"v1"') {
        return 304;
      }
      return new Response(JSON.stringify(document), { status: 200, headers: { etag: '"v1"' } });
    },
  });
  const world = await watching(t, {
    networks: ['nantes'],
    station: '1',
    network,
    config: { refresh_interval: '120' },
  });
  const first = served;
  await cycle(world, 60);
  assert.equal(served, first);
  await cycle(world, 60);
  assert.equal(served, first + 1);
  assert.equal(world.service.statusOf(world.service.watch.stations[0]).bikes, 4);
});

test('a reading publishes only the changes, and fires the thresholds crossed', async (t) => {
  const world = await watching(t);
  const device = await create(world, 'Benjamin Godard');
  const published = world.fake.states.length;
  setStatus(world, 'velib', GODARD, {
    num_bikes_available: 2,
    num_bikes_available_types: [{ mechanical: 2 }, { ebike: 0 }],
    num_docks_available: 33,
  });
  await cycle(world, 300);
  const changed = world.fake.states
    .slice(published)
    .map((s) => s.device_feature_external_id.split(':').pop());
  assert.deepEqual(changed.sort(), ['bikes', 'docks', 'electric', 'mechanical']);
  const events = world.fake.sceneEvents.map(
    ({ key, data }) => `${key}/${data.bike_type ?? '-'}/${data.threshold}`,
  );
  assert.deepEqual(events, [
    'bikes_low/any/2',
    'bikes_low/any/3',
    'bikes_low/any/5',
    'bikes_low/any/10',
    'bikes_low/mechanical/2',
    'bikes_low/mechanical/3',
    'bikes_low/mechanical/5',
    'bikes_low/mechanical/10',
    'bikes_low/electric/0',
    'bikes_low/electric/1',
    'bikes_low/electric/2',
    'bikes_low/electric/3',
    'docks_back/-/10',
  ]);
  const first = world.fake.sceneEvents[0].data;
  assert.deepEqual(first, {
    station: device.external_id,
    station_name: 'Benjamin Godard - Victor Hugo',
    bikes: 2,
    mechanical: 2,
    electric: 0,
    docks: 33,
    bike_type: 'any',
    threshold: '2',
  });
  // Back up: the "back" triggers.
  setStatus(world, 'velib', GODARD, {
    num_bikes_available: 4,
    num_bikes_available_types: [{ mechanical: 2 }, { ebike: 2 }],
    num_docks_available: 31,
  });
  world.fake.requests.length = 0;
  await cycle(world, 300);
  assert.deepEqual(
    world.fake.sceneEvents.map(
      ({ key, data }) => `${key}/${data.bike_type ?? '-'}/${data.threshold}`,
    ),
    ['bikes_back/any/2', 'bikes_back/any/3', 'bikes_back/electric/0', 'bikes_back/electric/1'],
  );
});

test('a network without split fires only the "any bike" thresholds', async (t) => {
  const world = await watching(t, { networks: ['nantes'], station: '1' });
  setStatus(world, 'nantes', '1', {
    num_vehicles_available: 0,
    vehicle_types_available: [{ vehicle_type_id: 'mechanical', count: 0 }],
  });
  await cycle(world, 60);
  assert.deepEqual(
    world.fake.sceneEvents.map(({ key, data }) => `${key}/${data.bike_type}/${data.threshold}`),
    ['bikes_low/any/0', 'bikes_low/any/1', 'bikes_low/any/2', 'bikes_low/any/3'],
  );
});

test('a station closed: its flags drop to 0', async (t) => {
  const world = await watching(t);
  const device = await create(world, 'Benjamin Godard');
  setStatus(world, 'velib', GODARD, { is_renting: 0, is_returning: 0 });
  await cycle(world, 300);
  assert.equal(world.fake.lastState(featureId(device, 'renting')), 0);
  assert.equal(world.fake.lastState(featureId(device, 'returning')), 0);
  assert.equal(world.fake.lastState(featureId(device, 'installed')), 1);
});

test('the station list is read once a day and kept in /data across restarts', async (t) => {
  const network = createFetch();
  const world = await watching(t, { network });
  const information = feedUrl('velib', 'station_information');
  assert.equal(callsTo(world, information), 1);
  await world.app.stop();
  const restarted = await createWorld({ network, dataDir: world.dataDir, networks: [] });
  t.after(() => restarted.app.stop());
  assert.equal(callsTo(world, information), 1);
  assert.equal(restarted.service.watch.stations.length, 1);
  assert.ok(restarted.service.statusOf(restarted.service.watch.stations[0]));
  const cache = JSON.parse(await readFile(join(world.dataDir, 'stations-paris.json'), 'utf8'));
  assert.equal(cache.stations.length, 11);
  restarted.clock.advance(25 * 3600 * 1000);
  await restarted.service.hourlyCheck();
  assert.equal(callsTo(world, information), 2);
});

test('/data lost: the stations come back from their Gladys devices', async (t) => {
  const first = await watching(t);
  const device = await create(first, 'Benjamin Godard');
  await first.app.stop();
  const world = await createWorld({ devices: [device], networks: [] });
  t.after(() => world.app.stop());
  assert.deepEqual(
    world.service.watch.networks.map((n) => [n.key, n.name, n.split]),
    [['paris', "Vélib' Metropole", true]],
  );
  assert.deepEqual(
    world.service.watch.stations.map((s) => [s.id, s.name, s.capacity]),
    [[GODARD, 'Benjamin Godard - Victor Hugo', 35]],
  );
  assert.equal(discovered(world, 'Benjamin Godard').external_id, device.external_id);
});

test('the feed down: the states stay, the status says it, and it comes back', async (t) => {
  const world = await watching(t);
  await create(world, 'Benjamin Godard');
  world.network.routes[statusUrl('velib')] = 503;
  await cycle(world, 300);
  const status = await action(world, 'status');
  assert.match(status.en, /Last error: velib-metropole-opendata\.smovengo\.cloud: HTTP 503/);
  world.network.routes[statusUrl('velib')] = (await import('./helpers/world.js')).fixtureJson(
    'gbfs/velib-station_status.json',
  );
  await cycle(world, 300);
  assert.doesNotMatch((await action(world, 'status')).en, /Last error/);
});

test('a 429 is respected: no reading before its Retry-After', async (t) => {
  const world = await watching(t, { networks: ['nantes'], station: '1' });
  world.network.routes[statusUrl('nantes')] = new Response('slow down', {
    status: 429,
    headers: { 'retry-after': '600' },
  });
  await cycle(world, 60);
  const after429 = callsTo(world, statusUrl('nantes'));
  for (let i = 0; i < 5; i += 1) {
    await cycle(world, 60);
  }
  assert.equal(callsTo(world, statusUrl('nantes')), after429);
});

test('status: networks, list, pace, volume, stations', async (t) => {
  const world = await watching(t);
  const status = await action(world, 'status');
  const lines = status.en.split('\n');
  assert.equal(lines[0], '1 network(s) added.');
  assert.equal(lines[1], "■ Vélib' Metropole [paris] · GBFS 1.0");
  assert.match(lines[2], /^Station list: 11 stations, read on /);
  assert.match(lines[3], /^Last reading 0 s ago, every 300 s \(about 0 MB per hour\)\.$/);
  assert.equal(lines[4], '1 station(s) watched:');
  assert.equal(
    lines[5],
    '• Benjamin Godard - Victor Hugo [213688169] — 21 mech. · 4 elec. · 10 docks',
  );
});

test('remove a station, then a network with its stations and its cache', async (t) => {
  const world = await watching(t, { networks: ['Paris', 'nantes'] });
  await action(world, 'add_station', { station: '1', network: 'Naolib' });
  assert.equal(world.fake.discoveredDevices.length, 2);
  const station = await action(world, 'remove', { name: 'benjamin godard victor hugo' });
  assert.match(station.fr, /^Benjamin Godard - Victor Hugo n'est plus surveillée/);
  assert.equal(world.fake.discoveredDevices.length, 1);
  const network = await action(world, 'remove', { name: 'Naolib' });
  assert.match(network.en, /^Naolib removed, with its 1 station\(s\)/);
  assert.equal(world.fake.discoveredDevices.length, 0);
  await assert.rejects(readFile(join(world.dataDir, 'stations-nantes.json')));
  const unknown = await action(world, 'remove', { name: 'Atlantis' });
  assert.match(unknown.en, /No watched station or network is called "Atlantis"/);
});

test('limits: thirty stations, five networks', async (t) => {
  const world = await createWorld({
    networks: ['Paris', 'nantes', 'v_lille', 'velibeo', 'lyft_nyc'],
  });
  t.after(() => world.app.stop());
  const sixth = await action(world, 'add_network', { network: 'namur' });
  assert.match(sixth.en, /5 networks at most/);
  world.service.watch.stations = Array.from({ length: 30 }, (_, i) => ({
    network: 'paris',
    id: `x${i}`,
    name: `x${i}`,
  }));
  const message = await action(world, 'add_station', { station: GODARD });
  assert.match(message.en, /30 stations at most/);
});

test('the trigger keys are the ones of the manifest', () => {
  assert.deepEqual(Object.values(TRIGGERS).sort(), [
    'bikes_back',
    'bikes_low',
    'docks_back',
    'docks_low',
  ]);
});
