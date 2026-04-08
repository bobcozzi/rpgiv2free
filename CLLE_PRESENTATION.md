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
# PowerPoint Outline: IBM CLLE — CL Language Tools for VS Code

---

## Slide 1 — IBM CLLE: CL Language Tools for VS Code
From IBM — A full-featured language extension for IBM i Control Language
Works with **Code for IBM i** (by Halcyon Software)
Supports `.cl`, `.bnd`, and `.cmd` source types
Brings IntelliSense-style features to CL development
Available free on the VS Code Marketplace

---

## Slide 2 — What is CL?
- **CL (Control Language)** is the command language of IBM i (AS/400)
- Used for: job control, submitting jobs, working with objects, running programs
- Compiled into CL programs (`.CLLE`) or used in `.CMD` objects
- CL still powers thousands of production IBM i systems
- Historically edited on 5250 green-screen or RDi — now VS Code!

---

## Slide 3 — What the IBM CLLE Extension Provides
- **Syntax Highlighting** — proper colorization for CL keywords and values
- **Outline View** — file structure at a glance in the Explorer panel
- **Content Assist** — auto-complete for CL commands and parameters
- **Go to / Peek Definition** — navigate to where variables and labels are defined
- **Find All References** — see every usage of a variable or label
- **Hover Documentation** — view IBM command docs without leaving the editor
- **Syntax Checking** — validate CL syntax against the IBM i system

---

## Slide 4 — Activated File Types
The extension activates automatically for these source types:

| File Extension | CL Type |
|---|---|
| `.cl` or `.clle` | CL Program source (CLLE) |
| `.bnd` | Service Program binder source |
| `.cmd` | Command definition source |

> All three types share the same language intelligence features

---

## Slide 5 — Outline View
- The VS Code **Outline** panel shows your CL program's structure
- Provides a navigable tree of: subroutines, labels, declared variables, files
- Works with the standard VS Code **Breadcrumb** navigation bar
- Click any item in the outline to jump directly to that line
- Great for large CL programs with many subroutines

---

## Slide 6 — Content Assist: Command Completion
- Press **Ctrl+Space** to trigger auto-complete anywhere in a `.cl` file
- Suggests valid CL command names as you type
- **Parameter completion** — after typing a command name, suggests its supported keywords
- Keyword descriptions come from IBM i command definitions
- Requires a live connection via **Code for IBM i** for full IBM i command catalog

---

## Slide 7 — Go To Definition & Find References
**Go to Definition** (F12 or Ctrl+Click):
- Jump to where a `DCL` variable, `DCLF` file, or subroutine label is declared
- Works across the current source file

**Find All References** (Shift+F12):
- Locate every place a variable, label, or file name is used
- Results appear in the VS Code References panel

**Peek Definition** (Alt+F12):
- View the declaration inline without leaving your current position

---

## Slide 8 — Hover Documentation
- Hover your cursor over a **CL command name** to see its documentation
- Hover over a **parameter keyword** to see its valid values and description
- Documentation is fetched live from the IBM i system via **Code for IBM i**
- The `vscode-clle.general.displayCommandDocumentation` setting must be enabled
- Requires an active IBM i connection — shows nothing if offline

---

## Slide 9 — Syntax Checking
Run the **"Check CL Syntax"** command:
- Validates the current `.cl` source against the connected IBM i system
- Errors appear in the VS Code **Problems** panel with line and column numbers
- Accessible from the **Command Palette**: `CL: Check CL Syntax`
- Also available via the editor toolbar (title bar icon)
- Requires an active Code for IBM i connection

---

## Slide 10 — Run Selected CL Command
- Select one or more CL statements in the editor
- Run command: **"Run selected CL command"**
- Submits the selected command(s) to the connected IBM i for execution
- Output appears in the VS Code **Output** or **Terminal** panel
- Useful for quick ad-hoc testing without creating a full program

---

## Slide 11 — Code Snippets
Type a keyword and press **Tab** to expand a full CL snippet:

| Trigger | What it inserts |
|---|---|
| `PGM` | Full program start/end boilerplate |
| `DCL` | Declare CL variable |
| `DCLF` | Declare file |
| `MONMSG` | Monitor message handler |
| `SELECT` | SELECT / WHEN / OTHERWISE block |
| `SUBR` | Subroutine start and end |
| `SBMJOB` | Submit Job skeleton |
| `CHGVAR` | Change Variable |

---

## Slide 12 — Integration with Code for IBM i
- IBM CLLE is designed to work **alongside** Code for IBM i
- Code for IBM i provides the IBM i **connection** and object browser
- CLLE extension uses that connection for:
  - Live command documentation on hover
  - Syntax checking against the real system
  - Running selected commands
- Without a connection, syntax highlighting, outline, and snippets still work

---

## Slide 13 — Configuration
One key setting:

**`vscode-clle.general.displayCommandDocumentation`**
- *Default:* enabled
- When on, hover tooltips fetch live IBM i CL command docs
- Disable if you want to suppress hover documentation fetching
- Configured in VS Code Settings (Ctrl+,) under "CL" or "CLLE"

---

## Slide 14 — Summary
IBM CLLE transforms VS Code into a first-class CL IDE:
- **Outline View** — navigate your CL program structure
- **IntelliSense** — command and parameter completion
- **Go to Definition / Find References** — code navigation
- **Hover docs** — IBM command documentation inline
- **Syntax check** — catch errors before compile
- **Run selection** — test CL commands interactively
- **Snippets** — common CL boilerplate at your fingertips
- Free, open source, from IBM
