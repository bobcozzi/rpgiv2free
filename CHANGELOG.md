# Changelog

All notable changes to this project will be documented in this file.

## [0.6.22] - 2025-05-26
- Corrected an issue with the ending ` ;` being added with a blank in some converted lines (just tightens up the line a bit).
- Corrected an issue with the RPGIV free formatter routine that was truncated spaces between symbols.
- Added support for the SCAN opcode.
- Corrected a word wrap issue on File specs when a keyword (such as USROPN) is followed by a keyword with parameters (such as RENAME(rcdfmt:newName)) that was removing the space beween the first keyword and the second when the first was on the end of the line and the next keyword should be moved to the next line.
- Add C spec comments in column 81 to 100 to the conversion effort. These comments are converted to // <comments> and inserted above the the converted opcode.
## [0.6.21] - 2025-05-26
- Implemented the intial *LDA data structure conversion logic. Need more test cases for edge syntax issue. Please use the Issue link in the marketplace extension to report any issues.
- Resolved an issue with the UDS (*LDS) recognition routine.
- Corrected an issue with the value inserted into the POS keyword when from/to columns were being converted. It finally converts to the correct POS syntax.
## [0.6.20] - 2025-05-25
- Corrected an issue with reformatting SQL when a host variable is also an SQL keyword (like FROM, TO, JOIN, SELECT, etc.)
- Added a new "Indent for compiler directives" setting that defaults to `8`
- Improved reformat of free format statements when the remainder of the line is fewer than the max source record length.
- The reformatting now avoids wrapping those few extra characters.
- This change reduces issues where symbols like `;` or `);` were being wrapped to their own line.
- Corrected an issue with H specs and embedded compiler directives
- Generalized the routine to check if the line is a compiler directive.
## [0.6.19] - 2025-05-25
- Corrected issues with converting the OTHER opcode.
- Corrected an issue where the Operation Extender was being lost in some rare cases.
- Resolved an issue with extra-space added before the semi-colon.
- General bug fixes and improvements.
## [0.6.18] - 2025-05-25
- Corrected the issue when inserting END-xx statements and several DS, PI, or PR, etc are selected at once.
- Greatly improved our "look ahead" logic to accommodate compound statements.
- Fixed an issue with field length calculations for D specs with from/to column notation (vs length only). Also removed the POS() keyword from pre-reserved PSDS positional symbols (i.e., *PROC, *PARMS *STATUS, *ROUTINE) I could swear POS(*PROC) was required, oh well, fixed now.
## [0.6.17] - 2025-05-24
- When an IFxx statement is immediately followed by another IFxx statement, and both are selected simultaneously, the inner IFxx would not convert and in some cases caused the extension to loop indefinitely.
## [0.6.16] - 2025-05-23
- Added support for column 81+ "comments" to be converted to `// <comments>` in free format (D specs only). Support for C spec column 81 comments may be integrated in a future release.
- Corrected an issue with File spec conversion that was omitted from the earlier release.
- Know issue with WHENEQ/ANDEQ and possibly IFEQ/ANDEQ style conditional logic. This was working, but we broke it. It'll be resolved in the next build. The work around right now is to selected those lines independently of others and they should convert.
- Correct issues related to stand-alone WHENxx statements (i.e., the secondary WHENxx in a SELECT block). Fixed several issues related to **select all** behaving badly.
- The File spec was being processed by an old routine that in one case thought it was a D spec, so yikes... yeah that's been fixed.
- Good solid select-all test of late 1990s style RPG by S/36 developers (so mostly RPGIII looking RPG IV) and it converted great.
- Still zero support for Conditioning Indicators, so continue to watch out for that.
## [0.6.12] - 2025-05-23
- Renamed our primary helper function namespace to `rpgiv` (it was ibmi) and the namespace container file name is now rpgedit.ts instead of IBMi.ts to avoid potential future conflicts with other extensions. This is an internal own change and should not impact the UX.
- Corrected an issue with empty P and D spec lines when converted with lines that follow them.
- Added POS(n) keyword to legacy D specs that contains From and To columns. Previously only the new type keyword and field length were translating, now if from and to columns are specified, CHAR(len) POS(from) are specified.

