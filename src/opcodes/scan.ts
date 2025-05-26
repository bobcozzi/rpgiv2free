

import * as vscode from 'vscode';
import * as rpgiv from '../rpgedit';

export function convertSCAN(
    opcode: string,
    factor1: string,
    factor2: string,
    result: string,
    extraDCL: string[]
): string[] {
    const lines: string[] = [];

    const config = rpgiv.getRPGIVFreeSettings();

    // === Extract Extender (e.g., from CHECK(E)) ===
    const extenderMatch = opcode.match(/\(([^)]+)\)/);
    const extender = extenderMatch ? extenderMatch[1].toUpperCase() : '';
    const hasE = extender.includes('E');


    let exprParts: string[] = [];

    // === Parse Factor 2 (source:startPos) ===
    let baseStr = '';
    let startPos = '1';
    let scanLen = '';
    let compStr = '';
    let target = '';
    let expr = '';  // final free format express
    let bPlainCHECK = false;

    if (factor2.includes(':')) {
        const [leftRaw, rightRaw] = factor2.split(':');
        baseStr = leftRaw.trim();
        startPos = rightRaw.trim();
    } else {
        baseStr = factor2.trim();
    }
    // Factor 1
    if (factor1.trim() === '') {
        compStr = `<factor 1 missing>`;
    }
    else {
        if (factor1.includes(':')) {
            const [leftRaw, rightRaw] = factor1.split(':');
            compStr = leftRaw.trim();
            scanLen = rightRaw.trim();
        }
        else {
            compStr = factor1.trim();
        }
    }
    if (scanLen !== '' && startPos === '') {
        startPos = '1';
    }
    if (startPos === '') {
        expr = `${result} = %SCAN(${compStr}:${baseStr});`
    }
    else {
        if (scanLen === '') {
            expr = `${result} = %SCAN(${compStr}:${baseStr}:${startPos});`
        }
        else {
            expr = `${result} = %SCAN(${compStr}:${baseStr}:${startPos}:${scanLen});`
        }
    }
    const orgStmt = ` // ${factor1}  ${opcode}  ${factor2}  ${result}`
    lines.push(expr + orgStmt);

    return lines;
}
