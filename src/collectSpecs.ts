import { collectSQLBlock } from './SQLSpec';
import { collectBooleanOpcode } from './collectBoolean';
import { collectHSpecs } from './collectHSpec';
import { collectCaseOpcode } from './collectCASEBlock';
import * as ibmi from './IBMi';
import * as vscode from 'vscode';


export { }; // forces module scope

export interface collectSpecs {
  entityName: string | null;  // Can be null for SQL blocks
  lines: string[];
  indexes: number[];
  comments: string[] | null; // Comments parm is optional
  isSQL: boolean | false;
  isBOOL: boolean | false;
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
  const comments: string[] = [];
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
      comments: comments.length > 0 ? comments : null,
      isSQL: true,
      isBOOL: false,
    };
  }

  const curSpec = ibmi.getSpecType(startLine);
  if (!curSpec || isLineEmpty(startLine)) return null;


if (curSpec === 'c') {
  if (ibmi.isBooleanOpcode(startLine)) {
    // Handle boolean opcode lines separately
    const booleanOpcodeResult = collectBooleanOpcode(allLines, startIndex);
    return {
      entityName: null,
      lines: booleanOpcodeResult.lines,
      indexes: booleanOpcodeResult.indexes,
      comments: comments.length > 0 ? comments : null,
      isSQL: false,
      isBOOL: true,
    };
  } else if (ibmi.isCASEOpcode(startLine)) {
    // Handle CASE/CASxx blocks
    const caseOpcodeResult = collectCaseOpcode(allLines, startIndex);
    return {
      entityName: null,
      lines: caseOpcodeResult.lines,
      indexes: caseOpcodeResult.indexes,
      comments: comments.length > 0 ? comments : null,
      isSQL: false,
      isBOOL: false,
    };
  }
}
  else if (curSpec === 'h') {
    const headerSpecs = collectHSpecs(allLines, startIndex); // Collect H specs if needed
    return {
      entityName: null,
      lines: headerSpecs.lines,
      indexes: headerSpecs.indexes,
      comments: comments.length > 0 ? comments : null,
      isSQL: false,
      isBOOL: false,
    };
  }

  // Special case: Unnamed Data Structure

