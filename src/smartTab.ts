/**
 * MIT License
 *
 * Copyright (c) 2025 Robert Cozzi, Jr.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import * as vscode from 'vscode';
import * as rpgiv from './rpgedit';
import * as types from './types'; // <-- restore the types import so setSuppressTabZoneUpdate works

// helper to accept suggestions if present
async function acceptAnySuggestionIfShown(): Promise<void> {
  try {
    await vscode.commands.executeCommand('editor.action.inlineSuggest.commit');
  } catch {
    // ignore if no inline suggestion or command not available
  }
  try {
    await vscode.commands.executeCommand('acceptSelectedSuggestion');
  } catch {
    // ignore if no classic suggestion or command not available
  }
}

// Tab stops by spec type — update or expand as needed
//    *. 1 ...+... 2 ...+... 3 ...+... 4 ...+... 5 ...+... 6 ...+... 7 ...+... 8 .. v
//   FFilename++IPEASF.....L.....A.Device+.Keywords+++++++++++++++++++++++++++++Comments++++++++++++++
//   FCUSTMAST  IF   E             DISK    USROPN
// .....D*ame+++++++++++ETDsFrom+++To/L+++IDc.Keywords+++++++++++++++++++++++++++++Comments++++++++++++++
//  *. 1 ...+... 2 ...+... 3 ...+... 4 ...+... 5 ...+... 6 ...+... 7 ...+... 8
// CL0N01Factor1+++++++Opcode&ExtFactor2+++++++Result++++++++Len++D+HiLoEq.
// C     baseText      CAT       A:1           X
// CL0N01Factor1+++++++Opcode&ExtExtended-factor2++++++++++++++++++++++++++
// C                   IF        A = B
const RPG_TAB_STOPS: Record<string, number[]> = {
  H: [1, 6, 7, 81],
  F: [1, 6, 7, 17, 18, 19, 20, 21, 22, 23, 28, 29, 34, 36, 43, 44, 81],
  D: [1, 6, 7, 22, 23, 24, 26, 33, 40, 41, 43, 44, 81],
  C: [1, 6, 7, 9, 12, 26, 36, 50, 64, 69, 71, 73, 75, 77, 81],
  CX: [1, 6, 7, 9, 26, 36, 81],
  I:    [1, 6, 7, 17, 19, 20, 21, 23, 28, 29, 30, 31, 36, 37, 38, 39, 44, 45, 46, 47, 81],  // Prog-described record: name, seq, num, opt, RI, 3× Pos/N/CC
  IAnd: [1, 6, 16, 21, 23, 28, 29, 30, 31, 36, 37, 38, 39, 44, 45, 46, 47, 81],             // AND/OR continuation: connector, RI, 3× Pos/N/CC
  IX:   [1, 6, 31, 35, 37, 42, 47, 49, 63, 65, 67, 69, 71, 73, 75, 81],                      // Prog-described field: fmt, from, to, dec, name, level/match/relation, indicators
  IER:  [1, 6, 7, 17, 21, 23, 81],                                                            // Ext-described record: record name, RI indicator
  IEF:  [1, 6, 21, 31, 49, 63, 65, 69, 71, 73, 75, 81],                                      // Ext-described field: ext name, RPG name, level/match, indicators
  O:    [1, 6, 7, 17, 18, 21, 24, 27, 30, 40, 43, 46, 49],  // Record ID: name, type, flag, 3× indicators, EXCEPT, spacing
  OAnd: [1, 6, 16, 21, 24, 27, 30],                          // AND/OR continuation: AND keyword, 3× indicators, EXCEPT name
  OX:   [1, 6, 21, 24, 27, 30, 44, 45, 47, 52, 53],         // Prog-described field: indicators, name, edit code, end pos, constant
  OFC:  [1, 6, 53],                                          // Field constant continuation
  OEF:  [1, 6, 21, 24, 27, 30, 45],                         // Ext-described field: indicators, name, blank-after
  P: [1, 6, 7, 24, 44, 81]
};

// Map from editor.document.uri.toString() to an array of ranges per line
const tabStopRangesPerEditor: Map<string, vscode.Range[][]> = new Map();

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
  if (!specChar) return [];
  const stops = RPG_TAB_STOPS[specChar] || [];
  return stops.map(stop => Math.max(0, stop - 1));
}

function getNextStop(current: number, stops: number[], reverse: boolean): number | undefined {
  if (!stops.length) return undefined;

  if (!reverse) {
    // If current is at or beyond the last stop, return undefined
    if (current >= stops[stops.length - 1] - 1) {
      return undefined;
    }
    for (const stop of stops) {
      if (stop > current) {
        return Math.max(0, stop);
      }
    }
    return undefined;
  } else {
    // If current is at or before the first stop, return undefined
    if (current <= stops[0]) {
      return undefined;
    }
    for (let i = stops.length - 1; i >= 0; i--) {
      if (stops[i] < current) {
        return Math.max(0, stops[i]);
      }
    }
    return undefined;
  }
}

function getCurrentTabRange(col: number, stops: number[]): [number, number] {
  for (let i = 0; i < stops.length - 1; i++) {
    if (col >= stops[i] && ((i + 1) < stops.length && col < stops[i + 1])) {
      return [stops[i], stops[i + 1]];
    }
  }
  // return [0, 0];
  return [-1, -1];
}
function getStmtRule(line: string): string {
  let specType = '';
  const lineType = rpgiv.getSpecType(line);
  if (lineType && lineType.trim() !== '') {
    specType = lineType.toUpperCase();
    specType = getStmtVariant(line, specType);
  }
  return specType;
}

export function getStmtVariant(line: string, specType: string): string {
  let varient = specType;
  switch (specType) {
    case 'C':
      if (rpgiv.isExtFactor2(line)) {
        varient = 'CX';  // Extended Factor 2 opcode
      }
      break;

    case 'O': {
      // AND continuation: cols 7-15 blank, AND keyword at cols 16-18
      if (rpgiv.getCol(line, 7, 15).trim() === '' &&
          rpgiv.getCol(line, 16, 18).toUpperCase().trim() === 'AND') {
        varient = 'OAnd';
      } else if (rpgiv.getCol(line, 7, 16).trim() !== '') {
        varient = 'O';                               // Record identification line
      } else if (rpgiv.getCol(line, 7, 52).trim() === '') {
        varient = 'OFC';                             // Constant continuation
      } else if (rpgiv.getCol(line, 47, 51).trim() !== '') {
        varient = 'OX';                              // Program-described field
      } else {
        varient = 'OEF';                             // Externally-described field
      }
      break;
    }

    case 'I': {
      const iCols715  = rpgiv.getCol(line, 7, 15).trim();
      const iConxn    = rpgiv.getCol(line, 16, 18).toUpperCase().trim();
      const iName716  = rpgiv.getCol(line, 7, 16).trim();
      const iCols1720 = rpgiv.getCol(line, 17, 20).trim();
      const iExtName  = rpgiv.getCol(line, 21, 30).trim();
      const iProgFld  = rpgiv.getCol(line, 31, 74).trim();

      if (!iCols715 && (iConxn === 'AND' || iConxn === 'OR')) {
        varient = 'IAnd';                            // AND/OR continuation
      } else if (iName716) {
        varient = iCols1720 ? 'I' : 'IER';          // Prog- or ext-described record
      } else if (iExtName) {
        varient = 'IEF';                             // Ext-described field
      } else if (iProgFld) {
        varient = 'IX';                              // Prog-described field
      }
      break;
    }
  }
  return varient;
}

export async function handleSmartTab(reverse: boolean): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const doc = editor.document;
  const langId = doc.languageId;
  if (langId !== 'rpgle' && langId !== 'sqlrpgle' && langId !== 'rpginc') return;

  // Read config at runtime to respect user setting changes
  const runtimeConfig = vscode.workspace.getConfiguration('rpgiv2free');
  const smartTabEnabled = runtimeConfig.get<boolean>('enableRPGSmartTab', true);

  // If Smart Tab is disabled, use default VS Code behavior
  if (!smartTabEnabled) {
    await vscode.commands.executeCommand(reverse ? 'outdent' : 'tab');
    return;
  }

  const cursor = editor.selection.active;
  const line = doc.lineAt(cursor.line);
  const lineText = line.text;

  // Determine whether the document is free-format and whether the current line is a valid fixed-format line.
  const isFreeFormatDoc = rpgiv.isFreeFormatRPG(doc);
  const curLineIsValidFixed = rpgiv.isValidFixedFormat(lineText);

  // Only accept/commit suggestions when the DOCUMENT is free-format AND the current line is NOT a valid fixed-format statement.
  if (isFreeFormatDoc && !curLineIsValidFixed) {
    const docVersionBefore = doc.version;
    await acceptAnySuggestionIfShown();
    if (doc.version !== docVersionBefore) {
      // A suggestion was accepted and the document changed — let VS Code handle cursor/insert behavior.
      return;
    }
  } else {
    const suggestVisible = Boolean((vscode as any).window.activeTextEditor?.options?.suggestWidgetVisible);
    if (suggestVisible) {
      await vscode.commands.executeCommand(reverse ? 'outdent' : 'tab');
      return;
    }
  }

  if (isFreeFormatDoc) {
    await vscode.commands.executeCommand(reverse ? 'outdent' : 'tab');
    return;
  }

  // DELETE THIS LINE (line 204):

  // Is it a Fixed Format statement?
  const specChar = getStmtRule(lineText);
  if (lineText.length < 6 || !specChar || !RPG_TAB_STOPS[specChar]) {
    await vscode.commands.executeCommand(reverse ? 'outdent' : 'tab');
    return;
  }

  const stops = getTabStops(lineText);
  if (stops.length === 0 || (stops[0] === 0 && stops.length === 1)) {
    await vscode.commands.executeCommand(reverse ? 'outdent' : 'tab');
    return;
  }

  const lastTabStop = stops[stops.length - 1];
  let newCol = getNextStop(cursor.character, stops, reverse);
  console.log('Current/New columns:', cursor.character + 1, newCol, 'stops:', stops);

  // 1. If there is a next tab stop, move to it (including the last one)
  if (typeof newCol === "number" && newCol > cursor.character) {
    // Pad if needed
    if (newCol > cursor.character && newCol >= lineText.length) {
      const padding = " ".repeat(newCol - lineText.length);
      await editor.edit(editBuilder => {
        editBuilder.insert(
          new vscode.Position(cursor.line, lineText.length),
          padding
        );
      }, { undoStopBefore: false, undoStopAfter: false });
    }

    // Highlight tab zone if desired
    const [startCol, endCol] = getCurrentTabRange(cursor.character, stops);
    let range: vscode.Range | undefined = undefined;
    if (
      startCol >= 0 &&
      endCol >= 0 &&
      !(startCol === endCol && startCol === 0)
    ) {
      range = new vscode.Range(cursor.line, startCol, cursor.line, endCol);
    }

    // Move cursor (REPLACE line 241 - remove Math.min)
    const newPos = new vscode.Position(cursor.line, newCol);
    editor.selection = new vscode.Selection(newPos, newPos);
    editor.revealRange(new vscode.Range(newPos, newPos));
    if (range) {
      editor.setDecorations(tabBoxDecoration, [range]);
    }
    return;
  }

  if (typeof newCol === "number") {
    // Pad if needed (for forward tab only)
    if (!reverse && newCol > cursor.character && newCol >= lineText.length) {
      const padding = " ".repeat(newCol - lineText.length);
      await editor.edit(editBuilder => {
        editBuilder.insert(
          new vscode.Position(cursor.line, lineText.length),
          padding
        );
      }, { undoStopBefore: false, undoStopAfter: false });
    }

    // Move cursor (REPLACE line 256 - remove Math.min)
    const newPos = new vscode.Position(cursor.line, newCol);
    editor.selection = new vscode.Selection(newPos, newPos);
    editor.revealRange(new vscode.Range(newPos, newPos));
    return;
  }

  // 2. If there is no next tab stop, move to the next line (only for Tab, not Shift+Tab)
  if (!reverse) {
    const nextLine = cursor.line + 1;
    if (nextLine >= doc.lineCount) {
      // Create a new line if we're at EOF
      await editor.edit(editBuilder => {
        editBuilder.insert(new vscode.Position(cursor.line, lineText.length), '\n');
      });
    }
    const nextLineText = doc.lineAt(Math.min(nextLine, doc.lineCount - 1)).text;
    const nextStops = getTabStops(nextLineText);
    const firstTab = nextStops.length > 1 ? nextStops[1] : 5;  // get 2nd tab (first is alway column 1)

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
  }

  // --- Optional: Shift+Tab trailing space trim ---
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
}


export async function highlightCurrentTabZone(editor: vscode.TextEditor): Promise<void> {
  const cursor = editor.selection.active;
  const doc = editor.document;

  if (!editor) return;
  const langId = editor.document.languageId;
  if (langId !== 'rpgle' && langId !== 'sqlrpgle' && langId !== 'rpginc') {
    // Optionally: clear decorations here
    return;
  }
  const lang = doc.languageId.toLowerCase();
  if (!rpgiv.isFixedFormatRPG()) return;

  const lineText = doc.lineAt(cursor.line).text;
  if (lineText.length < 6 || rpgiv.isSkipStmt(lineText)) {
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

export function drawTabStopLines(editor: vscode.TextEditor, lineNbr: number): void {

  if (!editor || rpgiv.isFreeFormatRPG()) {
    return;
  }
  const langId = editor.document.languageId;
  if (langId !== 'rpgle' && langId !== 'sqlrpgle' && langId !== 'rpginc') {
    // Optionally: clear decorations here
    return;
  }

  const doc = editor.document;
  const uriKey = doc.uri.toString();

  // Get or initialize the per-line ranges array for this editor
  let perLineRanges = tabStopRangesPerEditor.get(uriKey);
  if (!perLineRanges) {
    perLineRanges = Array(doc.lineCount).fill(null).map(() => []);
    tabStopRangesPerEditor.set(uriKey, perLineRanges);
  }

  // Recompute tab stops for this line
  const decorations: vscode.Range[] = [];
  if (lineNbr < doc.lineCount) {
    const line = doc.lineAt(lineNbr);
    const stops = getTabStops(line.text);

    for (const stop of stops) {
      if (stop > 0 && stop < line.text.length) {
        const pos = new vscode.Position(lineNbr, stop);
        decorations.push(new vscode.Range(pos, pos));
      }
    }
  }

  // Update only this line's ranges
  perLineRanges![lineNbr] = decorations; // Non-null assertion ensures TypeScript knows it's defined

  // Apply decorations only for visible ranges
  const visibleRanges = editor.visibleRanges;
  const visibleDecorations = visibleRanges.flatMap(range => {
    const visibleLines = [];
    for (let i = range.start.line; i <= range.end.line; i++) {
      visibleLines.push(...(perLineRanges![i] || [])); // Non-null assertion ensures TypeScript knows it's defined
    }
    return visibleLines;
  });

  editor.setDecorations(verticalLineDecoration, visibleDecorations);
}

export function applyColumnarDecorations(editor: vscode.TextEditor, smartTabEnabled: boolean) {
  if (!editor || rpgiv.isFreeFormatRPG()) return;
  const langId = editor.document.languageId;
  if (langId !== 'rpgle' && langId !== 'sqlrpgle' && langId !== 'rpginc') {
    // Optionally: clear decorations here
    return;
  }

  const doc = editor.document;
  const uriKey = doc.uri.toString();

  if (smartTabEnabled) {
    const perLineRanges: vscode.Range[][] = [];
    const visibleRanges = editor.visibleRanges; // Get visible ranges

    for (const range of visibleRanges) {
      for (let i = range.start.line; i <= range.end.line; i++) {
        const line = doc.lineAt(i);
        if (rpgiv.isSkipStmt(line.text)) continue;

        const stops = getTabStops(line.text);
        if (!stops || stops.length === 0) continue;

        const ranges: vscode.Range[] = [];
        stops.forEach(col => {
          if (line.text.length > col) {
            const pos = new vscode.Position(i, col);
            ranges.push(new vscode.Range(pos, pos));
          }
        });
        perLineRanges[i] = ranges;
      }
    }

    tabStopRangesPerEditor.set(uriKey, perLineRanges);
    const allRanges = perLineRanges.flat();
    editor.setDecorations(verticalLineDecoration, allRanges);
  } else {
    // Clear decorations and remove from map
    editor.setDecorations(verticalLineDecoration, []);
    tabStopRangesPerEditor.delete(uriKey);
  }
}
