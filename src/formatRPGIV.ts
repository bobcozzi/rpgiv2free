/**
 * MIT License
 *
 * Copyright (c) 2025 Robert Cozzi, Jr.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import * as vscode from 'vscode';
import * as rpgiv from './rpgtools';
import { wrapSQLBody } from './collectSQLSpec';

// The national-variant identifier characters are now driven by the
// `rpgiv2free.nationalVariantChars` VS Code setting (see rpgtools.ts).
// The default covers all known IBM i single-byte CCSIDs; the constant
// below is kept only as a named reference for any code that still needs
// a plain string (e.g. for display).  All regex patterns use
// rpgiv.getIdentClasses() at call time so they automatically pick up
// any user customisation without requiring a restart.
export const RPG_NAME_VARIANT_CHARS = rpgiv.DEFAULT_VARIANT_CHARS;

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

// Structural / control-flow / declarative keywords that are recognized as
// RPG IV keywords but do NOT trigger an extra indent level.
// Kept at module scope so applyLineCasing can also use it.
const NO_INDENT_KEYWORDS = new Set([
  // Conditionals and loops
  'IF', 'ELSEIF', 'ELSE', 'ENDIF',
  'DOW', 'DOU', 'DO', 'ENDDO',
  'FOR', 'FOR-EACH', 'ENDFOR',
  'SELECT', 'WHEN', 'OTHER', 'ENDSL',
  'ITER', 'LEAVE',
  // Subroutines / procedures
  'BEGSR', 'ENDSR',
  'DCL-PROC', 'END-PROC',
  // Error handling
  'MONITOR', 'ON-ERROR', 'ON-EXIT', 'ENDMON',
  // Jumps
  'GOTO', 'TAG',
  // Declarations / control options
  'CTL-OPT',
  'DCL-S', 'DCL-DS', 'DCL-C', 'DCL-F',
  'DCL-PR', 'DCL-PI', 'DCL-ENUM',
  'END-DS', 'END-PR', 'END-PI', 'END-ENUM',
  'WHEN-IS', 'WHEN-IN',
]);

function shouldIndentStatement(firstToken: string): boolean {
  if (!firstToken) return false;
  const tok = firstToken.toUpperCase().replace(/\(.*\)$/, '').replace(/;$/, '');
  // Comments are never indented
  if (tok.startsWith('//')) return false;
  // Boolean comparison opcodes (IFxx, DOWxx, DOUxx, WHENxx, ANDxx, ORxx, CASxx)
  if (/^(IF|DOW|DOU|WHEN|AND|OR)(EQ|NE|GT|LT|GE|LE)$/.test(tok)) return false;
  if (/^CAS(EQ|NE|GT|LT|GE|LE)?$/.test(tok)) return false;
  if (NO_INDENT_KEYWORDS.has(tok)) return false;
  // Everything else is an action statement — indent it
  return true;
}

export const formatRPGIV = (input: string, splitOffComments: boolean = false, indentOffset: number = 0, skipAutoIndent: boolean = false): string[] => {
  const config = rpgiv.getRPGIVFreeSettings();
  let firstIndentLen = config.leftMargin - 1;
  let contIndentLen = config.leftMarginContinued - 1;
  const rightMargin = config.rightMargin;
  const dirIndent = config.indentDir;

  const indent = (n: number) => ' '.repeat(n);
  const result: string[] = [];

  const { start: vStart, cont: vCont } = rpgiv.getIdentClasses(config.nationalVariantChars);

  const isValidRPGName = (token: string) =>
    new RegExp(`^[${vStart}][${vCont}]{0,4095}$`, 'i').test(token);

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

    // Special handling for parens
    const isClosingParen = token === ')';
    const isOpeningParen = token === '(';

    // If adding this token would exceed the right margin
    if (currentLength + tokenLen > rightMargin) {
      // Keep closing parens with previous content even if exceeding margin
      if (isClosingParen && currentLine.trim().length > 0) {
        currentLine += token + tokenSpacer;
        currentLength += tokenLen;
        return;
      }

      // Keep opening parens with previous token (function name) if possible
      if (isOpeningParen && currentLine.trim().length > 0) {
        // Check if previous token looks like a function name (%SUBST, %BITOR, etc.)
        const trimmed = currentLine.trimEnd();
        if (/[A-Z0-9_]$/i.test(trimmed)) {
          // Keep the ( with the function name
          currentLine += token + tokenSpacer;
          currentLength += tokenLen;
          return;
        }
      }

      // For all other tokens, flush if there's content on the line
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
  if (!bIsDir && !skipAutoIndent) {
    const firstToken = code.trim().split(/\s+/)[0] ?? '';
    if (shouldIndentStatement(firstToken)) {
      firstIndentLen += 2;
      contIndentLen += 2;
    }
  }
  firstIndentLen += indentOffset;
  contIndentLen += indentOffset;

  let currentLine = indent(firstIndentLen);
  let currentLength = firstIndentLen;
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

    const { tokens, spacers } = tokenizeWithSpacing(code, config.nationalVariantChars);

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
        // Preserve the spacer that follows this token so the next token (e.g. the
        // data type) is not smashed directly against the variable name.
        if (spacers[i]) {
          currentLine += spacers[i];
          currentLength += spacers[i].length;
        }
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
function tokenizeWithSpacing(line: string, variantChars: string): { tokens: string[], spacers: string[] } {
  const tokens: string[] = [];
  const spacers: string[] = [];
  const { start: vs, cont: vc } = rpgiv.getIdentClasses(variantChars);
  // This regex matches quoted strings, identifiers, keywords, operators, punctuation, and whitespace.
  const regex = new RegExp(
    `(%[A-Z][A-Z0-9]*\\()|(%[A-Z][A-Z0-9]*)|([XB]'([^']|'')*')|('([^']|'')*')|(\\*IN[A-Z0-9]{2})|(\\*IN\\([^)]+\\))|(\\*[${vs}][${vc}]*)|[${vs}][${vc}]*|(\\+=|-=|\\*=|\\/=|%=|==|<=|>=|<>|!=)|[(){}\\[\\]+\\-*\\/=<>:,;]|[^\\s${vc}]+|\\s+`,
    'gi'
  );

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

// ─────────────────────────────────────────────────────────────────────────────
// Free-format document formatter helpers
// ─────────────────────────────────────────────────────────────────────────────

// Compound single-word RPG IV keywords split into [prefix, suffix] for
// case styling.  prefix = structural part (end/else/beg), suffix = semantic part.
// camel  → prefix lower  + suffix initcap  → endIf, elseIf, begSr
// initcap → prefix initcap + suffix initcap → EndIf, ElseIf, BegSr
const COMPOUND_KEYWORD_PARTS: Record<string, [string, string]> = {
  'ENDIF':  ['end',  'If'],
  'ENDDO':  ['end',  'Do'],
  'ENDFOR': ['end',  'For'],
  'ENDSL':  ['end',  'Sl'],
  'ENDMON': ['end',  'Mon'],
  'ENDSR':  ['end',  'Sr'],
  'ENDPROC':['end',  'Proc'],
  'ELSEIF': ['else', 'If'],
  'BEGSR':  ['beg',  'Sr'],
};

/** Apply the configured opcode case style to a single token. */
export function applyOpcodeCase(token: string, style: string): string {
  const up = token.toUpperCase();
  switch (style) {
    case 'upper': return up;
    case 'lower': return token.toLowerCase();
    case 'camel': {
      // Compound single-word keywords: prefix lowercase + suffix initcap
      // e.g. ENDIF → endIf, ELSEIF → elseIf, BEGSR → begSr
      if (COMPOUND_KEYWORD_PARTS[up]) {
        const [pre, suf] = COMPOUND_KEYWORD_PARTS[up];
        return pre + suf;
      }
      // hyphenated tokens: first segment lowercase, rest initcap → dcl-Ds, end-Ds
      const parts = up.split('-');
      if (parts.length > 1) {
        return parts.map((p, i) =>
          i === 0 ? p.toLowerCase() : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
        ).join('-');
      }
      // plain single-word tokens: initcap → Eval, Chain, If
      return parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
    }
    case 'initcap': {
      // Compound single-word keywords: both prefix and suffix initcap
      // e.g. ENDIF → EndIf, ELSEIF → ElseIf, BEGSR → BegSr
      if (COMPOUND_KEYWORD_PARTS[up]) {
        const [pre, suf] = COMPOUND_KEYWORD_PARTS[up];
        return pre.charAt(0).toUpperCase() + pre.slice(1) + suf;
      }
      // hyphenated or plain: capitalise first letter of each segment, rest lowercase
      return up.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join('-');
    }
    default: return token.toLowerCase();
  }
}

