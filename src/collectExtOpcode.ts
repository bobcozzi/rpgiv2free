
import * as rpgiv from './rpgedit';
import { collectedStmt, stmtLines } from './types'



type CollectResult = {
  extF2: string;
  indexes: number[];
  comments: string[];
  namedOpcode: string;
};

export function collectExtOpcode(allLines: string[],
  startIndex: number,
  condIndyStmt: string): {
    lines: string[],
    indexes: number[],
    comments: string[]
  } {
  const lines: string[] = [];
  const indexes: number[] = [];
  const comments: string[] = [];
  const eol = rpgiv.getEOL();


  // Walk BACKWARD to find the starting line of the statement
  let firstIndex = startIndex;
  for (let i = firstIndex; i >= 0; i--) {
    const line = allLines[i];

    if (rpgiv.isDirective(line)) break;  // Done
    if (rpgiv.isEmptyStmt(line)) continue; // Skip it
    if (rpgiv.isComment(line)) continue;  // Skip it

    if (rpgiv.getSpecType(line) !== 'c') {
      firstIndex = i;
      break;
    }
    const factor2 = rpgiv.getCol(line, 36, 80).trimEnd();
    const opArea = rpgiv.getCol(line, 8, 35).trim();
    const opCode = rpgiv.getRawOpcode(line);
    if (opArea === '') continue;

    if (rpgiv.isExtOpcode(opCode)) {
      firstIndex = i;
      // We found the starting point of the Extended Factor 2 Opcode
      break;
    }
    else {
      lines.push(`// Unknown opcode ${opCode} detected.`);
      break;
    }
  }

  // Walk FORWARD to collect the full statement
  const {
    extF2,
    indexes: usedIndexes,
    comments: collectedComments,
    namedOpcode
  } = collectExtF2(allLines, firstIndex);

  if (namedOpcode) {
    const match = extF2.match(/^[A-Z0-9-]+/i);
    const firstToken = match ? match[0].toUpperCase() : null;
    const { rawOpcode, extenders: ext } = rpgiv.splitOpCodeExt(namedOpcode);
    const isEvalOrCallP = (rawOpcode && ['eval', 'callp'].includes(rawOpcode.toLowerCase()));
    const keepOpcode = (
      (firstToken && isEvalOrCallP &&
        (rpgiv.isValidOpcode(firstToken) || rpgiv.isExtOpcode(firstToken)))
      || (ext && ext.trim() !== '')
    ) ? true : false;
    if (!isEvalOrCallP || (isEvalOrCallP && keepOpcode)) {
      lines.push(`${namedOpcode}`);
      lines.push(`${extF2}`)
    }
    else {
      lines.push(`${extF2}`)
    }
  }
  if (condIndyStmt && condIndyStmt.trim() !== '') {
    const condIndyStmtStripped = condIndyStmt.replace(/^\w+\s+/, '');
    if (condIndyStmtStripped) {
      lines.splice(1, 0, `(${condIndyStmtStripped}) and (`);
    }
  }
  if (condIndyStmt && condIndyStmt.trim() !== '') {
    lines.push(`)`)
  }
  const combinedLine = lines.join(' ');
  return {
    lines: [combinedLine],
    indexes: usedIndexes,
    comments: collectedComments
  };
}


export function collectExtF2(
  allLines: string[],
  firstIndex: number
): CollectResult {
  let extF2 = '';
  const indexes: number[] = [];
  const comments: string[] = [];
  let namedOpcode = '';
  let inQuote = false;
  let wasQuoted = false;

  for (let i = firstIndex; i < allLines.length; i++) {
    const line = allLines[i];
    if (rpgiv.isDirective(line)) break;  // Done
    if (rpgiv.isEmptyStmt(line)) continue; // Skip it
    if (rpgiv.isComment(line)) {
      comments.push(line);
      indexes.push(i); // Include comment line index!
      continue;
    }
    if (rpgiv.getSpecType(line) !== 'c') break;

    let opCode = rpgiv.getFullOpcode(line);
    const opArea = rpgiv.getCol(line, 8, 35).trim();
    const factor2 = rpgiv.getCol(line, 36, 80).trimEnd();

    if (opArea !== '' && opCode !== '') {
      if (namedOpcode) break; // Already collecting; new opcode, stop
      namedOpcode = opCode;
    }

    let buffer = '';
    for (let j = 0; j < factor2.length; j++) {
      const ch = factor2[j];
      if (ch === "'") {
        if (j < factor2.length && factor2[j + 1] !== "'") {
          inQuote = !inQuote;
        }
      }
      buffer += ch;
    }

    const endsWith = extF2.trimEnd().slice(-1);
    const endsWithDots = extF2.trimEnd().endsWith('...');
    if ((endsWithDots && !wasQuoted) || ((endsWith === '+' || endsWith === '-') && wasQuoted)) {
      if (endsWithDots) {
        extF2 = extF2.slice(0, -3).trimEnd();
        extF2 += buffer.trimStart();
      }
      else {
        extF2 = extF2.replace(/[+-]$/, '');
        if (endsWith === '-') {
          extF2 += buffer;
        }
        else {
          extF2 += buffer.trim();
        }
      }
    }
    else {
      if (endsWith && extF2) {
        extF2 += ' ' + buffer.trim();
      }
      else {
        extF2 += buffer.trim();
      }
    }
    wasQuoted = inQuote;

    indexes.push(i);
  }

  return { extF2, indexes, comments, namedOpcode };
}