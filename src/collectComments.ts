
import * as rpgiv from './rpgedit';
import { stmtLines } from './types';

export function collectComments(allLines: string[], startIndex: number): stmtLines {
  const lines: string[] = [];
  const indexes: number[] = [];
  const comments: string[] = [];
  const eol = rpgiv.getEOL();

  // NOTE: This routine returns comments as "lines" not in the "comments" return value

  // Find start of comment block by scanning backward
  let start = startIndex;
  while (start > 0) {
    const line = allLines[start-1].trimEnd();
    if (line === '' || rpgiv.isComment(line)) {
      start--;
    } else {
      break;
    }
  }

  // Find end of comment block by scanning forward
  let end = start;
  while (end < allLines.length) {
    const line = allLines[end+1].trimEnd();
    if (line === '' || rpgiv.isComment(line)) {
      end++;
    } else {
      break;
    }
  }

  for (let i = start; i <= end; i++) {
    lines.push(rpgiv.convertCmt(allLines[i]));
    indexes.push(i);
  }

  return {
    lines,
    indexes,
    comments: comments.length > 0 ? comments : null
  };
}