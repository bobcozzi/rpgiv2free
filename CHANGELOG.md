# Changelog

All notable changes to this project will be documented in this file.

## [1.0.1] - 2025-07-09:
- Corrected and issue with compile-time data not being recognize properly when unsupported "comments" are included on the same line as `**`.

## [1.0.0] - 2025-07-01:
- Formal release of RPGIV2FREE VS Code for IBM i Extension. Converts RPG IV Fixed Format to Free Format.

## [0.7.18] - 2025-06-28:
- Corrected an issue with embedded comments within Extended Factor 2 opcodes that span multiple lines.

## [0.7.17] - 2025-06-25:
- Corrected an issue where once RPG SmartTab/SmartEnter were activated, they stayed active for all source files in that VS Code session, regardless of language ID/type.
- Corrected a painting issue with columnar boundaries and **FREE source files.
- Corrected an issue with out of bounds columnar boundary drawing when all free format statements, but not **FREE, are detected.

## [0.7.15] - 2025-06-22:
- Performance improvements when loading large RPG source file and RPG Smart Tab is enabled.
- Generate performance enhancments.

## [0.7.14] - 2025-06-10:
- Corrected an issue with the TAB key when the source file is **FREE.

## [0.7.12] - 2025-06-09:
- Corrected an issue with DO result field ("counter") ad hoc definition.
- Corrected an issue with KeyList not being seen when defined in subprocedures.
- When Fixed Format is converted to free, the Columnar Guides are now removed from those lines.

