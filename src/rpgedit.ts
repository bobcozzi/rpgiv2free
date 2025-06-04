
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
  rightMargin: number;
  srcRcdLen: number;
  indentDir: number;
  altMOVEL: boolean;
  indyMOVEAStyle: string;
  addEXTDEVFLAG: boolean;
  removeFREEdir: boolean;
  removeOLDdir: boolean;
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
    indentDir: config.get<number>('indentDirectives', 8),
    rightMargin: config.get<number>('maxFreeFormatLineLength', 76),
    srcRcdLen: config.get<number>('maxRPGSourceLength', 80),
    altMOVEL: config.get<boolean>('ALTMOVEL', true),
    indyMOVEAStyle: config.get<string>('indyMOVEAStyle', "LIST"),
    addEXTDEVFLAG: config.get<boolean>('AddEXTDeviceFlag', true),
    removeFREEdir: config.get<boolean>('RemoveFREEDirective', true),
    removeOLDdir: config.get<boolean>('RemoveOLDDirectives', true),
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
  return text.split(getEOL());
}

// Log function with condition for Debug
export function log(...args: any[]) {
  console.log('[rpgiv2free]', ...args);
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

// Return the RPG IV Fixed Format Specification Code (H F D I C O P) in lowercase
// or blank/empty when it is not one of those or when position 7 is * or /
export function getSpecType(line: string): string {
  if (line.length < 6) return '';
  const col7 = line[6];
  if (col7 === '*' || col7 === '/') return '';
  return line[5].toLowerCase();
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


export function getDclVarName(line: string): string | null {
  // Match optional spaces, case-insensitive dcl-s, then the variable name (identifier)
  const match = line.match(/^\s*dcl-s\s+([A-Z0-9_#$@]+)\b/i);
  return match ? match[1] : null;
}

/**
 * Determines if a variable with the given name is declared using the `dcl-s` statement
 * in the currently active text editor in VS Code.
 *
 * The function searches upwards from the current cursor line to find a line that both:
 * - Contains the variable name as a whole word (case-insensitive).
 * - Starts with the `dcl-s` declaration (ignoring leading whitespace, case-insensitive).
 *
 * @param name - The name of the variable to search for.
 * @returns `true` if a matching declaration is found above the current line; otherwise, `false`.
 */
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

export const rpgDataTypes = [
  'char', 'varchar', 'packed', 'zoned', 'int', 'uns', 'float', 'real',
  'date', 'time', 'timestamp', 'ind', 'like', 'likeds', 'likerec', 'pointer', 'const'
];

function isRPGFreeSubfield(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || isComment(line)) return false;

  // Tokenize the line
  const tokens = trimmed.split(/\s+/);
  if (tokens.length === 0) return false;

  // Check each token for a datatype keyword as a whole word,
  // or immediately followed by '(' or ';'
  for (let i = 0; i < tokens.length; i++) {
    for (const type of rpgDataTypes) {
      const regex = new RegExp(`^${type}(\\(|;|$)`, 'i');
      if (regex.test(tokens[i])) {
        // If the type is not the first token, ensure the first token is not an opcode
        if (i === 0 || !isValidOpcode(tokens[0].toUpperCase())) {
          return true;
        }
      }
    }
  }
  return false;
}

export function isDirective(line: string, bFreeFormOnly?: boolean): boolean {
  // Classic RPG directive: column 7 is '/' and column 8 is not '/'
  const bDirective = (
    line.length > 7 &&
    line[6] === '/' &&
    line[7] !== '/'
  );
  if (bFreeFormOnly !== true) {
    if (bDirective) return true;
  }

  // Free-form or modern: line starts with '/' followed by A-Za-z0-9 and nothing or whitespace
  const trimmed = getCol(line, 7, 80).trim().toUpperCase();
  if (!trimmed.startsWith('//') &&
    trimmed.startsWith('/') &&
    trimmed.length > 1 &&
    /^[A-Za-z0-9]/.test(trimmed[1])
  ) {
    // Accept if only /X or /X... or /X[whitespace...]
    if (trimmed.length === 2 || /\s/.test(trimmed[2])) {
      return true;
    }
    // Accept if /COPY, /INCLUDE, etc.
    if (/^\/[A-Za-z0-9]+(\s|$)/.test(trimmed)) {
      return true;
    }
  }

  return false;
}

export function isValidFixedFormat(line: string): boolean {
  const specType = getSpecType(line).trim();
  // isNotSkipStmt checks for things like comments and directives and empty lines
  return (isNotSkipStmt(line) && ['h', 'f', 'd', 'c', 'p', 'i', 'o'].includes(specType));
}

// for non-executable source lines, like comments, blanks line, or compiler directives
export function isSkipStmt(line: string): boolean {
  const bComment = isComment(line);  // Assumes isComment() handles RPG IV logic
  const bEmptyStmt = isEmptyStmt(line);
  const bDirective = isDirective(line);
  return bComment || bDirective || bEmptyStmt;
}
// for non-executable source lines, like comments, blanks line, or compiler directives
export function isSkipNonComment(line: string): boolean {
  const bEmptyStmt = isEmptyStmt(line);
  const bDirective = isDirective(line);
  return bDirective || bEmptyStmt;
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

  // Find all insertion positions and prepare insertions
  const insertData: { position: vscode.Position; text: string }[] = [];
  let insertAfterLine = 0;
  for (const { currentLineIndex, extraDCL } of inserts) {
    if (extraDCL.length === 0) continue;

    insertAfterLine = 0;
    const firstDCL = extraDCL[0].trim().toLowerCase();

    if (firstDCL.startsWith('end-')) {
      // Find rough insert point by scanning forward
      insertAfterLine = findLocationForEndStmt(currentLineIndex, allLines);

      // Walk backwards to find last non-blank, non-comment line
      while (insertAfterLine > 0) {
        const candidate = allLines[insertAfterLine].trim();
        if (candidate === '' || isComment(candidate)) {
          insertAfterLine--;
        } else {
          break;
        }
      }
    } else {
      for (let i = currentLineIndex; i >= 0; i--) {
        const line = allLines[i];
        if (typeof line !== 'string' || !line.trim()) continue;
        if (isSkipStmt(line)) continue;

        const specType = line.length > 5 ? line[5].toLowerCase?.() || '' : '';
        const legacyD = line.length > 5 && (["d", "p", "f", "h"].includes(specType));
        const freeDCL = getColUpper(line, 8, 25).toUpperCase().trimStart();
        const fullyFreeDCL = getColUpper(line, 1, 80).toUpperCase().trimStart();
        const isDCL =
          freeDCL.startsWith('DCL-') ||
          freeDCL.startsWith('END-') ||
          fullyFreeDCL.startsWith('DCL-') ||
          fullyFreeDCL.startsWith('END-') ||
          freeDCL.startsWith('CTL-') || fullyFreeDCL.startsWith('CTL-');

        if (legacyD || isDCL || isRPGFreeSubfield(line)) {
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
    // Sort by position.line descending so inserts don't shift subsequent positions
    uniqueData
      .sort((a, b) => b.position.line - a.position.line)
      .forEach(({ position, text }) => {
        editBuilder.insert(position, text);
      });
  });
}

function findLocationForEndStmt(startIndex: number, allLines: string[]): number {
  let insertPoint = startIndex;
  for (let i = startIndex + 1; i < allLines.length; i++) {
    const line = allLines[i].toUpperCase();

    if (!line || line.trim() === '') continue;
    if (isComment(line)) continue;
    if (isDirective(line)) break;


    // Check for END-xxx (xxx must be alpha only, case-insensitive)
    const endMatch = line.trimStart().toUpperCase().match(/^END-([A-Z]+)/);
    if (endMatch) {
      break;
    }

    // Check for DCL-xxx (not SUBF or PARM)
    const dclMatch = line.trimStart().toUpperCase().match(/^DCL-([A-Z]+)/);
    if (dclMatch) {
      const dclType = dclMatch[1];
      // continuing if it isn't dcl-parm or dcl-subf
      if (dclType !== 'SUBF' && dclType !== 'PARM') {
        break;
      }
    }
    const bFixedFormat = isValidFixedFormat(line);
    const specType = line[5]?.toLowerCase?.() || '';
    if (bFixedFormat && specType !== 'd') {
      break;  // If fixed-format but not a D spec, we're done
    }


    const trimmed = line.trim();
    if (trimmed && !bFixedFormat) {
      const tokens = trimmed.split(/\s+|\(/);
      const firstToken = tokens[0].toUpperCase();

      // is a free format opcode?
      if (isValidOpcode(firstToken)) {
        break;
      }
      // Procedure call: myFoo('Hello') or myFoo ('Hello')
      if (/^[A-Z0-9_#$@]+\s*\(/i.test(trimmed)) {
        break;
      }
      // RPG built-in function: %SUBST(...)
      if (/^%[A-Z0-9_]+\s*\(/i.test(trimmed)) {
        break;
      }
      insertPoint = i;
      continue;
    }

    // By now we should be in only fixed format arena
    const bValidDefn = isValidFixedDefnLine(line);


    if (!bValidDefn) {
      break;
    }
    else {
      const dclType = getColUpper(line, 24, 25).trim();  // Get column 24-25 DCL Type
      if (dclType?.trim() && ["DS", "S", "C", "PI", "PR"].includes(dclType)) {
        // stop here and return this line number.
        break;
      }
    }

    insertPoint = i;

  }

  return insertPoint;
}

export function isBitLiteral(factor2: string): boolean {
  return /^'[0-7]{1,8}'$/.test(factor2);
}

/**
 * Checks if the input string contains a valid RPG IV Date format *xxxS.
 * Allows for optional trailing characters (e.g., *ISO0, *YMD-, *MDY/).
 */
export function isValidDateFmt(input: string): boolean {
  const dateFmtPrefixes = [
    '*ISO', '*USA', '*EUR', '*JIS', '*MDY', '*DMY', '*YMD', '*JUL', '*LONGJUL',
    '*CYMD', '*CDMY', '*CMDY', '*JOB', '*JOBRUN', '*SYS', '*SYSVAL'
  ];
  const upperInput = input.toUpperCase();
  return dateFmtPrefixes.some(fmt =>
    upperInput.split(/[\s,;()]+/).some(token =>
      dateFmtPrefixes.some(prefix =>
        token.startsWith(prefix)
      )
    )
  );
}

/**
 * Splits the input string on the first colon (:) not inside single quotes.
 * Returns an array: [factorValue, factorArg]. If no such colon, returns [input, ''].
 */
export function splitFactor(input: string): [factorValue: string, factorArg: string] {
  let inQuotes = false;
  let splitIdx = -1;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === "'") inQuotes = !inQuotes;
    if (ch === ':' && !inQuotes) {
      splitIdx = i;
      break;
    }
  }
  if (splitIdx !== -1) {
    const factorValue = input.slice(0, splitIdx).trim();
    const factorArg = input.slice(splitIdx + 1).trim();
    return [factorValue, factorArg];
  }
  return [input.trim(), ''];
}

export function isExtFactor2(line: string): boolean {
  if (typeof line !== 'string' || !line) return false;

  // Defensive: Ensure line is long enough for specType and column access
  if (line.length < 7) return false;

  const specType = getSpecType(line);
  if (specType !== 'c') return false;
  if (isSkipStmt(line)) return false;

  // Defensive: getCol will pad as needed, but ensure line is string
  const factor1 = getCol(line, 12, 25)?.trim?.() ?? '';
  const opcode = getRawOpcode(line) ?? '';
  const extFactor2 = getCol(line, 36, 80)?.trim?.() ?? '';

  if ((!factor1 || factor1.trim() === '') && extFactor2 && extFactor2 !== '') {
    if (isExtOpcode(opcode) || !opcode || opcode === '') {
      return true;
    }
  }
  return false;
}

export function isFreeFormCalcStmt(line: string): boolean {
  const trimmedLine = line.trim();

  // If the line is empty, return false
  if (isSkipStmt(trimmedLine)) return false;

  // Split the line into tokens by space or (
  const tokens = trimmedLine.split(/\s+|\(/);
  const firstToken = tokens[0].toUpperCase().replace(/[^A-Z0-9]/g, '');

  // Check if the first token is a valid opcode or %SUBST() built-in function (l-value)
  if (isValidOpcode(firstToken) || firstToken.startsWith('%SUB')) {
    return true;
  }

  // Check for assignment operators (=, +=, -=, *=, /=)
  const assignmentMatch = trimmedLine.match(/(\+?=|\-?=|\*?=|\/?=)/);
  if (assignmentMatch) {
    // Check if the left-hand side is a valid variable or built-in function
    // (You may want to enhance this logic for your needs)
    return true;
  }

  // Check for a function/procedure call
  const openParenIndex = trimmedLine.indexOf('(');
  if (openParenIndex !== -1) {
    if (isValidOpcode(firstToken)) return true; // Procedure call
  }

  return false;
}


// Extracts the opcode from a C-spec line
/**
 * Extracts the opcode from a C-spec line (columns 26-35, inclusive).
 * Returns '' if not a C-spec or is a comment.
 */
export function splitOpCodeExt(opcode: string): { rawOpcode: string, extenders: string } {
  // This function splits an opcode string into its base opcode and extenders.
  // Example: "MOVEL(P)" => { rawOpcode: "MOVEL", extenders: "P" }
  //          "EVAL-CORR(h r)" => { rawOpcode: "EVAL-CORR", extenders: "HR" } const opcodeMatch = opcode.match(/^([A-Z\-]+)(\(\s*([A-Z\s]+)\s*\))?$/i);

  const opcodeMatch = opcode.match(/^([A-Z\-]+)(\(\s*([A-Z\s]+)\s*\))?$/i);
  let rawOpcode = "";
  let extenders = "";

  if (opcodeMatch) {
    rawOpcode = opcodeMatch[1].toUpperCase();
    const existingExt = opcodeMatch[3];
    if (existingExt) {
      // Normalize: remove whitespace and convert to uppercase letters
      extenders = existingExt.replace(/\s+/g, "").toUpperCase();
    }
  } else {
    rawOpcode = opcode.toUpperCase();
  }
  return { rawOpcode, extenders };
}


export function getRawOpcode(line: string): string {
  if (!line || getSpecType(line) !== 'c' || isComment(line)) return '';
  const { rawOpcode: opcode, extenders: ext } = splitOpCodeExt(getColUpper(line, 26, 35).trim());
  return opcode;
}


export function getOpcodeExt(line: string): string {
  if (!line || getSpecType(line) !== 'c' || isComment(line)) return '';
  const { rawOpcode: opcode, extenders: ext } = splitOpCodeExt(getColUpper(line, 26, 35).trim());
  return ext;
}

export function getFullOpcode(line: string): string {
  if (!line || getSpecType(line) !== 'c' || isComment(line)) return '';
  return getColUpper(line, 26, 35).trim();
}

export function isOpcodeIFxx(line: string): boolean {
  const opcode = getRawOpcode(line);
  // Only matches IF followed by a valid boolean operator
  return /^IF(EQ|NE|GT|LT|GE|LE)$/.test(opcode);
}
export function isOpcodeDOUxx(line: string): boolean {
  const opcode = getRawOpcode(line);
  // Only matches IF followed by a valid boolean operator
  return /^DOU(EQ|NE|GT|LT|GE|LE)$/.test(opcode);
}
export function isOpcodeDOWxx(line: string): boolean {
  const opcode = getRawOpcode(line);
  // Only matches IF followed by a valid boolean operator
  return /^DOW(EQ|NE|GT|LT|GE|LE)$/.test(opcode);
}

export function isOpcodeWHENxx(line: string): boolean {
  const opcode = getRawOpcode(line);
  if (isComment(line)) return false;
  // removed  || opcode === 'OTHER' from return conditional logic
  return /^WHEN(EQ|NE|GT|LT|GE|LE)$/.test(opcode);
}

export function isOpcodeSELECT(line: string): boolean {
  return isOpcodeWHENStart(line);
}
export function isOpcodeWHENStart(line: string): boolean {
  const opcode = getRawOpcode(line);
  // Only matches WHEN followed by a valid boolean operator
  return (opcode === 'SELECT');
}
export function isCASEOpcode(line: string): boolean {
  const opcode = getRawOpcode(line);
  return /^CAS(EQ|NE|LT|LE|GT|GE)?$/.test(opcode);
}


export function isOpcodeANDxxORxx(line: string): boolean {
  const opcode = getRawOpcode(line);
  return /^(AND|OR)(EQ|NE|GT|LT|GE|LE)$/.test(opcode);
}


export function isStartBooleanOpcode(line: string): boolean {
  return (
    (isOpcodeIFxx(line) ||
      isOpcodeDOWxx(line) ||
      isOpcodeDOUxx(line) ||
      isOpcodeWHENxx(line) ||
      isOpcodeWHENStart(line))
  );
}

export function isBooleanOpcode(line: string): boolean {
  return (
    (isOpcodeIFxx(line) ||
      isOpcodeDOWxx(line) ||
      isOpcodeDOUxx(line) ||
      isOpcodeWHENxx(line) ||
      isOpcodeWHENStart(line) ||
      isOpcodeANDxxORxx(line))
  );
}

export function logOverlappingEdits(edits: { range: { start: { line: number, character: number }, end: { line: number, character: number } }, text: string }[]) {
  // Sort by start position
  const sorted = edits.slice().sort((a, b) => {
    if (a.range.start.line !== b.range.start.line) {
      return a.range.start.line - b.range.start.line;
    }
    return a.range.start.character - b.range.start.character;
  });

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];

    // If the current edit starts before the previous edit ends, they overlap
    const prevEndLine = prev.range.end.line;
    const prevEndChar = prev.range.end.character;
    const currStartLine = curr.range.start.line;
    const currStartChar = curr.range.start.character;

    const overlaps =
      (currStartLine < prevEndLine) ||
      (currStartLine === prevEndLine && currStartChar < prevEndChar);

    if (overlaps) {
      console.log('Overlapping edits detected:');
      console.log('Edit 1:', JSON.stringify(prev, null, 2));
      console.log('Edit 2:', JSON.stringify(curr, null, 2));
    }
  }
}
/**
 * Checks if "this" line is the End Of Program marker (e.g., '**', '**CTDATA').
 * Optimized for high-frequency calls.
 */
export function isEOP(line: string): boolean {
  if (!line) return false;
  // Fast path: check first two chars
  if (line.length < 2 || line[0] !== '*' || line[1] !== '*') return false;

  // Skip leading '**'
  let i = 2;
  const len = line.trimEnd().toLowerCase().length;

  if (len === i) return true;
  if (len < 6) return false;

  // Check for 'ctdata' (case-insensitive), possibly followed by whitespace and optional '('
  // Compare char-by-char for speed
  const ctd = 'ctdata';
  let j = 0;

  while (i < len && j < 6 && (line[i] === ctd[j])) {
    i++; j++;
  }
  if (j === 6) {
    // Skip whitespace after 'ctdata'
    while (i < len && (line[i] === ' ' || line[i] === '\t')) i++;
    // Accept if end of line or next char is '('
    if (i === len || line[i] === '(') return true;
  }

  return false;
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
  const opcode = getRawOpcode(line);
  return /^END(?:IF|DO|FOR|MON|SL|CS|SR)?$/.test(opcode);
}

export function isValidOpcode(id: string): boolean {
  // List of valid opcodes (operation extenders not included)
  const rpgOpcodes = new Set([
    "ACQ", "ADD", "ADDDUR", "ALLOC", "ANDXX", "BEGSR", "BITOFF", "BITON", "CABXX", "CALL", "CALLB", "CALLP",
    "CASXX", "CAT", "CHAIN", "CHECK", "CHECKR", "CLEAR", "CLOSE", "COMMIT", "COMP1", "DATA-GEN", "DATA-INTO",
    "DEALLOC", "DEFINE", "DELETE", "DIV", "DO", "DOU", "DOUXX", "DOW", "DOWXX", "DSPLY", "DUMP", "ELSE",
    "ELSEIF", "END", "ENDCS", "ENDDO", "ENDFOR", "ENDIF", "ENDMON", "ENDSL", "ENDSR", "EVAL", "EVALR",
    "EVAL-CORR", "EXCEPT", "EXFMT", "EXSR", "EXTRCT", "FEOD", "FOR", "FOR-EACH", "FORCE", "GOTO", "IF",
    "IFXX", "IN", "ITER", "KFLD", "KLIST", "LEAVE", "LEAVESR", "LOOKUP", "MHHZO", "MHLZO", "MLHZO", "MLLZO",
    "MONITOR", "MOVE", "MOVEA", "MOVEL", "MULT", "MVR", "NEXT", "OCCUR", "ON-ERROR", "ON-EXIT", "OPEN",
    "ORXX", "OTHER", "OUT", "PARM", "PLIST", "POST", "READ", "READC", "READE", "READP", "READPE", "REALLOC",
    "REL", "RESET", "RETURN", "ROLBK", "SCAN", "SELECT", "SETGT", "SETLL", "SETOFF", "SETON", "SHTDN",
    "SORTA", "SQRT", "SUB", "SUBDUR", "SUBST", "TAG", "TEST", "TESTB", "TESTN", "TESTZ", "TIME", "UNLOCK",
    "UPDATE", "WHEN", "WHENXX", "WRITE", "XFOOT", "XLATE", "XML-INTO", "XML-SAX", "Z-ADD", "Z-SUB"
  ]);

  // Strip off operation extenders like "(EHMR)" from the ID
  const baseOpcode = id.replace(/\([A-Z]+\)$/i, "").toUpperCase();

  return rpgOpcodes.has(baseOpcode);
}

export function isReservedWord(id: string): boolean {
  // List of valid opcodes (operation extenders not included)
  const reservedWords = new Set([
    "EXEC"
  ]);
  return reservedWords.has(id.toUpperCase());
}

export function isUnSupportedOpcode(id: string): boolean {
  // List of valid opcodes (operation extenders not included)
  const oldRPGOpcodes = new Set([
    "CALL", "CALLB", "PLIST", "PARM", "KLIST", "KFLD", "FREE", "DEBUG", "GOTO", "TAG"
  ]);
  // Strip off operation extenders like "(EHMR)" from the ID
  const baseOpcode = id.replace(/\([A-Z]+\)$/i, "").toUpperCase();

  // Check for CAB* pattern
  if (baseOpcode.startsWith("CAB")) {
    return true;
  }

  return oldRPGOpcodes.has(baseOpcode);
}
export function isSupportedMOVEA(line: string): boolean {
  const factor1 = getCol(line, 12, 25).trim();
  const opcode = getRawOpcode(line);
  const factor2 = getCol(line, 36, 49).trim();
  const result = getCol(line, 50, 63).trim();

  function isBinaryFlags(str: string): boolean {
    // Matches a single-quoted string containing only 0 and 1, at least one digit
    return /^'([01]+)'$/.test(str.trim());
  }

  /**
   * Checks if the string starts with *IN(n), where n is a number or variable name
   * Examples: *IN(82), *IN(idx)
   */
  function isIndyArray(str: string): boolean {
    // Matches *IN(n), where n is one or more digits or a variable name (letters, digits)
    // or *INxx where xx is one or more digits or variable name (letters, digits)
    // The /i flag makes *IN case-insensitive as well.
    return /^\*IN(\(\s*([a-z][a-z0-9]*|\d+)\s*\)|[a-z][a-z0-9]*|\d+)$/i.test(str.trim());
  }
  const bMOVEA = (opcode === 'MOVEA');
  const bSupportedMOVEA = (bMOVEA && ((isBinaryFlags(factor2) && isIndyArray(result)) ||
    (isBinaryFlags(result) && isIndyArray(factor2)))) ? true : false;

  if (bMOVEA && bSupportedMOVEA) {
    return true;
  }
  return false;
}

// Is an OpCode that supports the Extended Factor 2 syntax?
export function isExtOpcode(opcode: string): boolean {
  const extOpcodes = new Set([
    "CALLP",
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
    "SORTA",
    "XML-INTO",
    "XML-SAX"
  ]);
  const normalized = opcode.toUpperCase().trim().replace(/\(.*\)$/, ""); // strip off Operation Extender (if any)
  // if (!isValidOpcode(normalized)) {
  //   log('Invalid Opcode:', opcode);
  // }
  return extOpcodes.has(normalized);
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

export function splitArray(factor2: string): [string, string | null] {
  const trimmed = factor2.trim();
  const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)(?:\(\s*([^)]+)\s*\))?$/);
  if (match) {
    const arrayName = match[1];
    const index = match[2] !== undefined ? match[2] : null;
    return [arrayName, index];
  }
  return [trimmed, null];
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
  const col6 = getSpecType(curLine);
  if (col6 !== 'd') return false;
  const dclType = getDclType(curLine).toLowerCase();
  const bLongName = getCol(curLine, 7, 80).trimEnd().endsWith('...');
  const hasName = getCol(curLine, 7, 21).trim().length > 0;
  const isExtSubfield = (getCol(curLine, 22).toUpperCase() === 'E');
  const hasKwds = getCol(curLine, 44, 80).trim().length > 0;
  const hasType = getCol(curLine, 23, 25).trim().length > 0;
  const hasAttr = getCol(curLine, 26, 43).trim().length > 0;

  if ((["ds", "pr", "pi", "s", "c"].includes(dclType)) ||
    isExtSubfield || (!bLongName && ((hasName || hasType) && (hasAttr || hasKwds)))) {
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

export function bitStringToHex(bitString: string): string {
  let mask = 0;
  for (const c of bitString) {
    const bitNum = parseInt(c, 10);
    if (bitNum < 0 || bitNum > 7) continue; // skip invalid
    mask |= 1 << (7 - bitNum); // RPG bit 0 = leftmost (bit 7 in a byte)
  }
  let hex = mask.toString(16).padStart(2, '0').toUpperCase(); // always 2 hex digits
  return `X'${hex}'`;
}
