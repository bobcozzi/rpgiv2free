// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 1996-2026 by R. Cozzi, Jr.

const EXEC_SQL_LINE_RX = /^\s*(?:\/\s*)?exec\s+sql\b/i;
const END_EXEC_LINE_RX = /^\s*\/\s*end-exec\b/i;
const FIXED_SPEC_RX = /^.{5}[HFDICOPcdfhiopcn]/i;
const COL7_DIR_RX = /^.{6}\//;
const FREE_DIR_RX = /^\*\*FREE\s*$/i;

function extractComment(line: string): { code: string } {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length - 1; i++) {
    const ch = line[i];
    const next = line[i + 1];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;
    if (ch === '/' && next === '/' && !inSingle && !inDouble) {
      return { code: line.substring(0, i).trimEnd() };
    }
  }
  return { code: line };
}

function isInsideOpenString(text: string): boolean {
  let inStr = false;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "'") {
      if (inStr && text[i + 1] === "'") i++;
      else inStr = !inStr;
    }
  }
  return inStr;
}

/** Collect physical lines belonging to one free-format RPG statement. */
export function collectFreeStmt(
  lines: string[],
  startIndex: number,
  shouldStopAtOpcode?: (line: string) => boolean
): { stmtText: string; nextIndex: number } {
  const parts: string[] = [];
  let i = startIndex;

  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (trimmed.startsWith('//')) {
      if (parts.length === 0) {
        parts.push(trimmed);
        i++;
      }
      break;
    }

    if (parts.length > 0) {
      if (trimmed === '' || EXEC_SQL_LINE_RX.test(trimmed) || END_EXEC_LINE_RX.test(trimmed) ||
        (raw.length >= 6 && FIXED_SPEC_RX.test(raw)) || FREE_DIR_RX.test(trimmed) ||
        (raw.length >= 7 && COL7_DIR_RX.test(raw)) || shouldStopAtOpcode?.(raw)) break;
    }

    const { code } = extractComment(trimmed);
    parts.push(trimmed);
    i++;
    if (code.trimEnd().endsWith(';')) break;
  }

  let stmtText = '';
  for (const part of parts) {
    if (stmtText === '') {
      stmtText = part;
      continue;
    }
    if (stmtText.trimEnd().endsWith('...')) {
      stmtText = stmtText.trimEnd().slice(0, -3) + part;
      continue;
    }
    const prevCode = extractComment(stmtText).code.trimEnd();
    if (isInsideOpenString(prevCode) && (prevCode.endsWith('+') || prevCode.endsWith('-'))) {
      stmtText = stmtText.slice(0, prevCode.length - 1) + part;
      continue;
    }
    stmtText += ' ' + part;
  }
  stmtText = stmtText.replace(/\s+/g, ' ').trim();
  return { stmtText, nextIndex: i };
}
