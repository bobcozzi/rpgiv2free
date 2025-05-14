
import * as ibmi from './IBMi';

import { stmtLines } from './types';

export function collectBooleanOpcode(allLines: string[], startIndex: number): stmtLines {
  const lines: string[] = [];
  const indexes: number[] = [];
  const comments: string[] = [];
  const eol = ibmi.getEOL();

  const indent = ' '.repeat(12);

  const opMap: { [key: string]: string } = {
    EQ: '=', NE: '<>', GT: '>', LT: '<', GE: '>=', LE: '<='
  };

  // Backtrack to find the starting boolean opcode line
  let i = startIndex;
  while (i >= 0 && !ibmi.isStartBooleanOpcode(allLines[i])) {
    i--;
  }
  if (i < 0) return { lines: [], indexes: [], comments: null };

  const startLine = allLines[i];
  indexes.push(i);

  const factor1 = ibmi.getCol(startLine, 12, 25).trim();
  const opcode = ibmi.getOpcode(startLine); // IFEQ, WHENNE, etc.
  const factor2 = ibmi.getCol(startLine, 36, 49).trim();

  let ffOpcode = '';
  let isIf = false;
  let isWhen = false;
  let isSelect = (opcode === 'SELECT');
  let compOp = '';
  let comparison = '';
  let booleanExpr = '';

  if (!isSelect) {
    compOp = opcode.slice(-2); // Last 2 characters
    comparison = opMap[compOp] ?? '?';
  }

  if (isSelect) {
    ffOpcode = 'select;' + ibmi.getEOL();
    booleanExpr = ffOpcode;
  }
  else {
    if (opcode.startsWith('IF')) {
      ffOpcode = 'IF';
      isIf = true;
    } else if (opcode.startsWith('WHEN')) {
      ffOpcode = 'WHEN';
      isWhen = true;
    }
    booleanExpr = `${ffOpcode} ${factor1} ${comparison} ${factor2}`;
  }

  i++;

  // Continue collecting ANDxx / ORxx lines
  while (i < allLines.length && ((isSelect && ibmi.isOpcodeWHENxx(allLines[i])) || ibmi.isOpcodeANDxxORxx(allLines[i]))) {
    const line = allLines[i];
    if (ibmi.isComment(line)) {
      comments.push(line);
      indexes.push(i);
      i++;
      continue;
    }

    indexes.push(i);

    const contFactor1 = ibmi.getCol(line, 12, 25).trim();
    const contOpcode = ibmi.getOpcode(line); // ANDGT, ORLE, etc.
    const contFactor2 = ibmi.getCol(line, 36, 49).trim();

    const logicOp = contOpcode.startsWith('OR') ? 'or' :
      contOpcode.startsWith('AND') ? 'and' :
        contOpcode.startsWith('WHEN') ? 'when' : '?';
    const comp = contOpcode.slice(-2); // Last 2 characters
    const compSymbol = opMap[comp] ?? '?';

    booleanExpr += ` ${logicOp} ${contFactor1} ${compSymbol} ${contFactor2}`;
    i++;
  }

  booleanExpr += ';';
  lines.push(booleanExpr);

  return {
    lines,
    indexes,
    comments: comments.length > 0 ? comments : null
  };
}

function parseBooleanOpcodeLine(line: string): {
  factor1: string,
  opcode: string,
  operator: string,
  factor2: string
} {
  const factor1 = line.substring(6, 16).trim();
  const opcode = line.substring(16, 21).trim().toUpperCase();
  const factor2 = line.substring(21, 35).trim();

  return {
    factor1,
    opcode,
    operator: getRelationalOperator(opcode),
    factor2
  };
}

function getBooleanConnector(opcode: string): string {
  if (opcode.startsWith('OR')) return 'or';
  if (opcode.startsWith('AND')) return 'and';
  return ''; // fallback
}

function getRelationalOperator(opcode: string): string {
  const upper = opcode.toUpperCase();
  if (upper.endsWith('EQ')) return '=';
  if (upper.endsWith('NE')) return '<>';
  if (upper.endsWith('LT')) return '<';
  if (upper.endsWith('LE')) return '<=';
  if (upper.endsWith('GT')) return '>';
  if (upper.endsWith('GE')) return '>=';
  return '?'; // fallback
}