type TokenRole = 'opener' | 'closer' | 'midblock' | 'action';

const OPENERS = new Set([
  'IF', 'DOW', 'DOU', 'DO', 'FOR', 'FOR-EACH',
  'SELECT', 'MONITOR', 'BEGSR', 'DCL-PROC',
  'DCL-DS', 'DCL-PR', 'DCL-PI', 'DCL-ENUM',
]);
const CLOSERS = new Set([
  'ENDIF', 'ENDDO', 'ENDFOR', 'ENDSL', 'ENDMON',
  'ENDSR', 'END-PROC', 'END-DS', 'END-PR', 'END-PI', 'END-ENUM',
]);
const MIDBLOCKS = new Set([
  'ELSEIF', 'ELSE',
  'WHEN', 'WHEN-IS', 'WHEN-IN', 'OTHER',
  'ON-ERROR', 'ON-EXIT',
]);

// Legacy Boolean-comparison opcodes (IFxx, DOWxx etc.) are openers
const BOOL_OPENER_RX = /^(IF|DOW|DOU|WHEN|AND|OR)(EQ|NE|GT|LT|GE|LE)$/;

function getTokenRole(tok: string): TokenRole {
  const up = tok.toUpperCase().replace(/[;(].*/, '').replace(/\(.*\)$/, '');
  if (CLOSERS.has(up)) return 'closer';
  if (MIDBLOCKS.has(up)) return 'midblock';
  if (OPENERS.has(up) || BOOL_OPENER_RX.test(up)) return 'opener';
  return 'action';
}

/** Apply opcode case to the first token of a free-format RPG IV line,
 *  but only when that token is a recognized RPG IV keyword/opcode.
 *  User-defined names (subfield names, variable names, etc.) are never
 *  case-converted. */
function applyLineCasing(line: string, style: string): string {
  if (style === 'lower' || !line.trim()) return line;
  const trimmed = line.trimStart();
  const leadingSpaces = line.length - trimmed.length;
  const m = trimmed.match(/^([A-Z][A-Z0-9\-]*)/i);
  if (!m) return line;
  const tok = m[1];
  const up = tok.toUpperCase();
  // Only restyle the token when it is a known RPG IV keyword/opcode.
  // Variable names and subfield names that happen to be first on a line
  // must never have their case altered.
  const isKnownKeyword =
    OPENERS.has(up) ||
    CLOSERS.has(up) ||
    MIDBLOCKS.has(up) ||
    BOOL_OPENER_RX.test(up) ||
    NO_INDENT_KEYWORDS.has(up) ||   // DCL-F, DCL-S, DCL-C, GOTO, etc.
    shouldIndentStatement(up);       // action opcodes like CHAIN, EVAL, etc.
  if (!isKnownKeyword) return line;
  const rest = trimmed.slice(tok.length);
  return ' '.repeat(leadingSpaces) + applyOpcodeCase(tok, style) + rest;
}

// Match both free-format (exec sql) and column-7 (/exec sql) starts
const EXEC_SQL_LINE_RX = /^\s*(?:\/\s*)?exec\s+sql\b/i;
const END_EXEC_LINE_RX = /^\s*\/\s*end-exec\b/i;
// Fixed-format spec: column 6 (0-based index 5) is a spec letter
const FIXED_SPEC_RX = /^.{5}[HFDICOPcdfhiopcn]/i;
// Classic directive: col 7 (0-based index 6) is '/'
const COL7_DIR_RX = /^.{6}\//;
// **FREE line
const FREE_DIR_RX = /^\*\*FREE\s*$/i;

/**
 * Returns true when the already-collected logical statement `stmtText`
 * contains the matching END-xx for the given DCL-xx opener, meaning the
 * declaration is self-contained (no child statements follow).
 */
function isInlineDeclaration(stmtText: string, openerTok: string): boolean {
  const closerMap: Record<string, string> = {
    'DCL-DS':   'END-DS',
    'DCL-PR':   'END-PR',
    'DCL-PI':   'END-PI',
    'DCL-ENUM': 'END-ENUM',
  };
  const closer = closerMap[openerTok];
  if (!closer) return false;
  const closerRx = new RegExp(`(?<![A-Z0-9_-])${closer.replace('-', '\\-')}(?![A-Z0-9_-])`);
  return closerRx.test(stmtText.toUpperCase());
}

/**
 * Returns true when `text` ends inside an open RPG IV single-quoted string
 * literal, i.e. there is an odd number of unescaped single-quote characters.
 */
function isInsideOpenString(text: string): boolean {
  let inStr = false;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "'") {
      // A doubled quote ('') inside a string is an escaped quote — skip the pair.
      if (inStr && i + 1 < text.length && text[i + 1] === "'") {
        i++;
      } else {
        inStr = !inStr;
      }
    }
  }
  return inStr;
}

