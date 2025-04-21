
import { collectSQLBlock } from './SQLSpec.js';
import * as ibmi from './IBMi';


// Global regex constants for identifying embedded SQL
const EXEC_SQL_RX = /^[\s\S]{5}[ cC]\/EXEC\s+SQL/i;
const END_EXEC_RX = /^[\s\S]{5}[ cC]\/END-EXEC/i;
const SQL_CONT_RX = /^[\s\S]{5}[ cC]\+/;

export function collectFullSpecWithIndexes(allLines: string[], startIndex: number): {
  lines: string[];
  indexes: number[];
  isSQL: boolean;
} {
  const totalLines = allLines.length;
  if (startIndex < 0 || startIndex >= totalLines) {
    return { lines: [], indexes: [], isSQL: false };
  }

  const startLine = allLines[startIndex].padEnd(80, ' ');

  // SQL block detection
  const isSQLStart = EXEC_SQL_RX.test(startLine);
  const isSQLCont  = SQL_CONT_RX.test(startLine);
  const isSQLEnd   = END_EXEC_RX.test(startLine);
  if (isSQLStart || isSQLCont || isSQLEnd) {
    return collectSQLBlock(allLines, startIndex);
  }

  const resultLines: string[] = [];
  const resultIndexes: number[] = [];

  // === Step 1: Walk backward to top of block ===
  let topIndex = startIndex;
  while (topIndex > 0) {
    const prevLine = allLines[topIndex - 1].padEnd(80, ' ');
    const thisLine = allLines[topIndex].padEnd(80, ' ');

    const continuation = lineContinuesFromPrevious(prevLine, thisLine);
    if (continuation === true || continuation === '//') {
      topIndex--;
    } else {
      break;
    }
  }

  // === Step 2: Walk forward, collect lines ===
  let index = topIndex;
  const baseLine = allLines[index].padEnd(80, ' ');
  const specType = baseLine.charAt(5).toLowerCase();
  let wasLongName = false;
  let inLongNameMode = false;

  while (index < totalLines) {
    const currentLine = allLines[index].padEnd(80, ' ');
    resultLines.push(currentLine);
    resultIndexes.push(index);

    // Detect if we're entering or exiting long-name mode
    const nameChunk = currentLine.substring(6, 80).trimEnd();
    const col7to20 = ibmi.getCol(currentLine, 7, 20).trim();

    if (nameChunk.endsWith('...')) {
      inLongNameMode = true;
      wasLongName = true;
    } else if (inLongNameMode && col7to20.length > 0) {
      // Found the "final name part" that *isn't* blank, end name mode
      inLongNameMode = false;
    }

    const nextLine = allLines[index + 1]?.padEnd(80, ' ');
    if (!nextLine) break;

    const continuation = lineContinuesFromPrevious(currentLine, nextLine);

    // If long-name mode, and next line has blank name, treat it as continuation
    const nextName = ibmi.getCol(nextLine, 7, 20).trim();
    if (inLongNameMode && nextName === '') {
      index++;
      continue;
    }
    if (wasLongName && !inLongNameMode && nextName === '') {
      const attributes = ibmi.getCol(currentLine, 23, 43).trim();
      if (attributes.length > 0) {
        // If we were in long-name mode and the next line is blank, treat it as continuation
        index++;
        continue;
      }
    }
    if (continuation === true || continuation === '//') {
      index++;
    } else {
      break;
    }
  }

  return {
    lines: resultLines,
    indexes: resultIndexes,
    isSQL: false
  };
}

