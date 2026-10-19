// -----------------------------------------------------------------------------
// Reading the GBFS feeds (General Bikeshare Feed Specification), versions 1.0
// to 3.x, as published by real operators: the differences are absorbed here
// so the rest of the code sees one shape.
//
//   gbfs.json            1.x/2.x: data.<language>.feeds; 3.x: data.feeds
//   names                1.x/2.x: strings; 3.x: [{ text, language }]
//   vehicles at station  1.x/2.x: num_bikes_available; 3.x: num_vehicles_available
//   vehicle types        2.1+: vehicle_types.json + vehicle_types_available;
//                        Vélib' (1.0 declared): num_bikes_available_types,
//                        [{ mechanical: n }, { ebike: n }]
//   flags                booleans, or 0/1 (1.x, Vélib', Lyft)
//   last_reported        POSIX seconds (1.x/2.x) or RFC 3339 (3.x)
//
// Scooters and other non-bicycle vehicles parked at a station are not bikes:
// counted out when the vehicle types say so.
// -----------------------------------------------------------------------------

const BICYCLES = new Set(['bicycle', 'cargo_bicycle']);

/** A text of the feed in the wanted language: a string, or a GBFS 3.0 localized list. */
export function localized(value, language = 'en') {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (Array.isArray(value)) {
    const texts = value.filter((entry) => typeof entry?.text === 'string' && entry.text.trim());
    const match =
      texts.find((entry) => String(entry.language ?? '').toLowerCase() === language) ??
      texts.find((entry) =>
        String(entry.language ?? '')
          .toLowerCase()
          .startsWith(`${language}-`),
      ) ??
      texts[0];
    return match ? match.text.trim() : '';
  }
  return '';
}

/**
 * The feed URLs announced by gbfs.json, by name: those of the wanted language
 * first (1.x/2.x publish one list per language), then of any other.
 */
export function feedUrls(discovery, language = 'en') {
  const data = discovery?.data ?? {};
  const lists = [];
  if (Array.isArray(data.feeds)) {
    lists.push(data.feeds);
  }
  const languages = Object.keys(data).filter((key) => Array.isArray(data[key]?.feeds));
  const order = [
    ...languages.filter((key) => key.toLowerCase() === language),
    ...languages.filter((key) => key.toLowerCase().startsWith(`${language}-`)),
    ...languages.filter((key) => key.toLowerCase() === 'en'),
    ...languages,
  ];
  for (const key of new Set(order)) {
    lists.push(data[key].feeds);
  }
  const urls = {};
  for (const feeds of lists) {
    for (const feed of feeds) {
      if (feed?.name && typeof feed.url === 'string' && /^https?:\/\//.test(feed.url)) {
        urls[feed.name] ??= feed.url;
      }
    }
  }
  return urls;
}

/** The `ttl` of a feed, in seconds (0 when the operator gives none or 0). */
export function feedTtl(document) {
  const ttl = Number(document?.ttl);
  return Number.isFinite(ttl) && ttl > 0 ? Math.floor(ttl) : 0;
}

/** The GBFS version a feed declares ("1.0" when it says nothing: 1.0 had no field). */
export function feedVersion(document) {
  return typeof document?.version === 'string' && document.version ? document.version : '1.0';
}

/** vehicle_types.json → Map(id → { bicycle, electric }). */
export function parseVehicleTypes(document) {
  const kinds = new Map();
  for (const type of document?.data?.vehicle_types ?? []) {
    if (type?.vehicle_type_id === undefined) {
      continue;
    }
    kinds.set(String(type.vehicle_type_id), {
      bicycle: BICYCLES.has(type.form_factor) || !type.form_factor,
      electric: /electric/.test(type.propulsion_type ?? ''),
    });
  }
  return kinds;
}

const count = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
};
const flag = (value, fallback = true) => {
  if (value === undefined || value === null) {
    return fallback;
  }
  return value === true || value === 1 || value === '1' || value === 'true';
};

