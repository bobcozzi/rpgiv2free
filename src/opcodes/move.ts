


import * as vscode from 'vscode';
import * as rpgiv from '../rpgedit';
import { commands, ExtensionContext, Uri, window } from "vscode";


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

    // Normalize variable name for case-insensitive match
    const name = varName.trim().toUpperCase();

    for (const variable of symbols.variables) {
        if (variable.name && variable.name.toUpperCase() === name) {
            const meta = variable.keyword || {};
            // Supported types (all uppercase for comparison)
            const supportedTypes =
                ["CHAR", "VARCHAR", "GRAPHIC", "VARGRAPHIC",
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
                    // For CHAR, VARCHAR, INT, PACKED, ZONED, length is a string number
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

    let move: string[] = [];  // resulting operations (if any)

    // This is MOVE/MOVEL Opcodes Bob, what the BITON/BITOFF Factor 2 test?
    // Likely when you cloned the ts from the biton.ts logic?
    if (factor1?.trim() !== '') {
        [f1, f1Parm] = rpgiv.splitFactor(factor1);
    }
    if (factor2?.trim() !== '') {
        [f2, f2Parm] = rpgiv.splitFactor(factor2);
    }
    // If Factor 1 contains a Date Format such as *ISO
    // then assume this is a move date to non-date or move non-date to date.
    //  result = %CHAR(factor2:factor1);
    //  or!
    //  result = %DATE(factor2:factor1);

    const f1a = getVarTypeInfo(symbols, f1);
    const f2a = getVarTypeInfo(symbols, f2);
    const rfa = getVarTypeInfo(symbols, result);

    console.log(`[MOVEx Opcode} Factor 1 ${f1} is ${f1a?.type}(${f1a?.length})`);
    console.log(`[MOVEx Opcode} Factor 2 ${f2} is ${f2a?.type}(${f1a?.length})`);
    console.log(`[MOVEx Opcode} Result   ${result} is ${rfa?.type}(${f1a?.length})`);

    const f2DTS = ['DATE', 'TIME', 'TIMESTAMP'].includes(f2a?.type || '');
    const rfDTS = ['DATE', 'TIME', 'TIMESTAMP'].includes(rfa?.type || '');

    let ff = '';
    let dateFmt = '*ISO';

    if (rpgiv.isValidDateFmt(f1)) {
        dateFmt = f1;
    }
    // Handle date to any or any to date assignment
    if (f2DTS && rfDTS) {  // Date to Date? Just plain assignment
        ff = `${result} = ${f2};`;
        lines.push(ff);
    } else if (!f2DTS && rfDTS) { // Convert CHAR to Date
        lines.push(`// Warning: Less forgiving than: '${dateFmt} MOVE ${f2} ${result}'`);
        ff = `${result} = %${rfa?.type}(${f2} : ${dateFmt})`;
        lines.push(ff);
    } else if (f2DTS && !rfDTS) {
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

        if (rfa && ['CHAR', 'GRAPHIC'].includes(rfa?.type)) {
            if (typeof rfa?.length === 'number' && rfa.length > dateLen) {

                if (rawOpcode === 'MOVE') {
                    let newStart = (rfa.length - dateLen) + 1;
                    lval = `evalR %SUBST(${result}: ${newStart} : ${dateLen})`;
                } else {  // else if MOVEL
                    lval = `%SUBST(${result}: 1 : ${dateLen})`;
                }
            }
            rval = `%CHAR(${f2} : ${dateFmt})`;
        }
        else if (['INT', 'UNS', 'ZONED', 'PACKED', 'BINDEC'].includes(rfa?.type || '')) {
            rval = `%DEC(${f2} : ${dateFmt})`;
            lval = result;
        }
        ff = `${lval} = ${rval}`;
        lines.push(ff);
    }
    else {
        switch (rawOpcode) {
            case "MOVEL":
                if (!hasP && config.altMOVEL && !factor2.startsWith('*')) {

                    const altMove = `%SUBST(${result} : 1 : %MIN(%LEN(${factor2}):%LEN(${result}))) = ${factor2};`;
                    lines.push(`// Alt conversion option, if replacing target: ${result} = ${factor2}`)
                    lines.push(altMove);
                }
                else {
                    lines.push(`${result} = ${factor2}`);
                }
                break;
            case "MOVE":
                // If result or factor2 is an indicator or boolean literal, do not use EVALR
                const isResultIndicator = result.trim().toUpperCase().startsWith('*IN');
                const factor2Upper = factor2.trim().toUpperCase();
                const isFactor2Indicator =
                    factor2Upper.startsWith('*') ||
                    factor2Upper === 'ON' ||
                    factor2Upper === 'OFF' ||
                    factor2Upper === "'1'" ||
                    factor2Upper === "'0'";
                if (isResultIndicator || isFactor2Indicator) {
                    lines.push(`${result} = ${factor2}`);
                } else {
                    lines.push(`EVALR ${result} = ${factor2}`);
                }
                break;
        }
    }

    return { lines, action };
}