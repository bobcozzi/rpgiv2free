import * as vscode from 'vscode';
import * as rpgiv from '../rpgedit';
import { commands, ExtensionContext, Uri, window } from "vscode";
import { getStructTypeInfo } from '../calcStructLen';


function binToList(str: string): string {
    // Remove quotes if present
    const match = str.trim().match(/^'([01]+)'$/);
    if (!match) return '';
    const chars = match[1].split('').map(ch => `'${ch}'`);
    return `%LIST(${chars.join(':')})`;
}

/**
 * Checks if the string is a quoted list of 1 or more 0 and 1, e.g. '1101'
 */
function isBinaryLiteral(str: string): boolean {
    // Matches a single-quoted string containing only 0 and 1, at least one digit
    return /^'([01]+)'$/.test(str.trim());
}
function isBinaryFlag(str: string): boolean {
    // Matches a single-quoted string containing exactly one digit (0 or 1)
    // or the string *ON or *OFF (case-insensitive)
    const trimmed = str.trim().toUpperCase();
    return /^'[01]'$/.test(trimmed) || trimmed === '*ON' || trimmed === '*OFF';
}

/**
 * Checks if the string starts with *IN(n), where n is a number or variable name
 * Examples: *IN(82), *IN(idx)
 */
function isIndyArray(str: string): boolean {
    // Matches *IN(n), where n is one or more digits or a variable name (letters, digits, underscores)
    return /^\*IN(\(\s*([a-z][a-z0-9]*|\d+)\s*\)|[a-z][a-z0-9]*|\d+)$/i.test(str.trim());
}

/**
 * Extracts the n value from *IN(n), where n is a number or variable name.
 * Returns null if not matched.
 */
