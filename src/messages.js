// -----------------------------------------------------------------------------
// Texts sent from the container (feature names, action messages, widget
// contents, scene outputs), in the four languages of the Gladys interface.
// Entries are strings or functions of one parameter object. German says "du",
// Spanish "usted". Brand and place names never translate.
// -----------------------------------------------------------------------------

export const INIT_FAILED = {
  en: 'Initialization failed, check the integration logs.',
  fr: "L'initialisation a échoué, consultez les logs de l'intégration.",
  de: 'Initialisierung fehlgeschlagen, sieh dir die Protokolle der Integration an.',
  es: 'La inicialización ha fallado, consulte los registros de la integración.',
};

// Feature names, frozen when the device is created (configured language).
export const NAMES = {
  en: {
    bikes: 'Bikes available',
    mechanical: 'Mechanical bikes',
    electric: 'Electric bikes',
    docks: 'Free docks',
    installed: 'Station in service',
    renting: 'Renting open',
    returning: 'Returns open',
  },
  fr: {
    bikes: 'Vélos disponibles',
    mechanical: 'Vélos mécaniques',
    electric: 'Vélos électriques',
    docks: 'Places libres',
    installed: 'Station en service',
    renting: 'Location possible',
    returning: 'Retour possible',
  },
  de: {
    bikes: 'Verfügbare Räder',
    mechanical: 'Mechanische Räder',
    electric: 'E-Bikes',
    docks: 'Freie Stellplätze',
    installed: 'Station in Betrieb',
    renting: 'Ausleihe möglich',
    returning: 'Rückgabe möglich',
  },
  es: {
    bikes: 'Bicis disponibles',
    mechanical: 'Bicis mecánicas',
    electric: 'Bicis eléctricas',
    docks: 'Anclajes libres',
    installed: 'Estación en servicio',
    renting: 'Préstamo posible',
    returning: 'Devolución posible',
  },
};

