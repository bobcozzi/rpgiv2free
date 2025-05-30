
import * as rpgiv from './rpgedit';
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
    return rpgiv.getSpecType(line) === 'd' && rpgiv.isNotComment(line) && !rpgiv.isDirective(line);
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
    if (rpgiv.isComment(line)) continue;
    if (rpgiv.isSpecEmpty(line)) continue;
    if (!isDefnSpecLine(line)) break;

    // Once a continued name is detected (reading backwards) and
    // this line is not also a continued name, then we are done reading backwards.

    const isKwdOnly = rpgiv.isJustKwds(line);
    const isNameCont = rpgiv.dNameContinues(prevLine);
    const isKwdCont = rpgiv.dKwdContinues(prevLine);

    if (bContName && !isNameCont) {
      firstIndex = i;
      break
    };

    bContName = isNameCont;

    if (bDefn || rpgiv.isValidFixedDefnLine(line)) {
      if (bDefn && !rpgiv.dNameContinues(line)) {
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

    if (rpgiv.isComment(line)) {
      comments.push(rpgiv.convertCmt(line));
      indexes.push(i);
      continue;
    }
    else if (!isDefnSpecLine(line)) {
      break;
    }

    if (bValidDefnLine && rpgiv.isValidFixedDefnLine(line)) {
      break;  // If we already had a declare and this is also a declare, then we're done
    }

    indexes.push(i);

    if (!bValidDefnLine) {
      bValidDefnLine = rpgiv.isValidFixedDefnLine(line);
    }
    const dclType = rpgiv.getDclType(line);

    // Entity name: characters from col 7 to 80, stopping before col 44

    if (rpgiv.dNameContinues(line)) {
      const namePart = rpgiv.getCol(line, 7, 80).trim();
      entityNameParts.push(namePart.replace(/\.\.\.$/, '').trim());
    }
    else  // if not a contnuined name line, then save the line itself (but always save the line index)
    {
      if (!rpgiv.isEmptyStmt(line)) { // If not an empty Spec (e.g., "D <allblanks...>") add it
        const namePart = rpgiv.getCol(line, 7, 21).trim();
        entityNameParts.push(namePart.replace(/\.\.\.$/, '').trim());
        lines.push(line);
      }
    }
    let isKwdOnly = false;
    let isCommentNext = false;
    // Changed to i+1 since we're getting the next line and array elements can't be exceeded
    if (bValidDefnLine && i+1 < allLines.length) { // Peak at next line
      isKwdOnly = rpgiv.isJustKwds(allLines[i + 1]);
      if (!isKwdOnly) {
        isCommentNext = rpgiv.isComment(allLines[i + 1]);
      }
    }
    // going forward through the lines, if we hit a Defn spec (DS, PI, C, PR, S) we're done
    if (!rpgiv.dNameContinues(line) && !rpgiv.dKwdContinues(line) && (bValidDefnLine && !isKwdOnly && !isCommentNext)) {
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

