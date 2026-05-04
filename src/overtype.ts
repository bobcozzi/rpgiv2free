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

/**
 * Registers the "INS" status bar button and the `rpgiv2free.toggleOvertype`
 * command.  The button shows "INS" whenever a fixed-format RPG source file is
 * active and the editor is in insert mode.  When overtype is active the button
 * is hidden so VS Code's own built-in "OVR" status bar indicator is visible
 * instead — VS Code's native overtype handles the actual replace-on-type
 * behaviour via `editor.toggleOvertype`.
 */
export function registerOvertypeCommands(
  context: vscode.ExtensionContext,
  getEnabled: () => boolean,
  setEnabled: (val: boolean) => void
): void {
  const toggleCmd = vscode.commands.registerCommand(
    'rpgiv2free.toggleOvertype',
    async () => {
      await vscode.commands.executeCommand('editor.action.toggleOvertypeInsertMode');
      setEnabled(!getEnabled());
    }
  );
  context.subscriptions.push(toggleCmd);
}
