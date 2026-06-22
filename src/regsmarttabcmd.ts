// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 1996-2026 by R. Cozzi, Jr.
// @author BobCozzi

import * as vscode from 'vscode';
import { handleSmartTab, applyColumnarDecorations } from './smartTab';
import * as rpgiv from './rpgtools';

export function registerSmartTabCommands(
  context: vscode.ExtensionContext,
  getSmartTabEnabled: () => boolean,
  setSmartTabEnabled: (val: boolean) => void
) {

  // Status bar item
  let smartTabStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  smartTabStatusBarItem.command = 'rpgiv2free.toggleRPGSmartTab';
  smartTabStatusBarItem.tooltip = 'Click to toggle RPG Smart Tab (no reload)';
  context.subscriptions.push(smartTabStatusBarItem);

  const RPG_LANG_IDS = new Set(['rpgle', 'sqlrpgle', 'rpgleinc']);

  function isVisibleFixedRPGEditor(editor: vscode.TextEditor | undefined): boolean {
    if (!editor) { return false; }
    const doc = editor.document;
    return RPG_LANG_IDS.has(doc.languageId) && rpgiv.isFixedFormatRPG(doc);
  }

  function updateSmartTabStatusBar() {
    smartTabStatusBarItem.text = `RPG Smart Tab: ${getSmartTabEnabled() ? 'On' : 'Off'}`;
    if (isVisibleFixedRPGEditor(vscode.window.activeTextEditor)) {
      smartTabStatusBarItem.show();
    } else {
      smartTabStatusBarItem.hide();
    }
  }

  // Update bar whenever the active editor changes.
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => updateSmartTabStatusBar())
  );

  // Update bar when a document is closed — covers the case where VS Code silently
  // removes session-restored remote tabs without a clean active-editor-change event.
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument(() => updateSmartTabStatusBar())
  );

  // Belt-and-suspenders: visible-editors list changes (splits, tab groups, etc.)
  context.subscriptions.push(
    vscode.window.onDidChangeVisibleTextEditors(() => updateSmartTabStatusBar())
  );

  // Toggle command
  const toggleRPGSmartTabCmd = vscode.commands.registerCommand('rpgiv2free.toggleRPGSmartTab', async () => {
    setSmartTabEnabled(!getSmartTabEnabled());
    await context.globalState.update('rpgSmartTabEnabled', getSmartTabEnabled());
    updateSmartTabStatusBar();

    // Don't touch decorations here - the ruler is controlled by enableRPGColumnGuides setting
    // The onDidChangeTextEditorSelection listener will handle redrawing ruler lines
  });
  context.subscriptions.push(toggleRPGSmartTabCmd);
  updateSmartTabStatusBar();

  // Tab command
  const tabCmd = vscode.commands.registerCommand('rpgsmarttab.tab', async () => {
    const didCommit = await vscode.commands.executeCommand('editor.action.inlineSuggest.commit');
    const editor = vscode.window.activeTextEditor;
    const doc = editor?.document;

    // Only enable Smart Tab for fixed-format RPG
    if (!editor || !doc) {
      return;
    }

    if (didCommit !== undefined) {
      return;
    }

    if ((vscode as any).window.activeTextEditor?.options.suggestWidgetVisible) {
      await vscode.commands.executeCommand('acceptSelectedSuggestion');
      return;
    }

    if (!getSmartTabEnabled()) {
      await vscode.commands.executeCommand('tab');
      return;
    }

    handleSmartTab(false);
  });

  // Shift+Tab command|| rpgiv.isRPGFree()
  const shiftTabCmd = vscode.commands.registerCommand('rpgsmarttab.shiftTab', async () => {
    const editor = vscode.window.activeTextEditor;
    const doc = editor?.document;
    if (!doc || !getSmartTabEnabled() ) {
      await vscode.commands.executeCommand('outdent');
      return;
    }
    handleSmartTab(true);
  });

  context.subscriptions.push(tabCmd, shiftTabCmd);
}
