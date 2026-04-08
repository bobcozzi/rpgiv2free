import * as vscode from 'vscode';
import { RPGIVSemanticTokensProvider, rpgivLegend } from './provider';

const RPG_LANGUAGES: vscode.DocumentSelector = [
  { language: 'rpgle' },
  { language: 'sqlrpgle' },
  { language: 'rpgleinc' },
];

export function registerSyntaxHighlighting(context: vscode.ExtensionContext): void {
  const provider = new RPGIVSemanticTokensProvider();

  context.subscriptions.push(
    vscode.languages.registerDocumentSemanticTokensProvider(
      RPG_LANGUAGES,
      provider,
      rpgivLegend
    )
  );

  // When the setting is toggled, force VS Code to re-run semantic tokenization
  // by momentarily invalidating open editors for the affected languages.
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('rpgiv2free.enableFixedFormatHighlighting')) {
        // Trigger a no-op edit and undo on each visible RPG editor so that
        // VS Code re-requests semantic tokens from the provider.
        for (const editor of vscode.window.visibleTextEditors) {
          const langId = editor.document.languageId;
          if (langId === 'rpgle' || langId === 'sqlrpgle' || langId === 'rpgleinc') {
            vscode.commands.executeCommand(
              'vscode.executeDocumentSemanticTokensProvider',
              editor.document.uri
            );
          }
        }
      }
    })
  );
}
