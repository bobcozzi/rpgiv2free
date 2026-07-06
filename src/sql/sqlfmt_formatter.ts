// SPDX-License-Identifier: Apache-2.0

import { DEFAULT_SQLFMT_OPTIONS, SQLFormatOptions } from './sqlfmt_types';

function escapeRegex(literal: string): string {
    return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sortLongestFirst(values: string[]): string[] {
    return [...values].sort((a, b) => b.length - a.length);
}

function isRealKeyword(sqlText: string, matchIndex: number, hostPrefixes: string[]): boolean {
    let i = matchIndex - 1;
    while (i >= 0 && /\s/.test(sqlText[i])) i--;
    return !(i >= 0 && hostPrefixes.includes(sqlText[i]));
}

function insertEOLBeforeKeywords(
    input: string,
    words: string[],
    eol: string,
    hostPrefixes: string[]
): string {
    if (words.length === 0) return input;

    const pattern = `\\b(${sortLongestFirst(words).map(escapeRegex).join('|')})\\b`;
    const rx = new RegExp(pattern, 'gi');

    let result = '';
    let last = 0;
    let m: RegExpExecArray | null;

    while ((m = rx.exec(input)) !== null) {
        const idx = m.index;
        const word = m[1];
        if (isRealKeyword(input, idx, hostPrefixes)) {
            result += input.slice(last, idx) + eol + word.toUpperCase();
        } else {
            result += input.slice(last, rx.lastIndex);
        }
        last = rx.lastIndex;
    }

    result += input.slice(last);
    return result;
}

export function applySQLKeywordCase(
    sql: string,
    options: SQLFormatOptions = DEFAULT_SQLFMT_OPTIONS
): string {
    let out = sql.trim().replace(/\s+/g, ' ');
    for (const keyword of sortLongestFirst(options.keywords)) {
        const rx = new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'gi');
        out = out.replace(rx, (match, offset) => {
            return isRealKeyword(out, offset, options.hostVariablePrefixes)
                ? keyword.toUpperCase()
                : match;
        });
    }
    return out;
}

export function formatSQLText(
    sql: string,
    options: SQLFormatOptions = DEFAULT_SQLFMT_OPTIONS
): string {
    let out = applySQLKeywordCase(sql, options);

    out = out.replace(
        /\bDECLARE\s+(\w+)\s+CURSOR\s+FOR\s+(SELECT\b[\s\S]+)/i,
        (_, name: string, select: string) => `DECLARE ${name} CURSOR FOR${options.eol}${select.trim()}`
    );

    out = insertEOLBeforeKeywords(out, options.clauseBreakKeywords, options.eol, options.hostVariablePrefixes);
    out = insertEOLBeforeKeywords(out, options.conjunctionKeywords, options.eol, options.hostVariablePrefixes);

    return out;
}
