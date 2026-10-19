// -----------------------------------------------------------------------------
// The dashboard widget and the scene action, on the real (reduced) feeds.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WIDGET_COLORS, validateWidgetContent } from '@gladysassistant/integration-sdk';
import { action, create, createWorld, cycle, feedUrl, setStatus } from './helpers/world.js';

const GODARD = '213688169';

async function world(t, networks = ['Paris']) {
  const w = await createWorld({ networks });
  t.after(() => w.app.stop());
  return w;
}

const widget = async (w, settings = {}, language = 'fr') => {
  const ack = await w.fake.widgetGet('stations', { settings, language });
  assert.equal(ack.success, true, ack.error);
  const { content } = ack.data;
  assert.deepEqual(validateWidgetContent(content), [], JSON.stringify(content));
  return content;
};

test('no station yet: the widget says how to add one', async (t) => {
  const w = await world(t);
  const content = await widget(w);
  assert.deepEqual(content.components, [
    { type: 'text', text: "Ajoutez une station dans l'intégration, puis choisissez-la ici." },
  ]);
});

test('several stations: one status row each, colored by the bikes left', async (t) => {
  const w = await world(t);
  for (const station of [GODARD, '48800374', '21584689525']) {
    await action(w, 'add_station', { station });
  }
  const content = await widget(w);
  assert.equal(content.ttl_seconds, 60);
  assert.deepEqual(content.components[0].items, [
    {
      label: 'Benjamin Godard - Victor Hugo',
      value: '21 méca · 4 élec · 10 places',
      color: WIDGET_COLORS.SUCCESS,
    },
    {
      label: "Place de l'Hôtel de Ville",
      value: '3 méca · 1 élec · 9 places',
      color: WIDGET_COLORS.SUCCESS,
    },
    { label: 'Station Tour de France', value: 'hors service', color: WIDGET_COLORS.NEUTRAL },
  ]);
  setStatus(w, 'velib', '48800374', {
    num_bikes_available: 1,
    num_bikes_available_types: [{ mechanical: 1 }, { ebike: 0 }],
  });
  await cycle(w, 300);
  const english = await widget(w, {}, 'en');
  assert.deepEqual(english.components[0].items[1], {
    label: "Place de l'Hôtel de Ville",
    value: '1 mech. · 0 elec. · 9 docks',
    color: WIDGET_COLORS.WARNING,
  });
});

test('one created station: live tiles bound to its features', async (t) => {
  const w = await world(t);
  await action(w, 'add_station', { station: GODARD });
  const device = await create(w, 'Benjamin Godard');
  const content = await widget(w, { stations: [device.external_id] });
  assert.deepEqual(
    content.components.map((c) => c.type),
    ['text', 'value', 'value', 'value'],
  );
  const ids = new Set(device.features.map((f) => f.external_id));
  for (const component of content.components.filter((c) => c.type === 'value')) {
    assert.ok(ids.has(component.device_feature), component.device_feature);
  }
});

test('several networks: the rows carry the network name', async (t) => {
  const w = await world(t, ['Paris', 'nantes']);
  await action(w, 'add_station', { station: GODARD });
  await action(w, 'add_station', { station: '1', network: 'nantes' });
  const content = await widget(w);
  assert.deepEqual(
    content.components[0].items.map((item) => [item.label, item.value]),
    [
      ["Vélib' Metropole · Benjamin Godard - Vi…", '21 méca · 4 élec · 10 places'],
      ['Naolib · Préfecture', '4 vélos · 29 places'],
    ],
  );
});

test('the scene action: a sentence and numbers, in the configured language', async (t) => {
  const w = await world(t, ['Paris', 'nantes']);
  await action(w, 'add_station', { station: GODARD });
  await action(w, 'add_station', { station: '1', network: 'nantes' });
  const godard = await create(w, 'Benjamin Godard');
  const prefecture = await create(w, 'Préfecture');
  const read = async (device) => {
    const ack = await w.fake.sceneAction('get_station', { station: device.external_id });
    assert.equal(ack.success, true, ack.error);
    return ack.data.outputs;
  };
  assert.deepEqual(await read(godard), {
    sentence:
      'Benjamin Godard - Victor Hugo : 25 vélos (21 mécaniques, 4 électriques), 10 places libres.',
    station_name: 'Benjamin Godard - Victor Hugo',
    bikes: 25,
    mechanical: 21,
    electric: 4,
    docks: 10,
    renting: 1,
    returning: 1,
  });
  assert.equal((await read(prefecture)).sentence, 'Préfecture : 4 vélos, 29 places libres.');
  setStatus(w, 'nantes', '1', { is_returning: false });
  await cycle(w, 60);
  assert.equal(
    (await read(prefecture)).sentence,
    "Préfecture : 4 vélos, 29 places libres. Impossible d'y rendre un vélo.",
  );
  const gone = await w.fake.sceneAction('get_station', { station: 'ext:nothing' });
  assert.equal(gone.success, false);
  assert.match(gone.error, /plus surveillée/);
});

test('a feed down for long: the widget and the scene action do not show old values', async (t) => {
  const w = await world(t, ['nantes']);
  await action(w, 'add_station', { station: '1' });
  await action(w, 'add_station', { station: '3' });
  const prefecture = await create(w, 'Préfecture');
  w.network.routes[feedUrl('nantes', 'station_status')] = 503;
  for (let i = 0; i < 4; i += 1) {
    await cycle(w, 400);
  }
  const content = await widget(w);
  assert.deepEqual(
    content.components[0].items.map((item) => item.value),
    ['flux indisponible', 'flux indisponible'],
  );
  const read = await w.fake.sceneAction('get_station', { station: prefecture.external_id });
  assert.equal(read.success, false);
  assert.match(read.error, /pas encore été lue/);
});
