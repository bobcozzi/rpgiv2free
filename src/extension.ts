
// File: src/extension.ts
import * as vscode from 'vscode';

import { collectStmt } from './collectSpecs';
import { reflowLines } from './reflowLines';
import { expandCompoundRange } from './compoundStmt';
import { convertHSpec } from './HSpec';
import { convertFSpec } from './FSpec';
import { convertDSpec } from './DSpec';
import { convertPSpec } from './PSpec';
import { convertCSpec } from './CSpec';
import { convertToFreeFormSQL } from './SQLSpec';

import * as ibmi from './IBMi';


export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('rpgconverter.convertToRPGFree', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor found.');
      return;
    }
    const activeline = editor.selection.active.line;
    ibmi.log('Active line: ' + activeline);
    const totalLines = editor.document.lineCount;
    ibmi.log(`Document line count: ${totalLines}`);

    try {
      const line = editor.document.lineAt(editor.selection.active.line).text;
      ibmi.log('Current line: ' + line);
    } catch (e) {
      ibmi.log('ERROR getting line text: ' + (e as Error).message);
    }

    const doc = editor.document;
    const allLines = ibmi.splitLines(doc.getText());;
    const processedLines = new Set<number>();
    ibmi.log('Total lines: ' + allLines.length);

    // Collect all edits and extra DCLs to apply them in separate edit operations
    const selectedLineIndexes = new Set<number>();
    const edits: { range: vscode.Range, text: string }[] = [];
    const extraDCLs: { insertAt: number, lines: string[] }[] = [];
    try {
      for (const sel of editor.selections) {
        if (sel.isEmpty) {
          selectedLineIndexes.add(sel.active.line);
        } else {
          for (let i = sel.start.line; i <= sel.end.line; i++) {
            selectedLineIndexes.add(i);
          }
        }
      }
    } catch (e) {
      ibmi.log('Error collecting selected lines: ' + (e as Error).message);
    }

    // const selectedLineList = [...selectedLineIndexes].sort((a, b) => a - b);
    const expandedLineIndexes = new Set<number>();

    const anchorLineIndexes = new Set<number>();

    for (const line of selectedLineIndexes) {
      const expanded = expandCompoundRange(allLines, line);
      const anchor = Math.min(...expanded);
      anchorLineIndexes.add(anchor);  // Add the top line number of any compound statement
    }
    const anchorLineList = [...anchorLineIndexes].sort((a, b) => a - b);

    for (const line of selectedLineIndexes) {
      const expanded = expandCompoundRange(allLines, line);
      for (const idx of expanded) expandedLineIndexes.add(idx);
    }
    const selectedLineList = [...expandedLineIndexes].sort((a, b) => a - b);

    for (const i of selectedLineList) {
      if (processedLines.has(i) || i >= allLines.length) continue;
      const collectedStmts = collectStmt(allLines, i);
      if (!collectedStmts) continue;

      const { lines: specLines, indexes, comments, isSQL, isBOOL, entityName } = collectedStmts;
      if (!specLines.length || indexes.some(idx => processedLines.has(idx))) continue;

      let convertedText = '';
      let extraDCL: string[] = [];
      if (isSQL) {
        convertedText = convertToFreeFormSQL(specLines).join(ibmi.getEOL());

      }
      else if (isBOOL) {
        convertedText = specLines.flatMap(line => reflowLines(line)).join(ibmi.getEOL());
      }
      else {
        const specType = specLines[0].charAt(5).toLowerCase().trim();

        const converted =
          specType === 'h' ? convertHSpec(specLines)
            : specType === 'f' ? convertFSpec(specLines)
              : specType === 'd' ? convertDSpec(specLines, entityName, extraDCL)
                : specType === 'p' ? convertPSpec(specLines, entityName)
                  : specType === 'c' ? convertCSpec(specLines, extraDCL)
                    : specLines;

        convertedText = converted.flatMap(line => reflowLines(line)).join(ibmi.getEOL());
      }

      const rangeStart = new vscode.Position(indexes[0], 0);
      const lastLineText = doc.lineAt(indexes[indexes.length - 1]).text;
      const rangeEnd = new vscode.Position(indexes[indexes.length - 1], lastLineText.length);
      const rangeToReplace = new vscode.Range(rangeStart, rangeEnd);

      edits.push({ range: rangeToReplace, text: convertedText });

      indexes.forEach(idx => processedLines.add(idx));
      if (extraDCL.length > 0) {
        extraDCLs.push({ insertAt: indexes[0], lines: extraDCL });
      }
    }

    const convertedExtraDCL = extraDCLs.map(block => ({
      insertAt: block.insertAt,
      lines: block.lines.flatMap(line => reflowLines(line))
    }));

    // Apply main edits
    if (edits.length > 0) {
      await editor.edit(editBuilder => {
        for (const edit of edits) {
          editBuilder.replace(edit.range, edit.text);
        }
      });
    }

    // Apply extra DCL lines in a separate edit operation
    // Apply extra DCL lines in a single batch edit

    const lines = ibmi.splitLines(editor.document.getText());
    await ibmi.insertExtraDCLLinesBatch(editor, lines, convertedExtraDCL.map(dcl => ({
      currentLineIndex: dcl.insertAt,
      extraDCL: dcl.lines
    })));
  });

  // ✅ Register command
  context.subscriptions.push(disposable);
}