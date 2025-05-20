import * as vscode from "vscode";
import * as ibmi from "./IBMi";  // Using your existing functions
import * as types from './types';


// Tab stops by spec type — update or expand as needed
//  *. 1 ...+... 2 ...+... 3 ...+... 4 ...+... 5 .. v
// FFilename++IPEASF.....L.....A.Device+.Keywords++
// FCUSTMAST  IF   E             DISK    USROPN
// DName+++++++++++ETDsFrom+++To/L+++IDc.Keywords++
//  *. 1 ...+... 2 ...+... 3 ...+... 4 ...+... 5 ...+... 6 ...+... 7 ...+... 8
// CL0N01Factor1+++++++Opcode&ExtFactor2+++++++Result++++++++Len++D+HiLoEq.
// C     baseText      CAT       A:1           X
// CL0N01Factor1+++++++Opcode&ExtExtended-factor2++++++++++++++++++++++++++
// C                   IF        A = B
const RPG_TAB_STOPS: Record<string, number[]> = {
  H: [1, 6, 7, 81],
  F: [1, 6, 7, 18, 19, 20, 21, 22, 28, 34, 36, 43, 44, 81],
  D: [1, 6, 7, 22, 23, 24, 26, 33, 40, 41, 43, 44, 81],
  C: [1, 6, 7, 9, 12, 26, 36, 50, 64, 69, 71, 73, 75, 77, 81],
  CX: [1, 6, 7, 9, 26, 36, 81],
  I: [1, 6, 7, 8, 10, 12, 17, 24, 39],
  O: [1, 6, 7, 8, 10, 12, 17, 24, 39],
  P: [1, 6, 7, 24, 44, 81]
};

const tabBoxDecoration = vscode.window.createTextEditorDecorationType({
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'rgba(100, 200, 255, 0.7)',
  backgroundColor: 'rgba(100, 150, 255, 0.2)',
  borderRadius: '2px',
  isWholeLine: false,
});

// Read user-specified color from settings, fallback to default if not set
const config = vscode.workspace.getConfiguration('rpgiv2free');
const themeKind = vscode.window.activeColorTheme.kind;
const isDarkMode = themeKind === vscode.ColorThemeKind.Dark;

// Get user-specified color for the active theme
const colorSetting = isDarkMode
  ? 'verticalTabColor_DarkMode'
  : 'verticalTabColor_LightMode';
const widthSetting = isDarkMode
  ? 'verticalTabWidth_DarkMode'
  : 'verticalTabWidth_LightMode';

const defaultDarkColor = 'rgba(80, 255, 80, 0.5)';
const defaultLightColor = 'rgba(0, 128, 0, 0.7)';
const defaultWidth = isDarkMode ? 0.6 : 1;

// Read from config with sensible defaults
const userColor = config.get<string>(colorSetting, isDarkMode ? defaultDarkColor : defaultLightColor);
const lineWidth = config.get<number>(widthSetting, defaultWidth);

// Create the decoration type
const verticalLineDecoration = vscode.window.createTextEditorDecorationType({
  borderColor: userColor,
  borderStyle: 'solid',
  borderWidth: `0 ${lineWidth}px 0 0`,  // Right-side vertical border
  isWholeLine: false,
});

function getTabStops(line: string): number[] {
  const specChar = getStmtRule(line);
  const stops = RPG_TAB_STOPS[specChar] || [];

  return stops.map(stop => Math.max(0, stop - 1));
}

function getNextStop(current: number, stops: number[], reverse: boolean): number | undefined {
  const sorted = reverse ? [...stops].reverse() : stops;

  for (const stop of sorted) {
    if ((reverse && stop < current) || (!reverse && stop > current)) {
      return Math.max(0, stop);
    }
  }

  return undefined; // No valid stop found
}

