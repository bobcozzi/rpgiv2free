
import * as ibmi from './IBMi'

export function collectComments(allLines: string[], startIndex: number): { lines: string[], indexes: number[] } {
  const lines: string[] = [];
  const indexes: number[] = [];

  // Find start of comment block by scanning backward
  let start = startIndex;
  while (start > 0) {
    const line = allLines[start-1].trimEnd();
    if (line === '' || ibmi.isComment(line)) {
      start--;
    } else {
      break;
    }
  }

  // Find end of comment block by scanning forward
  let end = start;
  while (end < allLines.length) {
    const line = allLines[end+1].trimEnd();
    if (line === '' || ibmi.isComment(line)) {
      end++;
    } else {
      break;
    }
  }

  for (let i = start; i <= end; i++) {
    lines.push(ibmi.convertCmt(allLines[i]));
    indexes.push(i);
  }

  return { lines, indexes };
}