// Widget contents and scene outputs.
export const TEXT = {
  en: {
    closed: 'out of service',
    counts: ({ bikes, docks }) =>
      `${bikes} bike${bikes === 1 ? '' : 's'} · ${docks} dock${docks === 1 ? '' : 's'}`,
    countsSplit: ({ mechanical, electric, docks }) =>
      `${mechanical} mech. · ${electric} elec. · ${docks} dock${docks === 1 ? '' : 's'}`,
    sentence: ({ name, bikes, docks }) =>
      `${name}: ${bikes} bike${bikes === 1 ? '' : 's'}, ${docks} free dock${docks === 1 ? '' : 's'}.`,
    sentenceSplit: ({ name, bikes, mechanical, electric, docks }) =>
      `${name}: ${bikes} bike${bikes === 1 ? '' : 's'} (${mechanical} mechanical, ${electric} electric), ${docks} free dock${docks === 1 ? '' : 's'}.`,
    sentenceClosed: ({ name }) => `${name}: out of service, no bike to take.`,
    noReturn: 'Bikes cannot be returned there.',
    pickStation: 'Add a station in the integration, then pick it here.',
    loading: 'Reading the station…',
    gone: 'This station is no longer watched.',
    unavailable: 'The station has not been read yet, try again in a minute.',
    stale: 'feed unavailable',
  },
  fr: {
    closed: 'hors service',
    counts: ({ bikes, docks }) =>
      `${bikes} vélo${bikes > 1 ? 's' : ''} · ${docks} place${docks > 1 ? 's' : ''}`,
    countsSplit: ({ mechanical, electric, docks }) =>
      `${mechanical} méca · ${electric} élec · ${docks} place${docks > 1 ? 's' : ''}`,
    sentence: ({ name, bikes, docks }) =>
      `${name} : ${bikes} vélo${bikes > 1 ? 's' : ''}, ${docks} place${docks > 1 ? 's' : ''} libre${docks > 1 ? 's' : ''}.`,
    sentenceSplit: ({ name, bikes, mechanical, electric, docks }) =>
      `${name} : ${bikes} vélo${bikes > 1 ? 's' : ''} (${mechanical} mécanique${mechanical > 1 ? 's' : ''}, ${electric} électrique${electric > 1 ? 's' : ''}), ${docks} place${docks > 1 ? 's' : ''} libre${docks > 1 ? 's' : ''}.`,
    sentenceClosed: ({ name }) => `${name} : hors service, aucun vélo à prendre.`,
    noReturn: "Impossible d'y rendre un vélo.",
    pickStation: "Ajoutez une station dans l'intégration, puis choisissez-la ici.",
    loading: 'Lecture de la station…',
    gone: "Cette station n'est plus surveillée.",
    unavailable: "La station n'a pas encore été lue, réessayez dans une minute.",
    stale: 'flux indisponible',
  },
  de: {
    closed: 'außer Betrieb',
    counts: ({ bikes, docks }) =>
      `${bikes} ${bikes === 1 ? 'Rad' : 'Räder'} · ${docks} ${docks === 1 ? 'Platz' : 'Plätze'}`,
    countsSplit: ({ mechanical, electric, docks }) =>
      `${mechanical} mech. · ${electric} E · ${docks} ${docks === 1 ? 'Platz' : 'Plätze'}`,
    sentence: ({ name, bikes, docks }) =>
      `${name}: ${bikes} ${bikes === 1 ? 'Rad' : 'Räder'}, ${docks} freie${docks === 1 ? 'r' : ''} Stellpl${docks === 1 ? 'atz' : 'ätze'}.`,
    sentenceSplit: ({ name, bikes, mechanical, electric, docks }) =>
      `${name}: ${bikes} ${bikes === 1 ? 'Rad' : 'Räder'} (${mechanical} mechanisch, ${electric} elektrisch), ${docks} freie${docks === 1 ? 'r' : ''} Stellpl${docks === 1 ? 'atz' : 'ätze'}.`,
    sentenceClosed: ({ name }) => `${name}: außer Betrieb, kein Rad zum Ausleihen.`,
    noReturn: 'Dort kann kein Rad zurückgegeben werden.',
    pickStation: 'Füge in der Integration eine Station hinzu und wähle sie hier aus.',
    loading: 'Station wird gelesen…',
    gone: 'Diese Station wird nicht mehr überwacht.',
    unavailable: 'Die Station wurde noch nicht gelesen, versuch es in einer Minute erneut.',
    stale: 'Feed nicht verfügbar',
  },
  es: {
    closed: 'fuera de servicio',
    counts: ({ bikes, docks }) =>
      `${bikes} bici${bikes === 1 ? '' : 's'} · ${docks} anclaje${docks === 1 ? '' : 's'}`,
    countsSplit: ({ mechanical, electric, docks }) =>
      `${mechanical} mec. · ${electric} eléc. · ${docks} anclaje${docks === 1 ? '' : 's'}`,
    sentence: ({ name, bikes, docks }) =>
      `${name}: ${bikes} bici${bikes === 1 ? '' : 's'}, ${docks} anclaje${docks === 1 ? '' : 's'} libre${docks === 1 ? '' : 's'}.`,
    sentenceSplit: ({ name, bikes, mechanical, electric, docks }) =>
      `${name}: ${bikes} bici${bikes === 1 ? '' : 's'} (${mechanical} mecánica${mechanical === 1 ? '' : 's'}, ${electric} eléctrica${electric === 1 ? '' : 's'}), ${docks} anclaje${docks === 1 ? '' : 's'} libre${docks === 1 ? '' : 's'}.`,
    sentenceClosed: ({ name }) => `${name}: fuera de servicio, ninguna bici disponible.`,
    noReturn: 'No se puede devolver una bici allí.',
    pickStation: 'Añada una estación en la integración y elíjala aquí.',
    loading: 'Leyendo la estación…',
    gone: 'Esta estación ya no está vigilada.',
    unavailable: 'La estación aún no se ha leído, inténtelo de nuevo en un minuto.',
    stale: 'flujo no disponible',
  },
};

