
import * as vscode from 'vscode';
import * as ibmi from './IBMi';

function extractComment(line: string): { code: string, comment: string | null } {
  let insideSingleQuote = false;
  let insideDoubleQuote = false;

  for (let i = 0; i < line.length - 1; i++) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === "'" && !insideDoubleQuote) insideSingleQuote = !insideSingleQuote;
    else if (ch === '"' && !insideSingleQuote) insideDoubleQuote = !insideDoubleQuote;

    if (ch === '/' && next === '/' && !insideSingleQuote && !insideDoubleQuote) {
      const codePart = line.substring(0, i).trimEnd();
      const commentPart = line.substring(i).trim();
      return { code: codePart, comment: commentPart };
    }
  }

  return { code: line.trimEnd(), comment: null };
}

export function reflowLines(statement: string): string[] {
  const result: string[] = [];
  const nameContinuation = '...';        // Continuation syntax for long names (not yet used)
  let addedComment = false;
  const config = ibmi.getRPGIVFreeSettings();
  const firstIndentLen = config.indentFirstLine;
  const contIndentLen = config.indentContLines;
  const maxLength = config.maxWidth;

  const firstIndent = ' '.repeat(firstIndentLen);
  const continuationIndent = ' '.repeat(contIndentLen);

  const { code, comment } = extractComment(statement);
  let trimmedStatement = code.trimStart();
  let currentLine = firstIndent;

  const endsWithSemicolon = trimmedStatement.endsWith(';');
  if (endsWithSemicolon) {
    trimmedStatement = trimmedStatement.slice(0, -1).trimEnd(); // Remove semicolon for processing
  }

  let insideQuote = false;

  while (trimmedStatement.length > 0) {
    const availableLength = maxLength - currentLine.length;
    if (trimmedStatement.length <= availableLength) {
      if (comment && !addedComment) {
        const lastIndex = result.length - 1;
        if (result.length > 0 && result[lastIndex].length + comment.length + 1 <= maxLength) {
          result[lastIndex] += ' ' + comment;
        } else {
          result.push(`${firstIndent}${comment}`);
        }
      }
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

    if (comment && !addedComment) {
      const lastIndex = result.length - 1;
      if (result.length > 0 && result[lastIndex].length + comment.length + 1 <= maxLength) {
        result[lastIndex] += ' ' + comment;
      } else {
        result.push(`${firstIndent}${comment}`);
      }
      addedComment = true;
    }

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
