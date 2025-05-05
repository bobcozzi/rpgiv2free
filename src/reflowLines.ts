
export function reflowLines(statement: string, maxLength: number = 74): string[] {
    const result: string[] = [];
    const firstIndent        = '          '; // 10 spaces
    const continuationIndent = '            '; // 12 spaces
    const nameContinuation   = '...';        // Continuation syntax for long names (not yet used)

    let trimmedStatement = statement.trimStart();
    let currentLine = firstIndent;

    const endsWithSemicolon = trimmedStatement.endsWith(';');
    if (endsWithSemicolon) {
      trimmedStatement = trimmedStatement.slice(0, -1).trimEnd(); // Remove semicolon for processing
    }

    let insideQuote = false;

    while (trimmedStatement.length > 0) {
      const availableLength = maxLength - currentLine.length;

      if (trimmedStatement.length <= availableLength) {
        currentLine += trimmedStatement;
        result.push(currentLine);
        break;
      }

      const match = trimmedStatement.match(/^\s*(dcl-[a-z]+)\s+([^\s]+)/i);
      const firstWord = match ? match[2] : '';

      if (currentLine.trim() === '') {
        currentLine += match ? match[1] + ' ' : '';
        trimmedStatement = trimmedStatement.slice((match ? match[1].length + 1 : 0)).trimStart();
      }

      if (currentLine.trimStart().startsWith('dcl-') && firstWord.length > availableLength) {
        handleLongName(trimmedStatement, currentLine, result, availableLength, continuationIndent);
        return result;
      }

      let breakPoint = availableLength;
      const substring = trimmedStatement.slice(0, availableLength + 1);

     // Recompute quote state *before* making slice decisions
const quoteCount = (currentLine.match(/'/g) || []).length +
(substring.match(/'/g) || []).length;
insideQuote = (quoteCount % 2 !== 0) || insideQuote;  // Update insideQuote


// Find last breakable character (space or colon)
const lastBreakableIndex = Math.max(substring.lastIndexOf(' '), substring.lastIndexOf(':'));
const breakPointChar = substring.charAt(lastBreakableIndex);
const preserveTrailingSpace = insideQuote && breakPointChar === ' ';


// Use it only if it's before the allowed limit
if (lastBreakableIndex > -1 && lastBreakableIndex < breakPoint) {
breakPoint = lastBreakableIndex;
}

const sliceEnd = preserveTrailingSpace ? breakPoint + 1 : breakPoint;
const fragment = trimmedStatement.slice(0, sliceEnd);
const lastChar = fragment.charAt(fragment.length - 1);
const nextChar = trimmedStatement.charAt(sliceEnd + 1); // Corrected this line

      if (insideQuote) {
          // currentLine += fragment; // preserve trailing spaces
          currentLine += preserveTrailingSpace ? fragment : fragment.trimEnd();

        // Choose continuation symbol based on space before and after
        if (lastChar === ' ' && nextChar === ' ') {
          currentLine += "-"; // preserve spaces on both sides
        } else {
          currentLine += "+"; // join normally
        }
      } else {
        // currentLine += fragment.trimEnd(); // safe to trim outside quotes
          currentLine += preserveTrailingSpace ? fragment : fragment.trimEnd();
      }

      result.push(currentLine);

      currentLine = continuationIndent;
      trimmedStatement = trimmedStatement.slice(sliceEnd);
    }

    // Append semicolon to the final line
    if (result.length > 0) {
      const lastIndex = result.length - 1;
      result[lastIndex] = result[lastIndex].replace(/ \+$/, '').trimEnd() + ';';
    }

    return result;
  }

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
         // substring.lastIndexOf('('),
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

  // Check if inside a quoted string and determine the proper continuation symbol
  if (insideQuote) {
      const lastChar = currentLine.charAt(currentLine.length - 1); // Get the last character of the current line
      const nextChar = trimmedStatement.charAt(breakPoint); // Get the next character after the break point

      // If the last character is a space and the next character is also a space
      // Insert continuation symbol according to RPG IV free format rules
      if (lastChar === ' ' && nextChar === ' ') {
          currentLine += " -"; // Continuation symbol is a '-' and starts at position 8 of the continued line
      } else {
          // Otherwise, insert a '+' sign without an extra space
          if (lastChar !== ' ') {
              currentLine += "+";
          } else {
              currentLine += " +"; // Add space only if there's a blank at the end
          }
      }
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