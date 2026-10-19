// -----------------------------------------------------------------------------
// Reading the real feeds of five networks, GBFS 1.0 to 3.0 (src/gbfs.js).
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  feedTtl,
  feedUrls,
  feedVersion,
  localized,
  parseStations,
  parseStatus,
  parseVehicleTypes,
  reportedAt,
  systemName,
} from '../src/gbfs.js';
import { fixtureJson } from './helpers/world.js';

const feed = (name, kind) => fixtureJson(`gbfs/${name}-${kind}.json`);
const read = (name) => {
  let kinds = new Map();
  try {
    kinds = parseVehicleTypes(feed(name, 'vehicle_types'));
  } catch {
    // No vehicle_types feed (Vélib').
  }
  const { split } = parseStatus(feed(name, 'station_status'), kinds);
  return { stations: parseStations(feed(name, 'station_information'), 'fr'), split };
};

test('gbfs.json: 1.x/2.x lists per language, 3.0 a single list', () => {
  const velib = feedUrls(feed('velib', 'gbfs'));
  assert.match(velib.station_status, /Velib_Metropole\/station_status\.json$/);
  assert.equal(feedVersion(feed('velib', 'gbfs')), '1.0');
  const nantes = feedUrls(feed('nantes', 'gbfs'));
  assert.match(nantes.station_information, /nantes\/gbfs\/v3\/station_information\.json$/);
  assert.equal(feedVersion(feed('nantes', 'gbfs')), '3.0');
  // Citi Bike: en, fr and es lists; the wanted language first.
  assert.match(feedUrls(feed('citi', 'gbfs'), 'fr').station_status, /\/fr\/station_status/);
  assert.match(feedUrls(feed('citi', 'gbfs'), 'de').station_status, /\/en\/station_status/);
});

test('ttl: the seconds announced, 0 when none', () => {
  assert.equal(feedTtl(feed('velib', 'station_status')), 3600);
  assert.equal(feedTtl(feed('nantes', 'station_status')), 1);
  assert.equal(feedTtl(feed('vlille', 'station_status')), 0);
  assert.equal(feedTtl({}), 0);
});

test('localized texts: a string, or the language wanted of a 3.0 list', () => {
  const name = [
    { text: 'Hôtel de Ville', language: 'fr' },
    { text: 'City Hall', language: 'en' },
  ];
  assert.equal(localized(name, 'en'), 'City Hall');
  assert.equal(localized(name, 'de'), 'Hôtel de Ville');
  assert.equal(localized('  Rihour ', 'en'), 'Rihour');
  assert.equal(localized([{ text: 'Zola', language: 'fr-FR' }], 'fr'), 'Zola');
  assert.equal(localized(undefined), '');
  assert.equal(systemName(feed('nantes', 'system_information'), 'fr'), 'Naolib');
  assert.equal(systemName(feed('vlille', 'system_information')), "V'lille");
});

test("Vélib': numeric ids, station code, 0/1 flags, mechanical and ebike counts", () => {
  const { stations, split } = read('velib');
  assert.equal(split, true);
  const godard = parseStations(feed('velib', 'station_information')).find(
    (s) => s.id === '213688169',
  );
  assert.deepEqual(godard, {
    id: '213688169',
    name: 'Benjamin Godard - Victor Hugo',
    shortName: '16107',
    lat: 48.865983,
    lon: 2.275725,
    address: '',
    capacity: 35,
  });
  const status = parseStatus(feed('velib', 'station_status')).stations;
  assert.deepEqual(status.get('213688169'), {
    bikes: 25,
    mechanical: 21,
    electric: 4,
    docks: 10,
    installed: true,
    renting: true,
    returning: true,
    reportedAt: 1792425633000,
  });
  // Installed but closed: neither renting nor returning.
  const closed = status.get('21584689525');
  assert.equal(closed.installed, true);
  assert.equal(closed.renting, false);
  assert.equal(closed.returning, false);
  assert.equal(stations.length, 11);
});

