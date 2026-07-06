// SPDX-License-Identifier: Apache-2.0

function isFixedExecOrEnd(line: string): boolean {
    return /^[\s\S]{5}[ cC]\/(?:EXEC\s+SQL|END-EXEC)\b/i.test(line);
}

function stripFixedContinuationPrefix(line: string): string {
    // Fixed-format continuation styles:
    //  - "     C+ ..."
    //  - "      + ..."
    if (/^[\s\S]{5}[ cC]?\+/.test(line)) {
        return line.substring(7);
    }
    return line;
}

export function stripExecSqlWrappers(lines: string[]): string[] {
    return lines.filter((line) => {
        const t = line.trim();
        return !/^\/?\s*exec\s+sql\b/i.test(t)
            && !/^\/?\s*end-exec\b/i.test(t)
            && !isFixedExecOrEnd(line);
    });
}

export function normalizeSQLLines(lines: string[]): string[] {
    return lines
        .map((line) => stripFixedContinuationPrefix(line))
        .map((line) => line.trim())
        .filter(Boolean)
        .filter((line) => !/^\/?\s*exec\s+sql\b/i.test(line) && !/^\/?\s*end-exec\b/i.test(line));
}

export function flattenSQLLines(lines: string[]): string {
    return normalizeSQLLines(lines).join(' ').replace(/\s+/g, ' ').trim();
}

export function ensureTerminator(sql: string): string {
    const flat = sql.trim();
    if (!flat) return ';';
    return flat.endsWith(';') ? flat : `${flat};`;
}

export function toFlatSQL(lines: string[]): string {
    return ensureTerminator(flattenSQLLines(stripExecSqlWrappers(lines)));
}