## [0.6.11] - 2025-05-21
- Completed work on opcode migration. All opcodes that can be converted, should now be convert properly. Note that conditioning indicators are not converted, and are currently lost. In the final release, they will cause the extension to not convert the conditioned opcode. Today those conditioned opcodes are converted but their indicators are lost. So use Ctrl+Z (Cmd+Z) undo to recover them if you inadvertently.

## [0.6.10] - 2025-05-21
- Corrected an issue where selecting an entire source file to convert at one caused and error if the last line in the source file is a compiler directive, such as "/end-free".
- Improved the performance of and optimized the memory use in our internal getCol (retrieve source line columns) function.

## [0.6.8] - 2025-05-20
- Improved Smart Tab and Smart Enter integration with VS Code's suggestion and inline suggestion features. Now, pressing Tab or Enter will first accept inline or dropdown suggestions before running custom RPG IV logic, ensuring a smoother editing experience.
- Fixed an issue where columnar boundary guidelines where they were not removed when switching a source member to **FREE format; decorations are now cleared immediately when **FREE is detected.
- Updated documentation and guidance for users on how to control inline suggestions globally and per-language, including RPGLE and SQLRPGLE.
- Minor code cleanup and improved comments for maintainability.
-
## [0.6.6] - 2025-05-20
- Added support for the DOWxx and DOUxx opcodes. They now convert to free format using the same syntax as the IFxx opcodes. The DOWxx and DOUxx opcodes are now fully supported in the RPG IV to Free Format conversion.
## [0.6.5] - 2025-05-19
- Introduces a Smart RPG Enter Key option in our settings. This is on by default. It allows you to press the Enter key to move to the next line in a FIXED FORMAT RPG IV statement without distorying the line integrity. That is no linefeed is inserted at the cursor location when Enter is pressed (but again, only on Fixed Format code). This is similar to how the Smart Tab feature works. You can disable this feature if you prefer the old behavior of the Enter key. RPG Smart Enter key provides combined with our RPG Smart Tab feature allows a more natural editing experience for RPG IV editing.
- The Smart Enter key feature is only available for Fixed Format RPG IV code. It is not available for Free Format RPG IV code, nor is it available for non-RPGLE or non-SQLRPGLE source files.
## [0.6.4] - 2025-05-19
- Cleaned up the code for the new RPG Smart Tab toggle on/off feature. It now cleaning removes the columnar boundary rulers when the feature is disabled. It also cleaning redraws them when the feature is toggled back on.
- We now have custom columr and width setting options for the columnar boundary rulers that apply specifically to Light Mode and Dark Mode editing.
## [0.6.3] - 2025-05-19
- Introducing RPG Smart Tabbing! This feature automatically adjusts the cursor when TAB is pressed for your RPG code. It moves from "column to column" based on the RPG IV specification you are on. Both forward tab and backwards tab (shift+TAB) move the cursor on the line without disrupting the existing code position. No more shifting code when tabbing!
- Introducing a new setting to control the "RPG Smart Tab" feature. This setting is called "rpgiv2free.smartTab" and is set to true by default. You can disable it if you prefer the old default tab behavior. There is also a status bar button to toggle the feature on and off. Note that on non-fixed format RPG IV code as well as non-RPGLE, non-SQLRPGLE source files, the smart tab feature is disabled by default.
- Introducing a new "RPG Columnar Boundary Ruler" that shows you visually where the RPG IV fixed format columnar areas begin and end. This can help with alignment and faster interpretation of the source statement. For example, Factor 1, Opcode, Factor 2, and Result along with all the indicator fields are now outlined for you. Note the due to VS CODE limitations, boundary rulers are shown only for columns that contain content in the columnar area. That is the empty or void areas of the physical source line will not have these boundary ruler lines drawn.
- New columnar boundary tab highlight feature. Now when you are on a fixed format statement, the current columnar area is highlighted in a light blue color. This helps you see where you are in the fixed format statement.
- For the RPGIV2Free extension, the all specifications, H, F, D, P are fully supported to be converted. Howeve the Calc specs while working well, are not converted and should be reviewed as we still do not support all edge cases fully, and do not support conditioning indicators at all (and do not intent to in the future).
## [0.6.2] - 2025-05-17
- Ignore File specs for input Primary/Secondary files (only the initial F spec is ignored, continuations may be problematic for these if they exist)
- Fixed a small issue with spacing for continuation of long expressions and all the variations that RPG IV allows for such things.
- Completed Header spec conversions. Now one CTL-OPT replaces all consecutive H specs. Looking at an option for a future release to simply translate each H spec to its own CTL-OPT statement (individually).
- Removes /free and /end-free statements (converts the to comments)
- Converts /copy statements to the more modern /include statement.
- The P (procedure) spec was completely rewritten using our new methodology.
- New config settings to control /free /end-free removal (default true), and to convert /copy to the more modern /include statement (default true, for RPGLE memeber, false for SQLRPGLE member; recommended: true)
- I accidently pushed out a 0.6.1 build which was identical to 0.6.0 earlier and the marketplace does not permit updates to existing releases, so you have to increment it... hence 0.6.2

