// -----------------------------------------------------------------------------
// Integration configuration: defaults (they mirror the `default` values of the
// manifest `config_schema`, see test/manifest.test.js) and normalization, so
// the rest of the code never deals with strings, blanks or `undefined`.
//
// The networks and stations are not configuration fields: the configuration
// actions add and remove them (src/service.js), and they live in /data.
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

// Seconds between two readings of the stations. The integration drives its
// own timer (devices are published with should_poll: false); a network's
// `ttl` may slow it down (src/network.js). One minute at least: the feeds of
// the big networks weigh up to 1 MB.
export const REFRESH_INTERVALS = ['60', '120', '300', '600'];

export const DEFAULT_CONFIG = {
  language: 'fr',
  refresh_interval: '60',
};

/**
 * @param {Record<string, unknown>} raw the configuration returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const interval = REFRESH_INTERVALS.includes(String(source.refresh_interval))
    ? String(source.refresh_interval)
    : DEFAULT_CONFIG.refresh_interval;
  return {
    language: LANGUAGES.includes(source.language) ? source.language : DEFAULT_CONFIG.language,
    refreshSeconds: Number(interval),
  };
}
