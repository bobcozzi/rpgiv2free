// SPDX-License-Identifier: Apache-2.0

import { SQLCollectedStatement, SQLSourceFormat } from './sqlfmt_types';
import {
    isFixedContinuation,
    isFixedEndExec,
    isFixedExecSqlStart,
    isFreeEndExec,
    isFreeExecSqlStart,
} from './sqlfmt_patterns';

function collectFixed(allLines: string[], startIndex: number): SQLCollectedStatement {
    const lines: string[] = [];
    const indexes: number[] = [];

    let start = startIndex;
    while (start >= 0) {
        if (isFixedExecSqlStart(allLines[start])) break;
        start--;
    }

    if (start < 0) {
        return { lines: [], indexes: [], isSQL: false, hasEndExec: false };
    }

    let idx = start;
    let hasEndExec = false;

    while (idx < allLines.length) {
        const line = allLines[idx];
        indexes.push(idx);

        const col7 = line.charAt(6);
        const keyword = line.substring(7, 16).trim().toUpperCase();

        if (col7 === '/' && keyword === 'EXEC SQL') {
            const sql = line.substring(16, 74).trimEnd();
            if (sql) lines.push(sql);
        } else if (isFixedContinuation(line)) {
            // Continuation can be either " +" or "C+"; start at column 8 (idx 7)
            // so we preserve both forms and normalize whitespace downstream.
            const sql = line.substring(7, 74).trimEnd();
            if (sql) lines.push(sql);
        } else if (isFixedEndExec(line)) {
            hasEndExec = true;
            break;
        } else {
            const sql = line.substring(7, 74).trimEnd();
            if (sql) lines.push(sql);
        }

        idx++;
    }

    return { lines, indexes, isSQL: true, hasEndExec };
}

function collectFree(allLines: string[], startIndex: number): SQLCollectedStatement {
    const lines: string[] = [];
    const indexes: number[] = [];

    let start = startIndex;
    while (start >= 0) {
        if (isFreeExecSqlStart(allLines[start].trim())) break;
        start--;
    }

    if (start < 0) {
        return { lines: [], indexes: [], isSQL: false, hasEndExec: false };
    }

    let idx = start;
    let hasEndExec = false;

    // Include inline SQL portion from opener line, if any.
    const opener = allLines[idx].trim();
    const inline = opener.replace(/^\/?\s*exec\s+sql\b\s*/i, '').replace(/;\s*$/, '').trim();
    indexes.push(idx);
    if (inline) lines.push(inline);
    idx++;

    while (idx < allLines.length) {
        const t = allLines[idx].trim();

        if (isFreeEndExec(t)) {
            indexes.push(idx);
            hasEndExec = true;
            break;
        }

        if (isFreeExecSqlStart(t)) {
            break;
        }

        if (t) {
            lines.push(t);
            indexes.push(idx);
        }

        idx++;

        if (t.endsWith(';')) {
            break;
        }
    }

    return { lines, indexes, isSQL: true, hasEndExec };
}

export function collectSQLStatement(
    allLines: string[],
    startIndex: number,
    format: SQLSourceFormat = 'fixed'
): SQLCollectedStatement {
    return format === 'free'
        ? collectFree(allLines, startIndex)
        : collectFixed(allLines, startIndex);
}
