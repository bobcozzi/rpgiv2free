
import * as ibmi from './IBMi';

import * as vscode from 'vscode';

export function collectBooleanOpcode(allLines: string[], startIndex: number): { lines: string[], indexes: number[] } {
  const lines: string[] = [];
  const indexes: number[] = [];

  const opMap: { [key: string]: string } = {
    EQ: '=', NE: '<>', GT: '>', LT: '<', GE: '>=', LE: '<='
  };

  // Backtrack to find the starting boolean opcode line
  let i = startIndex;
  while (i >= 0 && !ibmi.isStartBooleanOpcode(allLines[i])) {
    i--;
  }
  if (i < 0) return { lines: [], indexes: [] };

  const startLine = allLines[i];
  indexes.push(i);

  const factor1 = ibmi.getCol(startLine, 12, 25).trim();
  const opcode = ibmi.getOpcode(startLine); // IFEQ, WHENNE, etc.
  const factor2 = ibmi.getCol(startLine, 36, 49).trim();

  const compOp = opcode.slice(-2); // Last 2 characters
  const comparison = opMap[compOp] ?? '?';

  let ffOpcode = '';
  let isIf = false;
  let isWhen = false;

  if (opcode.startsWith('IF')) {
    ffOpcode = 'IF';
    isIf = true;
  } else if (opcode.startsWith('WHEN')) {
    ffOpcode = 'WHEN';
    isWhen = true;
  }

  let booleanExpr = `${ffOpcode} ${factor1} ${comparison} ${factor2}`;
  i++;

  // Continue collecting ANDxx / ORxx lines
  while (i < allLines.length && ibmi.isOpcodeANDxxORxx(allLines[i])) {
    const line = allLines[i];
    indexes.push(i);

    const contFactor1 = ibmi.getCol(line, 12, 25).trim();
    const contOpcode = ibmi.getColUpper(line, 26, 35).trim(); // ANDGT, ORLE, etc.
    const contFactor2 = ibmi.getCol(line, 36, 49).trim();

    const logicOp = contOpcode.startsWith('OR') ? 'or' :
      contOpcode.startsWith('AND') ? 'and' : '?';
    const comp = contOpcode.slice(-2); // Last 2 characters
    const compSymbol = opMap[comp] ?? '?';

    booleanExpr += ` ${logicOp} ${contFactor1} ${compSymbol} ${contFactor2}`;
    i++;
  }

  booleanExpr += ';';
  lines.push(booleanExpr);

  return { lines, indexes };
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