import * as vscode from 'vscode';
import * as rpgiv from './rpgedit';
import { commands, ExtensionContext, Uri, window } from "vscode";
import { getStructTypeInfo } from './calcStructLen';


export function binToList(str: string): string {
    // Remove quotes if present
    const match = str.trim().match(/^'([01]+)'$/);
    if (!match) return '';
    const chars = match[1].split('').map(ch => `'${ch}'`);
    return `%LIST(${chars.join(':')})`;
}

/**
 * Checks if the string is a quoted list of 1 or more 0 and 1, e.g. '1101'
 */
export function isBinaryLiteral(str: string): boolean {
    // Matches a single-quoted string containing only 0 and 1, at least one digit
    return /^'([01]+)'$/.test(str.trim());
}
export function isBinaryFlag(str: string): boolean {
    // Matches a single-quoted string containing exactly one digit (0 or 1)
    // or the string *ON or *OFF (case-insensitive)
    const trimmed = str.trim().toUpperCase();
    return /^'[01]'$/.test(trimmed) || trimmed === '*ON' || trimmed === '*OFF';
}

/**
 * Checks if the string starts with *IN(n), where n is a number or variable name
 * Examples: *IN(82), *IN(idx)
 */
export function isIndyArray(str: string): boolean {
    // Matches *IN(n), where n is one or more digits or a variable name (letters, digits, underscores)
    return /^\*IN(\(\s*([a-z][a-z0-9]*|\d+)\s*\)|[a-z][a-z0-9]*|\d+)$/i.test(str.trim());
}

/**
 * Extracts the n value from *IN(n), where n is a number or variable name.
 * Returns null if not matched.
 */
export function getIndyIndex(str: string): string | null {
    const match = str.trim().match(/^\*IN\(\s*([A-Za-z_][A-Za-z0-9_]*|\d+)\s*\)/);
    return match ? match[1] : null;
}
// If not found in variables, constants, or structs, check if it's a literal
export function getTypeInfo(symbols: any, name: string): { type: string, length?: number, decimals?: number } | null {
    if (!name || name.trim() === '') return null;

    let info = getVarTypeInfo(symbols, name);
    if (info) return info;

    const constInfo = getConstTypeInfo(symbols, name);
    if (constInfo) {
        // Add decimals as undefined for consistency
        return { type: constInfo.type, length: constInfo.length, decimals: undefined };
    }

    const structInfo = getStructTypeInfo(symbols, name);
    if (structInfo) {
        // Add length and decimals as undefined for consistency
        return { type: structInfo.type, length: structInfo.length, decimals: undefined };
    }

    if (isLiteral(name)) {
        return { type: 'LITERAL', length: getLiteralLen(name), decimals: undefined };
    }
    return null;
}


/**
 * Extracts type, length, and decimals for a variable from the IBM i symbols cache.
 * @param symbols The symbols object returned from the IBM i extension.
 * @param varName The variable name to search for.
 * @returns { type: string, length?: number, decimals?: number } or null if not found.
 */
export function getVarTypeInfo(symbols: any, varName: string): {
    type: string,
    length?: number,
    decimals?: number
} | null {
    if (!symbols || !Array.isArray(symbols.variables)) return null;
    if (!varName || varName === '') return null;

    // Normalize variable name for case-insensitive match
    const name = varName.trim().toUpperCase();

    for (const variable of symbols.variables) {
        if (variable.name && variable.name.toUpperCase() === name) {
            const meta = variable.keyword || {};
            // Supported types (all uppercase for comparison)
            const supportedTypes =
                ["CHAR", "VARCHAR", "GRAPH", "VARGRAPH",
                    "PACKED", "ZONED", "INT", "UNS", "IND",
                    "DATE", "TIME", "TIMESTAMP"];
            // Search meta keys case-insensitively
            for (const key of Object.keys(meta)) {
                const type = key.toUpperCase();
                if (supportedTypes.includes(type)) {
                    let length: number | undefined;
                    // For IND, default length to 1 if not present
                    if (type === "IND") {
                        length = meta[key] ? Number(meta[key]) : 1;
                        return { type, length };
                    }
                    if (['PACKED', 'ZONED'].includes(type)) {
                        // meta[key] could be "7:2" or just "7"
                        let length: number | undefined = 1;
                        let decimals: number | undefined = undefined;
                        if (typeof meta[key] === "string") {
                            const parts = meta[key].split(':');
                            length = Number(parts[0]);
                            decimals = parts.length > 1 ? Number(parts[1]) : undefined;
                        }
                        return { type, length, decimals };
                    }      // For CHAR, VARCHAR, INT, PACKED, ZONED, length is a string number
                    if (typeof meta[key] === "string" && !isNaN(Number(meta[key]))) {
                        length = Number(meta[key]);
                    }
                    // For DATE, TIME, TIMESTAMP, just flag as type
                    if (["DATE", "TIME", "TIMESTAMP"].includes(type)) {
                        return { type };
                    }
                    // For INT, CHAR, VARCHAR, PACKED, ZONED, return type and length
                    return { type, length };
                }
            }
        }
    }
    return null;
}