function getIndyIndex(str: string): string | null {
    const match = str.trim().match(/^\*IN\(\s*([A-Za-z_][A-Za-z0-9_]*|\d+)\s*\)/);
    return match ? match[1] : null;
}
// If not found in variables, constants, or structs, check if it's a literal
function getTypeInfo(symbols: any, name: string): { type: string, length?: number, decimals?: number } | null {
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
function getVarTypeInfo(symbols: any, varName: string): {
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
function getConstTypeInfo(symbols: any, constName: string): { type: string, length: number } | null {
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

// Returns { type: 'STRUCT', length: number } for a struct, or null if not found
// getStructTypeInfo moved to src/calcStructLen.ts and imported above.
// The local implementation has been removed.

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

export async function convertMOVE(
    opcode: string,
    factor1: string,
    factor2: string,
    result: string,
    extraDCL: string[]
): Promise<{ lines: string[], action: string }> {
    const lines: string[] = [];
    let action = '';

    const config = rpgiv.getRPGIVFreeSettings();

    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
        return { lines: ['// No active editor found.'], action: '' };
    }
    const uri = activeEditor.document.uri;
    const symbols = await commands.executeCommand(`vscode-rpgle.server.getCache`, uri) as any;
    // console.log('CODE4IBMi Symbols.variables:', JSON.stringify(symbols.variables, null, 2));

    // === Extract Extender (e.g., from CAT(P)) ===
    const { rawOpcode: rawOpcode, extenders: extender } = rpgiv.splitOpCodeExt(opcode);
    const hasP = extender.includes('P');

    let f1 = '';
    let f2 = '';
    let f1Parm = '';
    let f2Parm = '';
    let ff = '';
    let dateFmt = '*ISO';
    let move: string[] = [];  // resulting operations (if any)

    // This is MOVE/MOVEL Opcodes Bob, what the BITON/BITOFF Factor 2 test?
    // Likely when you cloned the ts from the biton.ts logic?
    if (factor1?.trim() !== '') {
        [f1, f1Parm] = rpgiv.splitFactor(factor1);
    }
    if (factor2?.trim() !== '') {
        [f2, f2Parm] = rpgiv.splitFactor(factor2);
    }
    if (f1 && isDateFmt(f1)) {
        dateFmt = f1.toUpperCase();
    }
    // If Factor 1 contains a Date Format such as *ISO
    // then assume this is a move date to non-date or move non-date to date.
    //  result = %CHAR(factor2:factor1);
    //  or
    //  result = %DATE(factor2:factor1);

    const f1a = getTypeInfo(symbols, f1);
    const f2a = getTypeInfo(symbols, f2);
    const rfa = getTypeInfo(symbols, result);

    console.log(`${f1} ${opcode} ${f2}  ${result})`);
    console.log(`${opcode} Factor 1 ${f1} is ${f1a?.type}(${f1a?.length})`);
    console.log(`${opcode} Factor 2 ${f2} is ${f2a?.type}(${f2a?.length})`);
    console.log(`${opcode} Result   ${result} is ${rfa?.type}(${rfa?.length})`);

    const bF2IsLiteral = isLiteral(f2);
    const bF2DecLiteral = (bF2IsLiteral && isDecLiteral(f2));
    if (bF2DecLiteral && f2a) {
        f2a.type = "DEC";
    }
    const f2DTS = ['DATE', 'TIME', 'TIMESTAMP'].includes(f2a?.type || '');
    const rfDTS = ['DATE', 'TIME', 'TIMESTAMP'].includes(rfa?.type || '');
    let oper = '';
    const isResultIndicator = result.trim().toUpperCase().startsWith('*IN');
    const factor2Upper = f2.trim().toUpperCase();
    const isFactor2Indicator =
        factor2Upper.startsWith('*IN') ||
        factor2Upper === 'ON'  ||
        factor2Upper === 'OFF' ||
        factor2Upper === "'1'" ||
        factor2Upper === "'0'";
    if (rawOpcode === 'MOVE') {
        oper = 'evalR';
    }
    // If no DATE Format is specified in Factor1,
    // then instead of defaulting to ISO,
    // MOVE/MOVEL default to the date format
    // for the date variable used on the opcode.
    // Fortunately, so does %CHAR(dateVar) when the
    // date format (parameter 2) is omitted.

    if (f2a && f2DTS && (!f1 || f1 === '')) {
        dateFmt = f2a.type;
    }
    else if (rfa && rfDTS && (!f1 || f1 === '')) {
        dateFmt = rfa.type;
    }

    // Handle date to any or any to date assignment
    if (f2DTS && rfDTS) {  // Date to Date? Just plain assignment
        ff = `${result} = ${f2};`;
        lines.push(ff);
    } else if (!f2DTS && rfDTS) { // Factor 2 is not date, but Result is date?
        if (['DATE', 'TIME', 'TIMESTAMP'].includes(dateFmt)) {
            // If not Factor 1 is specified then dateFmt will be DataType
            // This is because the code4i symbols table doesn't fully populate
            // the symbols for dates or data structures and '*SYS' isn't a thing
            ff = `${oper} ${result} = %DATE(${f2})`;
        }
        else {
            ff = `${oper} ${result} = %DATE(${f2} : ${dateFmt})`;
        }
        lines.push(ff);
    } else if (f2DTS && !rfDTS) {  // Factor 2 is date, but Result is not date?
        let lval = '';
        let rval = '';
        let dateLen = (dateFmt.endsWith('0')) ? 8 : 10;
        let trim0 = 0;
        if (['*ISO', '*USA', '*EUR', '*JIS'].some(fmt => dateFmt.startsWith(fmt))) {
            dateLen = 10;
            trim0 = 2;
        }
        else if (['*MDY', '*YMD', '*DMY'].some(fmt => dateFmt.startsWith(fmt))) {
            dateLen = 8;
            trim0 = 2;
        }
        else if (['*CMDY', '*CYMD', '*CDMY'].some(fmt => dateFmt.startsWith(fmt))) {
            dateLen = 9;
            trim0 = 2;
        }
        else if (dateFmt.startsWith('*JUL')) {
            dateLen = 6;
            trim0 = 1;
        }
        else if (dateFmt.startsWith('*LONGJUL')) {
            dateLen = 8;
            trim0 = 1;
        }

        dateLen -= (dateFmt.endsWith('0')) ? trim0 : 0;

        // TODO: Handle struct to date and date to struct via MOVE/MOVEL opcodes

        if (rfa && ['STRUCT', 'CHAR', 'VARCHAR', 'GRAPH', 'VARGRAPH'].includes(rfa?.type)) {
            if (typeof rfa?.length === 'number' && rfa.length > dateLen) {
                let newStart = (rawOpcode === 'MOVE') ? (rfa.length - dateLen) + 1 : 1;
                lval = `%SUBST(${result}: ${newStart} : ${dateLen})`;
            }
            else {
                lval = `${result}`.trimStart();
            }
            if (['DATE', 'TIME', 'TIMESTAMP'].includes(dateFmt)) {
                rval = `%CHAR(${f2})`;
            }
            else {
                rval = `%CHAR(${f2} : ${dateFmt})`;
            }
        }
        else if (['INT', 'UNS', 'ZONED', 'PACKED', 'DEC', 'BINDEC'].includes(rfa?.type || '')) {
            if (['DATE', 'TIME', 'TIMESTAMP'].includes(dateFmt)) {
                rval = `%DEC(${f2})`;
            }
            else {
                rval = `%DEC(${f2} : ${dateFmt})`;
            }
            lval = `${result}`.trimStart();
        }
        ff = `${oper} ${lval} = ${rval}`;
        lines.push(ff);
    }  // end Date handling

    else if (!hasP && (rfa && ['STRUCT', 'CHAR', 'VARCHAR', 'GRAPH', 'VARGRAPH'].includes(rfa?.type) &&
        (f2a && ['STRUCT', 'CHAR', 'VARCHAR', 'GRAPH', 'VARGRAPH', 'CONST', 'LITERAL'].includes(f2a?.type)))) {
        // Begin char-to-char based variable handling

        if (isResultIndicator || isFactor2Indicator) {
            lines.push(`${result} = ${factor2}`);
            return { lines, action }; // stop before adding a second line
        }
        else if (factor2.startsWith('*')) { // hasP is false in this block
            lines.push(`${oper} ${result} = ${factor2}`);
            return { lines, action }; // stop before adding a second line
        }

        // When Factor 2 is a numeric literal or named constant that is a numeric value
        // Then treate it like a Decimal/Numeric field being copied to the target/result field
        const bF2Literal = (f2a === null || isLiteral(f2));
        let f2Len = (f2a && f2a.length) ? f2a.length : 0;
        let f2Size = `%LEN(${f2})`;
        let rfSize = `%LEN(${result})`;
        let copyLen = `%MIN(${f2Size} : ${rfSize})`;
        // Example: MOVEL f2 to result  => %SUBST(result : 1 : len(f2)) = f2;
        let startPos: string;
        if (rawOpcode === 'MOVEL') {
            startPos = '1';
        } else {
            startPos = `(${rfSize} - ${copyLen}) + 1`;
        }
        if (typeof rfa?.length !== 'number' || f2Len === 0) {
            lines.push(`${oper} %SUBST(${result} : ${startPos} : ${copyLen}) = ${f2}`);
        }
        else if (typeof rfa?.length === 'number' && f2Len > 0) {
            if (f2Len >= rfa.length) {
                lines.push(`${oper} ${result} = ${f2}`);
            }
            else {
                lines.push(`%SUBST(${result} : ${startPos} : ${copyLen}) = ${f2}`);
            }
        }

    }
    else {
        if ((f2a && rfa) && ((['PACKED', 'DEC', 'DECIMAL', 'ZONED', 'INT', 'UNS', 'FLOAT'].includes(f2a.type) &&
            ['STRUCT', 'CHAR', 'VARCHAR', 'GRAPH', 'VARGRAPH'].includes(rfa.type)) ||
            (['STRUCT', 'CHAR', 'VARCHAR', 'GRAPH', 'VARGRAPH', 'LITERAL', 'CONST'].includes(f2a.type) &&
                ['PACKED', 'ZONED', 'INT', 'UNS', 'FLOAT'].includes(rfa.type)))) {
            let rType = (rfa.type === 'PACKED') ? 'DEC' : rfa.type;
            if ((f2a && rfa) && ['DEC', 'DECIMAL', 'PACKED', 'ZONED'].includes(rType)) {
                let rfLen = rfa.length;
                let rfDec = (typeof rfa.decimals === 'number') ? rfa.decimals : 0;
                lines.push(`${result} = %${rType}(${f2} : ${rfLen} : ${rfDec})`);
            }
            else {
                lines.push(`${result} = %${rType}(${f2})`);
            }
        }
        else {
            lines.push(`${result} = ${f2}`);
        }
    }

    return { lines, action };
}