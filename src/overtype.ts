// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 1996-2026 by R. Cozzi, Jr.
// @author BobCozzi

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