/**
 * Collects physical lines starting at `startIndex` that together form one
 * RPG IV free-format logical *statement* — everything up to and including
 * the physical line whose code portion (after stripping any trailing inline
 * comment) ends with `;`.
 *
 * Collection stops early (without consuming the triggering line) when a
 * continuation line would start a new context: blank line, comment-only
 * line, EXEC SQL opener, fixed-format spec, **FREE, or column-7 directive.
 * A comment-only line as the very first line is returned as a standalone
 * single-line statement.
 */
function collectFreeStmt(lines: string[], startIndex: number): { stmtText: string; nextIndex: number } {
  const parts: string[] = [];
  let i = startIndex;

  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();

    // Comment-only lines are always standalone — return immediately if first
    // line, or stop collection if encountered mid-statement.
    if (trimmed.startsWith('//')) {
      if (parts.length === 0) {
        parts.push(trimmed);
        i++;
      }
      break;
    }

    // Mid-collection: stop before any line that starts a new context.
    if (parts.length > 0) {
      if (trimmed === '') break;
      if (EXEC_SQL_LINE_RX.test(trimmed)) break;
      if (END_EXEC_LINE_RX.test(trimmed)) break;
      if (raw.length >= 6 && FIXED_SPEC_RX.test(raw)) break;
      if (FREE_DIR_RX.test(trimmed)) break;
      if (raw.length >= 7 && COL7_DIR_RX.test(raw)) break;
    }

    // Strip inline comment to find the real statement terminator.
    const { code } = extractComment(trimmed);
    parts.push(trimmed);
    i++;

    if (code.trimEnd().endsWith(';')) break;
  }

  // Join physical lines into one logical statement, respecting RPG IV
  // continuation conventions:
  //   '...'  at end of a line  — name continuation:   strip '...', join directly
  //   '+'    at end of code    — string continuation:  strip '+',   join directly
  //   '-'    at end of code    — string continuation:  strip '-',   join with next part leading-whitespace trimmed
  let stmtText = '';
  for (const part of parts) {
    if (stmtText === '') {
      stmtText = part;
      continue;
    }
    // Name-continuation marker
    if (stmtText.trimEnd().endsWith('...')) {
      stmtText = stmtText.trimEnd().slice(0, -3) + part;
      continue;
    }
    // String-literal continuation: only applies when we are inside an open string
    const prevCode = extractComment(stmtText).code.trimEnd();
    if (isInsideOpenString(prevCode)) {
      if (prevCode.endsWith('+')) {
        // Strip the trailing '+' (the continuation marker, not string content)
        stmtText = stmtText.slice(0, prevCode.length - 1) + part;
        continue;
      }
      if (prevCode.endsWith('-')) {
        // Strip the trailing '-' and concatenate the next part as-is, preserving
        // its leading whitespace (position 1 of the next physical line is the
        // next character in the string value).
        stmtText = stmtText.slice(0, prevCode.length - 1) + part;
        continue;
      }
    }
    // Default: join with a single space
    stmtText = stmtText + ' ' + part;
  }
  stmtText = stmtText.replace(/\s+/g, ' ').trim();

  return { stmtText, nextIndex: i };
}

