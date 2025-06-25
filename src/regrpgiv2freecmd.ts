import * as vscode from 'vscode';
import { collectStmt } from './collectStmts';
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

    for (const lineNbr of selectedLineIndexes) {
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

      const { indexes } = collectedStmts;
      if (indexes.some(idx => processedLines.has(idx))) continue;

      const { lines: specLines, comments: rawComments, isSQL, isCollected, entityName } = collectedStmts;
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
          converted = convertCSpec(specLines, comments, condStmt, extraDCL, allLines, i);
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
          const indent = config.indentFirstLine - 1;
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

    if (edits.length > 0) {
      try {
        rpgiv.log('CMD Handler Applying edits');
        rpgiv.logOverlappingEdits(edits);

        edits.sort((a, b) => b.range.start.line - a.range.start.line);

        const success = await editor.edit(editBuilder => {
          for (const edit of edits) {
            editBuilder.replace(edit.range, edit.text);
          }
        });

        if (!success) {
          rpgiv.log('Failed to apply edits. Edits:', JSON.stringify(edits, null, 2));
          vscode.window.showErrorMessage('Failed to apply conversion edits. Please try again.');
        }
        else {
          //  applyColumnarDecorations(editor, false);
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