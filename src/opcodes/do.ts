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

export function convertDO(
    opcode: string,
    factor1: string,
    factor2: string,
    result: string,
    length: string,
    decimals: string,
    extraDCL: string[]
): string[] {
    const lines: string[] = [];


    // === Extract Extender (e.g., from DO(P)) (DOxx does not support Extenders)===
    const extenderMatch = opcode.match(/\(([^)]+)\)/);
    const extender = extenderMatch ? extenderMatch[1].toUpperCase() : '';
    const hasP = extender.includes('P');
    const config = rpgiv.getRPGIVFreeSettings();

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
    if (!rpgiv.isVarDcl(f3)) {
        let workFieldDefn = 'int(10)';
        if (length && length.trim() !== '') {
            if (decimals && decimals !== '') {
                workFieldDefn = `packed(${length} : ${decimals})`;
            }
        }
        extraDCL.push(`DCL-S ${f3} ${workFieldDefn}; // Ad hoc counter used by DO opcode `);
    }

    lines.push(`FOR ${f3} = ${f1} to ${f2} by 1; // DO opcode`);
    return lines;
}