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
import { collectStmt } from './collectStmts';
import { getPARMIndexes, collectInlinePARMs, buildEntryOnExitBlock, findPARMParent, findOnExitInsertPosition,
  clearConversionState, getPendingPatches, findPRBlock, buildParmLines } from './opcodes';
import { collectCondCalc } from './collectCondCalc';
import { expandCompoundRange } from './compoundStmt';
import { convertHSpec } from './HSpec';
import { convertFSpec } from './FSpec';
import { convertDSpec } from './DSpec';
import { convertPSpec } from './PSpec';
import { convertCSpec } from './CSpec';
import { convertToFreeFormSQL } from './collectSQLSpec';
import { formatRPGIV } from './formatRPGIV';
import * as rpgiv from './rpgedit';
import { applyColumnarDecorations, drawTabStopLines } from './smartTab';

export function registerConvertToRPGFreeCommand(context: vscode.ExtensionContext, config: any) {
  const disposable = vscode.commands.registerCommand('rpgiv2free.convertToRPGFree', async () => {
    const editor = vscode.window.activeTextEditor;
    rpgiv.log('Convert RPG IV to Free Format Handler evoked');
    if (!editor) {
      vscode.window.showErrorMessage('No active editor window found. Convert RPGIV to Free Format cancelled.');
      return;
    }

    const doc = editor.document;
    clearConversionState();
    const allLines = doc.getText().split(rpgiv.getEOL());
    let specType = '';
    let newBeginIndex = -1;
    const processedLines = new Set<number>();
    const selectedLineIndexes = new Set<number>();
    const edits: { range: vscode.Range, text: string }[] = [];
    const extraDCLs: { insertAt: number, lines: string[], netLineChangeAtInsert: number }[] = [];

    try {
      for (const sel of editor.selections) {
        if (sel.isEmpty) {
          selectedLineIndexes.add(sel.active.line);
        } else {
          const start = Math.min(sel.start.line, sel.end.line);
          const end = Math.max(sel.start.line, sel.end.line);
          for (let i = start; i <= end; i++) {
            selectedLineIndexes.add(i);
          }
        }
      }
    } catch (e) {
      rpgiv.log('Error collecting selected lines: ' + (e as Error).message);
    }

    const expandedLineIndexes = new Set<number>();
    let condIndy: ReturnType<typeof collectCondCalc> | undefined;

    // If the cursor/selection sits on a PARM line, redirect to the parent
    // PLIST / CALL / CALLB so the entire group is processed together.
    const remappedLineIndexes = new Set<number>();
    for (const lineNbr of selectedLineIndexes) {
      const parent = findPARMParent(allLines, lineNbr);
      remappedLineIndexes.add(parent >= 0 ? parent : lineNbr);
    }

    for (const lineNbr of remappedLineIndexes) {
      if (expandedLineIndexes.has(lineNbr)) continue;
      const expanded = expandCompoundRange(allLines, lineNbr);
      for (const idx of expanded) {
        if (!expandedLineIndexes.has(idx)) {
          expandedLineIndexes.add(idx);
        }
      }

      // leave the call to collectCondCalcs here because
      // we need it for conditional statement such as IFxx/WHENxx
      let firstLineNbr = Infinity;
      if (expandedLineIndexes.size > 0) {
        firstLineNbr = Math.min(...expandedLineIndexes);
        condIndy = collectCondCalc(allLines, firstLineNbr);
        for (const idx of condIndy.indexes) {
          if (!expandedLineIndexes.has(idx)) {
            expandedLineIndexes.add(idx);
          }
        }
      }
    }

    const selectedLineList = [...expandedLineIndexes].sort((a, b) => a - b);
    let netLineChange = 0;
    let extraIndexes: number[] = [];

    for (const i of selectedLineList) {
      if (i >= allLines.length) continue;
      if (processedLines.has(i)) continue;
      if (rpgiv.isCondIndyOnly(allLines[i])) {
        if (!processedLines.has(i)) {
          extraIndexes.push(i);
        }
        continue;
      }
      const collectedStmts = collectStmt(allLines, i, condIndy?.condStmt ?? null);
      if (!collectedStmts) continue;

      const { indexes: indexes, lines: specLines, comments: rawComments, isSQL, isCollected, entityName } = collectedStmts;
      let comments = rawComments ?? [];
      if (!specLines.length) continue;
      if (indexes.some(idx => processedLines.has(idx))) continue;

      let extraDCL: string[] = [];
      let convertedText = '';
      const eol = rpgiv.getEOL();

      if (extraIndexes.length > 0) {
        for (const idx of extraIndexes) {
          if (!indexes.includes(idx)) {
            indexes.push(idx);
          }
        }
        extraIndexes.length = 0;
      }

      // For PLIST / CALL / CALLB: absorb following PARM lines into this
      // group so they are replaced (deleted) as part of the same edit and
      // are not processed individually by later loop iterations.
      if (!isSQL && !isCollected && specLines.length > 0) {
        const firstLine = specLines[0].padEnd(80, ' ');
        const lineSpecType = firstLine.length > 5 ? firstLine.charAt(5).toLowerCase().trim() : '';
        if (lineSpecType === 'c') {
          const rawOp = rpgiv.getRawOpcode(firstLine).toUpperCase();
          if (rawOp === 'PLIST' || rawOp === 'CALL' || rawOp === 'CALLB') {
            const parmIdxs = getPARMIndexes(allLines, i);
            for (const idx of parmIdxs) {
              if (!indexes.includes(idx)) {
                indexes.push(idx);
              }
            }

            // *ENTRY PLIST with Factor 2 PARMs: schedule an ON-EXIT block
            // insertion at the last C-spec line before any BEGSR subroutine.
            if (rawOp === 'PLIST' && rpgiv.getCol(firstLine, 12, 25).trim().toUpperCase() === '*ENTRY') {
              const entryParms = collectInlinePARMs(allLines, i);
              const { insertAt: onExitInsertAt, existingOnExit } = findOnExitInsertPosition(allLines, i);
              const onExitLines = buildEntryOnExitBlock(entryParms, !existingOnExit);
              if (onExitLines.length > 0) {
                // Insert as a direct edit at the original source position so
                // it lands at the bottom of the main calc body — NOT via
                // insertExtraDCLLinesBatch (which scans backward for DCL-
                // lines and would place it in the declaration area).
                // When merging into an existing on-exit, insert on the line
                // immediately after it; otherwise insert after the last mainline C-spec.
                const insertLine = Math.min(onExitInsertAt + 1, doc.lineCount - 1);
                const formattedOnExit = onExitLines.flatMap(l => formatRPGIV(l, false));
                const onExitText = formattedOnExit.join(eol) + eol;
                const onExitPos = new vscode.Position(insertLine, 0);
                edits.push({ range: new vscode.Range(onExitPos, onExitPos), text: onExitText });
              }
            }
          }
        }
      }

      indexes.forEach(idx => processedLines.add(idx));
      let bIsCondStmt = false;
      if (condIndy && Array.isArray(condIndy.indexes)) {
        bIsCondStmt = condIndy.indexes.includes(i);
      }

      if (isSQL) {
        convertedText = convertToFreeFormSQL(specLines).join(rpgiv.getEOL());
      } else if (isCollected) {
        convertedText = specLines.flatMap(line => formatRPGIV(line)).join(eol);
      } else {
        const line = specLines[0] ?? '';
        specType = line.length > 5 ? line.charAt(5).toLowerCase().trim() : '';
        let converted;
        if (specType === 'h') {
          converted = convertHSpec(specLines);
        } else if (specType === 'f') {
          converted = convertFSpec(specLines);
        } else if (specType === 'd') {
          converted = convertDSpec(specLines, entityName, extraDCL, allLines, i);
        } else if (specType === 'p') {
          converted = convertPSpec(specLines, entityName);
        } else if (specType === 'c') {
          // Only call collectCondCalc for C-specs
          const condIndyForC = collectCondCalc(allLines, i);
          const condStmt = condIndyForC?.condStmt ?? '';
          converted = await convertCSpec(specLines, comments, condStmt, extraDCL, allLines, i);
          // If convertCSpec returned nothing AND there is no pending extraDCL
          // (e.g. dcl-pi/dcl-pr to insert), fall back to leaving the original line.
          if ((!Array.isArray(converted) || converted.length === 0) && extraDCL.length === 0) {
            continue;
          }

        } else {
          converted = specLines;
        }
        if (specType !== '') {
          convertedText = converted.flatMap(line => formatRPGIV(line)).join(eol);
        }
        else {
          convertedText = Array.isArray(converted)
            ? converted.join(eol)
            : String(converted);
        }
      }

      if (Array.isArray(comments) && comments.length > 0) {
        if (comments.length === 1 && comments[0] === '') {
          convertedText = '' + eol + convertedText;
        }
        else {
          const indent = config.leftMargin - 1;
          const prefix = ' '.repeat(Math.max(0, indent)) + '// ';
          convertedText = comments.map(c => prefix + c).join(eol) + eol + convertedText;
        }
      }

      indexes.sort((a, b) => a - b);
      const rangeStart = new vscode.Position(indexes[0], 0);
      const lastLineText = doc.lineAt(indexes[indexes.length - 1]).text;
      const rangeEnd = new vscode.Position(indexes[indexes.length - 1], lastLineText.length);
      const rangeToReplace = new vscode.Range(rangeStart, rangeEnd);

      const currentText = doc.getText(rangeToReplace);
      if (
        convertedText !== undefined &&
        convertedText !== null &&
        currentText !== convertedText
      ) {
        edits.push({ range: rangeToReplace, text: convertedText });
      }

      if (extraDCL.length > 0) {
        extraDCLs.push({ insertAt: indexes[0], lines: extraDCL, netLineChangeAtInsert: netLineChange });
      }

      const linesReplaced = indexes.length;
      const linesInserted = convertedText.split(rpgiv.getEOL()).length;
      netLineChange += (linesInserted - linesReplaced);
      extraDCL = [];
    }

    function formatBlockLines(lines: string[]): string[] {
      return lines.flatMap(line => formatRPGIV(line, false));
    }

    const convertedExtraDCL = extraDCLs.map(block => ({
      insertAt: block.insertAt + block.netLineChangeAtInsert,
      lines: formatBlockLines(block.lines)
    }));

    // Apply any pending prototype patches (augmenting dcl-pr blocks already
    // written to the document in a previous command invocation).
    const patches = getPendingPatches();
    if (patches.length > 0) {
      const eol = rpgiv.getEOL();
      for (const { name, additionalParms } of patches) {
        const block = findPRBlock(name, allLines);
        if (block) {
          const newParmLines = buildParmLines(additionalParms, true);
          const formatted = formatBlockLines(newParmLines);
          const insertPos = new vscode.Position(block.endLine, 0);
          edits.push({ range: new vscode.Range(insertPos, insertPos), text: formatted.join(eol) + eol });
        }
      }
    }

    if (edits.length > 0) {
      try {
        rpgiv.log('CMD Handler Applying edits');
        rpgiv.logOverlappingEdits(edits);

        // Sort edits by start position (descending)

        edits.sort((a, b) => {
          if (a.range.start.line !== b.range.start.line) {
            return b.range.start.line - a.range.start.line;
          }
          return b.range.start.character - a.range.start.character;
        });

        // Filter out overlapping edits
        const nonOverlappingEdits: typeof edits = [];
        for (const edit of edits) {
          if (!nonOverlappingEdits.some(e => e.range.intersection(edit.range))) {
            nonOverlappingEdits.push(edit);
          } else {
            rpgiv.log(`Skipped overlapping edit at line ${edit.range.start.line}`);
          }
        }

        const success = await editor.edit(editBuilder => {
          for (const edit of nonOverlappingEdits) {
            editBuilder.replace(edit.range, edit.text);
          }
        });

        if (!success) {
          rpgiv.log('Failed to apply edits. Edits:', JSON.stringify(edits, null, 2));
          vscode.window.showErrorMessage('Failed to apply conversion edits. Please try again.');
        }
        else {

          // Redraw guides only for lines that are still fixed-format
          const doc = editor.document;
          const updatedLines = new Set<number>();

          for (const edit of edits) {
            for (let line = edit.range.start.line; line <= edit.range.end.line; line++) {
              updatedLines.add(line);
            }
          }

          for (const line of updatedLines) {
            if (line >= 0 && line < doc.lineCount) {
              const text = doc.lineAt(line).text;
              drawTabStopLines(editor, line);
            }
          }
        }
      } catch (error) {
        vscode.window.showErrorMessage('Error applying edits: ' + (error as Error).message);
      }
    }

    if (convertedExtraDCL.length > 0) {
      const lines = rpgiv.splitLines(editor.document.getText());
      await rpgiv.insertExtraDCLLinesBatch(
        editor,
        lines,
        convertedExtraDCL.map(dcl => ({
          currentLineIndex: dcl.insertAt,
          extraDCL: dcl.lines
        }))
      );
    }
    rpgiv.log('CMD Handler ending');
  });

  context.subscriptions.push(disposable);
}