// Step 1: Walk backward to find the start of the declaration
let start = startIndex;
  while (start >= 0) {
    const curLine = allLines[start].padEnd(80, ' ');
    let prevLine = '';
    if (start > 0) {
      prevLine = allLines[start - 1].padEnd(80, ' ');
    }

    if (ibmi.getSpecType(prevLine) !== curSpec) break;
    let isComment = ibmi.getCol(curLine, 7, 7).trim() === '*';
    if (!isComment) {
      isComment = ibmi.getCol(curLine, 7, 80).trimStart().startsWith('//');
    }
    if (isComment) {
      const commentText = allLines[start].substring(7, 80).trimEnd();
      comments.push(allLines[start].substring(0,6) + ' //' + commentText);
    }
    const curDclType = ibmi.getDclType(curLine);
    const trimmedLine = ibmi.getCol(prevLine, 7, 80).trimEnd();
    const curTrimmed = ibmi.getCol(prevLine, 7, 80).trimEnd();
    const endsWithDots = trimmedLine.endsWith('...');
    const curEndsWithDots = curTrimmed.endsWith('...');
    const prevHasName = ibmi.getCol(prevLine, 7, 21).trim().length > 0;
    const curOpCode = ibmi.getCol(curLine, 25, 35).trim();
    const prevOpCode = ibmi.getCol(prevLine, 25, 35).trim().length > 0;
    const hasFactor1 = ibmi.getCol(curLine, 12, 25).trim().length;
    const curHasName = ibmi.getCol(curLine, 7, 21).trim().length > 0;

    // The very fringe case of a long name ending on prior line
    //  D  thisIsALongNameThatIsNotContinued
    //  D                SDS
    if (!curEndsWithDots && curDclType === 'DS' && curSpec === 'd') {
      // Special case: Unnamed Data Structure (DS) with attributes
      // Stop here if the current line is a DS and has no name
      break;
    }
    if (curSpec === 'c' && !isComment) {
      if (curOpCode.length === 0 && !hasFactor1) {
        // keep reading if the current line is a C-spec with no opcode and no factor1
        start--;
        continue;
      }
      else if (curOpCode.length > 0) {
        if (ibmi.isOpcodeANDxxORxx(curLine)) {
          start--;
          continue;
        }
        break;
      }
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

    let isComment = ibmi.getCol(line, 7, 7).trim() === '*';
    if (!isComment) {
      isComment = ibmi.getCol(line, 7, 80).trim().startsWith('//');
    }


    const namePartTrimmed = ibmi.getCol(line, 7, 21).trim();
    const fSpecCont = ibmi.getCol(line, 7, 43).trim();
    const fSpecKwd = ibmi.getCol(line, 44, 80).trim();

    const attr22to43 = ibmi.getCol(line, 22, 43).trimEnd();
    const endsWithDots = ibmi.getCol(line, 7, 80).trimEnd().endsWith('...');
    const hasOpcode = ibmi.getCol(line, 25, 35).trim().length > 0;
    const hasFactor1 = ibmi.getCol(line, 12, 25).trim().length;

    let fullName = '';
    if (endsWithDots) {
        fullName = ibmi.getCol(line, 7, 80).trimEnd().slice(0, -3).trimEnd();
    } else {
        fullName = ibmi.getCol(line, 7, 21).trimEnd();
    }

    if (["d", "p"].includes(curSpec)) {
      // Build the entity name from name parts
      if (!finalNameLineFound) {
        entityNameParts.push(fullName);
        if (!endsWithDots) {
          finalNameLineFound = true;
        }
      }
    }

    collectedIndexes.push(index);


    // ✅ Only collect lines after the full name is known, or in edge cases
    if (finalNameLineFound || ((["d", "p"].includes(curSpec)) && namePartTrimmed === '' && attr22to43 !== '') ||
      (curSpec === 'c' && !isComment)) {
        let bDoNotSave = false;
      if (curSpec === 'c' && !isComment && index !== start) {
        if (hasOpcode && !ibmi.isOpcodeANDxxORxx(line)) {
          bDoNotSave = true;
        }
      }
      if (!bDoNotSave) {
        collectedIndexes.push(index);
        collectedLines.push(line);
      }
    }
    if (!isComment) {
      // Continued F spec?
      if (curSpec === 'f' &&
        ((index === start) || (fSpecKwd.length > 0 && fSpecCont.length === 0))) {
        // Stop here if the nextLine is a F-spec with keyword
        collectedIndexes.push(index);
        collectedLines.push(line);
      }
    }

    // Check if the next line begins a new declaration or new opcode
    const nextLine = allLines[index + 1]?.padEnd(80, ' ');
    if (!nextLine) break; // No more lines to process
    const bStartNewLine = isStartOfNewEntity(nextLine, curSpec);
    if ((finalNameLineFound || (curSpec === 'c' && !isComment)) &&
        nextLine && bStartNewLine) {
      break;
    }

    const nextSpec = ibmi.getSpecType(nextLine);
    const nextOpcode = ibmi.getCol(nextLine, 25, 35).trim().length > 0;
    const nextFactor1 = ibmi.getCol(nextLine, 12, 25).trim().length;
    const nextfSpecCont = ibmi.getCol(nextLine, 7, 43).trim();
    const nextfSpecKwd = ibmi.getCol(nextLine, 44, 80).trim();

    let isNextComment = ibmi.getCol(nextLine, 7, 7).trim() === '*';
    if (!isNextComment) {
      isNextComment = ibmi.getCol(nextLine, 7, 80).trim().startsWith('//');
    }

    if (!isNextComment) {
      if (curSpec != nextSpec || (nextSpec === 'c' && (nextOpcode || nextFactor1))) {
          // Stop here if the nextLine is a C-spec with new opcode or factor1
          break;
      }
      if (nextSpec === 'f' && (nextfSpecKwd.length === 0 || nextfSpecCont.length > 0)) {
        // Stop here if the nextLine is a F-spec with keyword
        break;
      }
    }

    index++;
  }

  // Ensure that entityName is always returned, even if it's an empty string
  const entityName = entityNameParts.join('').trim() || null;

  return {
    entityName,
    lines: collectedLines,
    indexes: collectedIndexes,
    comments: comments.length > 0 ? comments : null,
    isSQL: false, // Ensure `isSQL` is false for non-SQL blocks
    isBOOL: false, // Ensure `isBOOL` is false for non-boolean blocks
  };
}

function isStartOfNewEntity(line: string, curSpec: string): boolean {
    if (ibmi.getSpecType(line) !== curSpec) return true;

    const name = ibmi.getCol(line, 7, 21).trim();
    const attr22to43 = ibmi.getCol(line, 22, 43).trimEnd();
    const hasDots = ibmi.getCol(line, 7, 80).trimEnd().endsWith('...');
    const nextSpec = ibmi.getSpecType(line);
    const nextOpcode = ibmi.getCol(line, 25, 35).trim().length > 0;
    const nextFactor1 = ibmi.getCol(line, 12, 25).trim().length;

  let isNextComment = ibmi.getCol(line, 7, 7).trim() === '*';
  const bBooleanContinuation = ibmi.isOpcodeANDxxORxx(line);

    if (!isNextComment) {
      isNextComment = ibmi.getCol(line, 7, 80).trim().startsWith('//');
    }

    // A line is a new entity if:
    // - It has a name and is not a continuation
    // - OR it's an unnamed D-spec (e.g., DS, SDS) with attributes
  let bStart = (!hasDots && name !== '' && !bBooleanContinuation) ||
               ((["d", "p"].includes(curSpec)) && name === '' && attr22to43 !== '');
  if (!bStart && curSpec === 'c' && !isNextComment) {
    if (nextSpec !== 'c' || nextOpcode || nextFactor1 || bBooleanContinuation) {
      bStart = false; // Stop here if the nextLine is a C-spec with new opcode or factor1
    }
  }
  return bStart;
}
