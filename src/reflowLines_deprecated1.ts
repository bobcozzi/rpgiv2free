
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

export function reflowLines_Deprecated(line: string): string[] {
  const config = ibmi.getRPGIVFreeSettings();
  const firstIndent = ' '.repeat(config.indentFirstLine);
  const contIndent = ' '.repeat(config.indentContLines);
  const maxLength = config.maxWidth;

  // Separate comment from code
  const { code, comment } = extractComment(line);
  const words = code.trim().split(/\s+/);

  let lines: string[] = [];
  let currentLine = firstIndent;
  let currentIndent = firstIndent;

  for (const token of words) {
    if ((currentLine + token).length > maxLength) {
      if ((currentIndent + token).length > maxLength) {
        // Token itself is too long, split it
        let remaining = token;
        while ((currentIndent + remaining).length > maxLength) {
          const available = maxLength - currentLine.length - 3; // space for '...'
          const part = remaining.substring(0, available);
          remaining = remaining.substring(available);
          lines.push(currentLine + part + '...');
          currentIndent = contIndent;
          currentLine = currentIndent;
        }
        currentLine += remaining;
      } else {
        // Move to a new line for wrapping
        lines.push(currentLine);
        currentIndent = contIndent;
        currentLine = currentIndent + token;
      }
    } else {
      // Append to current line
      currentLine += (currentLine.trim().length > 0 ? ' ' : '') + token;
    }
  }

  if (currentLine.trim()) lines.push(currentLine);
  if (comment) lines[lines.length - 1] += ' ' + comment;

  return lines;
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