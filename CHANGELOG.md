# Changelog

All notable changes to this project will be documented in this file.

## [0.4.8] - 2025-05-06
### Added
- Added several opcodes to the conversion engine. ADD, SUB, MULT, DIV, ALLOC, DEALLOC, REALLOC, CASxx, COMP, CAT, CALLP.
## [0.4.7] - 2025-05-05
### Fixed
- Corrected an issue where END-DS was being added multiple times when non-LIKEDS Data Structures were converted.
- Corrected a cross platoform linefeed issue. Windows/Linux/Mac use different linefeed sequences. The extension now uses the linefeed sequence of the current file/platform.
- Corrected the issue with Boolean Opcodes such as IFEQ, IFNE, WHENEQ, WHENGT and their "Extended Factor 2" variants. The extension now correctly decerns these opcodes from their extended Factor 2 variants.
- Resolved the issue where multiple consecutive embedded blanks in quoted strings were being compressed when converted to free format.
- Corrected the "catch all" Calc Spec opcode conversion routine that converts opcodes that are not explicitly handled (such as "TEST") to free format. No if there is no customized handler for the Opcode, it is converted to "opcode factor1 factor2 resultField;" and resulting indicators (if any) are lost.
## [0.4.6] - 2025-05-03
### Added
- Converting a Data Structure "header" line or the PI or PR statements results in the corresponding END-xx being generated after the list of child nodes.
- Reactivating File spec conversion (it was removed accidentally in 0.4.4).
- Fixed an issue with the Extension's Activation.
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
