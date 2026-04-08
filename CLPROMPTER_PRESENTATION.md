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
# PowerPoint Outline: CLPrompter — IBM i CL Command Prompter for VS Code

---

## Slide 1 — CLPrompter: Prompt CL Commands Like IBM i F4 — in VS Code
Brings the classic IBM i **F4=Prompt** experience to VS Code
Works on `.cl`, `.clle`, `.cmd`, and `.bnd` source members
Integrates with **Code for IBM i** for live IBM i command definitions
By Bob Cozzi / CozziResearch
Currently in **PREVIEW** — keep your Undo key (Cmd+Z / Ctrl+Z) handy!

---

## Slide 2 — What is IBM i F4 Prompting?
- IBM i's 5250 green-screen has always had an **F4 key** for command prompting
- Pressing F4 on a CL command opens a full-screen parameter fill-in form
- Each parameter is labeled, described, and validated with allowed values
- Developers have relied on it for 40 years to build CL programs correctly
- CLPrompter recreates this experience natively inside VS Code

---

## Slide 3 — Getting Started
To prompt a CL command:
1. Open a `.cl`, `.clle`, `.cmd`, or `.bnd` file in VS Code
2. Place your cursor on the line containing the command to prompt
3. Press **F4** — or right-click and choose **"CL Prompter"** from the context menu
4. The prompter panel opens, pre-filled with any existing parameter values
5. Fill in or adjust the parameters, then press **Enter** to apply or **F3/Esc** to cancel

---

## Slide 4 — The Prompter Panel
- Opens as a VS Code **webview panel** alongside your editor
- Displays the CL command name at the top
- Each parameter is shown with:
  - Its **keyword name** (e.g., `LIB`, `OUTQ`, `JOBQ`)
  - A text input, dropdown, or textarea as appropriate for the parameter type
  - The allowed values or a description
- Values already present in your source are **pre-populated** automatically
- On **Enter**: the formatted CL statement is written back to your source

---

## Slide 5 — Visual Focus Indicator
- A **▶ arrow** indicator appears at the right edge of the label for the focused field
- Makes it instantly clear which parameter you are editing
- Especially helpful for commands with **20+ parameters**
- Indicator moves as you tab through fields
- Matches the directional cue style that IBM i 5250 users are familiar with

---

## Slide 6 — Keyboard Navigation
**TAB** key:
- Moves focus **forward** through all input fields, just like classic 5250
- No mouse required — full keyboard-only workflow supported
- TAB does not accidentally enter literal tab characters into values

**F4** (within a CMD/CMDSTR textarea):
- Opens a **nested prompter** for the embedded command
- Nested panel opens side-by-side, titled with "(nested)"
- Submitting the nested prompter returns its result to the parent field

**F3 / Esc**:
- Cancels the prompter and returns to the editor with no changes made

---

## Slide 7 — Nested Prompting (F4 within CMD)
Some CL commands accept another command as a parameter (e.g., `SBMJOB CMD()`):

1. In the SBMJOB prompter, type a command name in the CMD textarea
   (e.g., `CALL PGM(MYPGM)`)
2. Press **F4** while the cursor is in that textarea
3. A **second prompter** opens in a side-by-side panel for `CALL`
4. Fill in the CALL parameters and press **Enter**
5. The formatted command string is returned to SBMJOB's CMD field automatically

> Supports arbitrarily complex nested command chains

---

## Slide 8 — Comment Preservation
- **Trailing comments** on your CL command line are automatically detected
- Example: `DLTF FILE(MYLIB/WRKFILE)  /* Cleanup temp file */`
- Comments are preserved and correctly re-attached after prompting
- **Multi-line comments** are wrapped and indented to match IBM i style
- Single-line or end-of-line comments never get lost during prompting or formatting

---

## Slide 9 — Intelligent Formatting: ELEM Parameters
CL commands like `CHGJOB LOG(4 0 *SECLVL)` have **ELEM** (element) parameters:
- Multiple values that belong together in one logical group
- CLPrompter keeps ELEM groups **on a single line** when possible
- Prevents awkward mid-group line breaks that break readability
- Handles `SBMJOB` `EXTRA`, `LOG`, and other compound ELEM types correctly
- Nested parentheses in ELEM groups are correctly preserved

---

## Slide 10 — CL Source Formatter
CLPrompter includes a **standalone CL formatter** (separate from the prompter):

