
import * as vscode from 'vscode';
import * as path from 'path';


export enum SmartEnterMode {
  FixedOnly = 1,
  FixedAndFree = 2,
  allSource = 3,
  Disabled = 0
}

export function getEOL(): string {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return '\n'; // Default to LF if no editor
  return editor.document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
}

export function getActiveFileInfo(): {
  fullPath: string;
  fileName: string;
  extension: string;
} | null {
  const activeEditor = vscode.window.activeTextEditor;

  if (activeEditor) {
    const fullPath = activeEditor.document.fileName;
    const fileName = path.basename(fullPath);
    const extension = path.extname(fullPath).toLowerCase();

    return { fullPath, fileName, extension };
  }

  return null;
}

export interface configSettings {
  convertBINTOINT: number;
  addINZ: boolean;
  indentFirstLine: number;
  indentContLines: number;
  maxWidth: number;
  addEXTDEVFLAG: boolean;
  removeFREEdir: boolean;
  replaceCOPYinRPG: boolean;
  replaceCOPYinSQLRPG: boolean;
  tempVar1STG: string;
  tempVar2DO: string;
}

export function getRPGIVFreeSettings(): configSettings {
  const config = vscode.workspace.getConfiguration('rpgiv2free');
  return {
    convertBINTOINT: config.get<number>('convertBINTOINT', 2),
    addINZ: config.get<boolean>('addINZ', true),
    indentFirstLine: config.get<number>('indentFirstLine', 10),
    indentContLines: config.get<number>('indentContinuedLines', 12),
    maxWidth: config.get<number>('maxFreeFormatLineLength', 76),
    addEXTDEVFLAG: config.get<boolean>('AddEXTDeviceFlag', true),
    removeFREEdir: config.get<boolean>('RemoveFREEDirective', true),
    replaceCOPYinRPG: config.get<boolean>('ReplaceCOPYwithINCLUDE_RPG', true),
    replaceCOPYinSQLRPG: config.get<boolean>('ReplaceCOPYwithINCLUDE_SQLRPG', false),
    tempVar1STG: config.get<string>('tempVarName1', 'rpg2ff_tempSTG'),
    tempVar2DO: config.get<string>('tempVarName2', 'rpg2ff_tempDO')
  };
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
  console.log(message);
}

export function getCol(line: string | null | undefined, from: number, to?: number): string {
  if (!line || from < 1) return '';
  const end = to ?? from; // default 'to' to 'from' if not provided
  if (end < from) return '';
  line = line.padEnd(end, ' ');
  return line.substring(from - 1, end);
}

export function getColUpper(line: string | null | undefined, from: number, to?: number): string {
  if (!line || from < 1) return '';
  line = line.padEnd(80, ' ');
  const end = to ?? from;
  if (end < from) return '';
  return line.substring(from - 1, end).toUpperCase();
}

export function getColLower(line: string | null | undefined, from: number, to?: number): string {
  if (!line || from < 1) return '';
  line = line.padEnd(80, ' ');
  const end = to ?? from;
  if (end < from) return '';
  return line.substring(from - 1, end).toLowerCase();
}

export function getSpecType(line: string): string {
  return line.length >= 6 ? line[5].toLowerCase() : '';
}
export function getDclType(line: string): string {
  return getColUpper(line, 24, 25).trim();
}

export function convertCmt(line: string): string {
  let freeComment = '';
  const indent = ' '.repeat(10);
  const isComment = getCol(line, 7).trim() === '*';

  if (isComment) {
    const cmtText = getCol(line, 8, 80).trimEnd();
    if (cmtText) {
      freeComment = indent + '// ' + cmtText;
    } else {
      freeComment = '';  // or ' ' if you need a placeholder
    }
  } else {
    freeComment = line;
  }

  return freeComment;
}


// for for not executable source lines, like comments, blanks line, or compiler directives
export function isEmptyStmt(line: string): boolean {
  const bBlankLine = line.trim().length < 6;

  const bEmptyStmt = (
    line.length > 5 &&
    line[5].trim() !== '' &&
    getCol(line, 8, 80).trim() === ''
  );

  return (bBlankLine || bEmptyStmt);
}

export function isDirective(line: string): boolean {
  const bDirective = (
    line.length > 7 &&
    line[6] === '/' &&
    line[7] !== '/'
  );
  return bDirective;
}

export function isValidFixedFormat(line: string): boolean {
  const bValidFormat = (isNotSkipStmt(line) && getSpecType(line).trim() !== '');
  return bValidFormat;
}

// for non-executable source lines, like comments, blanks line, or compiler directives
export function isSkipStmt(line: string): boolean {
  const bComment = isComment(line);  // Assumes isComment() handles RPG IV logic
  const bEmptyStmt = isEmptyStmt(line);
  const bDirective = isDirective(line);
  return bComment || bDirective || bEmptyStmt;
}

