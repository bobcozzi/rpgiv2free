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


function tokenizeWithSpacing(line: string): { tokens: string[], spacers: string[] } {
  const tokens: string[] = [];
  const spacers: string[] = [];

  // Match quoted literals (X'...' or '...') first (handles doubled single quotes ''), then identifier-with-parens,
  // then other token types. This keeps whole quoted strings together.
  const regex = /([XB]?'(?:[^']|'')*')|([A-Z#$@][A-Z0-9#$@_]*\([^()]*\))|(%[A-Z][A-Z0-9]*\()|(%[A-Z][A-Z0-9]*)|([A-Z#$@][A-Z0-9#$@_]*)|([+-]?\d+(\.\d+)?)|("([^"]|"")*")|(\+=|-=|\*=|\/=|%=|==|<=|>=|<>|!=)|[(){}\[\]+\-*\/=<>:,;]|[^\sA-Z0-9_]+|\s+/gi;

  let match: RegExpExecArray | null;
  let lastIndex = 0;
  while ((match = regex.exec(line)) !== null) {
    const part = match[0];
    const start = match.index;
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
      if (tokens.length > 0) {
        spacers[spacers.length - 1] += part;
      }
    }
    lastIndex = start + part.length;
  }
  if (lastIndex < line.length && tokens.length > 0) {
    spacers[spacers.length - 1] += line.slice(lastIndex);
  }
  while (spacers.length < tokens.length) spacers.push('');

  return { tokens, spacers };
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

  // Helper: find last index of a char that is not inside single/double quotes
  const lastUnquotedIndexOf = (s: string, ch: string, from?: number): number => {
    let inSingle = false;
    let inDouble = false;
    const end = typeof from === 'number' ? from : s.length - 1;
    for (let i = end; i >= 0; i--) {
      const c = s[i];
      if (c === "'" && !inDouble) inSingle = !inSingle;
      else if (c === '"' && !inSingle) inDouble = !inDouble;
      else if (!inSingle && !inDouble && c === ch) return i;
    }
    return -1;
  };

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
    let margin = rightMargin;

    if (currentLength + tokenLen >= margin && currentLength + tokenLen < srcRcdLen) {
      margin = srcRcdLen;
   //   flushLine(true, addIndent);
    }
    if (currentLength + tokenLen > margin) { // &&    !isSpecialPrefixToken(token)) {
      if (currentLine.trim().length > 0) {
        flushLine(true, addIndent);
      }
      currentLine += token + tokenSpacer;
      currentLength = contIndentLen + tokenLen;
      return;
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


  let { code, comment } = extractComment(input);

  const bIsDir = rpgiv.isDirective(input, true); // check free format style for directives, only
  if (bIsDir) {
    result.push(indent(dirIndent) + input.trim());
  }
  else {
    if (code.trim() !== '' && !code.trimEnd().endsWith(';')) {
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

        // const spaceBetween = (pieces.length == 1) ? spacers[i] : '';
        const pieces = breakQuotedString(token, rightMargin, contIndentLen);
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
    if (!rpgiv.isComment(result[result.length - 1])) {

      // NOTE: Use the top-level lastUnquotedIndexOf defined above; do NOT re-declare it here.

      const lastIdx = result.length - 1;
      let lastLine = result[lastIdx];
      // wouldFit tries rightMargin first, then srcRcdLen as a fallback when requested
      const wouldFit = (line: string, allowRecordFallback = false) => {
        const len = line.trimEnd().length + 1; // +1 for ';'
        if (len <= rightMargin) return true;
        if (allowRecordFallback) return len <= srcRcdLen;
        return false;
      };

      // If semicolon would fit in the cosmetic margin, just append it
      if (wouldFit(lastLine, false)) {
        result[lastIdx] = lastLine.trimEnd() + ';';
      } else {
        // FIRST: Try to find any existing recent line (preferring one ending with ')')
        // where the semicolon can be appended (try cosmetic margin first, then record length).
        let appended = false;
        for (let j = lastIdx; j >= 0; j--) {
          const cand = result[j];
          if (!cand || cand.trim() === '') continue;
          if (rpgiv.isComment(cand)) continue;
          // Prefer appending to a line that ends with ')' (common case for your examples)
          if (cand.trimEnd().endsWith(')')) {
            if (wouldFit(cand, false) || wouldFit(cand, true)) {
              result[j] = cand.trimEnd() + ';';
              appended = true;
              break;
            }
          }
        }
        // If not found a ')' ending line, try any prior non-comment non-empty line
        if (!appended) {
          for (let j = lastIdx; j >= 0; j--) {
            const cand = result[j];
            if (!cand || cand.trim() === '') continue;
            if (rpgiv.isComment(cand)) continue;
            if (wouldFit(cand, false) || wouldFit(cand, true)) {
              result[j] = cand.trimEnd() + ';';
              appended = true;
              break;
            }
          }
        }

        if (!appended) {
          // FALLBACK: original splitting logic (attempt to break before colon/space or move token)
          // Try to back up to an unquoted ':' or space after the last '(' of the keyword.
          const lp = lastLine.lastIndexOf('(');
          // Find last unquoted colon before end
          let splitPos = lastUnquotedIndexOf(lastLine, ':', lastLine.length - 1);

          // If no colon found after lp, try last unquoted space
          if (splitPos <= lp) {
            splitPos = lastUnquotedIndexOf(lastLine, ' ', lastLine.length - 1);
          }

          if (splitPos > lp) {
            // Break at splitPos (include the split char at end of first line)
            const left = lastLine.substring(0, splitPos + 1).trimEnd();
            const right = lastLine.substring(splitPos + 1).trim();
            result[lastIdx] = left;
            result.push(indent(contIndentLen) + right);

            // Now attempt to append semicolon to the (possibly new) last line
            const finalIdx = result.length - 1;
            if (wouldFit(result[finalIdx], false)) {
              // fits within cosmetic margin
              result[finalIdx] = result[finalIdx].trimEnd() + ';';
            } else if (wouldFit(result[finalIdx], true)) {
              // doesn't fit cosmetic margin but fits physical record length - use it
              result[finalIdx] = result[finalIdx].trimEnd() + ';';
            } else {
              // As a fallback, append semicolon to the previous (left) line if it fits
              if (wouldFit(result[lastIdx], false)) {
                result[lastIdx] = result[lastIdx].trimEnd() + ';';
              } else if (wouldFit(result[lastIdx], true)) {
                result[lastIdx] = result[lastIdx].trimEnd() + ';';
              } else {
                // Give up and append semicolon on a new line (ugly but safe)
                result.push(indent(contIndentLen) + ';');
              }
            }
          } else {
            // No safe split before left paren — move the entire keyword to the next line.
            // Find start of the keyword (the last token that contains '(') and move it.
            const parenIdx = lastLine.lastIndexOf('(');
            // find token start (space before paren)
            let tokenStart = -1;
            if (parenIdx > 0) {
              tokenStart = lastLine.lastIndexOf(' ', parenIdx) + 1;
            }
            if (tokenStart <= 0) {
              // If can't find a sensible token boundary, just append semicolon on its own line
              result.push(indent(contIndentLen) + ';');
            } else {
              const left = lastLine.substring(0, tokenStart).trimEnd();
              const token = lastLine.substring(tokenStart).trim();
              result[lastIdx] = left;
              result.push(indent(contIndentLen) + token);
              // append semicolon to new token line if it fits (try cosmetic margin first, then record length)
              const finalIdx = result.length - 1;
              if (wouldFit(result[finalIdx], false)) {
                result[finalIdx] = result[finalIdx].trimEnd() + ';';
              } else if (wouldFit(result[finalIdx], true)) {
                result[finalIdx] = result[finalIdx].trimEnd() + ';';
              } else if (wouldFit(result[lastIdx], false)) {
                result[lastIdx] = result[lastIdx].trimEnd() + ';';
              } else if (wouldFit(result[lastIdx], true)) {
                result[lastIdx] = result[lastIdx].trimEnd() + ';';
              } else {
                result.push(indent(contIndentLen) + ';');
              }
            }
          }
        }
      }
    }
  }
  // Post-process: if the final line is only a semicolon, move the previous token to a new continuation
  const lastIdx = result.length - 1;
  if (lastIdx >= 0 && /^\s*;\s*$/.test(result[lastIdx])) {
    // remove the semicolon-only line and attempt to attach it to the last meaningful token
    for (let j = lastIdx - 1; j >= 0; j--) {
      const cand = result[j];
      if (!cand || cand.trim() === '') continue;
      if (rpgiv.isComment(cand)) continue;

      // Split by whitespace to find last token on the line.
      // Use regex split to preserve tokens like KEYED(*CHAR:14) intact.
      const tokens = cand.trimEnd().split(/\s+/);
      if (tokens.length > 1) {
        const lastToken = tokens.pop()!;
        const leftPart = tokens.join(' ');
        const leading = (cand.match(/^\s*/) || [''])[0];

        // Replace the line with the left part (preserve leading indentation)
        result[j] = (leading + leftPart).trimEnd();

        // Create new continuation line with moved token + semicolon
        const newLine = indent(contIndentLen) + lastToken + ';';

        // Remove the semicolon-only line and push the new combined line
        result.pop();
        result.push(newLine);
        break;
      }

      // If there's only one token on this line, try previous lines instead.
      // continue searching for a multi-token line to steal from.
    }
  }

  // Ensure final comment handling unchanged
  if (comment && !splitOffComments) {
    result.push(indent(contIndentLen) + comment);
  }

  return result;

}
