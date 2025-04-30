
export function reflowOutputLines(statement: string, maxLength: number = 74): string[] {
  const result: string[] = [];
  const firstIndent        = '          '; // 10 spaces
  const continuationIndent = '            '; // 12 spaces
  const nameContinuation = '...'; // Continuation syntax for long names

  // Trim leading spaces and apply the first indent
  let trimmedStatement = statement.trimStart();
  let currentLine = firstIndent;

  // Check if the statement ends with a semicolon
  const endsWithSemicolon = trimmedStatement.endsWith(';');
  if (endsWithSemicolon) {
      trimmedStatement = trimmedStatement.slice(0, -1).trimEnd(); // Remove semicolon for processing
  }

  let insideQuote = false; // Track whether we are inside a quoted string

  while (trimmedStatement.length > 0) {
      // Determine the maximum length for the current line
      const availableLength = maxLength - currentLine.length;

      // If the statement fits within the available length, add it and break
      if (trimmedStatement.length <= availableLength) {
          currentLine += trimmedStatement;
          result.push(currentLine);
          break;
      }

      // Extract the first identifier (variable, procedure, etc.) after the declaration keyword
      const match = trimmedStatement.match(/^\s*(dcl-[a-z]+)\s+([^\s]+)/i);
      const firstWord = match ? match[2] : '';

      // If the current line is empty (only contains the first indent), add the declaration keyword
      if (currentLine.trim() === '') {
          currentLine += match ? match[1] + ' ' : '';
          trimmedStatement = trimmedStatement.slice((match ? match[1].length + 1 : 0)).trimStart();
      }

      // Handle long RPG IV names that exceed the line length
      if (currentLine.trimStart().startsWith('dcl-') && firstWord.length > availableLength) {
          handleLongName(trimmedStatement, currentLine, result, availableLength, continuationIndent);
          return result;
      }

      // Otherwise, find a suitable break point
      let breakPoint = availableLength;
      const substring = trimmedStatement.slice(0, availableLength + 1);

      // Prefer breaking at spaces, parentheses, or semicolons
      const lastBreakableIndex = Math.max(
          substring.lastIndexOf(' '),
          substring.lastIndexOf('('),
          substring.lastIndexOf(':')
      );

      if (lastBreakableIndex > -1) {
          breakPoint = lastBreakableIndex;
      }

      // Check if we're in the middle of a quoted string
      const quoteCount = (currentLine.match(/'/g) || []).length +
          (trimmedStatement.slice(0, breakPoint).match(/'/g) || []).length;

      insideQuote = (quoteCount % 2 !== 0) || insideQuote;

      // Add the continuation marker only if breaking inside a quoted string
      currentLine += trimmedStatement.slice(0, breakPoint).trimEnd();
      if (insideQuote) {
          currentLine += " +";
      }

      result.push(currentLine);

      // Prepare the next line with continuation indent
      currentLine = continuationIndent;
      trimmedStatement = trimmedStatement.slice(breakPoint).trimStart();
  }

  // Append a semicolon to the final statement
  if (result.length > 0) {
      const lastIndex = result.length - 1;
      result[lastIndex] = result[lastIndex].replace(/ \+$/, '').trimEnd() + ';';
  }

  return result;
}

// Helper function to handle long RPG IV names
function handleLongName(
  trimmedStatement: string,
  currentLine: string,
  result: string[],
  availableLength: number,
  continuationIndent: string
): void {
  const nameContinuation = '...'; // Continuation syntax for long names
  while (trimmedStatement.length > 0) {
      const namePart = trimmedStatement.slice(0, availableLength - nameContinuation.length).trimEnd();
      currentLine += namePart + nameContinuation;
      result.push(currentLine);

      // Prepare the next line with continuation indent only
      currentLine = continuationIndent;
      trimmedStatement = trimmedStatement.slice(namePart.length).trimStart();

      // If the remaining part fits within the available length, add it and break
      if (trimmedStatement.length <= availableLength) {
          currentLine += trimmedStatement;
          result.push(currentLine);
          break;
      }
  }
}