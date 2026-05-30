// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 1996-2026 by R. Cozzi, Jr.
// @author BobCozzi

import * as vscode from 'vscode';
import * as rpgiv from './rpgtools';

export async function handleSmartEnter(editor: vscode.TextEditor, position: vscode.Position) {
  const mode = rpgiv.getSmartEnterMode();

  if (mode === rpgiv.SmartEnterMode.Disabled) {
    await vscode.commands.executeCommand('default:type', { text: rpgiv.getEOL() });
    return;
  }

  const doc = editor.document;
  const isFreeFormatDoc = rpgiv.isFreeFormatRPG(doc);
  const eol = rpgiv.getEOL();

  // For fixedOnly mode, bail out on free-format documents
  if (mode === rpgiv.SmartEnterMode.FixedOnly && isFreeFormatDoc) {
    await vscode.commands.executeCommand('default:type', { text: rpgiv.getEOL() });
    return;
  }

  const line = doc.lineAt(position.line);
  if (!line) {
    await vscode.commands.executeCommand('default:type', { text: rpgiv.getEOL() });
    return;
  }

  const text = line.text;

  // For fully free-format documents (starts with **FREE), or free-format lines in hybrid
  // documents when fixedAndFree/allSource mode is active: move to next line preserving indent
  const isFreeFormatLine = isFreeFormatDoc || !rpgiv.isValidFixedFormat(text);
  if (isFreeFormatLine) {
    if (mode === rpgiv.SmartEnterMode.FixedAndFree || mode === rpgiv.SmartEnterMode.allSource) {
      const indent = text.match(/^(\s*)/)?.[1] ?? '';
      const lineEndPosition = line.range.end;
      await editor.edit(editBuilder => {
        editBuilder.insert(lineEndPosition, eol + indent);
      });
      const newCursorPos = new vscode.Position(position.line + 1, indent.length);
      editor.selection = new vscode.Selection(newCursorPos, newCursorPos);
      return;
    }
    await vscode.commands.executeCommand('default:type', { text: rpgiv.getEOL() });
    return;
  }

  // Fixed-format line: duplicate spec prefix and align cursor to first content column
  const config = vscode.workspace.getConfiguration('rpgiv2free');
  const copySpec = config.get<boolean>('enableRPGSmartEnterDupSpec', true);

  const specPrefix = text.substring(0, 6);
  const afterSpec = text.substring(6);

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