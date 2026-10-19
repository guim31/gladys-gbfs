// -----------------------------------------------------------------------------
// The official catalog of GBFS feeds, systems.csv of MobilityData
// (https://github.com/MobilityData/gbfs): about 1,200 shared mobility systems
// of the world, with their gbfs.json. Bikes, but also scooters and cars:
// the systems without stations are refused when added (src/network.js).
//
// Read on demand (search, add a network), kept a day in memory and in /data,
// so a GitHub outage still finds the networks.
// -----------------------------------------------------------------------------

import { getBuffer } from './http.js';
import { normalize } from './search.js';

export const CATALOG_URL = 'https://raw.githubusercontent.com/MobilityData/gbfs/master/systems.csv';
export const CATALOG_MAX_AGE_MS = 24 * 3600 * 1000;

/** Parses a whole CSV text (RFC 4180: quoted fields, doubled quotes, quoted line breaks). */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') {
        i += 1;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim()));
}

/**
 * systems.csv → [{ id, name, location, country, url, versions, auth, haystack }].
 * @param {string} text
 */
export function reduceCatalog(text) {
  const [header, ...rows] = parseCsv(String(text ?? '').replace(/^\uFEFF/, ''));
  if (!header) {
    return [];
  }
  const column = (name) => header.findIndex((cell) => cell.trim() === name);
  const at = {
    country: column('Country Code'),
    name: column('Name'),
    location: column('Location'),
    id: column('System ID'),
    url: column('Auto-Discovery URL'),
    versions: column('Supported Versions'),
    auth: column('Authentication Type'),
  };
  if (at.id < 0 || at.url < 0) {
    return [];
  }
  const entries = [];
  for (const cells of rows) {
    const get = (key) => (at[key] >= 0 ? String(cells[at[key]] ?? '').trim() : '');
    const entry = {
      id: get('id'),
      name: get('name') || get('id'),
      location: get('location'),
      country: get('country').toUpperCase(),
      url: get('url'),
      versions: get('versions')
        .split(/[;,]/)
        .map((version) => version.trim())
        .filter(Boolean),
      auth: Boolean(get('auth')),
    };
    if (!entry.id || !/^https?:\/\//.test(entry.url)) {
      continue;
    }
    entry.haystack = normalize(`${entry.name} ${entry.location} ${entry.id} ${entry.country}`);
    entries.push(entry);
  }
  return entries;
}

/**
 * Catalog entries matching a query: every word of the query starts a word of
 * the name, the place, the id or the country code. Exact names first.
 */
export function searchCatalog(entries, query) {
  const wanted = normalize(query);
  if (!wanted) {
    return [];
  }
  const words = wanted.split(' ');
  const matches = [];
  for (const entry of entries) {
    const hay = entry.haystack.split(' ');
    if (!words.every((word) => hay.some((candidate) => candidate.startsWith(word)))) {
      continue;
    }
    const name = normalize(entry.name);
    const rank =
      name === wanted || normalize(entry.id) === wanted ? 0 : name.startsWith(wanted) ? 1 : 2;
    matches.push({ entry, rank });
  }
  return matches
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        Number(a.entry.auth) - Number(b.entry.auth) ||
        a.entry.name.localeCompare(b.entry.name, 'fr'),
    )
    .map(({ entry }) => entry);
}

export class Catalog {
  /**
   * @param {object} options
   * @param {typeof fetch} options.fetch
   * @param {() => number} [options.now]
   * @param {string} [options.url]
   * @param {import('./store.js').JsonFile} [options.cache] the copy kept in /data
   */
  constructor({ fetch, now = Date.now, url = CATALOG_URL, cache = null }) {
    this.fetch = fetch;
    this.now = now;
    this.url = url;
    this.cache = cache;
    this.entries = null;
    this.readAt = null;
  }

  async load() {
    if (this.entries && this.now() - this.readAt < CATALOG_MAX_AGE_MS) {
      return this.entries;
    }
    if (!this.entries && this.cache) {
      const saved = await this.cache.load();
      if (Array.isArray(saved?.entries) && this.now() - saved.readAt < CATALOG_MAX_AGE_MS) {
        this.entries = saved.entries;
        this.readAt = saved.readAt;
        return this.entries;
      }
      if (Array.isArray(saved?.entries)) {
        // Kept as a fallback should the download fail.
        this.entries = saved.entries;
        this.readAt = saved.readAt;
      }
    }
    try {
      const { body } = await getBuffer(this.fetch, this.url, { maxBytes: 5e6, timeoutMs: 30000 });
      const entries = reduceCatalog(body.toString('utf8'));
      if (entries.length === 0) {
        throw new Error('the catalog is empty');
      }
      this.entries = entries;
      this.readAt = this.now();
      await this.cache?.save({ readAt: this.readAt, entries });
    } catch (err) {
      if (!this.entries) {
        throw err;
      }
      // A stale catalog is better than none; tried again in an hour.
      this.readAt = this.now() - CATALOG_MAX_AGE_MS + 3600 * 1000;
    }
    return this.entries;
  }

  /** The entry of a system id, or of a gbfs.json URL. */
  async find(idOrUrl) {
    const entries = await this.load();
    const wanted = String(idOrUrl ?? '').trim();
    return (
      entries.find((entry) => entry.id.toLowerCase() === wanted.toLowerCase()) ??
      entries.find((entry) => entry.url === wanted) ??
      null
    );
  }
}
