

export function collectHSpecs(allLines: string[], startIndex: number): { lines: string[], indexes: number[] } {
  const lines: string[] = [];
  const indexes: number[] = [];

  for (let i = startIndex; i < allLines.length; i++) {
    const line = allLines[i];
    // Check for 'H' in column 6 (index 5)
    if (line.length >= 6 && line[5].toUpperCase() === 'H') {
      lines.push(line);
      indexes.push(i);
    }
  }

  return { lines, indexes };
}