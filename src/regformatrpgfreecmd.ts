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
import { formatRPGIVDocument } from './formatRPGIV';
import * as rpgiv from './rpgtools';

export function registerFormatRPGFreeCommand(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('rpgiv2free.formatRPGFree', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor. Format RPG IV Free Format cancelled.');
      return;
    }

    const doc = editor.document;
    const eol = doc.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';

    let startLine: number;
    let endLine: number;
    let hasSelection = false;

    const sel = editor.selection;
    if (!sel.isEmpty) {
      // Expand to full lines
      startLine = sel.start.line;
      endLine = sel.end.line;
      // If selection ends exactly at col 0 of a line, don't include that line
      if (sel.end.character === 0 && endLine > startLine) {
        endLine--;
      }
      hasSelection = true;
    } else {
      startLine = 0;
      endLine = doc.lineCount - 1;
    }

    // Collect the lines to format
    const inputLines: string[] = [];
    for (let i = startLine; i <= endLine; i++) {
      inputLines.push(doc.lineAt(i).text);
    }

    const outputLines = formatRPGIVDocument(inputLines);

    const newText = outputLines.join(eol);
    const oldText = inputLines.join(eol);

    if (newText === oldText) {
      vscode.window.showInformationMessage('RPG IV Free Format: No changes needed.');
      return;
    }

    const range = new vscode.Range(
      new vscode.Position(startLine, 0),
      new vscode.Position(endLine, doc.lineAt(endLine).text.length)
    );

    const edit = new vscode.WorkspaceEdit();
    edit.replace(doc.uri, range, newText);
    await vscode.workspace.applyEdit(edit);
  });

  context.subscriptions.push(disposable);
}
