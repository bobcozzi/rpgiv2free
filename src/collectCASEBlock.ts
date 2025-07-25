
import * as rpgiv from './rpgedit';
import { collectedStmt, stmtLines } from './types'

export function collectCaseOpcode(
  allLines: string[],
  startIndex: number,
  condIndyStmt: string): {
    lines: string[],
    indexes: number[]
  } {
  const lines: string[] = [];
  const indexes: number[] = [];
  const comments: string[] = [];
  const eol = rpgiv.getEOL();
  const condStmt = (!condIndyStmt || condIndyStmt.trim() === '') ? '' : `(${condIndyStmt}) and `;

  const opMap: { [key: string]: string } = {
    EQ: '=', NE: '<>', GT: '>', LT: '<', GE: '>=', LE: '<='
  };
  const indent = ' '.repeat(12);
  const comparisons: string[] = [];
  let i = startIndex;

  // Track the main condition variable (from the first line)
  let selector: string | null = null;
  let elseLineIndex: number | null = null;

  while (i < allLines.length) {
    const line = allLines[i];
    if (rpgiv.isComment(line)) {
      comments.push(line);
      indexes.push(i);
      i++;
      continue;
    }
    else if (rpgiv.isSkipStmt(line)) {
      i++;
      continue;
    }
    if (rpgiv.getSpecType(line) !== 'c') break;

    const opCode = rpgiv.getFullOpcode(line);
    const f1 = rpgiv.getCol(line, 12, 25).trim();
    const f2 = rpgiv.getCol(line, 36, 49).trim();
    const result = rpgiv.getCol(line, 50, 63).trim();
    let condPrefix = '';

    if (opCode.startsWith('END')) {
      indexes.push(i);
      break;
    }
    if (/^CAS(EQ|NE|LT|LE|GT|GE)$/.test(opCode)) {
      indexes.push(i);

      const compOp = opCode.slice(-2);
      const compSymbol = opMap[compOp] ?? '?';

      if (!selector) { selector = f1 };

      if (comparisons.length === 0) {
        comparisons.push(`IF ${condStmt}(${selector} ${compSymbol} ${f2});`);
      }
      else {
        comparisons.push(`elseIf ${condStmt}(${selector} ${compSymbol} ${f2})`);
      }
      comparisons.push(`${indent}exsr ${result}`);
    }
    else if (opCode === 'CAS') {  // PURE "CAS" is the "other/otherwise" clause for CASxx
      // This is the ELSE part
      indexes.push(i);
      elseLineIndex = i;
    }

    i++;
  }

  if (elseLineIndex !== null) {
    const elseResult = rpgiv.getCol(allLines[elseLineIndex], 50, 63).trim();
    if (condStmt && condStmt.trim() !== '') {
      comparisons.push(`elseIf ${condStmt}`);
    }
    else {
      comparisons.push(`ELSE`);
    }
    comparisons.push(`${indent}exsr ${elseResult}`);
  }

  comparisons.push('endif');
  lines.push(...comparisons);

  const result: stmtLines = {
    lines,
    indexes,
    comments: null
  };

  return result;

}