export function isNotSkipStmt(line: string): boolean {
  return (!isSkipStmt(line));
}

export function isComment(line: string): boolean {
  const classicRPGStyle = line.length > 6 && line[6] === '*';
  const cppStyle = getCol(line, 8, 80).trimStart().startsWith('//') ||
    getCol(line, 1, 80).trimStart().startsWith('//');
  return classicRPGStyle || cppStyle;
}

export function isNotComment(line: string): boolean {
  return (!isComment(line));
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

        if (candidate === '' || isComment(candidate)) {
          insertAfterLine--;
        } else {
          break;
        }
      }

      // Now insertAfterLine is at the last meaningful line before the next block
    } else {
      for (let i = currentLineIndex; i >= 0; i--) {
        const line = allLines[i];
        if (typeof line !== 'string' || !line.trim()) continue;
        if (isComment(line)) continue;

        // Defensive: line must be at least 6 chars for specType
        const specType = line.length > 5 ? line[5].toLowerCase?.() || '' : '';
        // Note: Input specs must appear after D specs/DCL-DS/DCL-S specs.
        // so we do not check for 'I' specs here.
        const legacyD = line.length > 5 && (["d", "p", "f", "h"].includes(specType));
        const freeDCL = getColUpper(line, 8, 25).toUpperCase().trimStart();
        const freeDCL2 = getColUpper(line, 1, 80).toUpperCase().trimStart();
        const isDCL = freeDCL.startsWith('DCL-') || freeDCL.startsWith('CTL-') ||
          freeDCL2.startsWith('DCL-') || freeDCL2.startsWith('CTL-');

        if (legacyD || isDCL) {
          insertAfterLine = i;
          break;
        }
      }
    }
    const uniqueDCL = [...new Set(extraDCL)];
    const filteredDCL = uniqueDCL.filter(line => {
      const varName = getDclVarName(line);
      return !(varName && isVarDcl(varName));
    });

    if (filteredDCL.length > 0) {
      const position = new vscode.Position(insertAfterLine + 1, 0);
      const text = filteredDCL.join(getEOL()) + getEOL();
      insertData.push({ position, text });
    }
  }
  const seen = new Set<string>();
  const uniqueData = insertData.filter(item => {
    if (seen.has(item.text)) return false;
    seen.add(item.text);
    return true;
  });
  return editor.edit(editBuilder => {
    for (const { position, text } of uniqueData) {
      editBuilder.insert(position, text);
    }
  });
}

function findLocationForEndStmt(startIndex: number, allLines: string[]): number {
  let insertPoint = startIndex;
  for (let i = startIndex + 1; i < allLines.length; i++) {
    const line = allLines[i];
    if (!line || line.trim() === '') continue;
    if (isComment(line)) continue;
    const directive = getColUpper(line, 7, 32).trim();

    if ( // Check for control directives such as /title, /space, /ejext, etc.
      line.length >= 9 &&
      line[6] === '/' &&
      /[A-Za-z]{2}/.test(line.substring(7, 9))
    ) {
      if (!directive.startsWith("/ENDIF")) {
        continue;
      }
    }

    const specType = line[5]?.toLowerCase?.() || '';
    const legacyDSpec = (specType === 'd');
    const bValidDefn = isValidFixedDefnLine(line);
    const freeForm = getColUpper(line, 8, 25);
    const freeForm2 = getColUpper(line, 1, 80);
    const extType = getColUpper(line, 22);  // Get column 22 Ext Type
    const PSDS = getColUpper(line, 23);  // Get column 23 PSDS Flag
    const dclType = getColUpper(line, 24, 25).trim();  // Get column 24-25 DCL Type
    const col2627 = getColUpper(line, 26, 27);  // Get column 36-27 should be empty

    if (legacyDSpec && bValidDefn &&
      dclType?.trim() && ["DS", "S", "C", "PI", "PR"].includes(dclType)) {
      // stop here and return this line number.
      break;
    }
    if (!isSpecEmpty(line) && !isValidOpcode(line)) {
      const dclTypes = ["DS", "S", "C", "PR", "PI", "PARM", "SUBF"];
      const isDCLorSubItem = isFreeFormDclType(freeForm, dclTypes) || isFreeFormDclType(freeForm2, dclTypes);
      const dclParmSubf = ["PARM", "SUBF"];
      const isParmOrSubfield = isFreeFormDclType(freeForm, dclParmSubf)
      if ((isDCLorSubItem && !isParmOrSubfield) || isFreeFormCalcStmt(line)) {
        break; // Insert just before this line
      }
      insertPoint = i;
    }
  }

  return insertPoint;
}

