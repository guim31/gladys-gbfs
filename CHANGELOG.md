# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.0.0] - 2026-10-19

### Added

- The bikes and free docks of any bike sharing station published in the GBFS
  standard (1.0 to 3.0), without account nor key: networks found in the
  MobilityData catalog or given by their `gbfs.json` URL, stations found by
  name, number or around the home.
- One device per station: bikes available, mechanical and electric bikes
  (when the network tells them apart), free docks, station in service,
  renting and returns open.
- "Bike stations" dashboard widget, four scene triggers (bikes running out or
  back, docks running out or free again) and the "Read a bike station" scene
  action, with a sentence ready to send.
- Texts, feature names and documentation in English, French, German and
  Spanish.

[Unreleased]: https://github.com/guim31/gladys-gbfs/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/guim31/gladys-gbfs/releases/tag/v1.0.0
