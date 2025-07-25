
import * as vscode from 'vscode';
import * as rpgiv from './rpgedit';

export async function handleSmartEnter(editor: vscode.TextEditor, position: vscode.Position) {
  const config = vscode.workspace.getConfiguration('rpgiv2free');
  const copySpec = config.get<boolean>('enableRPGCopySpecOnEnter', true);

  // Check if Smart Enter is enabled
  const smartRPGEnterMode = config.get<string>('enableRPGSmartEnter', 'fixedOnly');
  if (!smartRPGEnterMode || smartRPGEnterMode === 'disable') {
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