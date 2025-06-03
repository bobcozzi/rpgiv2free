


import * as vscode from 'vscode';
import * as rpgiv from '../rpgedit';

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

export function convertMOVE(
    opcode: string,
    factor1: string,
    factor2: string,
    result: string,
    extraDCL: string[]
): { lines: string[], action: string } {
    const lines: string[] = [];
    let action = '';

    const config = rpgiv.getRPGIVFreeSettings();

    // === Extract Extender (e.g., from CAT(P)) ===
    const { rawOpcode: rawOpcode, extenders: extender } = rpgiv.splitOpCodeExt(opcode);
    const hasP = extender.includes('P');

    let f1 = '';
    let f2 = '';
    let f1Parm = '';
    let f2Parm = '';

    let move: string[] = [];  // resulting operations (if any)
    if (factor1?.trim() !== '') {
        [f1, f1Parm] = rpgiv.splitFactor(factor1);
        if (rpgiv.isBitLiteral(f1)) {
            f1 = rpgiv.bitStringToHex(f1);
        }
    }
    if (factor2?.trim() !== '') {
        [f2, f2Parm] = rpgiv.splitFactor(factor2);
        if (rpgiv.isBitLiteral(f2)) {
            f2 = rpgiv.bitStringToHex(f2);
        }
    }
    // If Factor 1 contains a Date Format such as *ISO
    // then assume this is a move date to non-date or move non-date to date.
    //  result = %CHAR(factor2:factor1);
    //  or!
    //  result = %DATE(factor2:factor1);

    if (rpgiv.isValidDateFmt(f1)) {
        lines.push('// TODO: Select desired assignment for Date<->NON-DATE conversion:');
        lines.push(`// Original: --> ${f1} ${opcode} ${f2}  ${result}`);
        lines.push('// Option 1: MOVE DATE to NON-DATE:');
        lines.push(`// ${result} = %DATE(${f2}:${f1})`);
        lines.push('// Option 2: MOVE NON-DATE to DATE (default):');
        lines.push(`${result} = %CHAR(${f2}:${f1})`);
        return { lines, action: '' };
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