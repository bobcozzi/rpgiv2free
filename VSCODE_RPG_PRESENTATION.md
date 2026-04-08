---
marp: true
theme: default
paginate: true
headingDivider: 2
style: |
  code, pre {
    font-family: "Letter Gothic MT";
    font-size: 10pt;
  }
---
# PowerPoint Outline: RPGIV2FREE — VS Code Extension for IBM i Developers

---

## Slide 1 — Bob Cozzi's RPG IV Fixed to Free Format Extension
Uses VS CODE for IBM i
Convert 1 or more statements to free format
Can do SELECT-ALL for all at once conversion
Context aware:
IFxx ORxx CASxx WHENxx compound statements
Data Structures
Procedure Parameter Lists
Subroutine's GOTO END-LABEL
---

## Slide 2 — The Problem We're Solving
- Legacy RPG IV fixed-format code is rigid, column-dependent, and hard to maintain
- IBM deprecated fixed-format in favor of free-format (V7.3+, `**FREE`)
- Free-format is more readable, modern, and IDE-friendly
- Manually converting is tedious, error-prone, and time-consuming
- **RPGIV2FREE automates this — preserving exact logic semantics**

---

## Slide 3 — What It Is (and What It Is Not)
- **It IS:** A statement-level fixed-to-free format converter
- **It IS:** A smart fixed-format editing assistant
- **It IS NOT:** A refactoring or modernization tool
- **It IS NOT:** An RPG Cycle converter (no level-break indicators, no I/O specs)
- Works on `.rpgle`, `.sqlrpgle`, `.rpgleinc` files
- Full undo support: `Cmd+Z` / `Ctrl+Z` reverts any conversion

---

## Slide 4 — How It Works (The Core Feature)
- Select one line, multiple lines, or the entire file
- Right-click → **"Convert RPG IV to Free Format"**
- The selected fixed-format statements are replaced in-place with free-format equivalents
- Operates at the *statement* level — multi-line statements are handled as a unit
- Available in the right-click context menu as the **first option listed**

> Demo opportunity: single line → select all → undo

---

## Slide 5 — Supported Specification Types

| Spec | Fixed-Format Example | Free-Format Output |
|------|---------------------|--------------------|
| **H** (Header) | `H DFTACTGRP(*NO)` | `CTL-OPT DFTACTGRP(*NO);` |
| **F** (File) | `F CUSTMAST IF E K DISK` | `DCL-F CUSTMAST DISK(*EXT) USAGE(*INPUT) KEYED;` |
| **D** (Definition) | `D myVar S 10A` | `DCL-S myVar CHAR(10);` |
| **C** (Calculation) | `C EVAL result = a + b` | `result = a + b;` |
| **P** (Procedure) | `P myProc B` | `DCL-PROC myProc;` |
| **SQL** | `/EXEC SQL` blocks | Reformatted free-style SQL embed |

---

## Slide 6 — Multi-Line & Compound Statement Support
- A single RPG *statement* can span many physical lines (e.g., long D-spec keyword lists, compound IF/ELSEIF blocks)
- Place cursor **anywhere** on the statement → right-click → converts the **entire statement** automatically
- Supports compound opcodes: `IFxx/ANDxx/ORxx/WHENxx/CASxx` → proper `IF/ELSEIF/ELSE` chains
- **CASxx best practice:** Select the entire `CASxx...ENDCS` block for correct `IF/ELSEIF/ELSE` generation

---

## Slide 7 — Conditioning Indicators — Fully Supported
- Resulting indicators (columns 54–59) are converted
- Opcodes conditioned by indicators (columns 7–9) are wrapped in `IF/ENDIF`
- For legacy conditional opcodes (`IFxx`, `WHENxx`, `CASxx`), indicators are **merged into the condition**
- Example:

```
C  30        IFGT      0          -- Indicator 30 conditioning the IF
```
Becomes:
```rpgle
if *in30 and ScanPos > 0;
```

---

## Slide 8 — Key Opcode Conversions: Highlights
- **MOVE / MOVEL** → `EVAL` / `EVALR` with proper `%CHAR`, `%DEC`, `%EDITC` as needed
- **MOVEA** → `%SUBARR(*IN:n) = %LIST(...)` or `FOR` loop (configurable)
- **DO** → `FOR` loop with auto-generated counter variable
- **SUBST / SCAN / CAT / XLATE** → `%SUBST`, `%SCAN`, `%TRIM`, `%XLATE` BIFs
- **MHHZO / MHLZO / MLLZO / MLHZO** → `%BITxx` built-in functions
- **LOOKUP** → `%LOOKUPxx` / `%TLOOKUPxx`
- **CASxx** → `IF / ELSEIF / ELSE / ENDIF`
- **GOTO** (within subroutines targeting ENDSR label) → `LEAVESR`
- **TESTB / TESTZ / TESTN / BITON / BITOFF** → free-format equivalents

