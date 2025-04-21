

 // processLine is call for all NON-SQL lines
// It takes a line of code and breaks it into multiple lines if it exceeds a certain length.
export function processLine(decl: string): string[] {
    const paddedPrefix    = '        '; // 8 spaces
    const continuedPrefix = '          '; // 10 spaces
    const maxLength = 72;

    // Trim and add the semicolon
    let fullLine = decl.trimEnd() + ';';

  const resultLines: string[] = [];
  fullLine = fullLine.trimStart(); // strip any existing indentation

    // Pad the first line
    fullLine = paddedPrefix + fullLine;

    while (fullLine.length > maxLength) {
      // Try to find the last space before maxLength
      let breakIndex = fullLine.lastIndexOf(' ', maxLength);

      // If no space found, break hard at maxLength
      if (breakIndex <= paddedPrefix.length) {
        breakIndex = maxLength;
      }

      // Push line up to the break point
      resultLines.push(fullLine.slice(0, breakIndex));

      // Trim leading whitespace from the next chunk and pad it again
      fullLine = continuedPrefix + fullLine.slice(breakIndex).trimStart();
    }

    // Push the final chunk
    resultLines.push(fullLine);

    return resultLines;
  }