| Command | Action |
|---|---|
| Format CL (current line) | Re-formats the CL command on the cursor line |
| Format CL (file) | Re-formats all CL commands in the current file |

Formatting applies:
- Configurable label, command, keyword, and continuation column positions
- Correct right-margin wrapping with `+` or `-` continuation characters
- IBM i-style comment placement (same line when space permits)
- Blank line preservation between commands

---

## Slide 11 — Formatting Configuration
Fine-tune exactly where each part of a CL statement appears:

| Setting | Default | Purpose |
|---|---|---|
| `formatLabelPosition` | 2 | Column where command label starts |
| `formatCmdPosition` | 14 | Column where command name starts |
| `formatKwdPosition` | 25 | Column where first keyword starts |
| `formatContinuePosition` | 27 | Column for continuation lines |
| `formatRightMargin` | 72 | Maximum line length |
| `formatIndentComments` | *YES | Indent comments with code |

---

## Slide 12 — Case Conversion
CLPrompter can normalize case when returning from the prompter or formatting:

**`convertCmdAndParmNameCase`**
- `*UPPER` — `CHGVAR VAR(&X) VALUE(1)` ← uppercase command and keywords
- `*LOWER` — `chgvar var(&x) value(1)` ← all lowercase
- `*NONE` — leave case exactly as typed

**`convertParmValueToUpperCase`**
- When enabled: CL variables, operators, and built-in functions go uppercase
- Example: `'&pickles *bcat %trim(x)'` → `'&PICKLES *BCAT %TRIM(x)'`
- Applies to values returned from the prompter and during file formatting

---

## Slide 13 — Theme-Aware Colors
The prompter's parameter display adapts to your VS Code color theme:

- **Keyword color** — configurable via `clPrompter.kwdColor` (any CSS color)
- **Value color** — configurable via `clPrompter.kwdValueColor`
- **`kwdColorAutoAdjust`** — automatically adjusts keyword color for best contrast in light, dark, or high-contrast themes
- Works with any VS Code theme — no manual reconfiguration needed when you switch themes

---

## Slide 14 — Public API for Extension Authors
CLPrompter exposes a **programmatic API** so other extensions can invoke it:

```typescript
const clPrompterExt = vscode.extensions.getExtension('CozziResearch.clprompter');
if (clPrompterExt) {
    if (!clPrompterExt.isActive) await clPrompterExt.activate();
    const { CLPrompter } = clPrompterExt.exports;
    const result = await CLPrompter(commandString, extensionUri);
}
```

- **No npm package required** — access is through the VS Code extension API
- Two integration modes: **optional enhancement** or **required dependency**
- Returns the updated command string after prompting
- Documented in `CLPROMPTER_API.md`

---

## Slide 15 — Diagnostic Tools
For troubleshooting or reporting issues to support:

**Save Command XML** (`clPrompter.saveCmdXMLtoFile`):
- Writes the IBM i command definition XML to `cmdDefn.xml`
- Useful to see exactly what parameter structure was returned from IBM i
- Configurable output directory (`${tmpdir}`, `${userHome}`, or absolute path)

**Save Prompter HTML** (`clPrompter.savePrompterHTMLtoFile`):
- Saves the generated prompter HTML to `clPrompt-<cmdName>.html`
- Can be sent to support to diagnose display issues
- **Not recommended** for normal daily use — enable only when troubleshooting

---

## Slide 16 — Requirements & Integration
**Dependencies:**
- VS Code 1.80+ (any platform: macOS, Windows, Linux)
- **Code for IBM i** (by Halcyon) — provides the IBM i connection
- An active connection to an IBM i system (for command definitions)

**Works with:**
- Any `.cl`, `.clle`, `.bnd`, or `.cmd` source file
- IBM CLLE extension (syntax highlighting, outline, definition navigation)
- Any IBM i source opened via Code for IBM i member editing

---

## Slide 17 — Summary
CLPrompter gives IBM i CL developers the full F4 prompt experience in VS Code:
- **F4 key** — prompt any CL command instantly
- **Pre-populated fields** — existing parameter values loaded automatically
- **Nested prompting** — F4 inside CMD/CMDSTR opens a second prompter
- **Comment preservation** — trailing comments survive editing
- **CL Formatter** — format current line or entire file on demand
- **Case conversion** — uppercase, lowercase, or as-is
- **Configurable columns** — match your shop's CL formatting standards
- **Theme-aware colors** — looks right in any VS Code theme
- **Public API** — other extensions can invoke CLPrompter programmatically