## [0.6.0] - 2025-05-15
- A major rewrite of D spec seletion and free format line formatting.
- Restructured how we process and convert calc spec opcodes to provide more customization for each opcode.
- Fixed several bugs in how the full D spec statement was selected. In edge cases it was dropping the end of a Long Variable name. This has now been corrected.
- Fully implemented CAT opcode to free format
- Correctly a bug in reformat/paginate RPG IV line routine that was causing it to wrap prematurely.
- Correctly as DCL-SUBF or DCL-PARM to child variables based on their parent variable type and if the name is that of an RPG opcode. For example, a parameter name of MONITOR is converted to "dcl-parm monitor ...".
- Quoted literals on D specs are now retaining embedded consecutive blanks. It does this in two ways, (1) Avoids compressing them and (2) If the line breaks onto a new line at a set of blanks, then the - is used to continue and the next line starts in column 8. NOTE: If you migrate to fully free format RPG IV, then you will need to adjust that start position (to 1) accordingly.
- Add a new setting for rpgiv2free generated work/temp fields. The settings are labeled tempVarNamen where "n" is a sequence number. In the initial release tempVarName1 is included.
- NOTE: NO CALC SPEC changes or enhancements have been made to this build.

## [0.5.8] - 2025-05-9
### Fixed
- Corrected an issue with the AddEXTDeviceFlag settings flag that caused it to be ignored.
- Updated the readme.md file with more accurate information.
- Data Structures with a Length (legacy "To pos") and/or OCCURS (legacy "From pos") now convert to LEN() and OCCURS() keyuwords respectively.

## [0.5.5] - 2025-05-8
### Fixed
- Corrected an issue with protypes and placement of end-pr. Also fixed the same issue on PI statements.

## [0.5.3] - 2025-05-7
### Added
- Support for END and ENDSR handling.
- Corrected an issue with data structure conversion
- Enhanced how the END-DS location is determined for better results.
- Convert comments better in more situations.
- Add new option to disable the *EXT flag/parameter on externally described file device IDs. That is DISK(*EXT) can now be generated as DISK when this new option is turned off. See SETTINGS for details.

### Fixed
- File specs now interpret the Keyed/nonKeyed flag properly.
- Conversion of final line in a source member is now handled correctly.

### Changed
- Updated extension dependencies for better compatibility with the latest VS Code releases.
- Refined UI elements for a more consistent look and feel within VS Code.
- Improved documentation and in-editor tooltips for extension commands.

## [0.5.2] - 2025-05-06
### New
- Extension renamed from rpgivfree to rpgiv2free to better clarify its role.
- SELECT/WHENxx statements now convert properly.
- Comments generated by the conversion tools are now properly embedded above the converted code.

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
