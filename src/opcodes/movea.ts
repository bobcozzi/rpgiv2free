

import * as vscode from 'vscode';
import * as rpgiv from '../rpgedit';

/**
 * Checks if the string is a quoted list of 1 or more 0 and 1, e.g. '1101'
 */
function isBinaryFlags(str: string): boolean {
    // Matches a single-quoted string containing only 0 and 1, at least one digit
    return /^'([01]+)'$/.test(str.trim());
}

/**
 * Checks if the string starts with *IN(n), where n is a number or variable name
 * Examples: *IN(82), *IN(idx)
 */
function isIndyArray(str: string): boolean {
    // Matches *IN(n), where n is one or more digits or a variable name (letters, digits, underscores)
    return /^\*IN\(\s*([A-Za-z_][A-Za-z0-9_]*|\d+)\s*\)/.test(str.trim());
}
/**
 * Extracts the n value from *IN(n), where n is a number or variable name.
 * Returns null if not matched.
 */
function getIndyIndex(str: string): string | null {
    const match = str.trim().match(/^\*IN\(\s*([A-Za-z_][A-Za-z0-9_]*|\d+)\s*\)/);
    return match ? match[1] : null;
}

export function convertMOVEA(
    opcode: string,
    factor1: string,
    factor2: string,
    result: string,
    extraDCL: string[]
): { lines: string[], action: string } {
    const lines: string[] = [];
    let action = '';

    // === Extract Extender (e.g., from CAT(P)) ===
    const extenderMatch = opcode.match(/\(([^)]+)\)/);
    const extender = extenderMatch ? extenderMatch[1].toUpperCase() : '';
    const hasP = extender.includes('P');
    const config = rpgiv.getRPGIVFreeSettings();

    let movea: string[] = [];

    const tempVar = config.tempVar2DO;
    if (!(isBinaryFlags(factor2) && isIndyArray(result)) &&
        !(isBinaryFlags(result) && isIndyArray(factor2))) {
        action = '*KEEP';
    }
    else {
        if (isBinaryFlags(factor2) && isIndyArray(result)) {
            const idx = getIndyIndex(result);

            // const ffMOVEA = `%SUBARR(*IN : ${idx} : %len(${factor2})) = ${factor2}`;
            const start = `for ${tempVar} = 1 to  %len(${factor2})`; // for i = 1 to %len(pattern);
            const body = `*in(${idx} + ${tempVar}-1) = %subst(${factor2} : ${tempVar} : 1)`;
            const endFor = `endFor`;
            lines.push(`// MOVEA ${factor2} ${result}  --> to FOR loop`);
            lines.push(start);
            lines.push(body);
            lines.push(endFor);
        }
        else if (isIndyArray(factor2)) {
            const idx = getIndyIndex(factor2);
            const ffMOVEA = `${result} = %SUBARR(*IN : ${idx} : %len(${result}))`;
            lines.push(ffMOVEA);
            action = `MOVEA indy array from ${factor2} to ${result}`;
        }
        if (!rpgiv.isVarDcl(tempVar)) {
            extraDCL.push(`DCL-S ${tempVar} INT(10); // Used for MOVEA `);
        }
    }
    return { lines, action };
}