# Bob Cozzi's RPG IV to Free Format Conversion (rpgiv2free) Extension for VS CODE for i

This Visual Studio Code extension helps developers convert RPG IV fixed-format statements into free-format RPG IV code effortlessly. Whether you’re working with File (F) specs, Definition (D) specs, or Embedded SQL statements, this tool streamlines the conversion to free format process by making a one-click option on your context menu. Just put the cursor on the line(s) you want to convert to free format and select "Convert RPG IV to free format" and bam! it is converted.
Download from the Visual Studio CODE Marketplace: [![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/CozziResearch.rpgiv2free.svg?label=VS%20Code%20Marketplace&color=blue)](https://marketplace.visualstudio.com/items?itemName=CozziResearch.rpgiv2free)).

For a list of changes and release notes, see the [Changelog](https://github.com/bobcozzi/rpgiv2free/blob/main/CHANGELOG.md).

This extension is an RPG IV to Free Format statement converter. Select the RPG IV fixed format statements you want to convert to free format, right-click and select **Convert RPG IV to free format**. Note there are other extensions that have a similar "command name". Be sure to select the one with this exact wording to evoke this extension vs the others.
This extension s **NOT a refactoring or modernization tool**. Its only purpose is to convert RPG IV fixed-format statements into free format RPG IV syntax.

## Features

- **Convert RPG IV Fixed-Format to Free Format**:
  Once installed, right-click on any RPG IV fixed-format statement in your editor and select the “Convert RPG IV to Free Format” option from the context menu. The statement will be converted instantly.

- **Multi-Line, Multi-Statement and Compound Statement Support**:
  A line of code is one line in the source file. An RPG statement, such as a D spec or Calc spec can span multiple lines of code, for example when a File or Definition spec have additional keywords on additional lines, or you have a Calc spec with IF/ELSEIF/EVAL/EVALR those statements often span multiple lines of coe. Then so called compound RPG opcodes such as the legacy IFEQ/OREQ/ANDEQ/WHENxx opcodes can also span multiple lines. This extension allows you to place the cursor on any part of the statement, (right in the middle line if necessary) and it converts the entire statement. The only exception is a set of CASxx opcodes. Prior to supporting conditioning indicators, we allowed it to be treated like the IFxx/ORxx/ANDxx/WHENxx opcodes. Today each CASxx is treated independently to support the unlikely situtional of it also having conditioning indicators. However, you may select the entire CASxx/ENDCS block and convert it at once and it'll work the way you expect it to, so this also means a Select-All->Convert sequence will work with CASxx.

- **Supported Specifications**:
  - Header (H) Specs
  - File (F) Specs
  - Definition (D) Specs
  - Calculation (C) Specs (in progress)
  - /EXEC SQL and C+ "fixed format" style Embedded SQL Statements
  - Procedure (P) Specs

- ## Bonus Editing Features**
- **Smart RPG Tab key** When enabled (default: `true`) on fixed-foramt RPG IV statements, when the TAB/Shift+TAB keys are pressed, it moves to the next/prev available "tab" location for the specification. For example: On a C (calc) spec, you may _tab_ from factor 1 to the opcode then to factor 2 and so on. The tab is non-distructive so tabbing can be done quickly and safely. To turn off Smart RPG Tab, press the "RPG Smart Tab" _button_ on the bottom status bar of the editor winodow. There is also a settings option to turn this off when VS Code starts. Smart RPG Enter and Smart RPG Tab features are off when NOT in fixed format.
- **Smart RPG Enter key** When enabled (default: `true`) on fixed-format RPG IV statments, when you press ENTER, the current line is **not** broken and a new line with the same source spec type is inserted. The cursor is moved under the first non-blank position (after the spec) of the previous line. To turn this off, go to the settings for the `rpgiv2free` extension. NOTE: This may interfer with GitHub CoPilot code completion (code _suggestions_) in fixed-format. Smart RPG Enter and Smart RPG Tab features are off when NOT in fixed format.
- **Columnar Boundaries** When the Smart RPG Tab key is enabled (on) the extension highlights the boundaries of each fixed-format RPG IV statement to show where the various fields such as Factor 1, Opcode, Factor 2, Result Field, etc. are located. This gives you a visual cue to verify that you are editing in the correct location.  To use this feature, turn off the VS CODE for IBM i "Format Ruler" setting, using Shift+F4. On my personal VS CODE install, I turn that feature off by default. To do that, go to the settings.json file. To do that (Ctrl + comma or Cmd + comma on macOS) then search for this setting: `"vscode-rpgle.rulerEnabledByDefault": false,` if it is false, you're good. If true, then set it to false as shown. Note you can toggle this setting using the Shift+F4 key at any time. But I find it to be unhelpful, so I turn it off by in the settings.json file.

## Advanced Support and Special-CASE
- **Conditioning Indicators on Calc Specs Support**:
  Resulting indicators are fully supported and converted. The extension converts opcodes conditioned by one or more indicators by wrapping the opcode in an IF/ENDIF condition. For legcy conditional opcodes such as IFxx, WHENxx, or CASxx, the conditioning indicators are integrated into the condition; for other opcodes, a separate IF/ENDIF statement is added. When converting CASxx statements, you, the user, should always select the entire block of related CASxx lines at once. This allows the tool to determine the correct IF/ELSEIF/ELSE structure to generate, which mimics the original logic. Converting CASxx statements individually will result in each being turned into a separate IF condition, rather than a proper IF-THEN-ELSE chain (unless you convert them individually from the bottom up). For best results, select the block of CASxx statements to convert, or use the _Select All → Convert RPG IV to free format_ key sequence so they are converted correctly. Note that if you have many opcodes conditioned by the same indicator, some manual optimization after conversion would be helpful.
- **Level Break Indicators are not Converted**:
- **Input and Output specs are NOT converted.**
- **We do nothing with RPG Cycle components** including Level Break Indicators in columns 7 and 8, input primary/secondary files, or total-time processing.

**Extended RPG IV Fixed Format Keyboard Features**

## Smart RPG Tab
- The RPG IV Smart Tab feature appears in the status bar at the bottom of the VS CODE editor window (right side). When RPGLE or SQLRPGLE are detected and the source is NOT **FREE, this feature is enabled for Fixed Format code. It gives you the abilit to forward TAB or backwards TAB within the lines (such as going from Factor 1 to the Opcode to Factor 2, etc.) in a non-distructive way. It also outlines columnar boundaries on each fixed-format line in a non-intrusive mannor, and highlights the "column" in which the cursor is located. For example, if your cursor is in the Opcode area, that entire 10-byte area is highlighted. The highlight follows your cursor in any fixed format line, to help you insure you've place the code in the right place.

## Smart Enter Key
- In Fixed-format, when you press Enter, the current fixed-format line will not break at the Enter location and a new line is inserted normally. In addition, the Smart Enter key adds the new line with the same specification as the prior line (the one where Enter was pressed) and positions the cursor at the first non-blank position of that prior line. This is simlar to how other editors work.

**NOTE:** Both features may be turned off in the settings, but the Smart RPG Tab key feature also has a "toggle" switch located in the right-side of the Status bar. See the Extension Settings for details on turning off either of these features.

## Extension Settings
This extension provides several settings to customize its behavior. You can configure these in your VS Code `settings.json` or through the extension settings user interface.

### `rpgiv2free.RemoveFREEDirective`
Automatically comments-out /free compiler directives. /free has been deprecated by IBM.

- `true` — Remove/comment-out /free and /end-free statements.
- `false` — Do not modify /free or /end-free statements.

Default: `true`

### `rpgiv2free.ReplaceCOPYwithINCLUDE_RPG`
Converts the legacy /copy statement to the more modern and cross-language /include statement for RPGLE source type source members.

- `true` — Any selected /copy is converted to /include.
- `false` — /copy statements are not converted.

Default: `true`

### `rpgiv2free.ReplaceCOPYwithINCLUDE_SQLRPG`
Converts the legacy /copy statement to the more modern and cross-language /include statement for SQLRPG* source type source members.

- `true` — Any selected /copy is converted to /include.
- `false` — /copy statements are not converted.

Default: `false`

### `rpgiv2free.enableRPGSmartEnter`
Enables the RPG Smart Tab feature. This is shipped as `true` and may be toggled on/off using the "RPG Smart Tab" _button_ on the status bar.

- `true` — RPG Fixed Format Smart Tab is Active at start up.
- `false` — RPG Fixed Format Smart Tab is disabled at start up

Default: `true`

### `rpgiv2free.enableRPGSmartEnter`

Enables the RPG Smart Enter key behavior which adds a new line without breaking the current fixed-format statement.

- **fixedOnly** (default): Enable Smart Enter only for fixed-format RPG.
- **fixedAndFree**: Enable Smart Enter for both fixed-format and free-format RPG.
- **\*ALL**: Enable Smart Enter for all source file types (RPG and non-RPG).
- **disable**: Disable Smart Enter entirely.

Default: `fixedOnly`

### `rpgiv2free.enableRPGCopySpecOnEnter`
When enableRPGSmartEnter is not disabled, the new line will receive the same specification in column 6 as the current line. In addition the cursor is moved over to the first non-blank column in original line.

- `true` — RPG Fixed Format Smart Enter adds the same spec type to new lines.
- `false` — RPG Fixed Format Smart Enter adds a blank new line.

Default: `true`

Since this feature is also disabled when enableRPGSmartEnter is disabled, you can set it and forget it. .

### `rpgiv2free.convertBINTOINT`
Controls whether binary (B) data types on RPG IV D specs are converted to integers in free-format RPG.

- `0` — Do not convert B fields to integer (make them BINDEC datatype variables).
- `1` — Always convert B fields to integer (make them INT variables).
- `2` — Convert B fields to integer (make them INT variables) ONLY when decimal positions = 0(recommended).

Default: `2`

### `rpgiv2free.addINZ`
Automatically adds the `INZ` keyword to non-PSDS data structures that do not already have it.

- `true` — Add `INZ` keyword to all Data Structures when converted.
- `false` — Do not add `INZ`.

Default: `true`

### `rpgiv2free.altMOVEL`
Include a comment with a `%SUBST(...)` assignment as an optional alternative for MOVEL. Note: if Factor 2 starts with an asterisk (e.g., *ALL, *BLANK, *ON, etc.) this option is ignored.

- `true` — Insert a comments for `%SUBST()` for the MOVEL opcode.
- `false` — Do not add a comment with `%SUBST()`.

Default: `true`

### `rpgiv2free.maxFreeFormatLineLength`
Max length for converted free format lines (right margin).
Since this extension is converting to free format RPG IV, it is limited to 80 characters line width/margins. However, if you are intending to move to fully free format (i.e., add the **FREE directive to line 1, column 1) then you may set this margin to more than 80.
Note: We default to 76 to allow for a blank and a + sign to be added for continuation lines that contains quoted strings to safely fit within the standard 80-character line width.
Default: `76`

### `rpgiv2free.indentFirstLine`
First free format line indent/spaces (in bytes).

Default: `10`

### `rpgiv2free.indentContinuedLines`
Secondary free format lines indent/spaces (in bytes).

Default: `12`

### `rpgiv2free.AddEXTDeviceFlag
Add *EXT to DISK, WORKSTN, PRINTER, etc. when converting externally described files.

- `true` — Add `*EXT` to DISK, WORKSTN, PRINTER keywords. e.g., DISK(*EXT)
- `false` — Do not add `*EXT` to externally described device file keywords. e.g., DISK

Default: `false`

### `rpgiv2free.tempVarName1
The name used as a work field by this extension. This field name is used when converting things like CAT and SUBST to free format. In some scenarios, a length variable is required, and this variable name is used. The conversion generates a DCL-S stand-alone field declaration automatically.

- The default name used is f2f_tempSTG (explanation: "f2f" = "fixed to free", "temp" = temporary, "STG" = string opcodes).
- `<your-custom-name>` — A user-specified variable name to use, **must NOT contain** special symbols such as @#$

Default: `f2f_tempSTG`

### `rpgiv2free.tempVarName2
The name used as a work field by this extension. This field name is used when converting things like the DO opcode to free format. In some scenarios, a counter variable is internally generated by the compiler. When converting to free format, the DO opcode becomes a FOR opcode which requires a counter variable and this variable name is used. The conversion generates a DCL-S stand-alone field declaration automatically.

- The default name used is f2f_tempDO (explanation: "f2f" = "fixed to free", "temp" = temporary, "DO" = DO opcodes).
- `<your-custom-name>` — A user-specified variable name to use, **must NOT contain** special symbols such as @#$

Default: `f2f_tempDO`

## In Development:

- **Calculation (C) Specs**
  The conversion of Calc Specs is in progress and is being updated in each release. Currently many calc specs convert fine, while others may or may not convert. Be ready with your Ctrl+Z (cmd+Z on Mac) to **undo** the conversion if it does not produce the desired results.

## Limitations
- Level Break Indicators are NOT converted.
- RPG Logical Cycle-based File Declarations (i.e. File specs with **Primary or Secondary files**) are not converted. RPG IV _hybrid_ Free format may include fixed-format code, so they can usually remain in your source code as is. However, if your intent is to migrate to fully free format RPG IV, then you must remove any RPG Cycle-related code from your source file member.
- Input and Output Spec are ignored. While it is technically possible to convert Input (and output) specs to Defnition specifications, this act would be concidered refactoring and it not a part of this extension.

## Getting Started

1. **Install the Extension**:
   - Go to the Visual Studio Code Extensions marketplace. [![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/CozziResearch.rpgiv2free.svg?label=VS%20Code%20Marketplace&color=blue)](https://marketplace.visualstudio.com/items?itemName=CozziResearch.rpgiv2free)).

   - or search for "rpgiv2free" in the marketplace, or from the Extensions explore View within VS CODE. The "Search Extensions in Marketplace" search box, enter "Bob Cozzi" or "rpgiv2free" or similar and it should show up in the list of extensions. Click on it and select "Install".
   - Once installed, you may need to restart Visual Studio Code for the changes to take effect.
   - After installation, you can find the extension in the Extensions view (Ctrl+Shift+X) under "Installed" or by searching for "rpgiv2free".
   - You can also find the extension in the Command Palette (Ctrl+Shift+P) by typing "rpgiv2free" and selecting the appropriate command.

2. **Using the Tool**:
   - Open any RPG IV source member in VS Code. The file extension must be .RPGLE or .SQLRPGLE which is derived from the member's source type.
   - Position the cursor on the fixed-format statement you want to convert.
   - Alternatively, you can select multiple lines of code or multiple statements to convert them at once. The position of the cursor or selection on the line does not matter.
   - Right-click on the selected code to bring up the context menu.
   - *Select* “**Convert RPG IV to Free Format**” from the context menu.
   - The tool converts all selected statements to free format.
   - The converted code replaces the original fixed-format code in the editor.
   - You can also use the command palette (Ctrl+Shift+P) and type "Convert RPG IV to Free Format" to run the conversion.
   - Use the "Undo" command (Ctrl+Z on Windows or Cmd+Z on Mac) to revert any changes if needed.

## Known Issues

- There are no known issues at this time. All features have been implemented.

## Controlling Inline Suggestions in VS Code

VS Code provides **inline suggestion** ("ghost text" "code completions") by default. You can control this feature globally or for specific languages such as RPGLE and SQLRPGLE.

If you are primarily coding in fixed format RPG IV, I recommend you tune off this feature for Source Types: "RPGLE" and "SQLRPGLE". To disable it, follow these steps:

### Globally Enable/Disable Inline Suggestions

1. Open **Settings** (`Ctrl+,` or `Cmd+,` on Mac).
2. Search for **Inline Suggest**.
3. Toggle **Editor: Inline Suggest Enabled** to turn inline suggestions on or off for all languages.

### Disable Inline Suggestions for RPGLE and SQLRPGLE Only

If you want to disable inline suggestions only for RPGLE and/or SQLRPGLE files, then add either or both of the following to your `settings.json`:

```json
"[rpgle]": {
  "editor.inlineSuggest.enabled": false
},
"[sqlrpgle]": {
  "editor.inlineSuggest.enabled": false
}
```


## License

This project is licensed. See the LICENSE.txt file for details.

## Support

If you have any issues or feature requests, please open an issue on the GitHub repository. We will do our best to address it promptly.
## Contact

Bob Cozzi
[Website](http://www.github.com/bobcozzi/rpgiv2free)
[Email](mailto:cozzi@rpgiv.com)
