
import * as ibmi from './IBMi';
import { collectedStmt, stmtLines } from './types'



type CollectResult = {
    extF2: string;
    indexes: number[];
    comments: string[];
    namedOpcode: string;
};

export function collectExtOpcode(allLines: string[], startIndex: number): { lines: string[], indexes: number[], comments: string[] } {
    const lines: string[] = [];
    const indexes: number[] = [];
    const comments: string[] = [];
    const eol = ibmi.getEOL();


    // Walk BACKWARD to find the starting line of the statement
    let firstIndex = startIndex;
    for (let i = firstIndex; i >= 0; i--) {
        const line = allLines[i];

        if (ibmi.isComment(line)) continue;
        if (ibmi.isSpecEmpty(line)) continue;
        if (ibmi.getSpecType(line) !== 'c') {
            firstIndex = i;
            break;
        }
        const factor2 = ibmi.getCol(line, 36, 80).trimEnd();
        const opArea = ibmi.getCol(line, 8, 35).trim();
        const opCode = ibmi.getOpcode(line);
        if (opArea === '') continue;

        if (ibmi.isExtOpcode(opCode)) {
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
    const isEvalOrCallP = (namedOpcode && ['eval', 'callp'].includes(namedOpcode.toLowerCase()));
    const keepOpcode = (firstToken && isEvalOrCallP && (ibmi.isValidOpcode(firstToken) || ibmi.isExtOpcode(firstToken)));
    if (!isEvalOrCallP || (isEvalOrCallP && keepOpcode)) {
      lines.push(`${namedOpcode} ${extF2};`)
    }
    else {
      lines.push(`${extF2};`)
    }
  }
    return {
        lines,
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
    if (ibmi.isComment(line)) {
      comments.push(ibmi.convertCmt(line));
      indexes.push(i);
      continue;
    }
    if (ibmi.isSpecEmpty(line)) continue;
    if (ibmi.getSpecType(line) !== 'c') break;

    const opCode = ibmi.getOpcode(line);
    const opArea = ibmi.getCol(line, 8, 35).trim();
    const factor2 = ibmi.getCol(line, 36, 80).trimEnd();

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
    if ( (endsWithDots && !wasQuoted) || ((endsWith === '+' || endsWith === '-') && wasQuoted)) {
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