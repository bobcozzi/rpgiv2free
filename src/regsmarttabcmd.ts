import * as vscode from 'vscode';
import { handleSmartTab, applyColumnarDecorations } from './smartTab';
import * as rpgiv from './rpgedit';

export function registerSmartTabCommands(
  context: vscode.ExtensionContext,
  getSmartTabEnabled: () => boolean,
  setSmartTabEnabled: (val: boolean) => void
) {
  // Status bar item
  const smartTabStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  smartTabStatusBarItem.command = 'rpgiv2free.toggleRPGSmartTab';
  smartTabStatusBarItem.tooltip = 'Click to toggle RPG Smart Tab (no reload)';
  context.subscriptions.push(smartTabStatusBarItem);

  function updateSmartTabStatusBar() {
    smartTabStatusBarItem.text = `RPG Smart Tab: ${getSmartTabEnabled() ? 'On' : 'Off'}`;
    smartTabStatusBarItem.show();
  }

  // Toggle command
  const toggleRPGSmartTabCmd = vscode.commands.registerCommand('rpgiv2free.toggleRPGSmartTab', async () => {
    setSmartTabEnabled(!getSmartTabEnabled());
    await context.globalState.update('rpgSmartTabEnabled', getSmartTabEnabled());
    updateSmartTabStatusBar();
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      applyColumnarDecorations(editor, getSmartTabEnabled());
    }
  });
  context.subscriptions.push(toggleRPGSmartTabCmd);
  updateSmartTabStatusBar();

  // Tab command
  const tabCmd = vscode.commands.registerCommand('rpgsmarttab.tab', async () => {
    const didCommit = await vscode.commands.executeCommand('editor.action.inlineSuggest.commit');
    const editor = vscode.window.activeTextEditor;
    const doc = editor?.document;

    if (!editor || !doc || rpgiv.isNOTFixedFormatRPG(doc)) {
      return;
    }

    if (didCommit !== undefined) {
      return;
    }

    if ((vscode as any).window.activeTextEditor?.options.suggestWidgetVisible) {
      await vscode.commands.executeCommand('acceptSelectedSuggestion');
      return;
    }

    if (!getSmartTabEnabled() || rpgiv.isNOTFixedFormatRPG(doc)) {
      await vscode.commands.executeCommand('tab');
      return;
    }

    handleSmartTab(false);
  });

  // Shift+Tab command
  const shiftTabCmd = vscode.commands.registerCommand('rpgsmarttab.shiftTab', async () => {
    const editor = vscode.window.activeTextEditor;
    const doc = editor?.document;
    if (!doc || !getSmartTabEnabled() || rpgiv.isNOTFixedFormatRPG(doc)) {
      await vscode.commands.executeCommand('outdent');
      return;
    }
    handleSmartTab(true);
  });

  context.subscriptions.push(tabCmd, shiftTabCmd);
}