function getCurrentTabRange(col: number, stops: number[]): [number, number] {
  for (let i = 0; i < stops.length - 1; i++) {
    if (col >= stops[i] && col < stops[i + 1]) {
      return [stops[i], stops[i + 1]];
    }
  }
  // return [0, 0];
  return [-1, -1];
}
function getStmtRule(line: string): string {
  let specType = '';
  const lineType = ibmi.getSpecType(line);
  switch (lineType) {
    case 'h':
      specType = 'H';
      break
    case 'f':
      specType = 'F';
      break;
    case 'd':
      specType = 'D';
      break
    case 'I':
      specType = 'I';
      break;
    case 'c':
      specType = getCType(line);
      break;
    case 'o':
      specType = 'O';
      break;
    case 'p':
      specType = 'P';  // only 1 type of P spec
      break;
  }
  return specType;
}

export async function handleSmartTab(reverse: boolean): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  // Early exit: If suggestion widget is visible, let VS Code handle Tab
  if ((vscode as any).window.activeTextEditor?.options.suggestWidgetVisible) {
    await vscode.commands.executeCommand(reverse ? 'outdent' : 'tab');
    return;
  }

  const doc = editor.document;
  if (ibmi.isNOTFixedFormatRPG(doc)) return;

  const config = vscode.workspace.getConfiguration('rpgiv2free');
  const maxRPGLen = config.get<number>('maxRPGSourceLength', 100);  // Default to 80
  const cursor = editor.selection.active;
  const line = doc.lineAt(cursor.line);
  const lineText = line.text;

  if (lineText.length < 6) {
    // Fall back to normal Tab or Shift+Tab
    vscode.commands.executeCommand(reverse ? 'outdent' : 'tab');
    return;
  }

  const specChar = getStmtRule(lineText);
  if (!specChar || !RPG_TAB_STOPS[specChar]) {
    vscode.commands.executeCommand(reverse ? 'outdent' : 'tab');
    return;
  }

  const stops = getTabStops(lineText);
  if (stops.length === 0 || (stops[0] === 0 && stops.length === 1)) {
    // No valid tab stops found
    vscode.commands.executeCommand(reverse ? 'outdent' : 'tab');
    return;
  }

  const newCol = getNextStop(cursor.character, stops, reverse);
  if (newCol === undefined || newCol === cursor.character) {
    const nextLine = cursor.line + 1;

    if (nextLine >= doc.lineCount) {
      // Create a new line if we're at EOF
      await editor.edit(editBuilder => {
        editBuilder.insert(new vscode.Position(cursor.line, lineText.length), '\n');
      });
    }

    const nextLineText = doc.lineAt(Math.min(nextLine, doc.lineCount - 1)).text;
    const nextStops = getTabStops(nextLineText);
    const firstTab = nextStops.length > 0 ? nextStops[0] : 6;

    // Pad next line if needed
    if (nextLineText.length < firstTab) {
      const padAmount = firstTab - nextLineText.length;
      await editor.edit(editBuilder => {
        editBuilder.insert(new vscode.Position(nextLine, nextLineText.length), ' '.repeat(padAmount));
      }, { undoStopBefore: false, undoStopAfter: false });
    }

    const wrappedPos = new vscode.Position(nextLine, firstTab);
    editor.selection = new vscode.Selection(wrappedPos, wrappedPos);
    editor.revealRange(new vscode.Range(wrappedPos, wrappedPos));
    return;
  }
  const [startCol, endCol] = getCurrentTabRange(cursor.character, stops);

// Only skip decoration, not logic
let range: vscode.Range | undefined = undefined;
if (startCol >= 0 && endCol >= 0 && !(startCol === endCol && startCol === 0) &&
    cursor.character < stops[stops.length - 1]) {
  range = new vscode.Range(cursor.line, startCol, cursor.line, endCol);
  }

// ...existing code...

// If Shift+Tab and cursor is at or beyond the last tab stop, trim trailing spaces
if (
  reverse &&
  cursor.character >= stops[stops.length - 1] &&
  /\s+$/.test(lineText)
) {
  const trimmed = lineText.replace(/\s+$/, "");
  await editor.edit(editBuilder => {
  editBuilder.replace(
    new vscode.Range(cursor.line, 0, cursor.line, lineText.length),
    trimmed
  );
}, { undoStopBefore: false, undoStopAfter: false });
}

