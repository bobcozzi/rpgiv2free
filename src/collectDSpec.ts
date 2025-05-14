
import * as ibmi from './IBMi';
import { collectedStmt } from './types';

export function collectDSpecs(
  allLines: string[],
  startIndex: number
): {
  lines: string[];
  indexes: number[];
  entityName: string | null;
  specType: string | null;
  comments: string[] | [];
} {

  function isDefnSpecLine(line: string): boolean {
    return ibmi.getSpecType(line) === 'd' && ibmi.isNotComment(line);
  }

  if (!isDefnSpecLine(allLines[startIndex])) {
    return {
      lines: [],
      indexes: [],
      entityName: null,
      specType: null,
      comments: []
    };
  }
  const startingLine = allLines[startIndex];

  // Walk BACKWARD to find the starting line of the statement
  let firstIndex = startIndex;
  let bDefn = false;
  let bContName = false;
  for (let i = firstIndex; i >= 0; i--) {
    const line = allLines[i];
    let prevLine = '';
    if (i > 0) {
      prevLine = allLines[i - 1];
    }
    if (ibmi.isComment(line)) continue;
    if (ibmi.isSpecEmpty(line)) continue;
    if (!isDefnSpecLine(line)) break;

    // once a continued name is detected (reading backwards) and
    // this line is not also a continued name, then we are done reading backwards.

    const isKwdOnly = ibmi.isJustKwds(line);
    const isNameCont = ibmi.dNameContinues(prevLine);
    const isKwdCont = ibmi.dKwdContinues(prevLine);

    if (bContName && !isNameCont) {
      firstIndex = i;
      break
    };

    bContName = isNameCont;

    if (ibmi.isValidFixedDefnLine(line)) {
      if (bDefn) {
        break;
      }
      else {
        bDefn = true;
      }
    } else if (bDefn && !isNameCont) {
      break;
    } else if (!isNameCont && !isKwdOnly && !isKwdCont) {
      break;
    }


    firstIndex = i;
  }

  // Walk FORWARD
  const indexes: number[] = [];
  const lines: string[] = [];
  let entityNameParts: string[] = [];
  let kwdAreaParts: string[] = [];
  let specType: string | null = null;
  let comments: string[] = [];
  let bValidDefnLine = false;

  // Walk FORWARD to collect the full statement
  for (let i = firstIndex; i < allLines.length; i++) {
    const line = allLines[i];

    if (ibmi.isComment(line)) {
      comments.push(ibmi.convertCmt(line));
      indexes.push(i);
      continue;
    }
    else if (!isDefnSpecLine(line)) {
      break;
    }

    if (bValidDefnLine && ibmi.isValidFixedDefnLine(line)) {
      break;  // If we already had a declare and this is also a declare, then we're done
    }

    indexes.push(i);

    if (!bValidDefnLine) {
      bValidDefnLine = ibmi.isValidFixedDefnLine(line);
    }
    const dclType = ibmi.getDclType(line);

    // Entity name: characters from col 7 to 80, stopping before col 44

    if (ibmi.dNameContinues(line)) {
      const namePart = ibmi.getCol(line, 7, 80).trim();
      entityNameParts.push(namePart.replace(/\.\.\.$/, '').trim());
    }
    else  // if not a contnuined name line, then save the line itself (but always save the line index)
    {
      const namePart = ibmi.getCol(line, 7, 21).trim();
      entityNameParts.push(namePart.replace(/\.\.\.$/, '').trim());
      lines.push(line);
    }
    let isKwdOnly = false;
    let isCommentNext = false;
    if (bValidDefnLine && i < allLines.length) { // Peak at next line
      isKwdOnly = ibmi.isJustKwds(allLines[i + 1]);
      if (!isKwdOnly) {
        isCommentNext = ibmi.isComment(allLines[i + 1]);
      }
    }
    // going forward through the lines, if we hit a Defn spec (DS, PI, C, PR, S) we're done
    if (!ibmi.dNameContinues(line) && !ibmi.dKwdContinues(line) && (bValidDefnLine && !isKwdOnly && !isCommentNext)) {
      break;
    }
  }

  return {
    specType: 'D',
    lines,
    indexes,
    entityName: entityNameParts.length > 0 ? entityNameParts.join('') : null,
    comments: comments
  };
}