---

## Slide 9 — Definition Spec (D-Spec) Intelligence
- Converts standalone fields, data structures, prototypes, and procedure interfaces
- Handles **from/to column notation** → `CHAR(len) POS(n)`
- Detects parent context (DS subfield vs PR/PI parameter) to default type correctly:
  - DS subfields → Zoned decimal
  - PR/PI parameters → Packed decimal
- **PACKEVEN** keyword handled and removed (not valid in free format)
- **Binary (B) fields** → configurable: always INT, auto (decimal=0), or BINDEC
- **INZ keyword** auto-added to data structures (configurable)
- Long field name continuations (`...`) properly resolved

---

## Slide 10 — File Spec (F-Spec) Intelligence
- Maps legacy device/usage combinations to modern `USAGE(*INPUT)`, `USAGE(*UPDATE:*DELETE)`, etc.
- External file keyword → optional `DISK(*EXT)` flag (configurable)
- `WORKSTN` combined I/O (`CF`) → `USAGE(*INPUT:*OUTPUT)` or plain
- Keyed files → `KEYED` keyword preserved
- `USROPN`, `RENAME`, and other F-spec keywords carried through correctly

---

## Slide 11 — Embedded SQL Support
- `/EXEC SQL ... /END-EXEC` blocks in fixed-format style are reformatted
- SQL keywords are properly recognized — host variable names that are also SQL keywords (e.g., `FROM`, `TO`, `JOIN`) handled correctly
- Maintains SQL indentation and structure

---

## Slide 12 — Directive & Legacy Code Cleanup (Bonus)
- `/FREE` and `/END-FREE` → automatically commented out (deprecated by IBM) *(configurable)*
- `/COPY` → `/INCLUDE` for RPGLE files *(configurable per source type)*
- `/EJECT`, `/SKIP`, `/SPACE`, `/TITLE` → removed as legacy directives *(configurable)*
- RPG II-style column 1–5 sequence numbers / change codes → preserved as `//` comments
- Column 81–100 inline comments → converted to `// ...` and placed above the statement

---

## Slide 13 — Smart RPG Tab Key
*For fixed-format editing — not just conversion*
- `TAB` / `Shift+TAB` moves the cursor **column-by-column** within the RPG IV specification layout
- **Non-destructive** — existing code is never shifted or overwritten
- Spec-aware: on a C-spec, tabs through Factor 1 → Opcode → Factor 2 → Result → Indicators
- Works on H, F, D, C, P specs — each with their own column layout
- Toggle on/off via **Status Bar button** (bottom-right of editor) or settings
- Automatically **disabled** in `**FREE` (fully free) source files

---

## Slide 14 — Smart RPG Enter Key
*For fixed-format editing — keep your lines intact*
- Pressing `Enter` does **not** break the current fixed-format line at the cursor
- A **new line is inserted** below, pre-populated with the same spec type (e.g., `C` on a C-spec line)
- Cursor is positioned at the first non-blank column of the prior line — ready to type
- Modes: `fixedOnly` (default), `fixedAndFree`, `*ALL`, or `disable`
- Prevents accidental destruction of column-sensitive code
- Compatible with GitHub Copilot suggestions (suggestion is accepted first, then Smart Enter fires)

---

## Slide 15 — Columnar Boundary Guides (Visual Rulers)
- Vertical guidelines drawn at each RPG IV specification column boundary
- The **current column area** (e.g., Opcode, Factor 2) is **highlighted** as you type
- Works on all spec types: H, F, D, C, I, P
- Can be enabled **independently** of Smart Tab/Enter (`enableRPGColumnGuides` setting)
- Configurable colors for light mode and dark mode
- Cleared automatically when `**FREE` is detected
- *Tip:* Turn off `vscode-rpgle` Format Ruler via `Shift+F4` for cleanest display

---

## Slide 16 — Comment / Uncomment RPG Lines
- Right-click → **"Comment RPG IV Source Line"** / **"Uncomment RPG IV Source Line"**
- **Fixed-format:** inserts/removes `*` at column 7, shifting content accordingly
- **Free-format:** prepends/removes `//` prefix while preserving indentation
- **Mixed-format files:** detects each line's format individually
- Works on single lines or multi-line selections
- Line-oriented — does not require selecting complete statements

---

## Slide 17 — Settings Quick-Access (Context Menu)
- Right-click in any RPG editor → **"RPGIV2Free Settings"** → opens extension settings directly
- Right-click → **"Code for IBM i Settings"** → opens Code for IBM i settings
- Both are also available via the Command Palette
- No more hunting through VS Code's settings tree

