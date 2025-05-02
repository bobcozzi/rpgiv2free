# RPG IV to Free Format Conversion Tool

This Visual Studio Code extension helps developers convert RPG IV fixed-format code into free-format RPG IV code effortlessly. Whether you’re working with File (F) specs, Definition (D) specs, or Embedded SQL statements, this tool streamlines the process by automating the conversion of fixed-format RPG code into more modern, readable free-format code.
Download in the [![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/CozziResearch.rpgivfree.svg?label=VS%20Code%20Marketplace&color=blue)](https://marketplace.visualstudio.com/items?itemName=CozziResearch.rpgivfree)).


For a detailed list of changes and release notes, see the [Changelog](./CHANGELOG.md).

This extension is an RPG IV to Free Format statement converter. You select the RPG IV fixed format statements you want to
convert to free format, right-click and select "Convert RPG IV to free format".
It is not a refactoring tool or moderization tool. Its only purpose is to get that statement into free format for you.

## Features

- **Convert RPG IV Fixed-Format to Free Format**:
  Once installed, right-click on any RPG IV fixed-format statement in your editor and select the “Convert RPG IV to Free Format” option from the context menu. The statement will be converted instantly.

- **Multi-Line Support for Complex Statements**:
  If a statement spans multiple lines (such as a D (Definition) spec), you can position the cursor on any line within the statement, and the extension will convert the entire statement properly, even if it’s split across several lines.

- **Batch Conversion of Multiple Statements**:
  You can select multiple statements within the same file and convert them all in a single operation. The tool processes them efficiently.

- **Fully Implemented Specifications**:
  - Header (H) Specs
  - File (F) Specs
  - Definition (D) Specs
  - Calculation (C) Specs (in progress)
  - Embedded SQL Statements
  - Procedure (P) Specs

## Extension Settings

This extension contains the following settings under `rpgivfree`:

### `rpgivfree.convertBINTOINT`
Controls whether binary (B) data types in RPG IV are converted to integers in free-format RPG.

- `0` — Do not convert B fields to integer (makes them BINDEC variables).
- `1` — Always convert B fields to integer (makes them INT variables).
- `2` — Convert B fields to integer variables only when decimal positions = 0.

Default: `0`

### `rpgivfree.addINZ`
Automatically adds the `INZ` keyword to data structure fields that do not already have it.

- `true` — Add `INZ` keyword to all Data Structures when converted.
- `false` — Do not add `INZ`.

Default: `false`

## In Development:

- **Header/Control (H) Specs**
  The conversion for H Specs is currently in development. It mostly works but may require some additional tweaks for edge cases.

- **Procedure (P) Specs**
  Most aspects of P Specs are working, but some minor adjustments are still being made. I doubt you will notice any issues, but if you do, please let me know.

- **Calculation (C) Specs**
  The conversion of Calc Specs is in progress and is being updated in each release. (See below for more details).
  Currently some calc specs convert fine, while others may or may not convert. Be ready with your Ctrl+Z to undo the conversion if it does not work as expected. (cmd+Z on Mac). For now, the following features are enablef:
  - IFxx/ORxx/ANDxx/WHENxx convert as a compound statement.
  - Regular 3 factor opcodes (like CHAIN) convert to free format. But verification is needed.

  **Data Structure (DS) and Data Structure Subfields**
- Data Structures and subfields convert, but the END-DS is NOT added during conversion. Eventually we plan on making data structures a compound statement and if any part of it is selected for conversion, then entire thing is converted, with the END-DS added.
-
## Getting Started

1. **Install the Extension**:
   - Go to the Visual Studio Code Extensions marketplace. [![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/CozziResearch.rpgivfree.svg?label=VS%20Code%20Marketplace&color=blue)](https://marketplace.visualstudio.com/items?itemName=CozziResearch.rpgivfree)).

   - Search for RPG IV to Free Format Conversion Tool and click Install.

2. **Using the Tool**:
   - Open any RPG IV file in VS Code. The extension must be .RPGLE or .SQLRPGLE only.
   - Right-click on a fixed-format statement to bring up the context menu.
   - Select “Convert RPG IV to Free Format” from the context menu.
   - The tool will convert the statement into free format.

3. **Multi-Line Statements**:
   - For multi-line statements (like D Specs), or enhanced calc spec opcodes that use the extended Factor 2, position the cursor on any line that makes up the statement. The extension automatically converts the entire statement.

4. **Multiple Statements Conversion**:
   - Select multiple statements in the editor and convert them at once.

## Known Issues

- **Calc Specs (C Specs)**:
  Currently under development. Some edge cases may not be fully converted as expected. We are actively working to address this.

- **P Specs**:
  While most of the P Specs are working, there are some additional tweaks to improve edge cases and ensure consistent formatting.

## Roadmap

- **Fully Implemented Calc Specs (C Specs)**:
  We are working on refining the handling of Calc Specs and expect it to be fully supported in the next release.

- **Improved User Feedback for Conversions**:
  We plan to enhance the user experience by providing more informative feedback about what is being converted and any issues that may arise during conversion.


## License

This project is licensed. See the LICENSE file for details.

## Support

If you have any issues or feature requests, please open an issue on the GitHub repository. We will do our best to address it promptly.
## Contact

Bob Cozzi
[Website](http://www.github.com/bobcozzi/vsciRPGConverter)
[Email](mailto:cozzi@rpgiv.com)
