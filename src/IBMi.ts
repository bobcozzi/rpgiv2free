

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

export interface DCLInsert {
  currentLineIndex: number;
  extraDCL: string[];
}

export function insertExtraDCLLinesBatch(
  editor: vscode.TextEditor,
  allLines: string[],
  inserts: DCLInsert[]
): Thenable<boolean> {
  if (inserts.length === 0) return Promise.resolve(true);

  // Find all insertion positions and prepare insertions
  const insertData: { position: vscode.Position; text: string }[] = [];

  for (const { currentLineIndex, extraDCL } of inserts) {
    if (extraDCL.length === 0) continue;

    let insertAfterLine = 0;
    for (let i = currentLineIndex; i >= 0; i--) {
      const line = allLines[i];
      if (!line || line.trim() === '') continue;
      if (line.trim().startsWith('//')) continue;

      const specType = line[5]?.toLowerCase?.() || '';
      // Note: Input specs must appear after D specs/DCL-DS/DCL-S specs.
      // so we do not check for 'I' specs here.
      const legacyD = line.length > 5 && (["d", "p","f","h"].includes(specType));
      const freeDCL = getColUpper(line, 8, 25);
      const freeDCL2 = getColUpper(line, 1, 80);
      const isDCL = freeDCL.startsWith('DCL-') || freeDCL.startsWith('CTL-') ||
                    freeDCL2.startsWith('DCL-') || freeDCL2.startsWith('CTL-');

      if (legacyD || isDCL) {
        insertAfterLine = i;
        break;
      }
    }

    const position = new vscode.Position(insertAfterLine + 1, 0);
    const text = extraDCL.join('\n') + '\n';
    insertData.push({ position, text });
  }

  return editor.edit(editBuilder => {
    for (const { position, text } of insertData) {
      editBuilder.insert(position, text);
    }
  });
}

export function insertExtraDCLLines1(
  editor: vscode.TextEditor,
  allLines: string[],
  currentLineIndex: number,
  extraDCL: string[]
): Thenable<boolean> {
  if (extraDCL.length === 0) return Promise.resolve(true);

  let insertAfterLine = 0;
  for (let i = currentLineIndex; i >= 0; i--) {
    const line = allLines[i];
    if (!line || line.trim() === '') continue;
    if (line.trim().startsWith('//')) continue;

    const specType = line[5].toLowerCase();
    const legacyD = line.length > 5 && (["d", "p"].includes(specType));
    const freeDCL = getColUpper(line, 8, 25);
    const isDCL = freeDCL.startsWith('DCL-');

    if (legacyD || isDCL) {
      insertAfterLine = i;
      break;
    }
  }

  const insertPosition = new vscode.Position(insertAfterLine + 1, 0);
  const insertText = extraDCL.join('\n') + '\n';
  return editor.edit(editBuilder => {
    editBuilder.insert(insertPosition, insertText);
  });
}

// Extracts the opcode from a C-spec line
export function getOpcode(line: string): string {
  return getColUpper(line.padEnd(80, ' '), 26, 35);
}

export function isOpcodeIFxx(line: string): boolean {
  const opcode = getOpcode(line);
  return /^IF(EQ|NE|GT|LT|GE|LE)?$/.test(opcode);
}

export function isOpcodeWHENxx(line: string): boolean {
  const opcode = getOpcode(line);
  return /^WHEN(EQ|NE|GT|LT|GE|LE)?$/.test(opcode);
}

export function isOpcodeANDxxORxx(line: string): boolean {
  const opcode = getOpcode(line);
  return /^(AND|OR)(EQ|NE|GT|LT|GE|LE)?$/.test(opcode);
}

export function isOpcodeEnd(line: string): boolean {
  const opcode = getOpcode(line);
  return /^END(IF|SL)?$/.test(opcode);
}


export function isStartBooleanOpcode(line: string): boolean {
  return (
    isOpcodeIFxx(line) ||
    isOpcodeWHENxx(line)
  );
}

export function isBooleanOpcode(line: string): boolean {
  return (
    isOpcodeIFxx(line) ||
    isOpcodeWHENxx(line) ||
    isOpcodeANDxxORxx(line)
  );
}