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

export function convertMHHZO(
    opcode: string,
    factor1: string,
    factor2: string,
    result: string,
    resInd1: string,
    resInd2: string,
    resInd3: string,
    extraDCL: string[]
): { lines: string[], action: string } {

    const lines: string[] = [];
    let action = '';
    let freeForm = '';

    // Add a comment with the original statement, for reference purposes
    lines.push(` // MHHZO ${factor2} ${result}`);

    freeForm = `%SUBST(${result}:1:1) = `;
    freeForm = `${freeForm} %BITOR(%BITAND(X'0F' : %SUBST(${result} : 1 : 1))`;
    freeForm = `${freeForm} : %BITAND(X'F0' : %SUBST(${factor2} : 1 : 1)))`;
    lines.push(freeForm);
    return { lines, action };
}


export function convertMHLZO(
    opcode: string,
    factor1: string,
    factor2: string,
    result: string,
    resInd1: string,
    resInd2: string,
    resInd3: string,
    extraDCL: string[]
): { lines: string[], action: string } {

    const lines: string[] = [];
    let action = '';
    let freeForm = '';

    // Add a comment with the original statement, for reference purposes
    lines.push(` // MHHZO ${factor2} ${result}`);

    freeForm = `%SUBST(${result}:%LEN(${result}):1) = `;
    freeForm = `${freeForm} %BITOR(%BITAND(X'0F' : %SUBST(${result} : %LEN(${result}) : 1))`;
    freeForm = `${freeForm} : %BITAND(X'F0' : %SUBST(${factor2} : 1 : 1)))`;
    lines.push(freeForm);
    return { lines, action };
}


export function convertMLHZO(
    opcode: string,
    factor1: string,
    factor2: string,
    result: string,
    resInd1: string,
    resInd2: string,
    resInd3: string,
    extraDCL: string[]
): { lines: string[], action: string } {

    const lines: string[] = [];
    let action = '';
    let freeForm = '';

    // Add a comment with the original statement, for reference purposes
    lines.push(` // MHHZO ${factor2} ${result}`);

    freeForm = `%SUBST(${result}:1:1) = `;
    freeForm = `${freeForm} %BITOR(%BITAND(X'0F' : %SUBST(${result} : 1 : 1))`;
    freeForm = `${freeForm} : %BITAND(X'F0' : %SUBST(${factor2} : %LEN(${factor2}) : 1)))`;
    lines.push(freeForm);
    return { lines, action };
}


export function convertMLLZO(
    opcode: string,
    factor1: string,
    factor2: string,
    result: string,
    resInd1: string,
    resInd2: string,
    resInd3: string,
    extraDCL: string[]
): { lines: string[], action: string } {

    const lines: string[] = [];
    let action = '';
    let freeForm = '';

    // Add a comment with the original statement, for reference purposes
    lines.push(` // MHHZO ${factor2} ${result}`);

    freeForm = `%SUBST(${result}:%LEN(${result}):1) = `;
    freeForm = `${freeForm} %BITOR(%BITAND(X'0F' : %SUBST(${result} : %LEN(${result}) : 1))`;
    freeForm = `${freeForm} : %BITAND(X'F0' : %SUBST(${factor2} : %LEN(${factor2}) : 1)))`;
    lines.push(freeForm);
    return { lines, action };
}
