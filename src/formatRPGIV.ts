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
  const firstIndentLen = config.leftMargin - 1;
  const contIndentLen = config.leftMarginContinued - 1;
  const rightMargin = config.rightMargin;
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
    const tokenLen = token.length + tokenSpacer.length;

    // If adding this token would exceed the right margin, flush the current line
    if (currentLength + tokenLen > rightMargin) {
        // Only flush if there's already content on the line
        if (currentLine.trim().length > 0) {
            flushLine(true, addIndent);
        }
    }

    // Now add the token
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

  let { code, comment } = extractComment(input);

  const bIsDir = rpgiv.isDirective(input, true); // check free format style for directives, only
  if (bIsDir) {
    result.push(indent(dirIndent) + input.trim());
  }
  else {
      if (code.trim()!== '' && !code.trimEnd().endsWith(';')) {
        code = code.trimEnd() + ';';
      }
    // Separate comment from code
    // const tokens = code.match(/'([^']|'')*'|[^\s]+/g) || [];
    // If total line is < rightMargin, the don't extract the comments
    if (
      comment &&
      comment.trim() !== '' &&
      input.trimEnd().length <= (rightMargin - firstIndentLen) + 1
    ) {
      code = code.trimEnd() + ' ' + comment.trim();
      comment = '';
    }
    if (comment && splitOffComments) {
      result.push(indent(contIndentLen) + comment);
    }

    const { tokens, spacers } = tokenizeWithSpacing(code);

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      // Handle quoted string literals
      // if (token.startsWith("'") && token.endsWith("'")) {
      if (/^(X|B)?'([^']|'')*'$/.test(token)) {

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

        // Post-process: if the final line is only a semicolon, move the previous token to a cont line with the semicolon.
        // Conservative: only steals the last whitespace-separated token from the nearest non-comment non-empty line.
        const lastIdx = result.length - 1;
        if (lastIdx >= 0 && /^\s*;\s*$/.test(result[lastIdx])) {
          for (let j = lastIdx - 1; j >= 0; j--) {
            const cand = result[j];
            if (!cand || cand.trim() === '') continue;
            if (rpgiv.isComment(cand)) continue;

            const leading = (cand.match(/^\s*/) || [''])[0];
            const body = cand.trimEnd();
            const parts = body.split(/\s+/);
            if (parts.length > 1) {
              // move last token to a continuation line and append semicolon
              const lastToken = parts.pop()!;
              const leftPart = parts.join(' ');
              result[j] = (leading + leftPart).trimEnd();
              // remove the lone semicolon line and push the new continuation line
              result.pop();
              result.push(indent(contIndentLen) + lastToken + ';');
              break;
            }
            // if only one token on this line, keep searching upward
          }
        }

  }

  // Ensure semicolon terminates final statement
  if (!bIsDir && result.length > 0 && !result[result.length - 1].trimEnd().endsWith(';')) {
    if (!rpgiv.isComment(result[result.length - 1])) {
      result[result.length - 1] = result[result.length - 1].trimEnd() + ';';
    }
  }
  if (comment && !splitOffComments) {
    result.push(indent(contIndentLen) + comment);
  }

  return result;

}
function tokenizeWithSpacing(line: string): { tokens: string[], spacers: string[] } {
  const tokens: string[] = [];
  const spacers: string[] = [];
  // This regex matches quoted strings, identifiers, keywords, operators, punctuation, and whitespace.
  const regex = /(%[A-Z][A-Z0-9]*\()|(%[A-Z][A-Z0-9]*)|([XB]'([^']|'')*')|('([^']|'')*')|(\*IN[A-Z0-9]{2})|(\*IN\([^)]+\))|(\*[A-Z#$@][A-Z0-9#$@_]*)|[A-Z#$@][A-Z0-9#$@_]*|(\+=|-=|\*=|\/=|%=|==|<=|>=|<>|!=)|[(){}\[\]+\-*\/=<>:,;]|[^\sA-Z0-9_]+|\s+/gi;

  let match: RegExpExecArray | null;
  let lastIndex = 0;
  while ((match = regex.exec(line)) !== null) {
    const part = match[0];
    const start = match.index;
    // If there is a gap between the last match and this one, it's whitespace
    if (start > lastIndex) {
      const space = line.slice(lastIndex, start);
      if (tokens.length > 0) {
        spacers[spacers.length - 1] += space;
      }
    }
    if (!/^\s+$/.test(part)) {
      tokens.push(part);
      spacers.push('');
    } else {
      // If it's whitespace, add it as a spacer for the previous token
      if (tokens.length > 0) {
        spacers[spacers.length - 1] += part;
      }
    }
    lastIndex = start + part.length;
  }
  // If there's trailing whitespace after the last token, add it as a spacer
  if (lastIndex < line.length && tokens.length > 0) {
    spacers[spacers.length - 1] += line.slice(lastIndex);
  }
  // Ensure spacers array matches tokens array length
  while (spacers.length < tokens.length) spacers.push('');

  return { tokens, spacers };
}

function tokenizeWithSpacing_ALT2(line: string): { tokens: string[], spacers: string[] } {
  const tokens: string[] = [];
  const spacers: string[] = [];
  // Regex: match quoted strings, identifiers, numbers, keywords, operators, and punctuation, then any following whitespace (including none)
  const regex = /('([^']|'')*'|\*IN\d{2}|\*[A-Z0-9_]+|[A-Z#$@][A-Z0-9#$@_]*|\d+(\.\d+)?|(\+=|-=|\*=|\/=|%=|==|<=|>=|<>|!=)|[(){}\[\]+\-*/=<>:,;]|[^\sA-Z0-9_]+)(\s*)/gi;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(line)) !== null) {
    tokens.push(match[1]);
    spacers.push(match[match.length - 1] || '');
  }
  return { tokens, spacers };
}
