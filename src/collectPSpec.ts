
import * as ibmi from './IBMi';
import { collectedStmt } from './types';

export function collectPSpecs(
  allLines: string[],
  startIndex: number
): {
  lines: string[];
  indexes: number[];
  entityName: string | null;
  specType: string | null;
  comments: string[] | [];
} {

  function isProcSpec(line: string): boolean {
    return (ibmi.getSpecType(line) === 'p');
  }

  if (!isProcSpec(allLines[startIndex])) {
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
    if (ibmi.isSkipStmt(line)) continue;
    if (!isProcSpec(line)) break;

    // Once a continued name is detected (reading backwards) and
    // this line is not also a continued name, then we are done reading backwards.

    const isKwdOnly = ibmi.isJustKwds(line);
    const isNameCont = ibmi.dNameContinues(prevLine);
    const isKwdCont = ibmi.dKwdContinues(prevLine);

    if (bContName && !isNameCont) {
      firstIndex = i;
      break
    };

    bContName = isNameCont;

    if (!isNameCont) {
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
    else if (ibmi.isEmptyStmt(line)) {
      continue;
    }
    else if (!isProcSpec(line) && !ibmi.isSkipStmt(line)) {
      break;
    }

    indexes.push(i);

    const dclType = ibmi.getDclType(line);  // B or E (for begin or End proc)

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
    let nextLine = '';
    let bNextIsPSpec = false;
    if (i < allLines.length) { // Peak at next line
          nextLine = allLines[i + 1];
        bNextIsPSpec = (isProcSpec(allLines[i + 1]))
    }

    if (bNextIsPSpec) { // Peak at next line
      isKwdOnly = ibmi.isJustKwds(nextLine);
      if (!isKwdOnly) {
        isCommentNext = (ibmi.isComment(nextLine) || ibmi.isSkipStmt(nextLine) );
      }
    }
    // going forward through the lines, if we hit a Defn spec (DS, PI, C, PR, S) we're done
    if (!ibmi.dNameContinues(line) && !ibmi.dKwdContinues(line) && (!isKwdOnly && !isCommentNext)) {
      break;
    }
  }

  return {
    specType: 'P',
    lines,
    indexes,
    entityName: entityNameParts.length > 0 ? entityNameParts.join('') : null,
    comments: comments
  };
}

