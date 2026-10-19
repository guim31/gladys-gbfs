// -----------------------------------------------------------------------------
// The Gladys device of a watched station and its states:
//   bikes       counter-sensor/integer  bikes available (bicycles only)
//   mechanical  counter-sensor/integer  only when the network tells them apart
//   electric    counter-sensor/integer  idem
//   docks       counter-sensor/integer  free docks
//   installed   input/binary            1 = the station is in service
//   renting     input/binary            1 = a bike can be taken
//   returning   input/binary            1 = a bike can be returned
//
// Read-only, no polling: the integration reads the feeds on its own timer
// (src/service.js), Gladys never polls (`should_poll: false`). The bounds are
// display bounds (gauges, charts): the capacity of the station when known.
// -----------------------------------------------------------------------------

import { DEVICE_FEATURE_CATEGORIES, DEVICE_FEATURE_TYPES } from '@gladysassistant/integration-sdk';
import { NAMES } from './messages.js';

export const STATION_TYPE = 'station';
export const COUNT_KEYS = ['bikes', 'mechanical', 'electric', 'docks'];
export const FLAG_KEYS = ['installed', 'renting', 'returning'];
export const DEFAULT_MAX = 60;
export const MAX_DEVICE_NAME = 80;

/** Shortens a text to `max` characters, with an ellipsis. */
export function clip(text, max) {
  const value = String(text ?? '');
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}

/** A piece of an external id: letters, digits, "_" and "-" only. */
export const slug = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** The platform id of a station: "<network key>-<station id>". */
export const stationPlatformId = (networkKey, stationId) =>
  `${slug(networkKey)}-${slug(stationId)}`;

/** "Préfecture" from the operator's "PRÉFECTURE"; names already in mixed case stay. */
export function prettyStationName(name) {
  const small = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'et', 'sur', 'aux', 'au', 'en']);
  const value = String(name ?? '').trim();
  if (value !== value.toUpperCase() || !/\p{L}{2}/u.test(value)) {
    return value;
  }
  return value
    .toLowerCase()
    .split(/(\s+|-|'|’)/)
    .map((word, index, words) => {
      if (!/\p{L}/u.test(word)) {
        return word;
      }
      // d'Arc, l'Huile: the elided article stays lower case.
      if ((word === 'd' || word === 'l') && /^['’]$/.test(words[index + 1] ?? '') && index > 0) {
        return word;
      }
      if (small.has(word) && index > 0) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join('');
}

/** The feature keys of a station of this network. */
export const featureKeys = (split) => [
  'bikes',
  ...(split ? ['mechanical', 'electric'] : []),
  'docks',
  ...FLAG_KEYS,
];

/**
 * The device of a watched station.
 * @param {object} gladys
 * @param {{ network: string, id: string, name: string, capacity?: number }} station
 * @param {{ key: string, name: string, url: string, split?: boolean }} network
 * @param {string} language
 */
export function buildStationDevice(gladys, station, network, language) {
  const ids = gladys.externalIds(STATION_TYPE, stationPlatformId(network.key, station.id));
  const names = NAMES[language] ?? NAMES.en;
  const max = station.capacity > 0 ? station.capacity : DEFAULT_MAX;
  const features = featureKeys(network.split).map((key) => {
    const flag = FLAG_KEYS.includes(key);
    return {
      name: names[key],
      external_id: ids.feature(key),
      category: flag ? DEVICE_FEATURE_CATEGORIES.INPUT : DEVICE_FEATURE_CATEGORIES.COUNTER_SENSOR,
      type: flag ? DEVICE_FEATURE_TYPES.SENSOR.BINARY : DEVICE_FEATURE_TYPES.SENSOR.INTEGER,
      min: 0,
      max: flag ? 1 : max,
      read_only: true,
      has_feedback: false,
    };
  });
  return {
    name: clip(`${network.name} · ${station.name}`, MAX_DEVICE_NAME),
    external_id: ids.device,
    should_poll: false,
    params: [
      { name: 'network', value: network.key },
      { name: 'network_name', value: network.name },
      { name: 'gbfs_url', value: network.url },
      { name: 'station_id', value: station.id },
      { name: 'capacity', value: String(station.capacity ?? 0) },
    ],
    features,
  };
}

/** The states of a station device, from its last reading. */
export function stationStates(gladys, station, network, status) {
  const ids = gladys.externalIds(STATION_TYPE, stationPlatformId(network.key, station.id));
  return featureKeys(network.split).map((key) => ({
    device_feature_external_id: ids.feature(key),
    state: FLAG_KEYS.includes(key) ? (status[key] ? 1 : 0) : status[key],
  }));
}
