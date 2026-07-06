// SPDX-License-Identifier: Apache-2.0

export const SQLFMT_PATTERNS = {
    // Fixed-format style used by RPG members
    execSqlFixed: /^[\s\S]{5}[ cC]\/EXEC\s+SQL/i,
    endExecFixed: /^[\s\S]{5}[ cC]\/END-EXEC/i,
    contFixed: /^[\s\S]{5}[ cC]\+/,

    // Free-format style
    execSqlFree: /^\s*(?:\/\s*)?exec\s+sql\b/i,
    endExecFree: /^\s*\/\s*end-exec\b/i,

    // Statement type detection
    statementHead: /^\s*(WITH|SELECT|INSERT|UPDATE|DELETE|DECLARE|FETCH|OPEN|CLOSE)\b/i,
};

export function isFixedExecSqlStart(line: string): boolean {
    return SQLFMT_PATTERNS.execSqlFixed.test(line);
}

export function isFixedEndExec(line: string): boolean {
    return SQLFMT_PATTERNS.endExecFixed.test(line);
}

export function isFixedContinuation(line: string): boolean {
    return SQLFMT_PATTERNS.contFixed.test(line);
}

export function isFreeExecSqlStart(line: string): boolean {
    return SQLFMT_PATTERNS.execSqlFree.test(line);
}

export function isFreeEndExec(line: string): boolean {
    return SQLFMT_PATTERNS.endExecFree.test(line);
}
