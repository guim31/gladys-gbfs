// -----------------------------------------------------------------------------
// Dashboard widget (manifest `widgets`, Gladys 5.1+).
//
// - stations: the watched stations as a departure board, one status row each
//   ("Préfecture" / "3 méca · 2 élec · 12 places"), red without bikes, orange
//   with two or fewer, grey out of service. A single station shows live tiles
//   instead (bikes, mechanical, electric, docks).
//
// Budget of the core: 8 components, 2 texts, 1 status (10 rows).
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { clip } from './devices.js';
import { NAMES, TEXT, say } from './messages.js';

export const MAX_ROWS = 10;
const MAX_LABEL = 40;
const TILE_ICONS = { bikes: 'disc', mechanical: 'disc', electric: 'zap', docks: 'log-in' };

const t = (language, key, params) => say(TEXT, language, key, params);

export function stationColor(status) {
  if (!status.installed || !status.renting) {
    return WIDGET_COLORS.NEUTRAL;
  }
  if (status.bikes === 0) {
    return WIDGET_COLORS.DANGER;
  }
  return status.bikes <= 2 ? WIDGET_COLORS.WARNING : WIDGET_COLORS.SUCCESS;
}

function stationsContent(service, { settings, language }) {
  const ttl = Math.max(60, service.config.refreshSeconds);
  const chosen = Array.isArray(settings?.stations) ? settings.stations : [];
  const stations =
    chosen.length > 0
      ? chosen.map((id) => service.stationOfDevice(id)).filter(Boolean)
      : service.watch.stations;
  const shown = stations.slice(0, MAX_ROWS);
  if (shown.length === 0) {
    const key = chosen.length > 0 ? 'gone' : 'pickStation';
    return { ttl_seconds: ttl, components: [{ type: 'text', text: t(language, key) }] };
  }
  if (shown.length === 1) {
    const [station] = shown;
    const network = service.networkOf(station);
    const deviceId = service.stationDeviceId(station);
    if (network && service.isCreated(deviceId)) {
      const names = NAMES[language] ?? NAMES.en;
      const keys = network.info.split ? ['mechanical', 'electric', 'docks'] : ['bikes', 'docks'];
      const components = [{ type: 'text', variant: 'heading', text: clip(station.name, 40) }];
      for (const key of keys) {
        components.push({
          type: 'value',
          label: clip(names[key], 24),
          icon: TILE_ICONS[key],
          device_feature: `${deviceId}:${key}`,
        });
      }
      const status = service.statusOf(station);
      if (status && (!status.installed || !status.renting)) {
        components.push({ type: 'text', variant: 'caption', text: t(language, 'closed') });
      }
      return { ttl_seconds: ttl, components };
    }
  }
  return {
    ttl_seconds: ttl,
    components: [
      {
        type: 'status',
        items: shown.map((station) => {
          const network = service.networkOf(station);
          const status = service.statusOf(station);
          const label = clip(
            service.watch.networks.length > 1 && network
              ? `${network.info.name} · ${station.name}`
              : station.name,
            MAX_LABEL,
          );
          if (!status || !network) {
            return { label, value: '—', color: WIDGET_COLORS.NEUTRAL };
          }
          return {
            label,
            value: clip(service.countsText(network, status, language), 40),
            color: network.error ? WIDGET_COLORS.NEUTRAL : stationColor(status),
          };
        }),
      },
    ],
  };
}

export const WIDGETS = {
  stations: { get: stationsContent },
};