## [0.7.10] - 2025-06-08 Release candidate 1:
- `Conditioning Indicators` are now fully supported/converted to free format! (you're welcome)
- Fixed issues with Smart Enter and Smart Tab activations, they now ONLY RUN if the line is FIXED Format.
- Refactored the main body of our code
- RPGII-style comments in columns 1 to 5 of Calc specs (only Calc specs) are _now retained_ when there are NO comments in columns 81 - 100.
- This is release candidate 1. If no significant issues are reported, I will move forward with updating it to the 1.0.0 release by 1 July 2025.
- Bug fixes and enhancements

## [0.7.5] - 2025-06-04
- Fixed an issue when a data structure and its subfields were converted at the same time as an ad hoc Calc spec result field. The generated work fields' DCL-S statements were incorrectly positioned below the data structure's DCL-DS statement.

## [0.7.4] - 2025-06-03
- MOVE opcodes with a date format code in Factor 1 were dropping Factor 1. Now 2 EVAL statements are generated. One live, one as a comment to support a user-selectable conversion choice.
- Corrected minor issues with semicolon being appended to comment-only lines.

## [0.7.2] - 2025-06-02
- Corrected the MOVE opcode such that when Factor 2 contains *BLANK, *ZEROS, etc, a standard eval assignment is generated instead of an EVALR opcode. For example: `MOVE *BLANK CUSTNAME` now results in `CUSTNAME = *BLANKS;` instead of `EVALR CUSTNAME = *BLANKS;` or similar.
- Corrected an issue when multiple data structures are converted at once and more than one has the same name or has no named (e.g., an unnamed data structure) where the END-DS statement was not being inserted.

## [0.7.1] - 2025-06-01
### The following Bug Fixes and Enhancements are rolled into this release
### File Specs
- Fixed: If the USAGE keyword contains *DELETE when "File Addition/ADD" was included.
- A WORKSTN device file that uses the standard CF (combined) I/O usage, no long includes a USAGE keyword.
- DISK usage Update files (e.g., "UF") are now converted as USAGE(*UPDATE:*DELETE) although techincally only USAGE(*DELETE) is required.
  - Note: *DELETE can be safely removed if your code does not DELETE records from the file but *UPDATE:*DELETE is the free format equivalent to "UF" in fixed format.
- USAGE(*OUTPUT) is now added only when required or when the "File Addition" flag is 'A'.

### General Issues
- Comments in columns 1–5 are unsupported by this conversion extension and are lost during translation.
- Comments in column 81 to 100 on Calc and D specs are now preserved.
- Comments in columns 81 to 100 are now rendered on the same line unless that line exceeds the record length/right margin, or converting an IFxx/ANDxx/ORxx block in which case only the first comment is preserved.
- Extension-generated comments now appear before the converted code instead of after.

### Definition (D) Spec Issues
- When From/To columns are the same (e.g., 30 30), the field length is now correctly calculated as 1, instead of the "to column" value.
- When adding ad hoc fields (fields declared in Calc specs), they fields were being inserted after UDS (*LDA data structures) but before its subfields; this has been corrected.
- Non-dataType fields (i.e., when lazy programmers omit the datatype), especially those with a LEN(n) keyword, were losing some attributes; this is fixed.

### Calc Spec/Opcode Issues
- Math opcodes with H or R extenders now include them via EVAL(H R) when converting to free format.
- Keylist conversions in subprocedures (and possibly elsewhere) were not applied to CHAIN/READ, etc. This was due to the top-down scan stopping at Output specs. Now it continues until EOF or ** in columns 1–2 is detected while searching for and building the key list database.
- Fixed a bug in DIV conversion where the terminating semicolon was missing.
- Added half-adjust support to all math opcodes.

## [0.7.1] - 2025-06-01
- Math conversion now includes the MVR (move remainder) opcode.
- Better handling of blank comment (e.g., "C*") and blank lines embedded between specs.
- Some math opcodes with resulting indicator use (which is very rare) were returning Resulting Indicator 1 in all cases. This has been corrected.
- Support for the `OCCUR` and `MVR` opcodes have been added
## [0.6.43] - 2025-05-31
- Corrected resulting indicator conversion for database I/O opcodes
- Added `TESTZ`, `TESTB`, `TESTN`,`BITON`, and `BITOFF` opcodes to the conversion.
- Corrected an issue with conversion output related to hexadecimal and binary notation literals.
## [0.6.42] - 2025-05-31
- Enhanced the SUBST (substring) opcode conversion routine to match our contemporary design style. In some cases the resulting %SUBST will be more streamlined, but the result will be the same.
## [0.6.40] - 2025-05-31
- Modified the CASxx conversion to use `IF/ELSEIF/ENDIF` instead of `SELECT/WHEN/OTHER/ENDSL`
## [0.6.38] - 2025-05-30
- New option for `MOVEA'1001' *IN(38)` style statements to use either a FOR loop or the recommended `%SUBARR(*IN:38) = %LIST('1','0','0','1')` style conversion. See the settings for this extension to customize to taste.
- Completed work on LOOKUP to %LOOKUPxx all converted test cases returned the same results as fixed format. %TLOOKUP (table lookup) is also implemented this way, but has not been tested due to lack of test case scenarios.
## [0.6.37] - 2025-05-30
- Corrected issues with nested IFxx statements.
## [0.6.36] - 2025-05-30
- Fixed an issue with parameters or subfields that have not attributes (such as those that use the LIKE keyword to define them) where it was combinine them with the prior statement.
- Initial some support for LOOKUP translation to either %LOOKUP or %TLOOKUP, use caution in non-traditional naming conventions, especially for table lookups vs array lookups.

## [0.6.34] - 2025-05-29
- Hot fix for MOVEA logic causing other opcodes to not convert
## [0.6.32] - 2025-05-29
- The MOVEA opcode is now partially supported in free format. A classic (legacy) technique often used to set on or off indicators can be converted carefully.
- RPGIV2FREE now converts *IN-based MOVEA opcodes to a FOR loop and sets each indicator as specified. Here is an example with the before and after MOVEA:

```rpg
  C                   MOVEA     '10'          *IN(41)

          for f2f_tempDO = 1 to  %len('10');
            *in(41 + f2f_tempDO-1) = %subst('10' : f2f_tempDO : 1);
          endFor;
```

- All other MOVEA opcodes are roundtripped (ignored) during conversion and need to be migrated manually.

## [0.6.31] - 2025-05-29
- Corrected an issue with CASxx blocks that would continue collecting statements past the ENDCS statement causing the "Duplicate Edits" error to appear in the editor window.
## [0.6.30] - 2025-05-28
- Fixed a bug when legacy compiler directives, such as `/EJECT` or `/SKIP` were encounted and were surrounded above and below by comments.
- A new setting is introduced to remove /EJECT, /SKIP, /SPACE /TITLE legacy compiler directives. The default: `true`.
## [0.6.29] - 2025-05-28
- New altMOVEL setting to enable insert of an alternative to the generated implied eval opcode when converting MOVEL opcodes.
- A comment is now inserted `// %SUBST(result : 1 : %min(%Len(F2):%LEN(result))) = result` when a MOVEL is converted. The code that is generated is `result = f2;` but this new commented-out suggestion or alternative option provides the user with choice and guidance for MOVE conversions.
- Key List (KLIST/KFLD) are now analyzed and inserted into database I/O opcodes during conversion. Free format "keylist" fields are `(fld1 : fld2 :...)`. The original KLIST/KFLD opcodes are left in place for removal by the developer as desired.
- Added GOTO, TAG, KLIST, KFLD to the list of opcodes that are not converted.
## [0.6.26] - 2025-05-28
- Redesigned now EVAL and similar opcodes are converted (retaining their operation extenders).
- Corrected an issue with XLATE opcode conversion.
- Generated `END-xx` statements are now inserted before any compiler directives, such as a /INCLUDE or /COPY or /IF DEFINED, etc.
## [0.6.25] - 2025-05-27
- Corrected an issue with where the generated end-ds statement is inserted. It now correctly locates the insert point even when bulk (e.g., select-All) conversions are performed.
- Fixed an issue where during bulk conversion if an unnamed data structure was converted immediately after a named data structure (in the same bulk conversion action) the unnamed data structure's end-ds would contain the prior named data structure's name.
## [0.6.24] - 2025-05-27
- I now convert "empty" or blank spec lines such as `     C` with nothing else on it o a blank line.
- Opcode conditioned by **1 conditioning indicator** are now converted.
- If the Level Break indicator area (columns 7 and 8) is `Lx` or is `OR` or `AN` unpredictable results will occur.
- It is a future objective to support AN/OR lines (multiple conditioning indicators) for a single opcode.
## [0.6.23] - 2025-05-26
- Refactored the RPG Smart Tab columnar ruler boundary decorations to better support tabbing past end of line.
- The visual Columnar ruler boundary guidelines now redraw using a more optimized logic flow that is a VS CODE standard.
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
- Know issue with WHENEQ/ANDEQ and possibly IFEQ/ANDEQ style conditional logic. This was working, but I broke it. It'll be resolved in the next build. The work around right now is to selected those lines independently of others and they should convert.
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
- I now have custom column and width setting options for the columnar boundary rulers that apply specifically to Light Mode and Dark Mode editing.
## [0.6.3] - 2025-05-19
- Introducing RPG Smart Tabbing! This feature automatically adjusts the cursor when TAB is pressed for your RPG code. It moves from "column to column" based on the RPG IV specification you are on. Both forward tab and backwards tab (shift+TAB) move the cursor on the line without disrupting the existing code position. No more shifting code when tabbing!
- Introducing a new setting to control the "RPG Smart Tab" feature. This setting is called "rpgiv2free.smartTab" and is set to true by default. You can disable it if you prefer the old default tab behavior. There is also a status bar button to toggle the feature on and off. Note that on non-fixed format RPG IV code as well as non-RPGLE, non-SQLRPGLE source files, the smart tab feature is disabled by default.
- Introducing a new "RPG Columnar Boundary Ruler" that shows you visually where the RPG IV fixed format columnar areas begin and end. This can help with alignment and faster interpretation of the source statement. For example, Factor 1, Opcode, Factor 2, and Result along with all the indicator fields are now outlined for you. Note the due to VS CODE limitations, boundary rulers are shown only for columns that contain content in the columnar area. That is the empty or void areas of the physical source line will not have these boundary ruler lines drawn.
- New columnar boundary tab highlight feature. Now when you are on a fixed format statement, the current columnar area is highlighted in a light blue color. This helps you see where you are in the fixed format statement.
- For the RPGIV2Free extension, the all specifications, H, F, D, P are fully supported to be converted. Howeve the Calc specs while working well, are not converted and should be reviewed as I still do not support all edge cases fully, and do not support conditioning indicators at all (and do not intent to in the future).
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
- Restructured how I process and convert calc spec opcodes to provide more customization for each opcode.
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
