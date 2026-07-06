
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 1996-2026 by R. Cozzi, Jr.
// @author BobCozzi

import * as rpgiv from './rpgtools';
import { DEFAULT_SQLFMT_OPTIONS, formatSQLText } from './sql/sqlfmt_index';

export function formatSQL(sql: string): string {
  return formatSQLText(sql, {
    ...DEFAULT_SQLFMT_OPTIONS,
    eol: rpgiv.getEOL(),
  });
}