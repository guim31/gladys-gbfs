# Bike sharing (GBFS)

The **bikes available** and the **free docks** of your bike sharing stations,
for **any network** that publishes its data in the open **GBFS** standard
(General Bikeshare Feed Specification, versions 1.0 to 3.0): Vélib'
Métropole (Paris), Vélo'v (Lyon), Naolib (Nantes), V'lille, VélôToulouse,
Villo! (Brussels), Citi Bike (New York), BiciMAD (Madrid) and about a
thousand more, listed in the official catalog of MobilityData. **No account,
no key.**

A city with a dedicated Gladys integration may be better served by it: Tisséo
(Toulouse, VélôToulouse included), Le Vélo (Bordeaux), STM (Montréal, BIXI
included), TCL (Lyon). This one is the generic complement, for every other
network.

This integration is a community project, not affiliated with MobilityData nor
with any bike sharing operator. It was tested against the real feeds of five
networks, not yet on many Gladys installations: feedback welcome.

## What you get

- **One device per watched station**: bikes available, mechanical and
  electric bikes (when the network tells them apart), free docks, and whether
  the station is in service, lets you take a bike, and lets you return one.
- **"Bike stations" widget**: your stations like a departure board, or live
  tiles for a single station.
- **Four scene triggers**: bikes running out, bikes back, docks running out,
  docks free again, at the number you choose.
- **"Read a bike station" scene action**, with a sentence ready to send
  ("Préfecture: 4 bikes, 29 free docks.").
- Up to **5 networks** and **30 stations**.

## Requirements

- Gladys Assistant **5.2.0** or later.
- Internet access from the Gladys machine (the feeds are online).
- For the search around your home: the **position of your house** set in
  Gladys (Settings → Houses). The integration asks for it at install time.

## Installation

1. In Gladys, open **Integrations → Install from GitHub**.
2. Enter `https://github.com/guim31/gladys-gbfs`.
3. Accept the requested access (the position of your houses, used only to
   find the closest stations).

## Configuration

### Settings

- **Language of the texts**: feature names, station names (when the network
  translates them) and the sentences sent to scenes. Feature names are frozen
  when a device is created.
