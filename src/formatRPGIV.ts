
import * as vscode from 'vscode';
import * as rpgiv from './rpgedit';

function extractComment(line: string): { code: string, comment: string | null } {
  let insideSingleQuote = false;
  let insideDoubleQuote = false;

  for (let i = 0; i < line.length - 1; i++) {
    const ch = line[i];
    const next = i + 1 < line.length ? line[i + 1] : '';

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
export const formatRPGIV = (input: string, splitOffComments: boolean = false): string[] => {
  const config = rpgiv.getRPGIVFreeSettings();
  const firstIndentLen = config.indentFirstLine - 1;
  const contIndentLen = config.indentContLines - 1;
  const rightMargin = config.rightMargin;
  const srcRcdLen = config.srcRcdLen;
  const dirIndent = config.indentDir;

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

  const isSpecialPrefixToken = (token: string) => {
    return token.startsWith('*') || token.startsWith('%');
  };

  const addToken = (token: string, tokenSpacer: string = '', addIndent = true) => {
    const tokenLen = token.length + tokenSpacer?.length;
    let margin = rightMargin;
    if (currentLength + token.length > margin && currentLength + token.length < srcRcdLen) {
      margin = srcRcdLen;
    }
    if (
      currentLength + token.length + 1 > margin &&
      !isSpecialPrefixToken(token)
    ) {
      flushLine(true, addIndent);
    }

    currentLine += token + tokenSpacer;
    currentLength += tokenLen;
  };

  const breakLongName = (name: string) => {
    const maxChunk = rightMargin - contIndentLen - 3;

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

  const { code, comment } = extractComment(input);
  const bIsDir = rpgiv.isDirective(input);
  if (bIsDir) {
    result.push(indent(dirIndent) + input.trim());
  }
  else {
    // Separate comment from code
    // const tokens = code.match(/'([^']|'')*'|[^\s]+/g) || [];
    const { tokens, spacers } = tokenizeWithSpacing(code);
    if (comment && splitOffComments) {
      result.push(indent(contIndentLen) + comment);
    }
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      // Handle quoted string literals
      if (token.startsWith("'") && token.endsWith("'")) {

        // Determine if the full quoted string fits on the current line
        if (currentLength + token.length <= rightMargin) {
          addToken(token, spacers[i]); // Add it as-is
          continue;
        }

        const pieces = breakQuotedString(token, rightMargin, contIndentLen);

        // const spaceBetween = (pieces.length == 1) ? spacers[i] : '';
        // pieces.forEach(part => addToken(part, spaceBetween, false));

        pieces.forEach((part, index) => {
          const isLast = index === pieces.length - 1;
          const spacer = isLast ? spacers[i] : '';
          addToken(part, spacer, false);
        });

        continue;
      }

      // Handle long names
      else if (isValidRPGName(token) && token.length > (rightMargin - currentLength)) {
        breakLongName(token);
        continue;
      }

      // Everything else
      else {
        addToken(token, spacers[i]);
      }
    }
    flushLine();
  }
    // Ensure semicolon terminates final statement
    if (!bIsDir && result.length > 0 && !result[result.length - 1].trimEnd().endsWith(';')) {
      result[result.length - 1] = result[result.length - 1].trimEnd() + ';';
    }
    if (comment && !splitOffComments) {
      result.push(indent(contIndentLen) + comment);
    }

    return result;

}

function tokenizeWithSpacing(line: string): { tokens: string[], spacers: string[] } {
  const tokens: string[] = [];
  const spacers: string[] = [];

  const tokenRegex1 = /('([^']|'')*')|(?<![A-Z0-9])[*%][A-Z_][A-Z0-9_]*|[A-Z0-9_]+|[(){}\[\]+\-*/=<>:,;]|[^\sA-Z0-9_](?=\s*)|(\s*)/gi;

  let match;
  const tokenRegex2 = /('([^']|'')*')|(?<![A-Z0-9])[*%][A-Z_][A-Z0-9_]*|[A-Z0-9_]+|[(){}\[\]+\-*/=<>:,;]|[^\sA-Z0-9_]/gi;
  const tokenRegex = /('([^']|'')*')|(?<![A-Z0-9])[*%][A-Z_][A-Z0-9_]*\(|[A-Z][A-Z0-9_]*\(|(?<![A-Z0-9])[*%][A-Z_][A-Z0-9_]*|[A-Z0-9_]+|[(){}\[\]+\-*/=<>:,;]|[^\sA-Z0-9_]/gi;
  const spacerRegex = /\s*/y;
  rpgiv.log(`Tokenizing: ${line}`);
  let pos = 0;
  let tokenCounter = 0;
  while (pos < line.length) {
    tokenRegex.lastIndex = pos;
    const tokenMatch = tokenRegex.exec(line);
    if (!tokenMatch) break;
    tokenCounter++;
    const token = tokenMatch[0];
    pos = tokenRegex.lastIndex;

    spacerRegex.lastIndex = pos;
    const spaceMatch = spacerRegex.exec(line);
    const spaces = spaceMatch?.[0] ?? '';
    pos = spacerRegex.lastIndex;
    // rpgiv.log(`Token: ${tokenCounter}: Spaces: ${spaces.length} => ${token}`);
    tokens.push(token);
    spacers.push(spaces);
  }

  return { tokens, spacers };
}
