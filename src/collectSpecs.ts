import { collectSQLBlock } from './SQLSpec.js';
import * as ibmi from './IBMi';
import * as vscode from 'vscode';
export { }; // forces module scope

export interface collectSpecs {
  entityName: string | null;  // Can be null for SQL blocks
  lines: string[];
  indexes: number[];
  isSQL: boolean | false;
}

// Add your actual regex patterns here
const EXEC_SQL_RX = /^.{5}[cC]?[\/]{1}EXEC\s+SQL/i;
const SQL_CONT_RX = /^.{5}[cC]?\+/;
const END_EXEC_RX = /^.{5}[cC]?[\/]{1}END-EXEC/i;

export function collectStmt(
  allLines: string[],
  startIndex: number
): collectSpecs | null {

  const isLineEmpty = (line: string) => line.trim().length === 0;

  const startLine = allLines[startIndex].padEnd(80, ' ');

  // Check if the line is part of an embedded SQL block
  const isSQLStart = EXEC_SQL_RX.test(startLine);
  const isSQLCont = SQL_CONT_RX.test(startLine);
  const isSQLEnd = END_EXEC_RX.test(startLine);
  if (isSQLStart || isSQLCont || isSQLEnd) {
    // Handle SQL block separately and return its result
    const sqlBlockResult = collectSQLBlock(allLines, startIndex);

    // Ensure the SQL result conforms to the CollectedSpec type
    return {
      entityName: null,  // No entity name for SQL blocks
      lines: sqlBlockResult.lines,
      indexes: sqlBlockResult.indexes,
      isSQL: true,
    };
  }

  const curSpec = ibmi.getSpecType(startLine);
  if (!curSpec || isLineEmpty(startLine)) return null;

  // Special case: Unnamed Data Structure

// Step 1: Walk backward to find the start of the declaration
let start = startIndex;
while (start > 0) {
  const curLine = allLines[start].padEnd(80, ' ');
  const prevLine = allLines[start - 1].padEnd(80, ' ');
  if (ibmi.getSpecType(prevLine) !== curSpec) break;
  const curDclType = ibmi.getDclType(curLine);
  const trimmedLine = ibmi.getCol(prevLine, 7, 80).trimEnd();
  const curTrimmed = ibmi.getCol(prevLine, 7, 80).trimEnd();
  const endsWithDots = trimmedLine.endsWith('...');
  const curEndsWithDots = curTrimmed.endsWith('...');
  const prevHasName = ibmi.getCol(prevLine, 7, 21).trim().length > 0;
  const curHasName = ibmi.getCol(curLine, 7, 21).trim().length > 0;

  // Bob, also need the very fringe case of a long name ending on prior line
  //  D  thisIsALongNameThatIsNotContinued
  //  D                SDS
  if (!curEndsWithDots && curDclType === 'DS' && curSpec === 'd') {
    // Special case: Unnamed Data Structure (DS) with attributes
    // Stop here if the current line is a DS and has no name
      break;
  }

  // If this is a long-name continuation line, keep going
  if (prevHasName && endsWithDots) {
    start--; // Keep walking back
    continue;
  }

  // If it's just a continuation (no name), keep going
  if (curHasName && !endsWithDots) {
    break;
  }
  if (!prevHasName) {
    start--;
    continue;
  }
  start--;
  // If it's a line with a name but no '...', stop here — it's a new declaration
  break;
}

  // Step 2: Walk forward to collect name fragments and attributes
  let entityNameParts: string[] = [];
  let finalNameLineFound = false;
  let index = start;
  let collectedIndexes: number[] = [];
  let collectedLines: string[] = [];

  while (index < allLines.length) {
    const line = allLines[index].padEnd(80, ' ');
    if (ibmi.getSpecType(line) !== curSpec) break;

      const namePartTrimmed = ibmi.getCol(line, 7, 21).trim();

    const attr22to43 = ibmi.getCol(line, 22, 43).trimEnd();
    const endsWithDots = ibmi.getCol(line, 7, 80).trimEnd().endsWith('...');
    let fullName = '';
    if (endsWithDots) {
        fullName = ibmi.getCol(line, 7, 80).trimEnd().slice(0, -3).trimEnd();
    } else {
        fullName = ibmi.getCol(line, 7, 21).trimEnd();
    }

    // Build the entity name from name parts
    if (!finalNameLineFound) {
      entityNameParts.push(fullName);
      if (!endsWithDots) {
        finalNameLineFound = true;
      }
    }
    collectedIndexes.push(index);

    // ✅ Only collect lines after the full name is known, or in edge cases
    if (finalNameLineFound || (curSpec === 'd' && namePartTrimmed === '' && attr22to43 !== '')) {
      collectedIndexes.push(index);
      collectedLines.push(line);
    }

    // Check if the next line begins a new declaration
    const nextLine = allLines[index + 1]?.padEnd(80, ' ');
    if (finalNameLineFound && nextLine && isStartOfNewEntity(nextLine, curSpec)) {
      break;
    }

    index++;
  }

  // Ensure that entityName is always returned, even if it's an empty string
  const entityName = entityNameParts.join('').trim() || null;

  return {
    entityName,
    lines: collectedLines,
      indexes: collectedIndexes,
    isSQL: false, // Ensure `isSQL` is false for non-SQL blocks
  };
}

function isStartOfNewEntity(line: string, curSpec: string): boolean {
    if (ibmi.getSpecType(line) !== curSpec) return true;

    const name = ibmi.getCol(line, 7, 21).trim();
    const attr22to43 = ibmi.getCol(line, 22, 43).trimEnd();
    const hasDots = ibmi.getCol(line, 7, 80).trimEnd().endsWith('...');

    // A line is a new entity if:
    // - It has a name and is not a continuation
    // - OR it's an unnamed D-spec (e.g., DS, SDS) with attributes
    return (!hasDots && name !== '') || (curSpec === 'd' && name === '' && attr22to43 !== '');
  }