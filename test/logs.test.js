// -----------------------------------------------------------------------------
// What the integration writes to `docker logs`: at info, only the lifecycle
// (the start, a network or station added or removed, a feed lost and back),
// never one line per reading; a failure that repeats at every cycle is
// logged once, plus one line when it is over. Never the path nor the query
// of a feed URL, where some operators put a key ("?apiKey=…").
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  action,
  captureLogs,
  create,
  createFetch,
  createWorld,
  cycle,
  feedUrl,
  fixtureJson,
} from './helpers/world.js';

const strip = (line) => line.text.replace(/^\[[^\]]+\] /, '');

test('the start is one info line', async (t) => {
  const lines = captureLogs(t, 'info');
  const world = await createWorld({ networks: [] });
  t.after(() => world.app.stop());
  assert.deepEqual(lines.map(strip), ['[INFO] [gbfs] Started: 0 network(s), 0 station(s) watched']);
});

test('a normal reading cycle writes nothing at info, one line at debug', async (t) => {
  const world = await createWorld({ networks: ['nantes'] });
  t.after(() => world.app.stop());
  await action(world, 'add_station', { station: '1' });
  await create(world, 'Préfecture');
  const lines = captureLogs(t, 'info');
  for (let i = 0; i < 5; i += 1) {
    await cycle(world, 60);
  }
  assert.deepEqual(lines, []);
  const debug = captureLogs(t, 'debug');
  await cycle(world, 60);
  assert.deepEqual(debug.map(strip), ['[DEBUG] [gbfs] Naolib: stations read']);
});

test('a feed down at every cycle: one warning, then one line at recovery, no key', async (t) => {
  const url = 'https://example.org/gbfs/gbfs.json?apiKey=opendata-secret';
  const discovery = fixtureJson('gbfs/vlille-gbfs.json');
  const status = feedUrl('vlille', 'station_status');
  const network = createFetch({ [url]: discovery });
  const world = await createWorld({ networks: [], network });
  t.after(() => world.app.stop());
  await action(world, 'add_network', { network: url });
  await action(world, 'add_station', { station: '27' });
  const lines = captureLogs(t, 'info');
  network.routes[status] = new TypeError('fetch failed');
  for (let i = 0; i < 4; i += 1) {
    await cycle(world, 60);
  }
  network.routes[status] = fixtureJson('gbfs/vlille-station_status.json');
  await cycle(world, 60);
  assert.deepEqual(lines.map(strip), [
    "[WARN] [gbfs] V'lille: station feed unavailable: media.ilevia.fr: fetch failed",
    "[INFO] [gbfs] V'lille: station feed back",
  ]);
  const all = captureLogs(t, 'debug');
  await action(world, 'status');
  network.routes[url] = 500;
  await action(world, 'add_network', { network: url });
  assert.doesNotMatch(all.map((l) => l.text).join('\n'), /secret/);
});
