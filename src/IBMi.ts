
import * as vscode from 'vscode';

// Create output channel
const outputChannel = vscode.window.createOutputChannel('RPGIV2FreeFmtConverter');


export function getEOL(): string {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return '\n'; // Default to LF if no editor
  return editor.document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
}

/**
 * Splits a single string into individual string (lines) using platform-agnostic line endings.
 * Handles \n (Unix), \r\n (Windows), and \r (legacy Mac) just in case.
 */
export function splitLines(text: string): string[] {
  return text.split(/\r\n|\r|\n/);
}

// Log function with condition for Debug
export function log(message: any) {
  const isDebug = process.env.VSCODE_ENV === 'development';  // Check if in debug mode via environment variable

  if (isDebug) {
    outputChannel.appendLine(typeof message === 'string' ? message : JSON.stringify(message));
    outputChannel.show(true);  // Show the log panel
  }
}

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


export function getRPGIVFreeSettings() {
  const config = vscode.workspace.getConfiguration('rpgiv2free');
  return {
    convertBINTOINT: config.get<number>('convertBINTOINT', 2),
    addINZ: config.get<boolean>('addINZ', true),
    indentFirstLine: config.get<number>('indentFirstLine',10),
    indentContLines: config.get<number>('indentContinuedLines', 12),
    maxWidth: config.get<number>('maxFreeFormatLineLength',76)
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


  // if first entry in DCLInsert is "end-xx" then look forward from starting line
  // to find the first non-subfield, non-parm (i.e., non-XX) line and insert just before it.


  // Find all insertion positions and prepare insertions
  const insertData: { position: vscode.Position; text: string }[] = [];
  let insertAfterLine = 0;
  for (const { currentLineIndex, extraDCL } of inserts) {
    if (extraDCL.length === 0) continue;

    insertAfterLine = 0;
    const firstDCL = extraDCL[0].trim().toLowerCase();

    if (firstDCL.startsWith('end-')) {
      // Step 1: Find rough insert point by scanning forward
      insertAfterLine = findLocationForEndStmt(currentLineIndex, allLines);

      // Step 2: Walk backwards to find last non-blank, non-comment line
      while (insertAfterLine > 0) {
        const candidate = allLines[insertAfterLine].trim();

        // Skip blank or comment lines
        let isComment = (candidate.trim().startsWith('//'));
        if (!isComment)
        {
          isComment = candidate.length > 6 && candidate[6] === '*';
        }

        if (candidate === '' || isComment) {
          insertAfterLine--;
        } else {
          break;
        }
      }

      // Now insertAfterLine is at the last meaningful line before the next block
    } else {
      for (let i = currentLineIndex; i >= 0; i--) {
        const line = allLines[i];
        if (!line || line.trim() === '') continue;
        if (line.trim().startsWith('//')) continue;

        const specType = line[5]?.toLowerCase?.() || '';
        // Note: Input specs must appear after D specs/DCL-DS/DCL-S specs.
        // so we do not check for 'I' specs here.
        const legacyD = line.length > 5 && (["d", "p", "f", "h"].includes(specType));
        const freeDCL = getColUpper(line, 8, 25);
        const freeDCL2 = getColUpper(line, 1, 80);
        const isDCL = freeDCL.startsWith('DCL-') || freeDCL.startsWith('CTL-') ||
          freeDCL2.startsWith('DCL-') || freeDCL2.startsWith('CTL-');

        if (legacyD || isDCL) {
          insertAfterLine = i;
          break;
        }
      }
    }
    const position = new vscode.Position(insertAfterLine + 1, 0);
    const text = extraDCL.join(getEOL()) + getEOL();
    insertData.push({ position, text });
  }

  return editor.edit(editBuilder => {
    for (const { position, text } of insertData) {
      editBuilder.insert(position, text);
    }
  });
}

function findLocationForEndStmt(startIndex: number, allLines: string[]): number {
  for (let i = startIndex + 1; i < allLines.length; i++) {
    const line = allLines[i];
    if (!line || line.trim() === '') continue;
    if (line.trim().startsWith('//')) continue;
    const isComment = line.length > 6 && line[6]==='*';
    if (isComment) continue; // Skip comment lines

    const specType = line[5]?.toLowerCase?.() || '';
    const legacySpec = line.length > 5 && !["d", " "].includes(specType);
    const freeForm = getColUpper(line, 8, 25);
    const freeForm2 = getColUpper(line, 1, 80);
    const extType = getColUpper(line, 22);  // Get column 22 Ext Type
    const PSDS = getColUpper(line, 23);  // Get column 23 PSDS Flag
    const dclType = getColUpper(line, 24, 25);  // Get column 24-25 DCL Type

    if (!legacySpec) {  // If fixed format D spec, then see if it is also a DS, S, or C type.
      if (specType === "d") {
        if (dclType?.trim() && ["DS", "S", "C"].includes(dclType)) {
          // stop here and return this line number.
          return i - 1;
        }
      }
    }
    const isDCLorSubItem =
      freeForm.startsWith('DCL-S') ||
      freeForm.startsWith('DCL-C') ||
      freeForm.startsWith('DCL-DS') ||
      freeForm.startsWith('DCL-PI') ||
      freeForm.startsWith('DCL-PR') ||
      freeForm.startsWith('DCL-PARM') ||
      freeForm2.startsWith('DCL-S') ||
      freeForm2.startsWith('DCL-C') ||
      freeForm2.startsWith('DCL-DS') ||
      freeForm2.startsWith('DCL-PI') ||
      freeForm2.startsWith('DCL-PR') ||
      freeForm2.startsWith('DCL-PARM');

    if (legacySpec || isDCLorSubItem || isFreeFormCalcStmt(line)) {
      return i - 1; // Insert just before this line
    }
  }

  return allLines.length - 1; // Default to end of file
}

function isFreeFormCalcStmt(line: string): boolean {
  const trimmedLine = line.trim();

  // If the line is empty, return false
  if (trimmedLine === '') return false;

  // Split the line into tokens by space
  const tokens = trimmedLine.split(/\s+/);  // Regular split by spaces

  const firstToken = tokens[0].toUpperCase().replace(/[^A-Z0-9]/g, ''); // Get first token and clean it

  // Check if the first token is a valid opcode (skip control structures)
  if (isValidOpcode(firstToken)) return true;

  // Check for the presence of assignment or function call
  const splitIndex = trimmedLine.indexOf('=');  // Check for assignment operator
  if (splitIndex === -1) {
    const openParenIndex = trimmedLine.indexOf('(');  // Check for a function call
    if (openParenIndex === -1) return false;  // No assignment and no function call
    // Check if it's a valid function (procedure call) by validating the first token
    if (isExtOpcode(firstToken)) return true;  // Procedure call
    return false;
  }

  // For assignment statements: check if it's a valid variable (e.g., target variable for the assignment)
  return true;
}


// Extracts the opcode from a C-spec line
export function getOpcode(line: string): string {
  return getColUpper(line.padEnd(80, ' '), 26, 35);
}

export function isOpcodeIFxx(line: string): boolean {
  const opcode = getOpcode(line);
  // Only matches IF followed by a valid boolean operator
  return /^IF(EQ|NE|GT|LT|GE|LE)$/.test(opcode);
}

export function isOpcodeWHENxx(line: string): boolean {
  const opcode = getOpcode(line);
  // Only matches WHEN followed by a valid boolean operator
  return /^WHEN(EQ|NE|GT|LT|GE|LE)$/.test(opcode);
}
export function isOpcodeANDxxORxx(line: string): boolean {
  const opcode = getOpcode(line);
  return /^(AND|OR)(EQ|NE|GT|LT|GE|LE)$/.test(opcode);
}

export function isOpcodeEnd(line: string): boolean {
  const opcode = getOpcode(line);
  return /^END(IF|SL|CS|DO)?$/.test(opcode);
}


export function isCASEOpcode(line: string): boolean {
  const opcode = getOpcode(line);
  return /^CAS(EQ|NE|LT|LE|GT|GE)?$/.test(opcode);
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

export function isValidOpcode(id: string): boolean {
  // List of valid opcodes (operation extenders not included)
  const rpgOpcodes = new Set([
    "ACQ", "BEGSR", "CALLP", "CHAIN", "CLEAR", "CLOSE", "COMMIT",
    "DATA-GEN", "DATA-INTO", "DEALLOC", "DELETE", "DOU", "DOW",
    "DSPLY", "DUMP", "ELSE", "ELSEIF", "ENDDO", "ENDFOR", "ENDIF",
    "ENDMON", "ENDSL", "ENDSR", "EVAL", "EVALR", "EVAL-CORR", "EXCEPT",
    "EXFMT", "EXSR", "FEOD", "FOR", "FOR-EACH", "FORCE", "IF", "IN",
    "ITER", "LEAVE", "LEAVESR", "MONITOR", "NEXT", "ON-ERROR", "ON-EXIT",
    "OPEN", "OTHER", "OUT", "POST", "READ", "READC", "READE", "READP",
    "READPE", "REL", "RESET", "RETURN", "ROLBK", "SELECT", "SETGT",
    "SETLL", "SORTA", "TEST", "UNLOCK", "UPDATE", "WHEN", "WRITE",
    "XML-INTO", "XML-SAX"
  ]);

  // Strip off operation extenders like "(EHMR)" from the ID
  const baseOpcode = id.replace(/\([A-Z]+\)$/i, "").toUpperCase();

  return rpgOpcodes.has(baseOpcode);
}

// Is an OpCode that supports the Extended Factor 2 syntax?
export function isExtOpcode(opcode: string): boolean {
    const extOpcodes = new Set([
      "CALLP",
      "CLEAR",
      "DATA-INTO",
      "DOU",
      "DOW",
      "EVAL",
      "EVALR",
      "EVAL-CORR",
      "FOR",
      "FOR-EACH",
      "IF",
      "ELSEIF",
      "WHEN",
      "MONITOR",
      "ON-ERROR",
      "RETURN",
      "ROLBK",
      "SORTA",
      "TEST",
      "XML-INTO",
      "XML-SAX"
    ]);
    const normalized = opcode.toUpperCase().replace(/\(.*\)$/, ""); // strip off Operation Extender (if any)
    return extOpcodes.has(opcode.toUpperCase());
}