/**
 * Format an entire RPG IV free-format document with nesting-aware indentation.
 * Returns the new lines array.  The caller is responsible for replacing the
 * document content.
 */
export function formatRPGIVDocument(lines: string[]): string[] {
  const config = rpgiv.getRPGIVFreeSettings();
  const INDENT = config.indentSize;
  const caseStyle = config.opcodeCase;
  const result: string[] = [];
  let depth = 0;
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();

    // Blank line
    if (trimmed === '') {
      result.push('');
      i++;
      continue;
    }

    // **FREE directive — preserve as-is
    if (FREE_DIR_RX.test(trimmed)) {
      result.push(raw);
      i++;
      continue;
    }

    // Fixed-format spec (col 6 is a spec letter) — round-trip
    if (raw.length >= 6 && FIXED_SPEC_RX.test(raw)) {
      result.push(raw);
      i++;
      continue;
    }

    // Column-7 classic directive (e.g. /COPY, /INCLUDE, /EJECT) — round-trip
    if (raw.length >= 7 && COL7_DIR_RX.test(raw) && !EXEC_SQL_LINE_RX.test(trimmed) && !END_EXEC_LINE_RX.test(trimmed)) {
      result.push(raw);
      i++;
      continue;
    }

    // EXEC SQL block — collect body, reformat via wrapSQLBody, shift by nesting depth
    if (EXEC_SQL_LINE_RX.test(trimmed)) {
      // Strip the "exec sql" opener and any trailing RPG-statement semicolon from that same line.
      // A bare `exec sql;` has the `;` as the RPG statement terminator, not SQL content.
      const inlineSQL = trimmed
        .replace(/^\/?\s*exec\s+sql\b\s*/i, '')
        .replace(/;\s*$/, '')
        .trim();

      const sqlParts: string[] = [];
      if (inlineSQL) sqlParts.push(inlineSQL);

      let hasEndExec = false;
      i++;

      // Collect body lines.  Stop on whichever comes first:
      //   1. /END-EXEC  — explicit block terminator (set hasEndExec, advance i)
      //   2. A new EXEC SQL line — implicit start of next block; do NOT consume it
      //   3. A body line ending with `;` — SQL statement terminator (collect it, then stop)
      //   4. EOF
      while (i < lines.length) {
        const sqlRaw = lines[i];
        const sqlTrimmed = sqlRaw.trim();

        if (END_EXEC_LINE_RX.test(sqlTrimmed)) {
          hasEndExec = true;
          i++;
          break;
        }

        // Next EXEC SQL encountered — leave it for the outer loop to handle
        if (EXEC_SQL_LINE_RX.test(sqlTrimmed)) {
          break;
        }

        if (sqlTrimmed) sqlParts.push(sqlTrimmed);
        i++;

        // SQL statement terminator — body ends here (no /END-EXEC style)
        if (sqlTrimmed.endsWith(';')) break;
      }

      const flatSQL = sqlParts.join(' ').replace(/\s+/g, ' ').trim();
      if (flatSQL) {
        const wrappedSQL = wrapSQLBody(flatSQL);
        const extraIndent = ' '.repeat(depth * INDENT);
        result.push(...wrappedSQL.map(ln => extraIndent + ln));
      }
      if (hasEndExec) {
        result.push('/END-EXEC');
      }
      continue;
    }

    // Free-format directive (e.g. /IF, /DEFINE, /INCLUDE in free-format style)
    if (rpgiv.isDirective(trimmed, true)) {
      // Use formatRPGIV with skipAutoIndent so directive indent is applied normally
      const formatted = formatRPGIV(trimmed, false, 0, true);
      result.push(...formatted);
      i++;
      continue;
    }

    // Regular free-format statement.
    // The first token is on the first physical line — enough for role analysis.
    // Then collect ALL physical lines of this logical statement so the full
    // text is passed to formatRPGIV as one unit (avoids spurious semicolons on
    // continuation lines of multi-line statements like long DCL-S names).
    const firstTok = (trimmed.split(/\s+/)[0] ?? '').toUpperCase().replace(/[;(].*/, '').replace(/\(.*\)$/, '');

    const { stmtText, nextIndex: nextI } = collectFreeStmt(lines, i);

    let role: TokenRole = getTokenRole(firstTok);
    if (firstTok === 'DCL-DS' || firstTok === 'DCL-PR' || firstTok === 'DCL-PI' || firstTok === 'DCL-ENUM') {
      if (isInlineDeclaration(stmtText, firstTok)) {
        role = 'action';
      }
    }

    // Keywords that must always sit at the left margin (depth 0), regardless
    // of what block depth the surrounding code is at.
    const ALWAYS_ZERO_DEPTH = new Set(['CTL-OPT']);

    let displayDepth: number;
    if (ALWAYS_ZERO_DEPTH.has(firstTok)) {
      displayDepth = 0;
    } else switch (role) {
      case 'closer':
        depth = Math.max(0, depth - 1);
        displayDepth = depth;
        break;
      case 'midblock':
        displayDepth = Math.max(0, depth - 1);
        break;
      case 'opener':
        displayDepth = depth;
        depth++;
        break;
      default: // action
        displayDepth = depth;
    }

    const casedStmt = applyLineCasing(stmtText, caseStyle);
    const formatted = formatRPGIV(casedStmt, false, displayDepth * INDENT, true);
    result.push(...formatted);
    i = nextI;
  }

  return result;
}

function tokenizeWithSpacing_ALT2(line: string, variantChars: string): { tokens: string[], spacers: string[] } {
  const tokens: string[] = [];
  const spacers: string[] = [];
  const { start: vs2, cont: vc2 } = rpgiv.getIdentClasses(variantChars);
  // Regex: match quoted strings, identifiers, numbers, keywords, operators, and punctuation, then any following whitespace (including none)
  const regex = new RegExp(
    `('([^']|'')*'|\\*IN\\d{2}|\\*[A-Z0-9_]+|[${vs2}][${vc2}]*|\\d+(\\.\\d+)?|(\\+=|-=|\\*=|\\/=|%=|==|<=|>=|<>|!=)|[(){}\\[\\]+\\-*/=<>:,;]|[^\\s${vc2}]+)(\\s*)`,
    'gi'
  );

  let match: RegExpExecArray | null;
  while ((match = regex.exec(line)) !== null) {
    tokens.push(match[1]);
    spacers.push(match[match.length - 1] || '');
  }
  return { tokens, spacers };
}