// ...existing code...

  // Pad only if we're moving forward AND it's within a sane range
  if (newCol > cursor.character && newCol > lineText.length && newCol <= maxRPGLen - 1) {
    const padding = " ".repeat(newCol - lineText.length);
    await editor.edit(editBuilder => {
      editBuilder.insert(
        new vscode.Position(cursor.line, lineText.length),
        padding
      );
    }, { undoStopBefore: false, undoStopAfter: false });
  }

  const safeColumn = Math.min(newCol, maxRPGLen - 1);
  const newPos = new vscode.Position(cursor.line, safeColumn);
  editor.selection = new vscode.Selection(newPos, newPos);
  editor.revealRange(new vscode.Range(newPos, newPos));
  if (range) {
    editor.setDecorations(tabBoxDecoration, [range]);
  }
}

function getCType(line: string): string {
  return 'C';
}

export async function highlightCurrentTabZone(editor: vscode.TextEditor): Promise<void> {
  const cursor = editor.selection.active;
  const doc = editor.document;

  const lang = doc.languageId.toLowerCase();
  if (!ibmi.isFixedFormatRPG(doc)) return;

  const lineText = doc.lineAt(cursor.line).text;
  if (lineText.length < 6 || ibmi.isSkipStmt(lineText)) {
    editor.setDecorations(tabBoxDecoration, []);
    return;
  }

  const specChar = getStmtRule(lineText);
  if (!specChar || !RPG_TAB_STOPS[specChar]) {
    editor.setDecorations(tabBoxDecoration, []);
    return;
  }

  const stops = getTabStops(lineText);
  if (!stops || stops.length === 0 || (stops[0] === 0 && stops.length === 1)) {
    editor.setDecorations(tabBoxDecoration, []);
    return;
  }

  const [startCol, endCol] = getCurrentTabRange(cursor.character, stops);

  if (lineText.length === 0 && 999 < endCol) {
    const padding = ' '.repeat(endCol - lineText.length);
    const editPos = new vscode.Position(cursor.line, lineText.length);

    types.setSuppressTabZoneUpdate(true);

    await editor.edit(editBuilder => {
      editBuilder.insert(editPos, padding);
    }, {
      undoStopBefore: true,
      undoStopAfter: true
    });

    setTimeout(() => {
      types.setSuppressTabZoneUpdate(false);
    }, 50);

    return; // skip drawing tab zone until after padding
  }

  const range = new vscode.Range(cursor.line, startCol, cursor.line, endCol);
  editor.setDecorations(tabBoxDecoration, [range]);
}

export function drawTabStopLines(editor: vscode.TextEditor): void {
  const doc = editor.document;
  const decorations: vscode.DecorationOptions[] = [];

  for (let lineNum = 0; lineNum < doc.lineCount; lineNum++) {
    const line = doc.lineAt(lineNum);
    const specChar = getStmtRule(line.text);
    const stops = getTabStops(line.text);

    for (const stop of stops) {
      if (stop > 0 && stop < line.text.length) {
        const pos = new vscode.Position(lineNum, stop);
        decorations.push({
          range: new vscode.Range(pos, pos),
        });
      }
    }
  }

  editor.setDecorations(verticalLineDecoration, decorations);
}

export function applyColumnarDecorations(editor: vscode.TextEditor, smartTabEnabled: boolean) {
  if (!editor) return;

  const doc = editor.document;
  const lang = doc.languageId.toLowerCase();
  if (!["rpgle", "sqlrpgle"].includes(lang)) return;

  if (smartTabEnabled) {
    const ranges: vscode.Range[] = [];

    // Create "vertical line" decoration by adding a range at specific columns
    for (let i = 0; i < editor.document.lineCount; i++) {
      const line = editor.document.lineAt(i);
      if (ibmi.isSkipStmt(line.text)) continue; // Skip if line is a skip statement
      if (ibmi.isComment(line.text)) continue; // Skip if line is a comment
      const stops = getTabStops(line.text); // Get tab stops for the current line
      if (!stops || stops.length === 0) continue; // Skip if no tab stops found
      stops.forEach(col => {
        if (line.text.length > col) {
          const pos = new vscode.Position(i, col);
          ranges.push(new vscode.Range(pos, pos));
        }
      });

      }

    editor.setDecorations(verticalLineDecoration, ranges);
  } else {
    // Clear decorations
    editor.setDecorations(verticalLineDecoration, []);
  }
}