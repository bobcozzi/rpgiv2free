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

export async function handleSmartEnter(editor: vscode.TextEditor, position: vscode.Position) {
  const config = vscode.workspace.getConfiguration('rpgiv2free');

  // Check if Smart Enter is enabled
  const smartRPGEnterMode = config.get<string>('enableRPGSmartEnter', 'fixedOnly');
  if (!smartRPGEnterMode || smartRPGEnterMode === 'disable') {
    // Use default VS Code Enter behavior
    await vscode.commands.executeCommand('default:type', { text: rpgiv.getEOL() });
    return;
  }

  const doc = editor.document;
  if (rpgiv.isNOTFixedFormatRPG()) {
    await vscode.commands.executeCommand('default:type', { text: rpgiv.getEOL() });
    return;
  }

  const line = doc.lineAt(position.line);
  if (!line) {
    await vscode.commands.executeCommand('default:type', { text: rpgiv.getEOL() });
    return;
  }

  const text = line.text;
  if (!text || !rpgiv.isValidFixedFormat(text)) {
    await vscode.commands.executeCommand('default:type', { text: rpgiv.getEOL() });
    return;
  }

  // NEW: Read the copySpec setting
  const copySpec = config.get<boolean>('enableRPGSmartEnterDupSpec', true);

  const eol = rpgiv.getEOL();
  const col1To5 = text.substring(0, 5);
  const specPrefix = text.substring(0, 6);
  const afterSpec = text.substring(6);

  // Find the first non-whitespace character index in that substring
  const nonSpacePos = copySpec ? afterSpec.search(/\S/) : text.search(/\S/);
  const paddingLength = nonSpacePos;
  const padding = ' '.repeat(paddingLength > 0 ? paddingLength : 0);

  const newLineText = copySpec ? specPrefix + padding : padding;
  const lineEndPosition = line.range.end;

  await editor.edit(editBuilder => {
    editBuilder.insert(lineEndPosition, eol + newLineText);
  });

  const newCursorPos = new vscode.Position(position.line + 1, newLineText.length);
  editor.selection = new vscode.Selection(newCursorPos, newCursorPos);
}