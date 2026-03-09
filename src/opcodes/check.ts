
/**
 * MIT License
 *
 * Copyright (c) 2025 Robert Cozzi, Jr.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import * as vscode from 'vscode';
import * as rpgiv from '../rpgedit';

export function convertCHECK(
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
    if (factor1.trim() !== '') {
        compStr = factor1.trim();
    }
    else {
        compStr = `<factor 1 missing>`;
    }


    if (startPos==='1' || startPos==='') {
        expr = `${result} = %CHECK(${compStr}:${baseStr});`
    }
    else {
         expr = `${result} = %CHECK(${compStr}:${baseStr}:${startPos});`
    }
    const orgStmt = ` // ${factor1}  ${opcode}  ${factor2}  ${result}`
    lines.push(expr + orgStmt);

    return lines;
}

export function convertCHECKR(
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
    if (factor1.trim() !== '') {
        compStr = factor1.trim();
    }
    else {
        compStr = `<factor 1 missing>`;
    }


    if (startPos==='1' || startPos==='') {
        expr = `${result} = %CHECKR(${compStr}:${baseStr});`
    }
    else {
         expr = `${result} = %CHECKR(${compStr}:${baseStr}:${startPos});`
    }
    const orgStmt = ` // ${factor1}  ${opcode}  ${factor2}  ${result}`
    lines.push(expr + orgStmt);

    return lines;
}