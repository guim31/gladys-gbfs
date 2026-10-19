# Gladys Bike sharing (GBFS)

External integration for [Gladys Assistant](https://gladysassistant.com): the
**bikes available** and **free docks** of your bike sharing stations, for any
network publishing the open [GBFS](https://github.com/MobilityData/gbfs)
standard (versions 1.0 to 3.0): Vélib' Métropole, Vélo'v, Naolib, V'lille,
VélôToulouse, Villo!, Citi Bike, BiciMAD and about a thousand more from the
MobilityData catalog. **No account, no key.**

It complements the city-specific integrations (Tisséo, Le Vélo in Bordeaux,
STM/BIXI in Montréal, TCL in Lyon), for every other network.

Unofficial: not affiliated with MobilityData nor with any bike sharing
operator. Tested against the real feeds of five networks, not yet on many
Gladys installations: feedback welcome.

User documentation: [English](docs/en.md) · [français](docs/fr.md) ·
[Deutsch](docs/de.md) · [español](docs/es.md).

## What you get in Gladys

| Kind                  | Content                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------- |
| Devices               | one per watched station: bikes, mechanical, electric (when told apart), free docks, 3 flags  |
| Dashboard widget      | "Bike stations": a board of your stations, or live tiles for one                             |
| Scene triggers        | bikes running out / back, docks running out / free again, thresholds 0 to 10                 |
| Scene action          | read a station: a sentence ready to send, and numbers for "Continue only if"                 |
| Configuration actions | find / add a network (catalog or `gbfs.json` URL), find / add a station (name, number, home) |

Requires Gladys **5.2.0** or later (dynamic "house" select).

## Installation

In Gladys: **Integrations → Install from GitHub**, then
`https://github.com/guim31/gladys-gbfs`. The integration asks for the
position of your houses, used only to list the stations closest to home.

## How it works

- Catalog: `systems.csv` of MobilityData, read on demand and kept a day.
- Station list (`station_information`): when a network is added, then at most
  once a day, cached in `/data`.
- Station status (`station_status`): at the configured pace (1 minute at
  least), never faster than the feed's `ttl` (capped at 5 minutes), with
  conditional requests when the server supports them. 429/503 answers are
  respected.
- Devices are published with `should_poll: false`: the container runs its own
  timer.

## Limitations

- Stations only: free-floating systems are refused.
- Feeds that require a key or a token are not supported.
- Up to 5 networks and 30 stations.

## Development

```bash
npm install
npm test               # node --test, no network access
npm run lint           # ESLint
npm run format:check   # Prettier, as the CI runs it
npx github:GladysAssistant/integration-store .   # store admission checks
```

See [CLAUDE.md](CLAUDE.md) for the architecture and the conventions. The
test fixtures are real feeds (Vélib' Métropole, Naolib, V'lille, Vélibéo,
Citi Bike) reduced to a few stations, and a sample of the MobilityData
catalog.

## Credits

- [GBFS](https://github.com/MobilityData/gbfs) and its catalog: MobilityData
  and the GBFS contributors.
- Same use case as the Home Assistant `citybikes` platform and the `gbfs`
  HACS integration (no code taken from them).
- Built from the official
  [integration template](https://github.com/GladysAssistant/integration-template-js).
- Station data belongs to each operator, under its own licence.

## License

[Apache 2.0](LICENSE).
