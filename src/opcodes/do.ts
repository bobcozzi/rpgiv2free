
import * as vscode from 'vscode';
import * as ibmi from '../IBMi';

export function convertDO(
    opcode: string,
    factor1: string,
    factor2: string,
    result: string,
    extraDCL: string[]
): string[] {
    const lines: string[] = [];


    // === Extract Extender (e.g., from DO(P)) (DOxx does not support Extenders)===
    const extenderMatch = opcode.match(/\(([^)]+)\)/);
    const extender = extenderMatch ? extenderMatch[1].toUpperCase() : '';
    const hasP = extender.includes('P');
    const config = ibmi.getRPGIVFreeSettings();

    let exprParts: string[] = [];

    // === Rule 1: If no Factor 1, use result field ===
    let f1 = factor1.trim();
    let f2 = factor2.trim();
    let f3 = result.trim();
    if (f1 === '') {
        f1 = '1';
    }
    if (f2 === '') {
        f2 = '1';
    }
    if (f3 === '') {
        f3 = config.tempVar2DO;
    }
    if (!ibmi.isVarDcl(f3)) {
        extraDCL.push(`DCL-S ${f3} INT(10); // Ad hoc counter used by DO opcode `);
    }

    lines.push(`FOR ${f3} = ${f1} to ${f2} by 1; // DO opcode`);
    return lines;
}