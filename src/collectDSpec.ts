
import * as rpgiv from './rpgedit';
import { collectedStmt } from './types';

function isDefnSpecLine(line: string): boolean {
  return rpgiv.getSpecType(line) === 'd' && rpgiv.isNotComment(line) && !rpgiv.isDirective(line);
}

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

  const commentIndexes: number[] = [];
  // Walk FORWARD
  const indexes: number[] = [];
  const lines: string[] = [];
  let entityNameParts: string[] = [];
  let kwdAreaParts: string[] = [];
  let specType: string | null = null;
  let comments: string[] = [];
  let bValidDefnLine = false;
  let bKwdContinues = false;
  let bNameContinues = false;
  let bValidFixedDefn = false;
  let headerSeen = false; // we've captured the current statement's header line
  let headerNameContinues = false;     // header name ends with '...'

  // Walk FORWARD to collect the full statement
  for (let i = firstIndex; i < allLines.length; i++) {
    const line = allLines[i];

    if (rpgiv.isComment(line)) {
      comments.push(rpgiv.convertCmt(line));
      commentIndexes.push(i);
      indexes.push(i);
      continue;
    }
    else if (!isDefnSpecLine(line)) {
      break;
    }

    bKwdContinues = rpgiv.dKwdContinues(line);
    bNameContinues = rpgiv.dNameContinues(line);
    bValidFixedDefn = rpgiv.isValidFixedDefnLine(line);

    // Fallback header detection: non-empty name area (7–21) that doesn't end with '...'
    const nameAreaRaw = rpgiv.getCol(line, 7, 21);
    const hasName = /\S/.test(nameAreaRaw);
    const nameEndsDots = /\.\.\.$/.test(nameAreaRaw.trimEnd());

    const isHeader = bValidFixedDefn || (hasName && !nameEndsDots);

    // Break on any new header (even if it has keyword continuation),
    // or if we see a name-continuation but the current header didn’t continue
    if (headerSeen && (isHeader || (!headerNameContinues && bNameContinues))) {
      break;
    }

    if (headerSeen && bValidFixedDefn &&
      !bNameContinues &&
      !bKwdContinues) {
      break;
    }
    if (headerSeen && bValidFixedDefn) {
      break;
    }

    if (headerSeen && !headerNameContinues && bNameContinues) {
      break;
    }

    indexes.push(i);

    if (!bValidDefnLine) {
      bValidDefnLine = bValidFixedDefn;
    }

    // Entity name: characters from col 7 to 80, stopping before col 44

    if (bNameContinues || (headerSeen && headerNameContinues && bKwdContinues)) {
      const segmentSrc = (bKwdContinues && !bNameContinues)
        ? rpgiv.getCol(line, 44, 80)
        : rpgiv.getCol(line, 7, 80);
      const seg = segmentSrc.trim().replace(/\.\.\.\s*$/, '');
      if (seg) entityNameParts.push(seg);

      // Maintain continuation flag for subsequent lines
      const endsWithDots = /\.\.\.\s*$/.test(line);
      headerNameContinues = endsWithDots;
      continue;
    }

    else {
      if (!rpgiv.isEmptyStmt(line)) {
        const nameShort = rpgiv.getCol(line, 7, 21).trim().replace(/\.\.\.$/, '').trim();
        if (nameShort) entityNameParts.push(nameShort);
        lines.push(line);
        headerSeen = true;

        // Decide if the header name continues and from where the next chunk comes:
        const nameArea = rpgiv.getCol(line, 7, 21).trimEnd();
        const pre44 = rpgiv.getCol(line, 22, 43);
        const endsWithDots = /\.\.\.\s*$/.test(line);
        const nameEndsDots = /\.\.\.$/.test(nameArea);
        const hasPre44Content = /[^\s]/.test(pre44);

        // Name continues if line ends with '...' and either the name area ends with '...'
        // or there is no content before col 44 (keyword-area continuation).
        headerNameContinues = endsWithDots && (nameEndsDots || !hasPre44Content);
      }
    }

    let isKwdOnly = false;
    let isCommentNext = false;
    // Changed to i+1 since we're getting the next line and array elements can't be exceeded
    if (bValidDefnLine && i + 1 < allLines.length) { // Peak at next line
      isKwdOnly = rpgiv.isJustKwds(allLines[i + 1]);
      if (!isKwdOnly) {
        isCommentNext = rpgiv.isComment(allLines[i + 1]);
      }
    }
    // going forward through the lines, if we hit a Defn spec (DS, PI, C, PR, S) we're done
    if (!bNameContinues &&
      !bKwdContinues &&
      (bValidDefnLine && !isKwdOnly && !isCommentNext)) {
      break;
    }
  }


  let i = indexes.length - 1;
  let c = commentIndexes.length - 1;

  // Remove trailing indexes that match in both sets
  while (
    i >= 0 &&
    c >= 0 &&
    indexes[i] === commentIndexes[c]
  ) {
    indexes.pop();
    commentIndexes.pop();
    comments.pop(); // <-- Remove the last collected ("embedded") comment as well
    i--;
    c--;
  }


  return {
    specType: 'D',
    lines,
    indexes,
    entityName: entityNameParts.length > 0 ? entityNameParts.join('') : null,
    comments: comments
  };
}

