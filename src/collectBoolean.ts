
import * as rpgiv from './rpgedit';
import { stmtLines } from './types';

export function collectBooleanOpcode(allLines: string[], startIndex: number, condIndyStmt: string): stmtLines {
  const lines: string[] = [];
  const indexes: number[] = [];
  const comments: string[] = [];
  const eol = rpgiv.getEOL();

  const indent = ' '.repeat(12);
  const condStmt = (!condIndyStmt || condIndyStmt.trim() === '') ? '' : condIndyStmt;
  const opMap: { [key: string]: string } = {
    EQ: '=', NE: '<>', GT: '>', LT: '<', GE: '>=', LE: '<='
  };

  // Backtrack to find the starting boolean opcode line
  let i = startIndex;
  const firstLine = allLines[i];
  if (!rpgiv.isStartBooleanOpcode(firstLine)) {
    while (i >= 0 && !rpgiv.isStartBooleanOpcode(allLines[i])) {
      i--;
    }
    if (i < 0) return { lines: [], indexes: [], comments: null };
  }
  const startLine = allLines[i];
  indexes.push(i);

  const factor1 = rpgiv.getCol(startLine, 12, 25).trim();
  const opcode = rpgiv.getRawOpcode(startLine); // IFEQ, WHENNE, etc.
  const factor2 = rpgiv.getCol(startLine, 36, 49).trim();
  const comment = rpgiv.getCol(startLine, 81, 100).trim();
  if (comment && comment.trim() !== '') {
    comments.push(comment);
  }

  let ffOpcode = '';
  let isIf = false;
  let isWhen = false;
  let isSelect = (opcode === 'SELECT');
  let compOp = '';
  let comparison = '';
  let booleanExpr = '';

  if (!isSelect && opcode !== 'OTHER') {
    compOp = opcode.slice(-2); // Last 2 characters
    comparison = opMap[compOp] ?? '?';
  }

  if (isSelect) {
    rpgiv.log('Opcode:', opcode, 'Line:', i);
    ffOpcode = 'select';
    lines.push(ffOpcode);
  }
  else {
    if (opcode.startsWith('IF')) {
      ffOpcode = 'IF';
      isIf = true;
    } else if (opcode.startsWith('WHEN')) {
      ffOpcode = 'WHEN';
      isWhen = true;

    } else if (opcode.startsWith('DOW')) {
      ffOpcode = 'DOW';
    } else if (opcode.startsWith('DOU')) {
      ffOpcode = 'DOU';
    }
    else {
      ffOpcode = opcode;  // 'OTHER'?
    }
    lines.push(ffOpcode);
    booleanExpr = `${factor1} ${comparison} ${factor2}`;
  }

  i++;
  const nextLine = allLines[i];
  // Continue collecting ANDxx / ORxx lines
  while (i < allLines.length &&
    ((isSelect && rpgiv.isOpcodeWHENxx(allLines[i])) || rpgiv.isOpcodeANDxxORxx(allLines[i]))) {
    const line = allLines[i];

    indexes.push(i);

    const contFactor1 = rpgiv.getCol(line, 12, 25).trim();
    const contOpcode = rpgiv.getRawOpcode(line); // ANDGT, ORLE, etc.
    const contFactor2 = rpgiv.getCol(line, 36, 49).trim();
    const comment = rpgiv.getCol(line, 81, 100).trim();

    const logicOp = contOpcode.startsWith('OR') ? 'or' :
      contOpcode.startsWith('AND') ? 'and' :
        contOpcode.startsWith('WHEN') ? 'when' : '?';
    const comp = contOpcode.slice(-2); // Last 2 characters
    const compSymbol = opMap[comp] ?? '?';
    if (comment && comment.trim() !== '') {
      comments.push(comment);
    }
    booleanExpr += ` ${logicOp} ${contFactor1} ${compSymbol} ${contFactor2}`;
    i++;
  }
  if (condIndyStmt && condIndyStmt.trim() !== '') {
    const condIndyStmtStripped = condIndyStmt.replace(/^\w+\s+/, '');
    lines.push(`(${condIndyStmtStripped}) and (`)
  }
  if (booleanExpr && booleanExpr !== '') {
    lines.push(booleanExpr);
  }
  if (condIndyStmt && condIndyStmt.trim() !== '') {
    lines.push(`)`)
  }
  const combinedLine = lines.join(' ');
  // Return as an array with a single string element
  return {
    lines: [combinedLine],
    indexes,
    comments: comments.length > 0 ? comments : null
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