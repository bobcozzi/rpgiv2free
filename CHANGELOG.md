# Changelog

All notable changes to this project will be documented in this file.

## [0.4.4] - 2025-05-03
### Added
- Converting a Data Structure "header" line or the PI or PR statements results in the corresponding END-xx being generated after the list of child nodes.
- 
## [0.4.3] - 2025-05-02
### Added
- `SUBDUR` opcode handling:
  - Standard format using `%<duration>()`.
  - `%DIFF` format when result field contains duration keyword.
- Intelligent detection of `SUBDUR` variants based on colons in Factor 2 or Result.
- Support for converting `ADDDUR` opcode to free-format using built-in `%<duration>()` functions.

### Fixed
- Now safely handles missing duration keywords in `ADDDUR` and `SUBDUR`.

### Added
- Greatly simplified extracted H-specs and conversion to `ctl-opt` free-form line, ignoring commented-out specs.
- `collectHSpecs` function to extract fixed-format H-specs (column 6 = 'H').
- Initial implementation of `convertHSpec` to consolidate multiple H-specs.

## [0.4.2] - 2025-05-01
### Added
- Resolved issues with IF statements that used extented Factor 2.
- Boolean opcode collector (`collectBooleanOpcode`) for RPG IV fixed format logic.
- Handling of boolean opcodes: `IFxx`, `WHENxx`, `ANDxx`, `ORxx`.
