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

// RPG IV fixed-format specs occupy columns 1–80 (0-indexed: 0–79).
// The comments area starts at column 81 (0-indexed: 80) — normal insert
// mode applies there.
const RPG_SPEC_END_COL = 80; // exclusive upper bound (0-indexed)

/**
 * Returns true when the active cursor is positioned inside a fixed-format RPG
 * spec column (cols 1–80, 0-indexed 0–79), has no active text selection, and
 * the document is a fixed-format RPG source file.
 */
export function isOvertypePosition(editor: vscode.TextEditor): boolean {
  const doc = editor.document;
  const langId = doc.languageId;
  if (langId !== 'rpgle' && langId !== 'sqlrpgle' && langId !== 'rpginc') {
    return false;
  }
  if (rpgiv.isFreeFormatRPG(doc)) {
    return false;
  }
  // No active text selection and no multi-cursor
  if (!editor.selection.isEmpty || editor.selections.length > 1) {
    return false;
  }
  const cursor = editor.selection.active;
  const lineText = doc.lineAt(cursor.line).text;
  // Line must be a valid fixed-format spec (H / F / D / C / I / O / P)
  // or a classic fixed-format comment (col 7 = '*').  isComment() already
  // excludes **FREE source, so no extra free-format check is needed here.
  if (!rpgiv.isValidFixedFormat(lineText) && !rpgiv.isComment(lineText, doc)) {
    return false;
  }
  // Only overtype within the RPG spec columns
  return cursor.character < RPG_SPEC_END_COL;
}

/**
 * Replaces the character at the cursor position with `text` and advances the
 * cursor by one column.  If the cursor is at or beyond the physical end of the
 * line, the line is padded with spaces as needed before the replacement.
 */
export async function handleOvertypeChar(
  editor: vscode.TextEditor,
  text: string
): Promise<void> {
  const cursor = editor.selection.active;
  const doc = editor.document;
  const lineText = doc.lineAt(cursor.line).text;
  const col = cursor.character;

  await editor.edit(
    editBuilder => {
      if (col < lineText.length) {
        // Replace the character that currently occupies this column
        editBuilder.replace(
          new vscode.Range(cursor.line, col, cursor.line, col + 1),
          text
        );
      } else {
        // Cursor is past the physical end of the line — pad then append
        const padding = ' '.repeat(col - lineText.length);
        editBuilder.insert(
          new vscode.Position(cursor.line, lineText.length),
          padding + text
        );
      }
    },
    { undoStopBefore: false, undoStopAfter: false }
  );

  // Advance cursor one column, capped at the spec boundary
  const newCol = Math.min(col + 1, RPG_SPEC_END_COL - 1);
  const newPos = new vscode.Position(cursor.line, newCol);
  editor.selection = new vscode.Selection(newPos, newPos);
}

/**
 * Registers the `type` command override that activates overtype (replace)
 * behaviour in fixed-format RPG spec columns when Smart Tab is enabled.
 *
 * For all other contexts the command falls through to VS Code's built-in
 * `default:type` so that normal insert behaviour is preserved everywhere else.
 *
 * Note: VS Code allows only one extension to own the `type` command at a time.
 * If a conflict is reported, it means another installed extension also overrides
 * `type`.  In that case disable the conflicting extension or set
 * `rpgiv2free.enableOvertypeInFixedFormat` to `false`.
 */
export function registerOvertypeHandler(
  context: vscode.ExtensionContext,
  getOvertypeEnabled: () => boolean
): void {
  const typeCmd = vscode.commands.registerCommand(
    'type',
    async (args: { text: string }) => {
      const editor = vscode.window.activeTextEditor;

      // --- Fall-through cases ---

      // No active editor
      if (!editor) {
        await vscode.commands.executeCommand('default:type', args);
        return;
      }

      // Check whether the feature is permitted (conflict-avoidance setting)
      const cfg = vscode.workspace.getConfiguration('rpgiv2free');
      const featureEnabled = cfg.get<boolean>('enableOvertypeInFixedFormat', true);
      if (!featureEnabled || !getOvertypeEnabled()) {
        await vscode.commands.executeCommand('default:type', args);
        return;
      }

      // Newlines, tabs, carriage returns and multi-char sequences (IME, paste)
      // all fall through — Smart Enter and Smart Tab handle \n and \t
      // independently via their own keybindings.
      if (
        args.text.length !== 1 ||
        args.text === '\n' ||
        args.text === '\r' ||
        args.text === '\t'
      ) {
        await vscode.commands.executeCommand('default:type', args);
        return;
      }

      // Not in a fixed-format overtype zone
      if (!isOvertypePosition(editor)) {
        await vscode.commands.executeCommand('default:type', args);
        return;
      }

      // --- Overtype ---
      await handleOvertypeChar(editor, args.text);
    }
  );

  context.subscriptions.push(typeCmd);
}

/**
 * Registers the "OVR" status bar button and the `rpgiv2free.toggleOvertype`
 * command.  The button appears next to the Smart Tab button whenever a
 * fixed-format RPG source file is active.
 */
export function registerOvertypeCommands(
  context: vscode.ExtensionContext,
  getEnabled: () => boolean,
  setEnabled: (val: boolean) => void
): void {
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    99   // one step left of Smart Tab (priority 100)
  );
  statusBarItem.command = 'rpgiv2free.toggleOvertype';
  context.subscriptions.push(statusBarItem);

  function updateStatusBar(inFixedFormatContext: boolean): void {
    const on = getEnabled();
    statusBarItem.text = on ? 'OVR' : 'INS';
      statusBarItem.tooltip =
       'Insert (INS) and Overtype (OVR) mode toggle — fixed-format RPG only.\nClick to toggle mode. Alternatively, use the INS key (Cmd+I on Mac) to switch modes.';
    // Grey out text when the cursor is not on a fixed-format line so the
    // button appears visually disabled in that context.
    statusBarItem.color = inFixedFormatContext
      ? undefined
      : new vscode.ThemeColor('disabledForeground');
  }

  function showOrHide(editor: vscode.TextEditor | undefined): void {
    const featureEnabled = vscode.workspace
      .getConfiguration('rpgiv2free')
      .get<boolean>('enableOvertypeInFixedFormat', true);
    const langId = editor?.document.languageId;
    if (
      featureEnabled &&
      editor &&
      (langId === 'rpgle' || langId === 'sqlrpgle' || langId === 'rpginc') &&
      rpgiv.isFixedFormatRPG(editor.document)
    ) {
      updateStatusBar(editor ? isOvertypePosition(editor) : false);
      statusBarItem.show();
    } else {
      statusBarItem.hide();
    }
  }

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(showOrHide),
    // Update the highlight as the cursor moves between fixed/free lines
    vscode.window.onDidChangeTextEditorSelection(e => {
      if (statusBarItem.text === 'OVR' || statusBarItem.text === 'INS') {
        updateStatusBar(isOvertypePosition(e.textEditor));
      }
    })
  );

  const toggleCmd = vscode.commands.registerCommand(
    'rpgiv2free.toggleOvertype',
    async () => {
      setEnabled(!getEnabled());
      await context.globalState.update('rpgOvertypeEnabled', getEnabled());
      const editor = vscode.window.activeTextEditor;
      updateStatusBar(editor ? isOvertypePosition(editor) : false);
      // Return focus to the editor so the user can type immediately after
      // clicking the status bar button without having to click back in.
      await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
    }
  );
  context.subscriptions.push(toggleCmd);

  // Initial state
  showOrHide(vscode.window.activeTextEditor);
}