test('Naolib (3.0): localized names, a single mechanical type, RFC 3339 dates', () => {
  const { stations, split } = read('nantes');
  assert.equal(split, false);
  const prefecture = stations.find((s) => s.id === '1');
  assert.equal(prefecture.name, 'PRÉFECTURE');
  assert.equal(prefecture.address, 'Place du Port Communeau');
  // A station without a name is named after its id.
  assert.equal(stations.find((s) => s.id === '2').name, '2');
  const status = parseStatus(
    feed('nantes', 'station_status'),
    parseVehicleTypes(feed('nantes', 'vehicle_types')),
  );
  const one = status.stations.get('1');
  assert.equal(one.bikes, 4);
  assert.equal(one.mechanical, 4);
  assert.equal(one.electric, 0);
  assert.equal(one.docks, 29);
  assert.equal(one.reportedAt, Date.parse('2026-10-19T01:20:33Z'));
  assert.equal(status.stations.get('48').renting, false);
});

test("V'lille (2.3): one human bike type, a station missing from the status", () => {
  const { stations, split } = read('vlille');
  assert.equal(split, false);
  assert.ok(stations.some((s) => s.id === '1'));
  const status = parseStatus(
    feed('vlille', 'station_status'),
    parseVehicleTypes(feed('vlille', 'vehicle_types')),
  );
  assert.equal(status.stations.has('1'), false);
  assert.deepEqual(
    { ...status.stations.get('27'), reportedAt: null },
    {
      bikes: 15,
      mechanical: 15,
      electric: 0,
      docks: 21,
      installed: true,
      renting: true,
      returning: true,
      reportedAt: null,
    },
  );
});

test('Vélibéo (3.0): electric bikes only, the scooters are not bikes', () => {
  const kinds = parseVehicleTypes(feed('velibeo', 'vehicle_types'));
  assert.deepEqual(kinds.get('knot'), { bicycle: false, electric: true });
  assert.deepEqual(kinds.get('x2'), { bicycle: true, electric: true });
  const document = structuredClone(feed('velibeo', 'station_status'));
  const station = document.data.stations[0];
  station.vehicle_types_available.find((v) => v.vehicle_type_id === 'knot').count = 2;
  station.num_vehicles_available += 2;
  const { stations, split } = parseStatus(document, kinds);
  assert.equal(split, false);
  const status = stations.get(station.station_id);
  assert.equal(status.bikes, 6);
  assert.equal(status.electric, 6);
  assert.equal(status.mechanical, 0);
});

test('Citi Bike (2.3): classic and e-bikes told apart by vehicle_types', () => {
  const { split } = read('citi');
  assert.equal(split, true);
  const status = parseStatus(
    feed('citi', 'station_status'),
    parseVehicleTypes(feed('citi', 'vehicle_types')),
  );
  const centre = status.stations.get('66dbe8d6-0aca-11e7-82f6-3863bb44ef7c');
  assert.equal(centre.bikes, 49);
  assert.equal(centre.mechanical, 6);
  assert.equal(centre.electric, 43);
  // A placeholder date (86400) is no date.
  assert.equal(status.stations.get('29ced315-14b5-4edc-bef2-665316dfe3dd').reportedAt, null);
});

test('without vehicle_types, the type ids are guessed', () => {
  const { stations, split } = parseStatus({
    data: {
      stations: [
        {
          station_id: 's',
          num_bikes_available: 3,
          vehicle_types_available: [
            { vehicle_type_id: 'mechanical', count: 1 },
            { vehicle_type_id: 'electrical', count: 2 },
          ],
          num_docks_available: 4,
          is_installed: true,
          is_renting: true,
          is_returning: true,
          last_reported: 1792425633,
        },
      ],
    },
  });
  assert.equal(split, true);
  assert.equal(stations.get('s').electric, 2);
  assert.equal(stations.get('s').mechanical, 1);
});

test('dates: POSIX seconds, milliseconds, RFC 3339, nonsense', () => {
  assert.equal(reportedAt(1792425633), 1792425633000);
  assert.equal(reportedAt(1792425633000), 1792425633000);
  assert.equal(reportedAt('2026-10-19T18:20:05+02:00'), Date.parse('2026-10-19T16:20:05Z'));
  assert.equal(reportedAt(86400), null);
  assert.equal(reportedAt('soon'), null);
});

test('stations without id or position are left out, duplicates once', () => {
  const stations = parseStations({
    data: {
      stations: [
        { station_id: 'a', name: 'A', lat: 1, lon: 2 },
        { station_id: 'a', name: 'A bis', lat: 1, lon: 2 },
        { name: 'no id', lat: 1, lon: 2 },
        { station_id: 'b', name: 'no position' },
      ],
    },
  });
  assert.deepEqual(
    stations.map((s) => s.name),
    ['A'],
  );
});