// Returns { type: 'CONST', length: number } for a constant, or null if not found
export function getConstTypeInfo(symbols: any, constName: string): { type: string, length: number } | null {
    if (!symbols || !Array.isArray(symbols.constants)) return null;
    if (!constName || constName === '') return null;

    const name = constName.trim().toUpperCase();

    for (const constant of symbols.constants) {
        if (constant.name && constant.name.toUpperCase() === name) {
            const value = constant.keyword?.CONST;
            if (typeof value === 'string') {
                // Use getLiteralLen if available, otherwise just length of value (without quotes)
                const length = getLiteralLen ? getLiteralLen(value) : value.replace(/^'(.*)'$/, '$1').length;
                return { type: 'CONST', length };
            }
        }
    }
    return null;
}

export function getLiteralLen(str: string): number {
    const trimmed = str.trim();
    // Check for quoted string: single quotes around one or more characters
    if (/^'.*'$/.test(trimmed)) {
        // Remove the outer quotes
        let inner = trimmed.slice(1, -1);
        // Replace double single-quotes with a single quote (RPG escape)
        inner = inner.replace(/''/g, "'");
        return inner.length;
    }
    // Check for numeric literal: integer or decimal (optionally with + or -)
    if (/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(trimmed)) {
        // Remove sign and decimal point for length
        return trimmed.replace(/[+-.]/g, '').length;
    }
    // Not a recognized literal
    return 0;
}

export function isNumericLiteral(value: string): boolean {
    return !isNaN(Number(value));
}

// Returns true if the input is a quoted string (e.g. 'ABC') or a numeric literal (e.g. 3741, 3.14)
export function isLiteral(str: string): boolean {
    const trimmed = str.trim();
    // Check for quoted string: single quotes around one or more characters
    const isQuoted = /^'.*'$/.test(trimmed);
    // Check for numeric literal: integer or decimal (optionally with + or -)
    const isNumeric = /^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(trimmed);
    return isQuoted || isNumeric;
}
// Returns true if the input is a quoted string (e.g. 'ABC') or a numeric literal (e.g. 3741, 3.14)
export function isDecLiteral(str: string): boolean {
    const trimmed = str.trim();
    // Check for numeric literal: integer or decimal (optionally with + or -)
    const isNumeric = /^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(trimmed);
    return isNumeric;
}

export function isDateFmt(datefmt: string): boolean {
    const validDateFmts = [
        '*ISO', '*EUR', '*JIS', '*USA',
        '*MDY', '*YMD', '*DMY',
        '*CMDY', '*CYMD', '*CDMY',
        '*MDYY', '*YYMD', '*DMYY',
        '*JUL', '*LONGJUL',
        '*JOBRUN'
    ];
    const fmt = datefmt.trim().toUpperCase();
    for (const baseFmt of validDateFmts) {
        // check for exact match (no date sep)
        if (fmt === baseFmt) return true;
        // check for match with optional date sep
        if (fmt.startsWith(baseFmt)) {
            // Accept trailing date separator or '0' (no separator), or '&' (blank separator)
            const suffix = fmt.slice(baseFmt.length);
            if (
                suffix &&
                (suffix === '' ||
                    ['0', '-', '/', '.', ',', '&'].includes(suffix))
            ) return true;
        }
    }
    return false;
}