function lineContinuesFromPrevious(previousLine: string, currentLine: string): boolean | '//' {
  const prev = previousLine.padEnd(80, ' ');
  const current = currentLine.padEnd(80, ' ');

  const prevSpec = prev.charAt(5).toLowerCase();
  const curSpec = current.charAt(5).toLowerCase();

  if (prevSpec !== curSpec) return false;

  const prevCol7 = prev.charAt(6);
  const curCol7 = current.charAt(6);
  if (curCol7 === '*') return true; // Commented continuation

  // Handle long name continuation if prior line ends with '...'
  const prevNameChunk = prev.substring(6, 80).trimEnd();
  const prevHadEllipsis = prevNameChunk.endsWith('...');
  const prevAttr = ibmi.getCol(prev, 23, 43).trim();

  switch (curSpec) {
    case 'd':
    case 'p': {
      const curName = ibmi.getCol(current, 7, 43).trim();
      if (curSpec === 'd' && isStandaloneDeclaration(prev, current)) {
        return false; // not a continuation
      }

      if (prevHadEllipsis) {
        // Long name continuation:
        // - continue if current name is blank (final continuation)
        // - or if it's just the rest of the long name
        return true;
      }

      // Normal continuation logic
      return curName === '';
    }
    case 'f':
      return (ibmi.getCol(current, 7, 43).trim() === '')
    case 'h':
      return true
    case 'c':
      // C-spec: blank factor1 (12–25) opcode (cols 26–35)
      return (ibmi.getCol(current, 12, 25).trim() === '')

    default:
      return false;
  }
}

function isStandaloneDeclaration(previous: string, current: string): boolean {
  const prev = previous.padEnd(80, ' ');
  const curr = current.padEnd(80, ' ');

  const nameField = ibmi.getCol(curr, 7, 20).trim();
  const declType = ibmi.getCol(curr, 24, 25).trim().toUpperCase();
  const fromToField = ibmi.getCol(curr, 26, 35).trim();
  const keywordArea = ibmi.getCol(curr, 44, 80).trim();

  // If there's a name field, it's a new declaration.
  if (nameField !== '') return true;

  // If declType is a known declaration type, and this line is not continuing the name,
  // it likely starts a new declaration.
  const knownDeclTypes = ['S', 'DS', 'PR', 'PI', 'LIKEDS'];
  if (knownDeclTypes.includes(declType)) return true;

  // If col 44–80 has keywords AND we're not in a name continuation context:
  if (keywordArea !== '' && !prev.trimEnd().endsWith('...')) {
    return true;
  }

  // *STATUS, *PROC, etc. appear in col 26–32
  const figurativeConsts = ['*STATUS', '*PROC', '*INZSR'];
  if (figurativeConsts.includes(fromToField.toUpperCase())) {
    return true;
  }

  return false;
}

////////  Legacy Code  /////////////
// The following function is a legacy version of lineContinuesFromPrevious2.
function lineContinuesFromPrevious2(previousLine: string, currentLine: string): boolean | '//' {
  const current = currentLine.padEnd(80, ' ');
  const previous = previousLine.padEnd(80, ' ');

  const prevSpec = previous.charAt(5).toLowerCase();
  const prevCol7 = previous.charAt(6);
  const curSpec = current.charAt(5).toLowerCase();
  const curCol7 = current.charAt(6);

  // Handle RPG IV long name continuation ending in ...
  if (prevSpec === curSpec && previous.substring(6, 80).trimEnd().endsWith('...')) {
    return true;
  }

  // If spec type changes don't continue.
  if (prevSpec !== curSpec) return false;

  // Special: col 7 is comment
  if (curCol7 === '*') return true;

  switch (curSpec) {
    case 'c':
      // C-spec: blank factor1 (12–25) opcode (cols 26–35)
      return (ibmi.getCol(current, 12, 25).trim() === '')
    case 'd':
      // D-spec: name field blank (cols 6–20)
      return (ibmi.getCol(current, 7, 43).trim() === '')
    case 'f':
      return (ibmi.getCol(current, 7, 43).trim() === '')
    case 'h':
      return true
    case 'p':
      // Others: name field blank as continuation
      return (ibmi.getCol(current, 7, 43).trim() === '')

    default:
      return false;
  }
}

