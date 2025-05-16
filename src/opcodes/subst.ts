
import * as vscode from 'vscode';
import * as ibmi from '../IBMi';

export function convertSUBST(
    opcode: string,
    factor1: string,
    factor2: string,
    result: string,
    extraDCL: string[]
): string[] {
    const lines: string[] = [];

    const config = ibmi.getRPGIVFreeSettings();

    // === Extract Extender (e.g., from SUBST(P)) ===
    const extenderMatch = opcode.match(/\(([^)]+)\)/);
    const extender = extenderMatch ? extenderMatch[1].toUpperCase() : '';
    const hasP = extender.includes('P');


    let exprParts: string[] = [];

    // === Parse Factor 2 (source:startPos) ===
    let sourceVar = '';
    let sourceStart = '1';
    let sourceLen = `%len(${result})`;
    let target = '';
    let expr = '';  // final free format express
    let bPlainSUBST = false;

    if (factor2.includes(':')) {
        const [leftRaw, rightRaw] = factor2.split(':');
        sourceVar = leftRaw.trim();
        sourceStart = rightRaw.trim();
    } else {
        sourceVar = factor2.trim();
        sourceStart = '1';
        bPlainSUBST = true;
    }
    // === Rule 1: If no Factor 1, use Factor 2's value's length ===
    if (factor1.trim() !== '') {
        sourceLen = factor1.trim();
        bPlainSUBST = false;
    }
    else {
        sourceLen = `%len(${sourceVar})`;
    }

    if (hasP) {
        // Rule: If extender (P), replace target entirely
        target = `${result}`;
    } else {
        target = `%SUBST(${result}:1:${sourceLen})`;
    }
    if (bPlainSUBST) {
        expr = `${target} = ${sourceVar}`;
    }
    else {
        expr = `${target} = %SUBST(${sourceVar}:${sourceStart}:${sourceLen});`
    }
    const orgStmt = ` // ${factor1}  ${opcode}  ${factor2}  ${result}`
    lines.push(expr + orgStmt);

    return lines;
}