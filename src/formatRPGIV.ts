
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
export const formatRPGIV = (input: string): string[] => {
  const config = ibmi.getRPGIVFreeSettings();
  const firstIndentLen = config.indentFirstLine - 1;
  const contIndentLen = config.indentContLines - 1;
  const maxLength = config.maxWidth;

  const indent = (n: number) => ' '.repeat(n);
  const result: string[] = [];


  let currentLine = indent(firstIndentLen);
  let currentLength = firstIndentLen;

  const isValidRPGName = (token: string) =>
    /^[A-Z#$@][A-Z0-9#$@_]{0,4095}$/i.test(token);

  const flushLine = (addLine = true, addIndent = true) => {
    if (addLine && currentLine.trim()) {
      result.push(currentLine.trimEnd());
    }
    if (addIndent) {
      currentLine = indent(contIndentLen);
      currentLength = contIndentLen;
    }
    else {
      currentLine = '';
      currentLength = 0;
    }
  };

  const addToken = (token: string, addIndent = true) => {
    if (currentLength + token.length + 1 > maxLength) {
      flushLine(true, addIndent);
    }
    if (currentLength > contIndentLen) {
      currentLine += ' ';
      currentLength++;
    }
    currentLine += token;
    currentLength += token.length;
  };

  const breakLongName = (name: string) => {
    const maxChunk = maxLength - contIndentLen - 3;
    let pos = 0;
    while (pos < name.length) {
      const chunkLen = Math.min(name.length - pos, maxChunk);
      const chunk = name.slice(pos, pos + chunkLen);
      const suffix = pos + chunkLen < name.length ? '...' : '';
      if (pos === 0) {
        addToken(chunk + suffix);
      } else {
        flushLine();
        currentLine += chunk + suffix;
        currentLength = contIndentLen + chunk.length + suffix.length;
      }
      pos += chunkLen;
    }
  };

  const breakQuotedString = (literal: string, maxLineLen: number, indentLen: number): string[] => {
    // const text = literal.slice(1, -1); // remove outer quotes
    const text = literal;
    const parts: string[] = [];
    let remaining = text;
    let continuator = '+';
    let indentSpace = '';

    while (remaining.length > 0) {
      const maxChunk = maxLineLen - indentLen - 3; // account for ' +' or +'
      if (remaining.length <= maxChunk) {
        if (continuator === '-') {
          indentSpace = indent(7);
        }
        else {
          indentSpace = indent(indentLen);
        }
        parts.push(indentSpace + remaining.trimEnd());
        break;
      }

      let splitPos = remaining.lastIndexOf(' ', maxChunk);

      // If no nearby blank, just break at maxChunk
      if (splitPos === -1 || maxChunk - splitPos > 10) {
        splitPos = maxChunk;
      }

      // Avoid breaking escaped quotes
      while (remaining[splitPos - 1] === "'" && remaining[splitPos] === "'") {
        splitPos++;
      }

      indentSpace = indent(indentLen);
      // was prior continuator -? Then only ident 7
      if (continuator === '-') {
        indentSpace = indent(7);
      }

      continuator = '+';

      if (remaining.length > splitPos + 1) {
        if (remaining[splitPos + 1] === ' ') {
          continuator = '-';
        }
      }
      // parts.push(remaining.slice(0, splitPos).trimEnd());
      parts.push(indentSpace + remaining.slice(0, splitPos + 1) + continuator);
      remaining = remaining.slice(splitPos + 1);
    }

    return parts;
  };

   // Separate comment from code
  const { code, comment } = extractComment(input);
  const tokens = code.match(/'([^']|'')*'|[^\s]+/g) || [];
  if (comment) {
    result.push(indent(12) + comment);
  }
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    // Handle quoted string literals
    if (token.startsWith("'") && token.endsWith("'")) {

      // Determine if the full quoted string fits on the current line
      if (currentLength + token.length <= maxLength) {
        addToken(token); // Add it as-is
        continue;
      }

      const pieces = breakQuotedString(token, maxLength, contIndentLen);
      pieces.forEach(part => addToken(part, false));
      continue;
    }

    // Handle long names
    else if (isValidRPGName(token) && token.length > (maxLength - currentLength)) {
      breakLongName(token);
      continue;
    }

    // Everything else
    else {
      addToken(token);
    }
  }

  flushLine();

  // Ensure semicolon terminates final statement
  if (result.length > 0 && !result[result.length - 1].trimEnd().endsWith(';')) {
    result[result.length - 1] = result[result.length - 1].trimEnd() + ';';
  }

  return result;
}