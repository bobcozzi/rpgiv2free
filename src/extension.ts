import * as vscode from 'vscode';
import { formatRPGIV } from './formatRPGIV';
import { collectStmt } from './collectStmts';
import {
  handleSmartTab, highlightCurrentTabZone, drawTabStopLines,
  applyColumnarDecorations
} from './smartTab';
import { handleSmartEnter } from './smartEnter';
import { expandCompoundRange } from './compoundStmt';
import { convertHSpec } from './HSpec';
import { convertFSpec } from './FSpec';
import { convertDSpec } from './DSpec';
import { convertPSpec } from './PSpec';
import { convertCSpec } from './CSpec';
import { collectCondCalc } from './collectCondCalc';
import { convertToFreeFormSQL } from './collectSQLSpec';

import { getIBMiAPI } from './codeforibmi';
import * as types from './types';
import * as rpgiv from './rpgedit';

import { registerConvertToRPGFreeCommand } from './regrpgiv2freecmd';
import { registerSmartTabCommands } from './regsmarttabcmd';
import { registerSmartEnterCommand } from './regsmartentercmd';

let rpgSmartTabEnabled = true;  // ← In-memory toggle

export async function activate(context: vscode.ExtensionContext) {
  // Load saved setting at startup

  rpgSmartTabEnabled = context.globalState.get<boolean>('rpgSmartTabEnabled', true);

  const config = rpgiv.getRPGIVFreeSettings();
  registerSmartTabCommands(
    context,
    () => rpgSmartTabEnabled,
    (val) => { rpgSmartTabEnabled = val; }
  );

  registerSmartEnterCommand(context);

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (!editor) return;
      const langId = editor.document.languageId;
      if (langId !== 'rpgle' && langId !== 'sqlrpgle') {
        // Remove RPG decorations from this editor
        applyColumnarDecorations(editor, false);
      }
    })
  );

  // Listen for newly opened documents
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((document) => {
      evaluateAndApplyFeatures(document);
    })
  );
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (!rpgiv.isRPGDocument(event.document)) return;

      if (event.contentChanges.some(change => change.range.start.line === 0)) {
        evaluateAndApplyFeatures(event.document);
      }
    })
  );

  let tabStopDebounceTimer: NodeJS.Timeout | undefined;
  // context.subscriptions.push(tabCmd, shiftTabCmd);


  // For all visible editors (covers cases where editor is visible but not in textDocuments yet)
  vscode.window.visibleTextEditors.forEach((editor) => {
    evaluateAndApplyFeatures(editor.document);
  });

  context.subscriptions.push(
    vscode.window.onDidChangeVisibleTextEditors((editors) => {
      editors.forEach(editor => {
        evaluateAndApplyFeatures(editor.document);
      });
    })
  );

  const visibleRangesListener = vscode.window.onDidChangeTextEditorVisibleRanges((event) => {
    if (rpgSmartTabEnabled) {
      applyColumnarDecorations(event.textEditor, true);
    }
  });

  // Add the listener to your context subscriptions
  context.subscriptions.push(visibleRangesListener);

  // add listener for character/non-tab cursor movement
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection((e) => {
      if (!e.textEditor || !rpgSmartTabEnabled) return;
      if (rpgiv.isNOTFixedFormatRPG(e.textEditor.document)) return;

      if (tabStopDebounceTimer) clearTimeout(tabStopDebounceTimer);

      tabStopDebounceTimer = setTimeout(async () => {
        try {
          await highlightCurrentTabZone(e.textEditor);

          // Only update the current line's tab boundaries
          const activeLine = e.selections[0]?.active.line;
          if (typeof activeLine === 'number') {
            drawTabStopLines(e.textEditor, activeLine);
          }
        } catch (err) {
          console.error("Tab zone debounce error:", err);
        }
      }, 100);
    })
  );

  registerConvertToRPGFreeCommand(context, config);

  // Resolve the Code for IBM i API and store it globally
  // that way if I need it somewhere else, its already loaded and available
  getIBMiAPI().then(ibmiAPI => {
    types.setIbmiApi(ibmiAPI);
    // Log CODE for IBM i APIs but only when in debug mode
    const bCheckCode4i = config.verifyCODE4i;
    if (bCheckCode4i && ibmiAPI && context.extensionMode === vscode.ExtensionMode.Development) {
      for (const key of Object.keys(ibmiAPI)) {
        const value = ibmiAPI[key];
        if (value && typeof value === 'object') {
          rpgiv.log(`ibmiAPI.${key}:`, Object.keys(value));
          rpgiv.log('Code for IBM i API:', Object.keys(ibmiAPI));
        }
      }
    }
  });

}

// This method is called when your extension is deactivated
export function deactivate() {
  rpgiv.log('deactivated');
}

function evaluateAndApplyFeatures(document: vscode.TextDocument) {
  if (!['rpgle', 'sqlrpgle'].includes(document.languageId)) return;

  const editor = vscode.window.visibleTextEditors.find(e => e.document === document);

  if (!editor) return;

  if (rpgiv.isNOTFixedFormatRPG(document)) {
    // Clear decorations if not fixed format
    applyColumnarDecorations(editor, false);
    return;
  }

  if (rpgSmartTabEnabled) {
    applyColumnarDecorations(editor, true);

    // Draw tab stop lines for all lines in the document
    for (let line = 0; line < document.lineCount; line++) {
      drawTabStopLines(editor, line);
    }
  }
}