

import { formatSQL } from './SQLFormatter';
import * as rpgiv from './rpgedit';
import * as vscode from 'vscode';


// Global regex constants for identifying embedded SQL
const EXEC_SQL_RX = /^[\s\S]{5}[ cC]\/EXEC\s+SQL/i;
const END_EXEC_RX = /^[\s\S]{5}[ cC]\/END-EXEC/i;
const SQL_CONT_RX = /^[\s\S]{5}[ cC]\+/;

/**
 * Collects SQL lines from an RPG source code array.
 * It identifies the start of the SQL block and collects lines until the end of the block.
 *
 * @param allLines - The array of all lines in the RPG source code.
 * @param startIndex - The index to start searching for the SQL block.
 * @returns An object containing the collected SQL lines, their indexes, and a flag indicating if it's SQL.
 */
// This function is used to collect SQL blocks from RPG source code lines.
export function collectSQLBlock(allLines: string[], startIndex: number): {
  lines: string[];
  indexes: number[];
  isSQL: boolean;
} {
  const resultLines: string[] = [];
  const resultIndexes: number[] = [];

  const totalLines = allLines.length;

  // Step 1: Go upwards to find the /EXEC SQL line
  let start = startIndex;
  while (start >= 0) {
    const line = allLines[start];
    if (line?.charAt(6) === '/' && line.substring(7, 16).trim().toUpperCase() === 'EXEC SQL') {
      break;
    }
    start--;
  }

  if (start < 0) return { lines: [], indexes: [], isSQL: false };

  // Step 2: Collect lines from /EXEC SQL through /END-EXEC
  let index = start;
  let collecting = true;

  while (index < totalLines && collecting) {
    const line = allLines[index];
    resultIndexes.push(index);

    const col6 = line.charAt(5); // RPG uses 1-based col positions
    const col7 = line.charAt(6);
    const col8 = line.charAt(7);
    const keyword = line.substring(7, 16).trim().toUpperCase();

    if (col7 === '/' && keyword === 'EXEC SQL') {
      // Starting line, content starts at position 17
      const sql = line.substring(16, 74).trimEnd();
      if (sql) resultLines.push(sql);
    } else if (col7 === '+' && col8 === ' ') {
      // Continuation line: positions 9–74 are valid content (index 8–74)
      const sql = line.substring(8, 74).trimEnd();
      if (sql) resultLines.push(sql);
    } else if (col7 === '/' && keyword === 'END-EXEC') {
      // End of SQL block
      collecting = false;
    } else {
      // Any other RPG-style SQL body (not +cont)
      const sql = line.substring(8, 74).trimEnd();
      if (sql) resultLines.push(sql);
    }

    index++;
  }

  return {
    lines: resultLines,
    indexes: resultIndexes,
    isSQL: true
  };
}


export function convertToFreeFormSQL(sqlLines: string[]): string[] {
  const sqlBodyParts: string[] = [];

  for (const rawLine of sqlLines) {
    const line = rawLine.padEnd(80, ' ');
    const content = line.trim(); // Skip past spec & continuation

    // Skip directives
    if (/^\/(exec\s+sql|end-exec)/i.test(content)) continue;

    sqlBodyParts.push(content);
  }

  let flatSQL = sqlBodyParts.join(' ').replace(/\s+/g, ' ').trim(); // Flatten to one line
  // Ensure the SQL ends with a semicolon
  if (!flatSQL.endsWith(';')) {
    flatSQL += ';';
  }
  // Reformat into nicely indented multi-line EXEC SQL block
  const wrappedLines = [...wrapSQLBody(flatSQL)];

  return wrappedLines;
}

/**
 * Wraps SQL lines to fit within a specified length, adding indentation for continued lines.
 * The first line is indented with 8 spaces, and continued lines are indented with 10 spaces.
 *
 * @param sql - The SQL string to be wrapped.
 * @returns An array of strings representing the wrapped SQL lines.
 */
// This function is used to wrap SQL lines to fit within a specified length.





export function wrapSQLBody(sql: string): string[] {
  const execSQLIndent   = '        ';
  const firstLineIndent = '          ';
  const clauseIndent    = '            ';
  const conjIndent      = '              ';
  const maxLength = 72;

  const formattedSQL = formatSQL(sql);

  const rawLines = rpgiv.splitLines(formattedSQL).map(line => line.trim()).filter(Boolean);
  const wrapped: string[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const upperLine = rawLines[i];
    const isConjunction = /^(AND|OR)\b/.test(upperLine);
    const indent = i === 0 ? firstLineIndent : isConjunction ? conjIndent : clauseIndent;

    let line = indent + upperLine;

    while (line.length > maxLength) {
      let breakIndex = line.lastIndexOf(' ', maxLength);
      if (breakIndex <= indent.length) breakIndex = maxLength;

      wrapped.push(line.slice(0, breakIndex).trimEnd());
      line = indent + line.slice(breakIndex).trimStart();
    }

    wrapped.push(line);
  }

  return [execSQLIndent + 'EXEC SQL', ...wrapped];
}