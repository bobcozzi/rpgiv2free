// SPDX-License-Identifier: Apache-2.0

export type SQLStatementType =
    | 'WITH'
    | 'SELECT'
    | 'INSERT'
    | 'UPDATE'
    | 'DELETE'
    | 'DECLARE'
    | 'FETCH'
    | 'OPEN'
    | 'CLOSE'
    | 'UNKNOWN';

export type SQLSourceFormat = 'fixed' | 'free';

export interface SQLCollectedStatement {
    lines: string[];
    indexes: number[];
    isSQL: boolean;
    hasEndExec: boolean;
}

export interface SQLFormatIndentProfile {
    execSql: string;
    firstLine: string;
    clause: string;
    conjunction: string;
}

export interface SQLFormatOptions {
    eol: string;
    keywords: string[];
    clauseBreakKeywords: string[];
    conjunctionKeywords: string[];
    hostVariablePrefixes: string[];
    maxLength: number;
    indent: SQLFormatIndentProfile;
}

export const DEFAULT_SQLFMT_OPTIONS: SQLFormatOptions = {
    eol: '\n',
    keywords: [
        'with', 'select', 'from', 'where', 'and', 'or', 'order by', 'group by', 'having',
        'join', 'inner join', 'left join', 'right join', 'on', 'as', 'in', 'like',
        'between', 'is null', 'is not null', 'exists', 'not exists',
        'declare', 'cursor', 'for', 'prepare', 'open', 'fetch', 'close',
    ],
    clauseBreakKeywords: ['SELECT', 'FROM', 'WHERE', 'ORDER BY', 'GROUP BY', 'HAVING', 'JOIN', 'ON'],
    conjunctionKeywords: ['AND', 'OR'],
    hostVariablePrefixes: [':', '&'],
    maxLength: 72,
    indent: {
        execSql: '        ',
        firstLine: '          ',
        clause: '            ',
        conjunction: '              ',
    },
};
