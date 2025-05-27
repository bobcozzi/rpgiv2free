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
import { convertToFreeFormSQL } from './collectSQLSpec';
import * as types from './types';
import * as rpgiv from './rpgedit';


let rpgSmartTabEnabled = true;  // ← In-memory toggle

export function activate(context: vscode.ExtensionContext) {
  // Load saved setting at startup

  rpgSmartTabEnabled = context.globalState.get<boolean>('rpgSmartTabEnabled', true);

  function loadSettings() {
    const config = vscode.workspace.getConfiguration('rpgiv2free');
    rpgSmartTabEnabled = config.get<boolean>('enableRPGSmartEnter', true);
  }


  //
  // ✅ Smart Tab Toggle UI (no reload required)
  //
  const smartTabStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  smartTabStatusBarItem.command = 'rpgiv2free.toggleRPGSmartTab';
  smartTabStatusBarItem.tooltip = 'Click to toggle RPG Smart Tab (no reload)';
  context.subscriptions.push(smartTabStatusBarItem);

  function updateSmartTabStatusBar() {
    smartTabStatusBarItem.text = `RPG Smart Tab: ${rpgSmartTabEnabled ? 'On' : 'Off'}`;
    smartTabStatusBarItem.show();
  }


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
  /**
   * Command to toggle the RPG Smart Tab feature.
   * This command enables or disables the Smart Tab functionality without requiring a reload.
   * The current state is persisted in the global state and reflected in the status bar.
   */
  const toggleRPGSmartTabCmd = vscode.commands.registerCommand('rpgiv2free.toggleRPGSmartTab', async () => {
    // Toggle the setting
    rpgSmartTabEnabled = !rpgSmartTabEnabled;

    // Persist the setting
    await context.globalState.update('rpgSmartTabEnabled', rpgSmartTabEnabled);

    // Update UI
    updateSmartTabStatusBar();
    // vscode.window.showInformationMessage(`Smart Tab is now ${rpgSmartTabEnabled ? 'enabled' : 'disabled'}.`);

    // Reapply or clear decorations based on new setting
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      applyColumnarDecorations(editor, rpgSmartTabEnabled);
    }
  });

  context.subscriptions.push(toggleRPGSmartTabCmd);
  updateSmartTabStatusBar();

  //
  // ✅ Register Tab/Shift+Tab handlers (always registered, gated at runtime)
  //
  const tabCmd = vscode.commands.registerCommand('rpgsmarttab.tab', async () => {
    const didCommit = await vscode.commands.executeCommand('editor.action.inlineSuggest.commit');
    if (didCommit !== undefined) {
      // If the command returns anything, assume it handled the keypress
      return;
    }

    if ((vscode as any).window.activeTextEditor?.options.suggestWidgetVisible) {
      await vscode.commands.executeCommand('acceptSelectedSuggestion');
      return;
    }
    const editor = vscode.window.activeTextEditor;
    const doc = editor?.document;
    if (!doc || !rpgSmartTabEnabled || rpgiv.isNOTFixedFormatRPG(doc)) {
      await vscode.commands.executeCommand('tab');
      return;
    }
    handleSmartTab(false);
  });

  const shiftTabCmd = vscode.commands.registerCommand('rpgsmarttab.shiftTab', async () => {
    const editor = vscode.window.activeTextEditor;
    const doc = editor?.document;
    if (!doc || !rpgSmartTabEnabled || rpgiv.isNOTFixedFormatRPG(doc)) {
      await vscode.commands.executeCommand('outdent');  // VS Code's default Shift+Tab
      return;
    }
    handleSmartTab(true);
  });

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


  context.subscriptions.push(
    vscode.commands.registerTextEditorCommand('rpgiv2free.smartEnter', async (editor, edit) => {
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
        (mode === rpgiv.SmartEnterMode.FixedOnly && rpgiv.isNOTFixedFormatRPG(doc)) ||
        (mode === rpgiv.SmartEnterMode.FixedAndFree && !rpgiv.isRPGDocument(doc));
      // Check if the document is not RPG or if the mode is disabled
      // If the selection is on the first row, first position and Enter is pressed,
      // we treat it like a normal Enter key and fallback to the default behavior.
      if (fallBackOnEnter || (editor.selection.start.line === 0 && editor.selection.start.character === 0)) {
        await vscode.commands.executeCommand('default:type', { text: rpgiv.getEOL() });
        return;
      }
      const position = editor.selection.active;
      await handleSmartEnter(editor, position);  // Note: handleSmartEnter doesn't use `edit` here
    })
  );

  // Command to convert selected RPG IV fixed format code to free-form RPG.

  const disposable = vscode.commands.registerCommand('rpgiv2free.convertToRPGFree', async () => {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
      vscode.window.showErrorMessage('No active editor found.');
      return;
    }
    rpgiv.log('CMD Handler Start');

    const activeLine = editor.selection.active.line;
    rpgiv.log('Active line: ' + activeLine);
    const totalLines = editor.document.lineCount;
    rpgiv.log(`Document line count: ${totalLines}`);

    try {
      const line = editor.document.lineAt(editor.selection.active.line).text;
      rpgiv.log('Current line: ' + line);
    } catch (e) {
      rpgiv.log('ERROR getting line text: ' + (e as Error).message);
    }

    // Use getText to get all lines at once, splitting by the document's EOL into an array of all lines
    const doc = editor.document;
    const allLines = doc.getText().split(rpgiv.getEOL());
    let specType = '';
    let index_Offset = 0;

    const processedLines = new Set<number>();
    rpgiv.log('Total lines: ' + allLines.length);

    const selectedLineIndexes = new Set<number>();
    const edits: { range: vscode.Range, text: string }[] = [];
    const extraDCLs: { insertAt: number, lines: string[] }[] = [];

    try {
      for (const sel of editor.selections) {
        if (sel.isEmpty) {
          selectedLineIndexes.add(sel.active.line);
        } else {
          const start = Math.min(sel.start.line, sel.end.line);
          const end = Math.max(sel.start.line, sel.end.line);
          for (let i = start; i <= end; i++) {
            selectedLineIndexes.add(i);
          }
        }
      }
    } catch (e) {
      rpgiv.log('Error collecting selected lines: ' + (e as Error).message);
    }

    const expandedLineIndexes = new Set<number>();
    rpgiv.log('CMD Handler expanding range selections');

    for (const lineNbr of selectedLineIndexes) {
      if (expandedLineIndexes.has(lineNbr)) {
        continue; // skip this one?
      }
      const expanded = expandCompoundRange(allLines, lineNbr);
      for (const idx of expanded) {
        // Only add if not already present (skip duplicates)
        if (!expandedLineIndexes.has(idx)) {
          expandedLineIndexes.add(idx);
        }
      }
    }
    rpgiv.log('CMD Handler expanding range selections');

    const selectedLineList = [...expandedLineIndexes].sort((a, b) => a - b);
    rpgiv.log('CMD Handler checking selections');
    for (const i of selectedLineList) {
      if (i >= allLines.length) continue;
      const collectedStmts = collectStmt(allLines, i);
      rpgiv.log(`Collected ${collectedStmts?.indexes.length} statements for line: ${i + 1}`);

      // ...and so on for each major step
      if (!collectedStmts) continue;

      const { lines: specLines, indexes, comments, isSQL, isCollected, entityName } = collectedStmts;

      // if (i !== indexes[0]) continue;

      if (!specLines.length) {
        continue;
      }
      if (indexes.some(idx => processedLines.has(idx))) {
        continue;
      }

      let extraDCL: string[] = [];
      let convertedText = '';

      if (isSQL) {
        convertedText = convertToFreeFormSQL(specLines).join(rpgiv.getEOL());
      } else if (isCollected) {
        convertedText = specLines.flatMap(line => formatRPGIV(line)).join(rpgiv.getEOL());
      } else {
        const line = specLines[0] ?? '';
        specType = line.length > 5 ? line.charAt(5).toLowerCase().trim() : '';
        const converted =
          specType === 'h' ? convertHSpec(specLines)
            : specType === 'f' ? convertFSpec(specLines)
              : specType === 'd' ? convertDSpec(specLines, entityName, extraDCL, allLines, i)
                : specType === 'p' ? convertPSpec(specLines, entityName)
                  : specType === 'c' ? convertCSpec(specLines, extraDCL)
                    : specLines;
        if (specType) {
          convertedText = converted.flatMap(line => formatRPGIV(line)).join(rpgiv.getEOL());
        } else {
          convertedText = Array.isArray(converted)
            ? converted.join(rpgiv.getEOL())
            : String(converted);
        }
      }

      const eol = rpgiv.getEOL();
      if (Array.isArray(comments) && comments.length > 0) {
        if (!convertedText.endsWith(eol) && convertedText.length > 0) {
          convertedText += eol;
        }
        convertedText += comments.join(eol);
      }

      const rangeStart = new vscode.Position(indexes[0], 0);
      const lastLineText = doc.lineAt(indexes[indexes.length - 1]).text;
      const rangeEnd = new vscode.Position(indexes[indexes.length - 1], lastLineText.length);
      const rangeToReplace = new vscode.Range(rangeStart, rangeEnd);

      // Always push the edit, even if convertedText is an empty string
      const currentText = doc.getText(rangeToReplace);
      if (
        convertedText !== undefined &&
        convertedText !== null &&
        currentText !== convertedText
      ) {
        edits.push({ range: rangeToReplace, text: convertedText });
      }

      indexes.forEach(idx => processedLines.add(idx));
      if (extraDCL.length > 0) {
        extraDCLs.push({ insertAt: indexes[0], lines: extraDCL });
      }
    }

    function formatBlockLines(lines: string[]): string[] {
      return lines.flatMap(line => formatRPGIV(line, false));
    }

    // Usage: Format and flatten RPG IV source lines for each extra (generated) DCL stmt
    const convertedExtraDCL = extraDCLs.map(block => ({
      insertAt: block.insertAt,
      lines: formatBlockLines(block.lines)
    }));

    if (edits.length > 0) {
      try {
        rpgiv.log('CMD Handler Applying edits');

        // const uniqueEdits = Array.from(new Map(edits.map(e => [e.range.toString(), e])).values());
        const success = await editor.edit(editBuilder => {
          for (const edit of edits) {
            editBuilder.replace(edit.range, edit.text);
          }
        });

        if (!success) {
          console.log('Failed to apply edits. Edits:', JSON.stringify(edits, null, 2));
          vscode.window.showErrorMessage('Failed to apply edits. Please try again.');
        }
      } catch (error) {
        console.log('Error applying edits:', (error as Error).message, 'Edits:', JSON.stringify(edits, null, 2));
        vscode.window.showErrorMessage('Error applying edits: ' + (error as Error).message);
      }
    }

    if (convertedExtraDCL.length > 0) {
      const lines = rpgiv.splitLines(editor.document.getText());
      await rpgiv.insertExtraDCLLinesBatch(editor, lines, convertedExtraDCL.map(dcl => ({
        currentLineIndex: dcl.insertAt + index_Offset,
        extraDCL: dcl.lines
      })));
      // If a D spec, then the only extra DCL-xx statements that are produced are end-dS, end-pr, end-pi and end-proc statements.
      // So since each iteration will offset by the prior insertExtraDCl, we keep a count of said inserts
      // and offset the starting line number where those inserts sould appear.
      if (specType === 'd') {
        index_Offset += convertedExtraDCL.length;
      }
      else {
        index_Offset = 0;
      }

    }
    rpgiv.log('CMD Handler ending');
  });

  context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {
  console.log('[rpgiv2free] deactivated');
}

function evaluateAndApplyFeatures(document: vscode.TextDocument) {
  if (!['rpgle', 'sqlrpgle'].includes(document.languageId)) return;

  const editor = vscode.window.visibleTextEditors.find(e => e.document === document);
  console.log('evaluateAndApplyFeatures:', document.fileName, !!editor);

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