// -----------------------------------------------------------------------------
// Scene actions (manifest `scene_actions`, Gladys 5.1+).
//
// - get_station: the bikes and docks of a watched station, as numbers for a
//   "Continue only if" step and as a sentence ready for a message or a
//   speaker ("Préfecture : 4 vélos (3 mécaniques, 1 électrique), 29 places
//   libres.").
//
// A scene action does not receive the user's language: the sentence follows
// the `language` of the configuration. Outputs are numbers, never booleans:
// the core's "Continue only if" compares with ===.
// -----------------------------------------------------------------------------

import { TEXT, say } from './messages.js';

export class SceneError extends Error {}

export const SCENE_ACTIONS = {
  async get_station(service, { fields }) {
    const language = service.config.language;
    const station = service.stationOfDevice(fields.station);
    if (!station) {
      throw new SceneError(say(TEXT, language, 'gone'));
    }
    const status = service.statusOf(station);
    if (!status) {
      throw new SceneError(say(TEXT, language, 'unavailable'));
    }
    return {
      sentence: service.sentence(station, status, language),
      station_name: station.name,
      bikes: status.bikes,
      mechanical: status.mechanical,
      electric: status.electric,
      docks: status.docks,
      renting: status.installed && status.renting ? 1 : 0,
      returning: status.installed && status.returning ? 1 : 0,
    };
  },
};
