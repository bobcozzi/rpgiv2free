# RPG IV to Free Format Conversion Tool

This Visual Studio Code extension helps developers convert RPG IV fixed-format statements into free-format RPG IV code effortlessly. Whether you’re working with File (F) specs, Definition (D) specs, or Embedded SQL statements, this tool streamlines the conversion to free format process by making a one-click option on your context menu. Just put the cursor on the line(s) you want to convert to free format and select "Convert RPG IV to free format" and bam! it is converted.
Download from the Visual Studio CODE Marketplace: [![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/CozziResearch.rpgiv2free.svg?label=VS%20Code%20Marketplace&color=blue)](https://marketplace.visualstudio.com/items?itemName=CozziResearch.rpgiv2free)).

For a list of changes and release notes, see the [Changelog](https://github.com/bobcozzi/rpgiv2free/blob/main/CHANGELOG.md).

This extension is an RPG IV to Free Format statement converter. You select the RPG IV fixed format statements you want to
convert to free format, right-click and select "Convert RPG IV to free format".
It is NOT a refactoring tool or code modernization tool. Its only purpose is to get an RPG IV fixed-format statement into free format RPG IV syntax.

## Features

- **Convert RPG IV Fixed-Format to Free Format**:
  Once installed, right-click on any RPG IV fixed-format statement in your editor and select the “Convert RPG IV to Free Format” option from the context menu. The statement will be converted instantly.

- **Multi-Line Support for Compound Statements**:
  If a statement spans multiple lines, such as when a File or Definition spec has additional keywords, or you have a legacy IFEQ/OREQ/ANDEQ/CASxx style Calc specs, you can position the cursor on any line within the statement, and the extension converts the entire statement; no need to select the entire thing.

- **Batch Conversion of Multiple Statements**:
  You can select multiple statements within the same file and convert them all in a single operation. The tool processes them efficiently. however, is it NOT recommended to select *ALL lines and convert them. I have not tested it on things like program-described arrays, conditioning indicators. These are ignored or potentially incorrectly converted in some edge cases.

- **Supported Specifications**:
  - Header (H) Specs
  - File (F) Specs
  - Definition (D) Specs
  - Calculation (C) Specs (in progress)
  - "fixed format" style Embedded SQL Statements
  - Procedure (P) Specs

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
- Conditioning and Level Break Indicators are NOT converted. The opcodes convert but the conditioning and Level-break Indicators are lost. So some manual conversion to RPG IV conditional logic is required before converting them to free format. We will be adding a configuration setting to avoid converting statements with a level break and/or conditioning indicator controlling them.
- RPG Logical Cycle-based File Declarations (i.e. File specs with **Primary or Secondary files**) are not converted. RPG IV _hybrid_ Free format may include fixed-format code, so they can usually remain in your source code as is. However, if your intent is to migrate to fully free format RPG IV, then you must remove any RPG Cycle-related code from your source file member.

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

- **Calc Specs (C Specs)**:
  Currently under development. Some opcodes are translated fine while others are sketchy. Conditioning Indicators logic is not supported and there is currently no plan to support conditioning indicators.

## Controlling Inline Suggestions in VS Code

VS Code provides **inline suggestions** ("ghost text" "code completions") by default. You can control this feature globally or for specific languages such as RPGLE and SQLRPGLE.

If you are primarily coding in fixed format RPG IV, I recommend you tune off this feature for RPGLE and possibly SQLRPGLE also.

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

## Roadmap

- **Implementation of Calc Specs**:
  We are working on refining the handling of Calc Specs and expect on-going improved support with each release.

## License

This project is licensed. See the LICENSE file for details.

## Support

If you have any issues or feature requests, please open an issue on the GitHub repository. We will do our best to address it promptly.
## Contact

Bob Cozzi
[Website](http://www.github.com/bobcozzi/rpgiv2free)
[Email](mailto:cozzi@rpgiv.com)
