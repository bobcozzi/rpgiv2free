
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 1996-2026 by R. Cozzi, Jr.
// @author BobCozzi

import {
  collectSQLStatement,
  convertCollectedToFreeSQL,
  DEFAULT_SQLFMT_OPTIONS,
  wrapSQLText,
} from './sql/sqlfmt_index';

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
  const collected = collectSQLStatement(allLines, startIndex, 'fixed');
  return {
    lines: collected.lines,
    indexes: collected.indexes,
    isSQL: collected.isSQL,
  };
}


export function convertToFreeFormSQL(sqlLines: string[]): string[] {
  return convertCollectedToFreeSQL(sqlLines, {
    ...DEFAULT_SQLFMT_OPTIONS,
  });
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
  return wrapSQLText(sql, {
    ...DEFAULT_SQLFMT_OPTIONS,
  });
}