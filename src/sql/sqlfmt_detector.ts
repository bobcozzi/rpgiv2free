// SPDX-License-Identifier: Apache-2.0

import { SQLStatementType } from './sqlfmt_types';
import { SQLFMT_PATTERNS } from './sqlfmt_patterns';

export function detectSQLStatementType(sqlText: string): SQLStatementType {
    const m = sqlText.match(SQLFMT_PATTERNS.statementHead);
    if (!m) return 'UNKNOWN';

    const kwd = m[1].toUpperCase();
    switch (kwd) {
        case 'WITH':
        case 'SELECT':
        case 'INSERT':
        case 'UPDATE':
        case 'DELETE':
        case 'DECLARE':
        case 'FETCH':
        case 'OPEN':
        case 'CLOSE':
            return kwd;
        default:
            return 'UNKNOWN';
    }
}
