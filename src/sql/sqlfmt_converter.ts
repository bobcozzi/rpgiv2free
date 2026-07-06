// SPDX-License-Identifier: Apache-2.0

import { DEFAULT_SQLFMT_OPTIONS, SQLFormatOptions } from './sqlfmt_types';
import { formatSQLText } from './sqlfmt_formatter';
import { ensureTerminator, stripExecSqlWrappers, toFlatSQL } from './sqlfmt_normalizer';

function splitLines(text: string): string[] {
    return text.split(/\r\n|\n|\r/);
}

export function wrapSQLText(
    sql: string,
    options: SQLFormatOptions = DEFAULT_SQLFMT_OPTIONS
): string[] {
    const formatted = formatSQLText(ensureTerminator(sql), options);
    const rawLines = splitLines(formatted).map((line) => line.trim()).filter(Boolean);

    const wrapped: string[] = [];

    for (let i = 0; i < rawLines.length; i++) {
        const chunk = rawLines[i];
        const isConj = new RegExp(`^(${options.conjunctionKeywords.join('|')})\\b`, 'i').test(chunk);
        const indent = i === 0 ? options.indent.firstLine : isConj ? options.indent.conjunction : options.indent.clause;

        let line = indent + chunk;
        while (line.length > options.maxLength) {
            let breakIdx = line.lastIndexOf(' ', options.maxLength);
            if (breakIdx <= indent.length) breakIdx = options.maxLength;
            wrapped.push(line.slice(0, breakIdx).trimEnd());
            line = indent + line.slice(breakIdx).trimStart();
        }

        wrapped.push(line);
    }

    return [options.indent.execSql + 'EXEC SQL', ...wrapped];
}

export function convertCollectedToFreeSQL(
    sqlLines: string[],
    options: SQLFormatOptions = DEFAULT_SQLFMT_OPTIONS
): string[] {
    const flat = toFlatSQL(stripExecSqlWrappers(sqlLines));
    return wrapSQLText(flat, options);
}
