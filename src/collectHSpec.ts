import * as ibmi from './IBMi'

export function collectHSpecs(allLines: string[], startIndex: number): { lines: string[], indexes: number[] } {
  const lines: string[] = [];
  const indexes: number[] = [];

  // Move backward to find the first H-spec in the block
  let start = startIndex;
  while (start > 0) {
    const line = allLines[start - 1];
    if (line.length >= 6 && line[5].toUpperCase() === 'H') {
      start--;
    } else {
      break;
    }
  }

  // Move forward and collect contiguous H-specs
  let end = start;
  while (end < allLines.length) {
    const line = allLines[end];
    if (line.length >= 6 && line[5].toUpperCase() === 'H') {
      lines.push(line);
      indexes.push(end);
      end++;
    } else {
      break;
    }
  }

  return { lines, indexes };
}