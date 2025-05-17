
import { collectSQLBlock } from './SQLSpec';
import { collectBooleanOpcode } from './collectBoolean';
import { collectHSpecs } from './collectHSpec';
import { collectPSpecs } from './collectPSpec';
import { collectDSpecs } from './collectDSpec';
import { collectComments } from './collectComments';
import { collectDirectives } from './collectDirectives';
import { collectCaseOpcode } from './collectCASEBlock';
import { collectExtOpcode } from './collectExtOpcode';

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
  if (ibmi.isComment(startLine)) { // Converting a block of comments?
    const cmtBlock = collectComments(allLines, startIndex);
    return {
      entityName: null,  // No entity name for SQL blocks
      lines: cmtBlock.lines,
      indexes: cmtBlock.indexes,
      comments: comments.length > 0 ? comments : null,
      isSQL: false,
      isBOOL: false,
    };
  }
  if (ibmi.isDirective(startLine)) { // Converting a block of comments?
    const dirBlock = collectDirectives(allLines, startIndex);
    return {
      entityName: null,  // No entity name for SQL blocks
      lines: dirBlock.lines,
      indexes: dirBlock.indexes,
      comments: comments.length > 0 ? comments : null,
      isSQL: false,
      isBOOL: false,
    };
  }

  const curSpec = ibmi.getSpecType(startLine);
  if ((!curSpec && ibmi.isNotComment(startLine)) || isLineEmpty(startLine)) return null;

  if (ibmi.isComment(startLine)) {
    let commentBlock: string[] = [];
    let commentIndex: number[] = [];
    let idx = startIndex;
    while (idx < allLines.length && ibmi.isComment(allLines[idx].padEnd(80, ' '))) {
      commentBlock.push(ibmi.convertCmt(allLines[idx]));
      commentIndex.push(idx);
      idx++;
    }
    idx = startIndex - 1;
    while (idx >= 0 && ibmi.isComment(allLines[idx].padEnd(80, ' '))) {
      commentBlock.push(ibmi.convertCmt(allLines[idx]));
      commentIndex.push(idx);
      idx--;
    }
    if (commentBlock.length > 0) {
      return {
        entityName: null,
        lines: commentBlock,
        indexes: commentIndex,
        comments: comments.length > 0 ? comments : null,
        isSQL: false,
        isBOOL: false,
      };
    }
  }

  if (curSpec === 'c' && !ibmi.isUnsuppotedOpcode(ibmi.getOpcode(startLine))) {
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
    } else if (ibmi.isExtOpcode(ibmi.getOpcode(startLine)) ||
      ibmi.getCol(startLine, 8, 35).trim() == '') {
      // if Calc spec and Extended Factor 2 opcode or nothing in Factor 1 or Opcode, then
      // this is a continued Extended Factor 2 spec. So read backwards
      // until we find an opcode or any free format statement.
      // Handle CASE/CASxx blocks
      const extF2 = collectExtOpcode(allLines, startIndex);
      return {
        entityName: null,
        lines: extF2.lines,
        indexes: extF2.indexes,
        comments: extF2.comments.length > 0 ? extF2.comments : null,
        isSQL: false,
        isBOOL: true,
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
      isBOOL: true,
    };
  }
  else if (curSpec === 'd') {
    const defnSpecs = collectDSpecs(allLines, startIndex); // Collect H specs if needed
    return {
      entityName: defnSpecs.entityName,
      lines: defnSpecs.lines,
      indexes: defnSpecs.indexes,
      comments: defnSpecs.comments.length > 0 ? defnSpecs.comments : null,
      isSQL: false,
      isBOOL: false,
    };
  }
  else if (curSpec === 'p') {
    const procSpec = collectPSpecs(allLines, startIndex); // Collect H specs if needed
    return {
      entityName: procSpec.entityName,
      lines: procSpec.lines,
      indexes: procSpec.indexes,
      comments: procSpec.comments.length > 0 ? procSpec.comments : null,
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

    if (ibmi.isComment(curLine)) {
      // comments.push(ibmi.convertCmt(curLine));
      start--;
      continue;
    }
    if (ibmi.isNotComment(prevLine)) {
      if (ibmi.getSpecType(prevLine) !== curSpec) break;
    }

    const curDclType = ibmi.getDclType(curLine);
    const prevDclType = ibmi.getDclType(prevLine).trim();
    const prevTrimmedLine = ibmi.getCol(prevLine, 7, 80).trimEnd();
    const curTrimmed = ibmi.getCol(prevLine, 7, 80).trimEnd();
    const prevEndsWithDots = prevTrimmedLine.endsWith('...');
    const curEndsWithDots = curTrimmed.endsWith('...');
    const prevHasName = ibmi.getCol(prevLine, 7, 21).trim().length > 0;
    const curOpCode = ibmi.getCol(curLine, 25, 35).trim();
    const prevOpCode = ibmi.getCol(prevLine, 25, 35).trim().length > 0;
    const hasFactor1 = ibmi.getCol(curLine, 12, 25).trim().length;
    const curHasName = ibmi.getCol(curLine, 7, 21).trim().length > 0;

    // The very fringe case of a long name ending on prior line
    //  D  thisIsALongNameThatIsNotContinued
    //  D                SDS
    if (curSpec === 'd') {
      const fieldDefn = ibmi.getCol(curLine, 7, 32).trim();
      const prevDefn = ibmi.getCol(prevLine, 33, 42).trim();
      const fieldAttr = ibmi.getCol(curLine, 7, 32).trim();
      if (!prevEndsWithDots) {
        if ((["ds", "pr", "pi"].includes(prevDclType) || prevDefn !== '') || fieldAttr === '') {
          break;
        }
      }
    }
    if (!curEndsWithDots && curDclType === 'DS' && curSpec === 'd') {
      // Special case: Unnamed Data Structure (DS) with attributes
      // Stop here if the current line is a DS and has no name
      break;
    }
    if (curSpec === 'c') {
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
    if (prevHasName && prevEndsWithDots) {
      start--; // Keep walking back
      continue;
    }

    // If it's just a continuation (no name), keep going
    if (curHasName && !prevEndsWithDots) {
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
  let collectedIndexes = new Set<number>();
  let collectedLines: string[] = [];

  while (index < allLines.length) {
    const totalLines = allLines.length;

    // Previous line (only if index > 0)
    const prevLine = index > 0 ? allLines[index - 1].padEnd(80, ' ') : '';
    // Current line
    const line = allLines[index]?.padEnd(80, ' ') ?? '';
    // Next line (only if index + 1 < totalLines)
    const nextLine = index + 1 < totalLines ? allLines[index + 1].padEnd(80, ' ') : '';

    if (ibmi.isComment(line)) {
      comments.push(ibmi.convertCmt(line));
      collectedIndexes.add(index);
      index++;
      continue;
    }

    if (ibmi.getSpecType(line) !== curSpec) break;

    const namePartTrimmed = ibmi.getCol(line, 7, 21).trim();
    const fSpecCont = ibmi.getCol(line, 7, 43).trim();
    const fSpecKwd = ibmi.getCol(line, 44, 80).trim();

    const attr22to43 = ibmi.getCol(line, 22, 43).trimEnd();
    const prevEndsWithDots = ibmi.getCol(prevLine, 7, 80).trimEnd().endsWith('...');
    const curEndsWithDots = ibmi.getCol(line, 7, 80).trimEnd().endsWith('...');
    const hasOpcode = ibmi.getCol(line, 25, 35).trim().length > 0;
    const hasFactor1 = ibmi.getCol(line, 12, 25).trim().length;

    let fullName = '';
    if (curEndsWithDots) {
      fullName = ibmi.getCol(line, 7, 80).trimEnd().slice(0, -3).trimEnd();
    } else {
      fullName = ibmi.getCol(line, 7, 21).trimEnd();
    }

    if (["d", "p"].includes(curSpec)) {
      // Build the entity name from name parts
      if (!finalNameLineFound) {
        entityNameParts.push(fullName);
        if (!curEndsWithDots) {
          finalNameLineFound = true;
        }
      }
    }

    if (index === start) {
      collectedIndexes.add(index);
    }

    if (curSpec === 'c') {
      if (index !== start) {
        if (hasOpcode && !ibmi.isOpcodeANDxxORxx(line)) {
          break;
        }
      }
      else {
        collectedIndexes.add(index);
        collectedLines.push(line);
      }
    }


    // ✅ Only collect lines after the full name is known, or in edge cases
    if (finalNameLineFound || ((["d", "p"].includes(curSpec)) && namePartTrimmed === '' && attr22to43 !== '')) {
      collectedIndexes.add(index);
      collectedLines.push(line);
    }

    // Continued F spec?
    if (curSpec === 'f' &&
      ((index === start) || (fSpecKwd.length > 0 && fSpecCont.length === 0))) {
      const fileDesignation = ibmi.getCol(line, 18).toLowerCase();
      if (["f", ""].includes(fileDesignation)) {
        // Stop here if the nextLine is a F-spec with keyword
        collectedIndexes.add(index);
        collectedLines.push(line);
      }
      else {
        index++;
        continue;
      }
    }

    // Check if the next line begins a new declaration or new opcode

    if (!nextLine) break; // No more lines to process?

    const bStartNewLine = isStartOfNewEntity(nextLine, curSpec);
    if ((finalNameLineFound || (curSpec === 'c') && !ibmi.isComment(nextLine)) &&
      nextLine.trim() !== '' && bStartNewLine) {
      break;
    }

    const nextSpec = ibmi.getSpecType(nextLine);
    const nextOpcode = ibmi.getCol(nextLine, 25, 35).trim().length > 0;
    const nextFactor1 = ibmi.getCol(nextLine, 12, 25).trim().length;
    const nextfSpecCont = ibmi.getCol(nextLine, 7, 43).trim();
    const nextfSpecKwd = ibmi.getCol(nextLine, 44, 80).trim();

    let isNextComment = ibmi.isComment(nextLine);

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
    indexes: [...collectedIndexes], // Convert Set<number> to an array
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
