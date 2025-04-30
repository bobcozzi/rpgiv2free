

// Extracts the specified columns data from the line input string.
  // const opcode = getcol(line, 25, 35).trim().toUpperCase();

  export function getCol(line: string | null | undefined, from: number, to?: number): string {
    if (!line || from < 1) return '';
    const end = to ?? from; // default 'to' to 'from' if not provided
    if (end < from) return '';
    return line.substring(from - 1, end).trim();
  }
  export function getColUpper(line: string | null | undefined, from: number, to?: number): string {
    if (!line || from < 1) return '';
    const end = to ?? from; // default 'to' to 'from' if not provided
    if (end < from) return '';
    return line.substring(from - 1, end).trim().toUpperCase();
  }
  export function getColLower(line: string | null | undefined, from: number, to?: number): string {
    if (!line || from < 1) return '';
    const end = to ?? from; // default 'to' to 'from' if not provided
    if (end < from) return '';
    return line.substring(from - 1, end).trim().toLowerCase();
  }

  export function getSpecType(line: string): string {
    return line.length >= 6 ? line[5].toLowerCase() : '';
}
export function getDclType(line: string): string {
  return getColUpper(line, 24, 25);
}
import * as vscode from 'vscode';

export function getRPGIVFreeSettings() {
  const config = vscode.workspace.getConfiguration('rpgivfree');
  return {
    convertBINTOINT: config.get<number>('convertBINTOINT', 2),
    addINZ: config.get<boolean>('addINZ', true)
  };
}

export function insertExtraDCLLines(
  editor: vscode.TextEditor,
  allLines: string[],
  currentLineIndex: number,
  extraDCL: string[]
): void {
  if (extraDCL.length === 0) return;

  // Start from current line and move upward
  let insertAfterLine = 0;
  for (let i = currentLineIndex; i >= 0; i--) {
    const line = allLines[i];
    if (!line || line.trim() === '') continue; // Skip empty lines
    if (line.trim().startsWith('//')) continue; // Skip comment lines
    const specType = line[5].toLowerCase();

    // Check for traditional D-spec (column 6 = 'D')
    const legacyD = line.length > 5 && (["d","p"].includes(specType))
    const freeDCL = getColUpper(line,8, 25);
    // Check for free-format DCL- opcodes (e.g., "DCL-S", "DCL-DS", etc.)
    const isDCL = freeDCL.startsWith('DCL-');

    if (legacyD || isDCL) {
      insertAfterLine = i;
      break;
    }
  }

  // Build insert edit
  editor.edit(editBuilder => {
    const insertPosition = new vscode.Position(insertAfterLine + 1, 0);
    const insertText = extraDCL.join('\n') + '\n';
    editBuilder.insert(insertPosition, insertText);
  });
}