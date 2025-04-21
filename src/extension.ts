
// File: src/extension.ts
import * as vscode from 'vscode';

import { collectStmt } from './collectSpecs';
import { processLine } from './lineProcessor';
import { convertHSpec } from './HSpec';
import { convertFSpec } from './FSpec';
import { convertDSpec } from './DSpec';
import { convertCSpec } from './CSpec';
import { convertToFreeFormSQL } from './SQLSpec';

import * as ibmi from './IBMi';

const outputChannel = vscode.window.createOutputChannel('RPGFREEConverterLog');

export function log(message: any) {
  outputChannel.appendLine(typeof message === 'string' ? message : JSON.stringify(message));
  outputChannel.show(true); // Show the log panel
}

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('rpgconverter.convertToRPGFree', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor found.');
      return;
    }
    const line = editor.document.lineAt(editor.selection.active.line).text;
    log('Current line: ' + line);

    const doc = editor.document;
    const allLines = doc.getText().split(/\r?\n/);
    const processedLines = new Set<number>();

    await editor.edit(editBuilder => {
      const selectedLineIndexes = new Set<number>();

      for (const sel of editor.selections) {
        if (sel.isEmpty) {
          selectedLineIndexes.add(sel.active.line);
        } else {
          for (let i = sel.start.line; i <= sel.end.line; i++) {
            selectedLineIndexes.add(i);
          }
        }
      }

      const selectedLineList = [...selectedLineIndexes].sort((a, b) => a - b);

      for (const i of selectedLineList) {
        if (processedLines.has(i) || i >= allLines.length) continue;
        const collectedStmts = collectStmt(allLines, i);
        if (!collectedStmts) continue;

        const { lines: specLines, indexes, isSQL, entityName } = collectedStmts;
        if (!specLines.length || indexes.some(idx => processedLines.has(idx))) continue;

        let convertedText = '';

        if (isSQL) {
          convertedText = convertToFreeFormSQL(specLines).join('\n');
        } else {
          const specType = specLines[0].charAt(5).toLowerCase().trim();

          const converted =
            specType === 'h' ? convertHSpec(specLines)
            : specType === 'f' ? convertFSpec(specLines)
            : specType === 'd' ? convertDSpec(specLines, entityName)
            : specType === 'c' ? convertCSpec(specLines)
            : specLines;

          convertedText = converted.flatMap(line => processLine(line)).join('\n');
        }

        const rangeStart = new vscode.Position(indexes[0], 0);
        const lastLineText = doc.lineAt(indexes[indexes.length - 1]).text;
        const rangeEnd = new vscode.Position(indexes[indexes.length - 1], lastLineText.length);
        const rangeToReplace = new vscode.Range(rangeStart, rangeEnd);

        editBuilder.replace(rangeToReplace, convertedText);

        indexes.forEach(idx => processedLines.add(idx));
      }
    });
  });

  // ✅ Register command
  context.subscriptions.push(disposable);

}