/** POSIX seconds or RFC 3339 → ms (null when unreadable). */
export function reportedAt(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 1e9) {
    return value > 1e12 ? value : value * 1000;
  }
  if (typeof value === 'string' && value) {
    const ms = Date.parse(value);
    if (Number.isFinite(ms)) {
      return ms;
    }
    const seconds = Number(value);
    return Number.isFinite(seconds) && seconds > 1e9 ? seconds * 1000 : null;
  }
  return null;
}

/** The name of a system (system_information.json), in the wanted language. */
export function systemName(document, language = 'en') {
  return localized(document?.data?.name, language);
}

/**
 * station_information.json → [{ id, name, shortName, lat, lon, address, capacity }].
 * Stations without an id or a position are left out.
 */
export function parseStations(document, language = 'en') {
  const stations = [];
  const seen = new Set();
  for (const station of document?.data?.stations ?? []) {
    if (station?.station_id === undefined || station.station_id === null) {
      continue;
    }
    const id = String(station.station_id);
    const lat = Number(station.lat);
    const lon = Number(station.lon);
    if (seen.has(id) || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      continue;
    }
    seen.add(id);
    // Vélib' calls its public number "stationCode".
    const shortName = localized(station.short_name, language) || String(station.stationCode ?? '');
    stations.push({
      id,
      name: localized(station.name, language) || shortName || id,
      shortName,
      lat,
      lon,
      address: localized(station.address, language),
      capacity: count(station.capacity),
    });
  }
  return stations;
}

/** Vélib' style counts: [{ mechanical: 3 }, { ebike: 2 }] or { mechanical: 3, ebike: 2 }. */
function typeCounts(value) {
  const entries = Array.isArray(value) ? value : [value];
  const counts = {};
  for (const entry of entries) {
    if (entry && typeof entry === 'object') {
      for (const [key, number] of Object.entries(entry)) {
        counts[key] = (counts[key] ?? 0) + count(number);
      }
    }
  }
  return counts;
}

/**
 * station_status.json → { stations: Map(id → status), split }, a status being
 * `{ bikes, mechanical, electric, docks, installed, renting, returning,
 * reportedAt }`. `split` is true when the feed tells mechanical and electric
 * bikes apart (a station lists both kinds, even at 0).
 * @param {object} document
 * @param {Map<string, { bicycle: boolean, electric: boolean }>} [kinds] from parseVehicleTypes
 */
export function parseStatus(document, kinds = new Map()) {
  const stations = new Map();
  let split = false;
  for (const station of document?.data?.stations ?? []) {
    if (station?.station_id === undefined || station.station_id === null) {
      continue;
    }
    const total = count(station.num_bikes_available ?? station.num_vehicles_available);
    let mechanical = 0;
    let electric = 0;
    let bikes = total;
    if (Array.isArray(station.vehicle_types_available)) {
      let others = false;
      let sawMechanical = false;
      let sawElectric = false;
      for (const entry of station.vehicle_types_available) {
        const id = String(entry?.vehicle_type_id ?? '');
        const kind = kinds.get(id) ?? {
          bicycle: !/scooter|moped|car/i.test(id),
          electric: /elec|ebike|e-bike|assist/i.test(id),
        };
        if (!kind.bicycle) {
          others = true;
          continue;
        }
        if (kind.electric) {
          sawElectric = true;
          electric += count(entry.count);
        } else {
          sawMechanical = true;
          mechanical += count(entry.count);
        }
      }
      split ||= sawMechanical && sawElectric;
      bikes = others ? mechanical + electric : Math.max(total, mechanical + electric);
    } else if (station.num_bikes_available_types) {
      const types = typeCounts(station.num_bikes_available_types);
      mechanical = types.mechanical ?? 0;
      electric = types.ebike ?? types.electrical ?? types.electric ?? 0;
      split ||= 'mechanical' in types && ('ebike' in types || 'electrical' in types);
      bikes = Math.max(total, mechanical + electric);
    } else {
      mechanical = total;
    }
    stations.set(String(station.station_id), {
      bikes,
      mechanical,
      electric,
      docks: count(station.num_docks_available),
      installed: flag(station.is_installed),
      renting: flag(station.is_renting),
      returning: flag(station.is_returning),
      reportedAt: reportedAt(station.last_reported),
    });
  }
  return { stations, split };
}