// Messages of the configuration actions.
export const REPORTS = {
  en: {
    catalogFailed: ({ reason }) => `The catalog of networks cannot be read (${reason}).`,
    keyNeeded: 'needs a key, not supported',
    noNetworkQuery: 'Type a network, a city or a gbfs.json URL.',
    noNetworkMatch: ({ query }) => `No network matches "${query}".`,
    foundNetworks: ({ count }) => `${count} network(s) found:`,
    addNetworkHint: 'Add one with "Add a network" and the identifier in brackets.',
    ambiguousNetwork: ({ query }) =>
      `Several networks match "${query}": give the identifier in brackets.`,
    keyRefused: ({ name }) => `${name} requires an access key: not supported.`,
    networkKnown: ({ name }) => `${name} is already added.`,
    tooManyNetworks: ({ max }) => `${max} networks at most: remove one first.`,
    noBikes: ({ name }) => `${name} has no bikes (scooters or cars only): not supported.`,
    noStations: ({ name }) =>
      `${name} publishes no stations (free-floating bikes or scooters): not supported.`,
    networkFailed: ({ name, reason }) => `${name} cannot be read (${reason}).`,
    networkAdded: ({ name, count, split }) =>
      `${name} added: ${count} stations${split ? ', mechanical and electric bikes told apart' : ''}. Now find your stations with "Find a station".`,
    networkUpdated: ({ name, count }) => `${name} updated: ${count} stations.`,
    noNetwork: 'Add a network first ("Add a network").',
    unknownNetwork: ({ query, networks }) => `No added network is called "${query}": ${networks}.`,
    noStationMatch: ({ query }) => `No station matches "${query}".`,
    foundStations: ({ count }) => `${count} station(s) found:`,
    noQuery: 'Type a station name, or set the position of your home in Gladys.',
    closestStations: ({ house }) => `The closest stations to ${house}:`,
    addStationHint: 'Add one with "Add a station" and the identifier in brackets.',
    noStationQuery: 'Type the identifier or the name of a station.',
    ambiguousStation: ({ query }) =>
      `Several stations match "${query}": give the identifier in brackets.`,
    stationKnown: ({ name }) => `${name} is already watched.`,
    tooManyStations: ({ max }) => `${max} stations at most: remove one first.`,
    stationAdded: ({ name, network }) =>
      `${network} · ${name} added: create its device in the Discover tab.`,
    notWatched: ({ query }) => `No watched station or network is called "${query}".`,
    stationRemoved: ({ name }) => `${name} is no longer watched (delete its device in Gladys).`,
    networkRemoved: ({ name, count }) =>
      `${name} removed, with its ${count} station(s) (delete their devices in Gladys).`,
    watchedNetworks: ({ count }) => `${count} network(s) added.`,
    stationList: ({ count, date }) => `Station list: ${count} stations, read on ${date}.`,
    stationListMissing: 'Station list not read yet.',
    reading: ({ age, interval, volume }) =>
      `Last reading ${age} s ago, every ${interval} s (up to ${volume} MB per hour).`,
    readingWaiting: 'No reading yet.',
    watchedStations: ({ count }) => `${count} station(s) watched:`,
    lastError: ({ error }) => `Last error: ${error}`,
    noNetworkYet: 'Start with "Find a network", then "Add a network".',
  },
  fr: {
    catalogFailed: ({ reason }) => `Le catalogue des réseaux est illisible (${reason}).`,
    keyNeeded: 'demande une clé, non pris en charge',
    noNetworkQuery: 'Indiquez un réseau, une ville ou une URL gbfs.json.',
    noNetworkMatch: ({ query }) => `Aucun réseau ne correspond à « ${query} ».`,
    foundNetworks: ({ count }) => `${count} réseau(x) trouvé(s) :`,
    addNetworkHint: "Ajoutez-en un avec « Ajouter un réseau » et l'identifiant entre crochets.",
    ambiguousNetwork: ({ query }) =>
      `Plusieurs réseaux correspondent à « ${query} » : indiquez l'identifiant entre crochets.`,
    keyRefused: ({ name }) => `${name} demande une clé d'accès : non pris en charge.`,
    networkKnown: ({ name }) => `${name} est déjà ajouté.`,
    tooManyNetworks: ({ max }) => `${max} réseaux au plus : retirez-en un d'abord.`,
    noBikes: ({ name }) =>
      `${name} n'a pas de vélos (trottinettes ou voitures seulement) : non pris en charge.`,
    noStations: ({ name }) =>
      `${name} ne publie pas de stations (vélos ou trottinettes en free-floating) : non pris en charge.`,
    networkFailed: ({ name, reason }) => `${name} est illisible (${reason}).`,
    networkAdded: ({ name, count, split }) =>
      `${name} ajouté : ${count} stations${split ? ', vélos mécaniques et électriques distingués' : ''}. Cherchez maintenant vos stations avec « Chercher une station ».`,
    networkUpdated: ({ name, count }) => `${name} mis à jour : ${count} stations.`,
    noNetwork: "Ajoutez d'abord un réseau (« Ajouter un réseau »).",
    unknownNetwork: ({ query, networks }) =>
      `Aucun réseau ajouté ne s'appelle « ${query} » : ${networks}.`,
    noStationMatch: ({ query }) => `Aucune station ne correspond à « ${query} ».`,
    foundStations: ({ count }) => `${count} station(s) trouvée(s) :`,
    noQuery: 'Indiquez un nom de station, ou renseignez la position de votre maison dans Gladys.',
    closestStations: ({ house }) => `Les stations les plus proches de ${house} :`,
    addStationHint: "Ajoutez-en une avec « Ajouter une station » et l'identifiant entre crochets.",
    noStationQuery: "Indiquez l'identifiant ou le nom d'une station.",
    ambiguousStation: ({ query }) =>
      `Plusieurs stations correspondent à « ${query} » : indiquez l'identifiant entre crochets.`,
    stationKnown: ({ name }) => `${name} est déjà surveillée.`,
    tooManyStations: ({ max }) => `${max} stations au plus : retirez-en une d'abord.`,
    stationAdded: ({ name, network }) =>
      `${network} · ${name} ajoutée : créez son appareil dans l'onglet Découverte.`,
    notWatched: ({ query }) =>
      `Aucune station ni aucun réseau surveillé ne s'appelle « ${query} ».`,
    stationRemoved: ({ name }) =>
      `${name} n'est plus surveillée (supprimez son appareil dans Gladys).`,
    networkRemoved: ({ name, count }) =>
      `${name} retiré, avec ses ${count} station(s) (supprimez leurs appareils dans Gladys).`,
    watchedNetworks: ({ count }) => `${count} réseau(x) ajouté(s).`,
    stationList: ({ count, date }) => `Liste des stations : ${count} stations, lue le ${date}.`,
    stationListMissing: 'Liste des stations pas encore lue.',
    reading: ({ age, interval, volume }) =>
      `Dernière lecture il y a ${age} s, toutes les ${interval} s (jusqu'à ${volume} Mo par heure).`,
    readingWaiting: 'Aucune lecture pour le moment.',
    watchedStations: ({ count }) => `${count} station(s) surveillée(s) :`,
    lastError: ({ error }) => `Dernière erreur : ${error}`,
    noNetworkYet: 'Commencez par « Chercher un réseau », puis « Ajouter un réseau ».',
  },
  de: {
    catalogFailed: ({ reason }) => `Der Netzkatalog ist nicht lesbar (${reason}).`,
    keyNeeded: 'braucht einen Schlüssel, nicht unterstützt',
    noNetworkQuery: 'Gib ein Netz, eine Stadt oder eine gbfs.json-URL ein.',
    noNetworkMatch: ({ query }) => `Kein Netz passt zu „${query}“.`,
    foundNetworks: ({ count }) => `${count} Netz(e) gefunden:`,
    addNetworkHint: 'Füge eines mit „Netz hinzufügen“ und der Kennung in Klammern hinzu.',
    ambiguousNetwork: ({ query }) =>
      `Mehrere Netze passen zu „${query}“: gib die Kennung in Klammern an.`,
    keyRefused: ({ name }) => `${name} verlangt einen Zugangsschlüssel: nicht unterstützt.`,
    networkKnown: ({ name }) => `${name} ist schon hinzugefügt.`,
    tooManyNetworks: ({ max }) => `Höchstens ${max} Netze: entferne zuerst eines.`,
    noBikes: ({ name }) => `${name} hat keine Räder (nur Roller oder Autos): nicht unterstützt.`,
    noStations: ({ name }) =>
      `${name} veröffentlicht keine Stationen (Free-Floating-Räder oder -Roller): nicht unterstützt.`,
    networkFailed: ({ name, reason }) => `${name} ist nicht lesbar (${reason}).`,
    networkAdded: ({ name, count, split }) =>
      `${name} hinzugefügt: ${count} Stationen${split ? ', mechanische Räder und E-Bikes getrennt' : ''}. Suche jetzt deine Stationen mit „Station suchen“.`,
    networkUpdated: ({ name, count }) => `${name} aktualisiert: ${count} Stationen.`,
    noNetwork: 'Füge zuerst ein Netz hinzu („Netz hinzufügen“).',
    unknownNetwork: ({ query, networks }) =>
      `Kein hinzugefügtes Netz heißt „${query}“: ${networks}.`,
    noStationMatch: ({ query }) => `Keine Station passt zu „${query}“.`,
    foundStations: ({ count }) => `${count} Station(en) gefunden:`,
    noQuery: 'Gib einen Stationsnamen ein oder trage die Position deines Zuhauses in Gladys ein.',
    closestStations: ({ house }) => `Die nächsten Stationen bei ${house}:`,
    addStationHint: 'Füge eine mit „Station hinzufügen“ und der Kennung in Klammern hinzu.',
    noStationQuery: 'Gib die Kennung oder den Namen einer Station ein.',
    ambiguousStation: ({ query }) =>
      `Mehrere Stationen passen zu „${query}“: gib die Kennung in Klammern an.`,
    stationKnown: ({ name }) => `${name} wird schon überwacht.`,
    tooManyStations: ({ max }) => `Höchstens ${max} Stationen: entferne zuerst eine.`,
    stationAdded: ({ name, network }) =>
      `${network} · ${name} hinzugefügt: lege das Gerät im Tab „Entdecken“ an.`,
    notWatched: ({ query }) => `Keine überwachte Station und kein Netz heißt „${query}“.`,
    stationRemoved: ({ name }) => `${name} wird nicht mehr überwacht (lösche das Gerät in Gladys).`,
    networkRemoved: ({ name, count }) =>
      `${name} entfernt, mit seinen ${count} Station(en) (lösche ihre Geräte in Gladys).`,
    watchedNetworks: ({ count }) => `${count} Netz(e) hinzugefügt.`,
    stationList: ({ count, date }) => `Stationsliste: ${count} Stationen, gelesen am ${date}.`,
    stationListMissing: 'Stationsliste noch nicht gelesen.',
    reading: ({ age, interval, volume }) =>
      `Letzte Abfrage vor ${age} s, alle ${interval} s (bis zu ${volume} MB pro Stunde).`,
    readingWaiting: 'Noch keine Abfrage.',
    watchedStations: ({ count }) => `${count} Station(en) überwacht:`,
    lastError: ({ error }) => `Letzter Fehler: ${error}`,
    noNetworkYet: 'Beginne mit „Netz suchen“, dann „Netz hinzufügen“.',
  },
  es: {
    catalogFailed: ({ reason }) => `El catálogo de redes no se puede leer (${reason}).`,
    keyNeeded: 'requiere una clave, no compatible',
    noNetworkQuery: 'Indique una red, una ciudad o una URL gbfs.json.',
    noNetworkMatch: ({ query }) => `Ninguna red corresponde a «${query}».`,
    foundNetworks: ({ count }) => `${count} red(es) encontrada(s):`,
    addNetworkHint: 'Añada una con «Añadir una red» y el identificador entre corchetes.',
    ambiguousNetwork: ({ query }) =>
      `Varias redes corresponden a «${query}»: indique el identificador entre corchetes.`,
    keyRefused: ({ name }) => `${name} requiere una clave de acceso: no compatible.`,
    networkKnown: ({ name }) => `${name} ya está añadida.`,
    tooManyNetworks: ({ max }) => `${max} redes como máximo: quite una primero.`,
    noBikes: ({ name }) => `${name} no tiene bicis (solo patinetes o coches): no compatible.`,
    noStations: ({ name }) =>
      `${name} no publica estaciones (bicis o patinetes sin base fija): no compatible.`,
    networkFailed: ({ name, reason }) => `${name} no se puede leer (${reason}).`,
    networkAdded: ({ name, count, split }) =>
      `${name} añadida: ${count} estaciones${split ? ', bicis mecánicas y eléctricas diferenciadas' : ''}. Busque ahora sus estaciones con «Buscar una estación».`,
    networkUpdated: ({ name, count }) => `${name} actualizada: ${count} estaciones.`,
    noNetwork: 'Añada primero una red («Añadir una red»).',
    unknownNetwork: ({ query, networks }) =>
      `Ninguna red añadida se llama «${query}»: ${networks}.`,
    noStationMatch: ({ query }) => `Ninguna estación corresponde a «${query}».`,
    foundStations: ({ count }) => `${count} estación(es) encontrada(s):`,
    noQuery: 'Indique un nombre de estación, o la posición de su casa en Gladys.',
    closestStations: ({ house }) => `Las estaciones más cercanas a ${house}:`,
    addStationHint: 'Añada una con «Añadir una estación» y el identificador entre corchetes.',
    noStationQuery: 'Indique el identificador o el nombre de una estación.',
    ambiguousStation: ({ query }) =>
      `Varias estaciones corresponden a «${query}»: indique el identificador entre corchetes.`,
    stationKnown: ({ name }) => `${name} ya está vigilada.`,
    tooManyStations: ({ max }) => `${max} estaciones como máximo: quite una primero.`,
    stationAdded: ({ name, network }) =>
      `${network} · ${name} añadida: cree su dispositivo en la pestaña Descubrir.`,
    notWatched: ({ query }) => `Ninguna estación ni red vigilada se llama «${query}».`,
    stationRemoved: ({ name }) => `${name} ya no está vigilada (elimine su dispositivo en Gladys).`,
    networkRemoved: ({ name, count }) =>
      `${name} quitada, con sus ${count} estación(es) (elimine sus dispositivos en Gladys).`,
    watchedNetworks: ({ count }) => `${count} red(es) añadida(s).`,
    stationList: ({ count, date }) => `Lista de estaciones: ${count} estaciones, leída el ${date}.`,
    stationListMissing: 'Lista de estaciones aún no leída.',
    reading: ({ age, interval, volume }) =>
      `Última lectura hace ${age} s, cada ${interval} s (hasta ${volume} MB por hora).`,
    readingWaiting: 'Aún ninguna lectura.',
    watchedStations: ({ count }) => `${count} estación(es) vigilada(s):`,
    lastError: ({ error }) => `Último error: ${error}`,
    noNetworkYet: 'Empiece con «Buscar una red» y luego «Añadir una red».',
  },
};

/** One text of a table, in a language (English when missing). */
export function say(table, language, key, params = {}) {
  const entry = table[language]?.[key] ?? table.en[key];
  return typeof entry === 'function' ? entry(params) : entry;
}

/** The same text in every language of the table: `{ en, fr, de, es }`. */
export function render(table, key, params = {}) {
  return Object.fromEntries(
    Object.keys(table).map((language) => [language, say(table, language, key, params)]),
  );
}

/** Joins rendered messages (or plain strings), language by language, one per line. */
export function lines(...messages) {
  const languages = Object.keys(messages.find((m) => typeof m === 'object' && m) ?? { en: '' });
  return Object.fromEntries(
    languages.map((language) => [
      language,
      messages
        .filter((message) => message !== null && message !== undefined)
        .map((message) => (typeof message === 'string' ? message : message[language]))
        .join('\n'),
    ]),
  );
}
