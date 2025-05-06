
import * as ibmi from './IBMi';

export function collectCaseOpcode(allLines: string[], startIndex: number): { lines: string[], indexes: number[] } {
    const lines: string[] = [];
    const indexes: number[] = [];
    const eol = ibmi.getEOL();

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
      const opCode = ibmi.getColUpper(line, 26, 35).trim();
      const f1 = ibmi.getCol(line, 12, 25).trim();
      const f2 = ibmi.getCol(line, 36, 49).trim();
      const result = ibmi.getCol(line, 50, 63).trim();

      if (opCode === 'ENDCS' || opCode === 'END') {
        indexes.push(i);
      }
      if (/^CAS(EQ|NE|LT|LE|GT|GE)$/.test(opCode)) {
        indexes.push(i);

        const compOp = opCode.slice(-2);
        const compSymbol = opMap[compOp] ?? '?';

        if (!selector) { selector = f1 };

        if (comparisons.length === 0) {
          comparisons.push(`SELECT${eol}`);
        }
        comparisons.push(`WHEN (${selector} ${compSymbol} ${f2});${eol}${indent}exsr ${result};`);
      }
      else if (opCode === 'CAS') {
        // This is the ELSE part
        indexes.push(i);
        elseLineIndex = i;
      }
      else if (opCode === 'ENDSL') {

        indexes.push(i);
        break;
      }

      i++;
    }

    if (elseLineIndex !== null) {
      const elseResult = ibmi.getCol(allLines[elseLineIndex], 50, 63).trim();
      comparisons.push(`OTHER;${eol}${indent}exsr ${elseResult}`);
      // comparisons.push(``);
    }

    comparisons.push('endsl');
    lines.push(...comparisons);

    return { lines, indexes };
}