---

## Slide 18 — Key Configurable Settings

| Setting | Default | Purpose |
|---------|---------|---------|
| `rightMargin` | 76 | Max line width of converted output |
| `leftMargin` | 10 | Indent for first converted line |
| `convertBINTOINT` | auto | B-type fields → INT when decimals = 0 |
| `addINZ` | true | Auto-add INZ to data structures |
| `altMOVEL` | true | Add `%SUBST` comment alternative for MOVEL |
| `indyMOVEAStyle` | LIST | MOVEA → FOR loop or %SUBARR/%LIST |
| `RemoveFREEDirective` | true | Comment out `/free` / `/end-free` |
| `ReplaceCOPYwithINCLUDE_RPG` | true | `/copy` → `/include` for RPGLE |
| `tempVarName1` | `f2f_tempSTG` | Work variable name for string opcodes |
| `tempVarName2` | `f2f_tempDO` | Counter variable name for DO→FOR |

---

## Slide 19 — What's NOT Converted (Know the Limits)
- **Input (I) and Output (O) specs** — converting these would be refactoring, not in scope
- **Level Break Indicators** — RPG Cycle concepts not supported
- **Primary / Secondary file declarations** — RPG Cycle file usage
- **Conditioning indicators on some edge cases** — some manual review may be needed
- **GOTO** to labels that are not ENDSR tags — not converted
- When a conversion cannot be done, the line is **left untouched** — always safe to undo

---

## Slide 20 — Integration: vscode-rpgle (Halcyon)
*Works alongside RPGIV2FREE — complementary tools*
- **Language server:** syntax highlighting, code completion (IntelliSense), hover documentation
- **Outline View:** navigate procedures, variables, and data structures in the file outline panel
- **Linter:** flags code quality issues, enforces style rules in `**FREE` format
- **Column Assist** (`Cmd+Shift+F4`): GUI helper for constructing fixed-format specs — useful for *reading* legacy code before converting
- **Format Ruler** (`Shift+F4`): toggle fixed-format column ruler (complement to RPGIV2FREE's columnar guides)
- **Move Left / Right** (`Ctrl+[`, `Ctrl+]`): shift content within fixed-format columns

---

## Slide 21 — Integration: Code for IBM i (Halcyon)
*Connect VS Code directly to your IBM i system*
- **Connect to IBM i:** Edit source members directly from IFS or QSYS library source files
- **Source Member browsing:** Navigate libraries → source files → members without leaving VS Code
- **Deploy workspace:** push local changes back to the system
- **Search source files:** grep across source members on the IBM i
- **Integrated terminal:** green-screen-style access via 5250 terminal or SSH
- **Variable/symbol database:** RPGIV2FREE uses this database for intelligent opcode conversions (e.g., SUBST, MOVE field types)

---

## Slide 22 — Typical Workflow (Putting It All Together)
1. **Connect** to IBM i via Code for IBM i → open source member
2. **vscode-rpgle** provides syntax highlighting and IntelliSense as you read the code
3. Use **Columnar Guides** to orient yourself in fixed-format code
4. Use **Smart Tab / Smart Enter** to safely edit fixed-format lines if needed
5. Select lines (or `Ctrl+A` for all) → right-click → **Convert RPG IV to Free Format**
6. Review results; **Ctrl+Z** to undo any statement that didn't convert as expected
7. **Comment out** any lines not ready to convert yet
8. Save → re-compile → iterate

---

## Slide 23 — Getting Started
1. Install from VS Code Marketplace: search **"rpgiv2free"** or **"Bob Cozzi"**
2. Also install: **halcyontechltd.vscode-rpgle** and **halcyontechltd.code-for-ibmi**
3. Open any `.rpgle` or `.sqlrpgle` file
4. Right-click → **Convert RPG IV to Free Format**
5. Configure settings at: right-click → **RPGIV2Free Settings**
6. Report issues: [github.com/bobcozzi/rpgiv2free/issues](https://github.com/bobcozzi/rpgiv2free/issues)

---

## Slide 24 — Closing / Q&A
**Bob Cozzi's RPGIV2FREE** — Version 1.12.18 (Current)
- MIT Licensed — Free to use
- Active development — frequent releases
- Community-driven issue tracking on GitHub

> *"The fastest path from fixed-format RPG IV to free-format — without breaking your code."*

---

*Presentation flow: Slides 2–3 establish **why**, Slides 4–11 cover **what it converts**, Slides 12–17 cover **editor productivity features**, Slides 18–19 set **expectations**, Slides 20–22 show **ecosystem integration**, Slides 23–24 close with **getting started**.*