- **Refresh interval**: 1, 2, 5 or 10 minutes. The integration never reads a
  network faster than its `ttl` allows (up to 5 minutes, see "Data, refresh
  and bandwidth").

### Add a network

1. Run **Find a network** with a network name, a city or a country code
   (`Vélib'`, `Lyon`, `BE`). Each result shows its identifier in brackets,
   for example `Vélib' Metropole — Paris, FR [Paris] · GBFS 1.0`.
2. Run **Add a network** with that identifier (or the exact name). The
   integration reads the station list and tells you how many stations it
   found, and whether it tells mechanical and electric bikes apart.

A network missing from the catalog: give the URL of its `gbfs.json`. The
catalog also lists scooters, cars and free-floating bikes: only systems
**with stations** can be added, and systems that require an access key are
not supported.

### Add a station

1. Run **Find a station**: empty, it lists the ten stations closest to your
   home, with their distance and their current bikes; with a name or a station
   number (Vélib' numbers such as `16107` work), the matching stations.
2. Run **Add a station** with the identifier in brackets.
3. Open the **Discover** tab of the integration and create the device.

With several networks, fill in the **Network** field to search only one of
them. With several houses, pick the **House** to search around.

### Remove, check the feeds

- **Remove** stops watching a station (by name or identifier) or a whole
  network with its stations. The devices stay in Gladys until you delete
  them.
- **Status** shows each network: its GBFS version, its station list, the age
  of the last reading, the pace, the volume downloaded per hour, the watched
  stations and the last error.

## Devices

### Station

| Feature            | Type           | Meaning                                          |
| ------------------ | -------------- | ------------------------------------------------ |
| Bikes available    | counter        | bicycles you can take (scooters are not counted) |
| Mechanical bikes   | counter        | only when the network tells them apart           |
| Electric bikes     | counter        | idem                                             |
| Free docks         | counter        | places to return a bike                          |
| Station in service | input (binary) | 1 = installed and working                        |
| Renting open       | input (binary) | 1 = a bike can be taken                          |
| Returns open       | input (binary) | 1 = a bike can be returned                       |

The counters go from 0 to the capacity of the station: a gauge or a chart is
scaled on it.

## Dashboard widget

**Bike stations**: pick the stations to show (empty: all of them, ten at
most). Each row shows the mechanical and electric bikes and the free docks,
green, orange at two bikes or fewer, red without bikes, grey out of service.
With a single station whose device is created, the widget shows live tiles
instead.

## Scene triggers

- **Bikes running out at a station**: the bikes (any, mechanical or electric)
  drop to the chosen number or below (0, 1, 2, 3, 5 or 10).
- **Bikes back at a station**: they rise above the chosen number again.
- **Docks running out at a station**: the free docks drop to the chosen
  number or below.
- **Docks free again at a station**: they rise above it again.

Each trigger gives the station name and the bikes (all, mechanical, electric)
and free docks at that moment to the scene. Mechanical and electric
thresholds only fire on networks that tell them apart.

## Scene action

**Read a bike station** returns a sentence ready for a message or a speaker
("Benjamin Godard - Victor Hugo: 25 bikes (21 mechanical, 4 electric), 10
free docks."), plus numbers usable in a "Continue only if" step: bikes,
mechanical, electric, docks, renting (1/0), returning (1/0).

## Scene examples

- **Before leaving for work**: at 8:00 on weekdays, read the station next to
  home and send the sentence on Telegram.
- **No more electric bikes**: "Bikes running out", electric bikes, at most 0,
  at your usual station: a notification, so you leave a bit earlier.
- **Returning in the evening**: "Docks running out", at most 2, at the
  station near your office: be warned before you ride there.

## Data, refresh and bandwidth

- The **catalog** of networks (`systems.csv` of MobilityData, 180 kB) is read
  only for a search or an addition, and kept a day.
- The **station list** of each network is read when it is added, then at most
  once a day, and kept in the integration's `/data` volume.
- The **station status** is read at the chosen interval, one minute at least,
  never faster than the `ttl` the network announces. A `ttl` longer than five
  minutes is capped: Vélib' announces an hour for data refreshed every
  minute, it is read every 5 minutes. When the server supports it, an
  unchanged feed is not downloaded again.
- Volume: from a few kB per reading (small networks) to about 1 MB (Citi
  Bike); Vélib' weighs about 460 kB per reading. The **Status** action shows
  the volume per hour of your networks.
- A server answering "429 Too Many Requests" or "503" is left alone for the
  time it asks.
- The data belongs to each operator and is published under its own licence
  (often ODbL or an open licence): check it before reusing it elsewhere.

## Troubleshooting

- **"publishes no stations"**: the system is free-floating (bikes or scooters
  parked anywhere): it has no stations to watch.
- **"cannot be read (… HTTP 404)"**: the operator moved its feeds. Search the
  network again, or give the current URL of its `gbfs.json`.
- **No mechanical/electric features**: the network does not tell them apart
  in its feed (Naolib, V'lille…), or has electric bikes only.
- **A device shows old values**: run **Status**; the last error tells why. The
  states come back by themselves once the feed answers again.
- **The search around the home is empty**: set the position of your house in
  Gladys, or search by name.
- **`docker logs`**: quiet by default; set `LOG_LEVEL=debug` to see every
  reading.

## Limitations

- Stations only: free-floating vehicles (`free_bike_status`,
  `vehicle_status`) are not read.
- Feeds that need a key or a token are not supported.
- Feature names and the list of features are set when the device is created:
  a network that starts telling bikes apart later proposes "Update" in the
  Discover tab.
- Up to 5 networks and 30 stations, ten rows in the widget.
- The quality of the data is the operator's: some networks update their feed
  every few minutes only.

## Credits

- [GBFS](https://github.com/MobilityData/gbfs) and its catalog of systems:
  MobilityData and the GBFS contributors (Apache 2.0 for the specification).
- Same use case as the Home Assistant `citybikes` platform and the `gbfs`
  integration of HACS; no code is taken from them. The bike stations of the
  Tisséo integration were the first draft.
- Test fixtures: real feeds of Vélib' Métropole, Naolib, V'lille, Vélibéo
  and Citi Bike, reduced to a few stations.
- Station data: each network operator (Smovengo for Vélib', JCDecaux,
  Ilévia, Lyft, Ecovélo…).