function isFreeFormCalcStmt(line: string): boolean {
  const trimmedLine = line.trim();

  // If the line is empty, return false
  if (trimmedLine === '') return false;

  if (isComment(line)) {
    return false;
  }

  // Split the line into tokens by space
  const tokens = trimmedLine.split(/\s+|\(/);  // Regular split by spaces

  const firstToken = tokens[0].toUpperCase().replace(/[^A-Z0-9]/g, ''); // Get first token and clean it

  // Check if the first token is a valid opcode (skip control structures)
  if (isValidOpcode(firstToken)) {
    return true;
  }

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
  return getColUpper(line.padEnd(80, ' '), 26, 35).trim();
}

export function isOpcodeIFxx(line: string): boolean {
  const opcode = getOpcode(line);
  // Only matches IF followed by a valid boolean operator
  return (isComment(line)) ? false : /^IF(EQ|NE|GT|LT|GE|LE)$/.test(opcode);
}
export function isOpcodeDOUxx(line: string): boolean {
  const opcode = getOpcode(line);
  // Only matches IF followed by a valid boolean operator
  return (isComment(line)) ? false : /^DOU(EQ|NE|GT|LT|GE|LE)$/.test(opcode);
}
export function isOpcodeDOWxx(line: string): boolean {
  const opcode = getOpcode(line);
  // Only matches IF followed by a valid boolean operator
  return (isComment(line)) ? false : /^DOW(EQ|NE|GT|LT|GE|LE)$/.test(opcode);
}

export function isOpcodeWHENxx(line: string): boolean {
  const opcode = getOpcode(line);
  if (isComment(line)) return false;
  return /^WHEN(EQ|NE|GT|LT|GE|LE)$/.test(opcode) || opcode === 'OTHER';
}

export function isOpcodeSELECT(line: string): boolean {
  const opcode = getOpcode(line);
  // Only matches WHEN followed by a valid boolean operator
  return (isComment(line)) ? false : (opcode.toUpperCase() === 'SELECT');
}
export function isOpcodeWHENStart(line: string): boolean {
  const opcode = getOpcode(line);
  // Only matches WHEN followed by a valid boolean operator
  return (isComment(line)) ? false : (opcode.toUpperCase() === 'SELECT');
}

export function isOpcodeANDxxORxx(line: string): boolean {
  const opcode = getOpcode(line);
  return (isComment(line)) ? false : /^(AND|OR)(EQ|NE|GT|LT|GE|LE)$/.test(opcode);
}


export function isCASEOpcode(line: string): boolean {
  const opcode = getOpcode(line);
  return (isComment(line)) ? false : /^CAS(EQ|NE|LT|LE|GT|GE)?$/.test(opcode);
}

export function isStartBooleanOpcode(line: string): boolean {
  return (isNotComment(line) &&
    (isOpcodeIFxx(line) ||
      isOpcodeDOWxx(line) ||
      isOpcodeDOUxx(line) ||
      isOpcodeSELECT(line))
  );
}

export function isBooleanOpcode(line: string): boolean {
  return (isNotComment(line) &&
    (isOpcodeIFxx(line) ||
      isOpcodeDOWxx(line) ||
      isOpcodeDOUxx(line) ||
      isOpcodeWHENxx(line) ||
      isOpcodeANDxxORxx(line))
  );
}

export function getSmartEnterMode(): SmartEnterMode {
  const config = vscode.workspace.getConfiguration('rpgiv2free');
  const setting = config.get<string>('enableRPGSmartEnter');

  switch (setting?.toLowerCase()) {
    case 'fixedonly':
      return SmartEnterMode.FixedOnly;
    case 'fixedandfree':
      return SmartEnterMode.FixedAndFree;
    case '*all':
    case 'all':
      return SmartEnterMode.allSource;
    case 'disable':
      return SmartEnterMode.Disabled;
    default:
      return SmartEnterMode.Disabled; // fallback to disabled
  }
}

export function isRPGDocument(document: vscode.TextDocument): boolean {
  if (!document) return false;
  const langId = document.languageId.toLowerCase();
  return langId === 'rpgle' || langId.startsWith('sqlrpg');
}

export function isFixedFormatRPG(document: vscode.TextDocument): boolean {
  if (!isRPGDocument(document)) return false;
  const firstLine = document.lineAt(0).text;

  // Must be at least 6 chars, no leading whitespace, exactly **FREE in columns 1-6
  // Only allow whitespace after column 6
  const hasFree = firstLine.length >= 6 &&
    firstLine.substring(0, 6).toUpperCase() === '**FREE' &&
    (firstLine.length === 6 || /^[ \t]*$/.test(firstLine.substring(6)));

  return !hasFree;
}

export function isNOTFixedFormatRPG(document: vscode.TextDocument): boolean {
  return !isFixedFormatRPG(document);
}

export function isOpcodeEnd(line: string): boolean {
  const opcode = getOpcode(line);
  return (isComment(line)) ? false : /^END(?:IF|DO|FOR|MON|SL|CS|SR)?$/.test(opcode);
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

export function isUnsuppotedOpcode(id: string): boolean {
  // List of valid opcodes (operation extenders not included)
  const oldRPGOpcodes = new Set([
    "CALL", "CALLB", "PARM", "KLIST", "KFLD", "FREE", "DEBUG"
  ]);
  // Strip off operation extenders like "(EHMR)" from the ID
  const baseOpcode = id.replace(/\([A-Z]+\)$/i, "").toUpperCase();

  return oldRPGOpcodes.has(baseOpcode);
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
  const normalized = opcode.toUpperCase().trim().replace(/\(.*\)$/, ""); // strip off Operation Extender (if any)
  return extOpcodes.has(opcode.toUpperCase());
}

function isFreeFormDclType(line: string, types: string[]): boolean {
  const trimmed = line.trimStart();  // Remove leading spaces
  const pattern = types.map(type => `DCL-${type}`).join('|');
  const regex = new RegExp(`^(${pattern})\\b`, 'i');  // Word boundary to avoid DCL-SUBF, etc.
  return regex.test(trimmed);
}

export function dNameContinues(line: string): boolean {
  // Check if the line ends with '...'
  if (!line.trimEnd().endsWith('...')) return false;

  // Scan columns 7 to 21 to find the first non-blank character (start of name)
  let startCol = -1;
  for (let i = 7; i <= 21; i++) {
    const char = getCol(line, i, i);
    if (char !== ' ') {
      startCol = i;
      break;
    }
  }

  // No name found starting in 7 to 21 → not a continuation
  if (startCol === -1) return false;

  // Extract from startCol to column 80
  const namePart = getCol(line, startCol, 80).trimEnd();

  // Must end with '...'
  if (!namePart.endsWith('...')) return false;

  // Remove '...' and validate the rest is strictly alphanumeric or underscore
  const namePrefix = namePart.slice(0, -3);
  return /^[A-Za-z0-9_]+$/.test(namePrefix);
}

export function dKwdContinues(line: string): boolean {
  // Keyword area is columns 44 to 80
  const kwdArea = getCol(line, 44, 80).trimEnd();

  if (kwdArea === '') return false;

  // Case 1: Quoted literal continued with + or -
  const lastChar = kwdArea.charAt(kwdArea.length - 1);
  if (lastChar === '+' || lastChar === '-') return true;

  // Case 2: Identifier (name) continued with ...
  if (kwdArea.endsWith('...')) {
    const base = kwdArea.slice(0, -3);
    // Check that it's a valid name: A-Z, 0-9, _
    return /^[A-Za-z0-9_]+$/.test(base);
  }

  return false;
}


export function isJustKwds(line: string): boolean {
  // Keyword area is columns 44 to 80
  const kwdArea = getCol(line, 44, 80).trimEnd();
  const nameDefnArea = getCol(line, 7, 43).trimEnd();
  if (kwdArea === '') return false;
  // Case 1: Quoted literal continued with + or -
  return kwdArea.length > 0 && nameDefnArea.length === 0;
}

export function isValidFixedDefnLine(curLine: string): boolean {
  let bValidDefn = false;
  if (dNameContinues(curLine)) return false;
  const col6 = getColUpper(curLine, 6)
  if (col6 !== 'D') return false;
  const dclType = getDclType(curLine).toLowerCase();
  const hasName = getCol(curLine, 7, 21).trim().length > 0;
  const isExtSubfield = (getCol(curLine, 22).toUpperCase() === 'E');
  const hasType = getCol(curLine, 23, 25).trim().length > 0;
  const hasAttr = getCol(curLine, 26, 43).trim().length > 0;

  if ((["ds", "pr", "pi", "s", "c"].includes(dclType)) || isExtSubfield || ((hasName || hasType) && hasAttr)) {
    bValidDefn = true;
  }

  return bValidDefn;
}

export function isSpecEmpty(line: string): boolean {
  if (!line || typeof line !== 'string') return true;
  if (line.length < 7) return true;
  const codeArea = getCol(line, 7, 80).trimEnd();
  if (codeArea === '' || isComment(line)) return true;
  return false;
}

export function getDclVarName(line: string): string | null {
  // Match optional spaces, case-insensitive dcl-s, then the variable name (identifier)
  const match = line.match(/^\s*dcl-s\s+([A-Z0-9_#$@]+)\b/i);
  return match ? match[1] : null;
}

export function isVarDcl(name: string): boolean {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return false;

  const doc = editor.document;
  const fromLine = editor.selection.active.line;

  for (let i = fromLine - 1; i >= 0; i--) {
    const line = doc.lineAt(i).text;
    if (
      line.match(new RegExp(`\\b${name}\\b`, 'i')) &&
      /^\s*dcl-s/i.test(line)
    ) {
      return true;
    }
  }

  return false;
}