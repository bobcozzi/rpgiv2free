
import * as rpgiv from './rpgedit';
import { collectedStmt } from './types';

export function collectFSpecs(
  allLines: string[],
  startIndex: number
): {
  lines: string[];
  indexes: number[];
  entityName: string | null;
  specType: string | null;
  comments: string[] | [];
} {

  function isFileSpec(line: string): boolean {
    return rpgiv.getSpecType(line) === 'f' && rpgiv.isNotComment(line);
  }
  function isFileDescCont(line: string): boolean {
    if (typeof line !== 'string' || line.length === 0) return false;
    if (rpgiv.getSpecType(line) !== 'f') return false;
    if (!rpgiv.isNotComment(line)) return false;

    const specArea = rpgiv.getCol(line, 7, 43);
    if (typeof specArea !== 'string') return false;
    if (specArea.trim().length > 0) return false;

    return true;
  }
  function isFileDesc(line: string): boolean {
    if (typeof line !== 'string' || line.length === 0) return false;
    if (rpgiv.getSpecType(line) !== 'f') return false;
    if (!rpgiv.isNotComment(line)) return false;
    const specArea = rpgiv.getCol(line, 7, 43);
    if (typeof specArea !== 'string') return false;
    const trimmedSpecArea = specArea.trim();
    return trimmedSpecArea.length > 0;
  }

  if (!isFileSpec(allLines[startIndex])) {
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
  for (let i = firstIndex; i >= 0; i--) {
    const line = allLines[i];
    let prevLine = '';
    if (i > 0) {
      prevLine = allLines[i - 1];
    }
    if (rpgiv.isComment(line)) continue;
    if (rpgiv.isSpecEmpty(line)) continue;
    if (!isFileSpec(line)) break;

    // Once a File Description spec (includes file name) is reached, we're at the start


    const isKwdOnly = rpgiv.isJustKwds(line);
    if (isFileDesc(line)) {
      firstIndex = i;
      break;
    }
    if (isFileDescCont(line)) {
      firstIndex = i;  // continue
    }
  }

  // Walk FORWARD
  const commentIndexes: number[] = [];
  const indexes: number[] = [];
  const lines: string[] = [];
  let entityNameParts: string[] = [];
  let kwdAreaParts: string[] = [];
  let specType: string | null = null;
  let comments: string[] = [];
  let bValidFileSpec = false;

  // Walk FORWARD to collect the full statement
  for (let i = firstIndex; i < allLines.length; i++) {
    const line = allLines[i];

    if (rpgiv.isComment(line)) {
      comments.push(rpgiv.convertCmt(line));
      commentIndexes.push(i);
      indexes.push(i);
      continue;
    }
    else if (rpgiv.isSkipStmt(line)) {
      continue;
    }
    if (!isFileSpec(line)) break;

    if (i > firstIndex && isFileDesc(line)) {
      break;  // If we already had a declare and this is also a declare, then we're done
    }
    else if (isFileDesc(line)) {
      entityNameParts.push(rpgiv.getCol(line, 7, 16));  // File names are max 10-char
    }

    indexes.push(i);
    lines.push(line);

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
    specType: 'F',
    lines,
    indexes,
    entityName: entityNameParts.length > 0 ? entityNameParts.join('') : null,
    comments: comments
  };
}

