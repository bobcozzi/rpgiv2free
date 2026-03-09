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
import { handleSmartEnter } from './smartEnter';
import * as rpgiv from './rpgedit';

export function registerSmartEnterCommand(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerTextEditorCommand('rpgiv2free.smartEnter', async (editor, edit) => {
    // 1. Try to commit inline suggestion first
    const didCommit = await vscode.commands.executeCommand('editor.action.inlineSuggest.commit');
    if (didCommit !== undefined) {
      // If an inline suggestion was committed, do nothing else
      return;
    }

    // 2. If the suggestion widget is visible, accept it
    if ((vscode as any).window.activeTextEditor?.options.suggestWidgetVisible) {
      await vscode.commands.executeCommand('acceptSelectedSuggestion');
      return;
    }

    const eol = rpgiv.getEOL();
    const mode = rpgiv.getSmartEnterMode();
    const doc = editor.document;

    const fallBackOnEnter =
      mode === rpgiv.SmartEnterMode.Disabled ||
      (mode === rpgiv.SmartEnterMode.FixedOnly && rpgiv.isFreeFormatRPG(doc)) ||
      (mode === rpgiv.SmartEnterMode.FixedAndFree && !rpgiv.isRPGDocument());
    // Check if the document is not RPG or if the mode is disabled
    // If the selection is on the first row, first position and Enter is pressed,
    // we treat it like a normal Enter key and fallback to the default behavior.
    if (fallBackOnEnter || (editor.selection.start.line === 0 && editor.selection.start.character === 0)) {
      await vscode.commands.executeCommand('default:type', { text: rpgiv.getEOL() });
      return;
    }
    const position = editor.selection.active;
    await handleSmartEnter(editor, position);  // Note: handleSmartEnter doesn't use `edit` here
  });

  context.subscriptions.push(disposable);
}