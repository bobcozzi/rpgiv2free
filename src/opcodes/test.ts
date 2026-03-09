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


export function convertTESTZ(
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

    // Add a comment with the original statement, for reference purposes
    lines.push(` // TESTZ ${factor2} ${result} ${resInd1} ${resInd2} ${resInd3}`);

    if (resInd1 && resInd1.trim() !== '') {
        const freeForm = `*in${resInd1} = (%BITAND(X'F0': %SUBST(${result}:1:1)) = %BITAND(X'F0':'A'))`;
        lines.push(freeForm);
    }

    if (resInd2 && resInd2.trim() !== '') {
        const freeForm = `*in${resInd2} = (%BITAND(X'F0': %SUBST(${result}:1:1)) = %BITAND(X'F0':'J'))`;
        lines.push(freeForm);
    }

    if (resInd3 && resInd3.trim() !== '') {
        // FIXED: Build as single string OR separate properly
        const freeForm = `*in${resInd3} = NOT (%BITAND(X'F0': %SUBST(${result}:1:1)) = %BITAND(X'F0':'A') or %BITAND(X'F0': %SUBST(${result}:1:1)) = %BITAND(X'F0':'J'))`;
        lines.push(freeForm);
    }

    return { lines, action };
}


export function convertTESTB(
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
    let action = '';  // reserved for future use

    let freeForm = '';
    let bitPattern = '';
    function isBitLiteral(factor2: string): boolean {
        return /^'[0-7]{1,8}'$/.test(factor2);
    }
    if (isBitLiteral(factor2)) {
        bitPattern = rpgiv.bitStringToHex(factor2);
    }
    else {
        bitPattern = factor2.trim();
    }
    // Add a comment with the original statement, for reference purposes
    lines.push(` // TESTB ${factor2} ${result} ${resInd1} ${resInd2} ${resInd3}`);

    if (resInd1 && resInd1.trim() !== '') {
        freeForm = `*in${resInd1} = %bitand(${result}:${bitPattern}) = x'00'`;
        lines.push(freeForm);
    }
    if (resInd2 && resInd2.trim() !== '') {
        freeForm = `*in${resInd2} = %bitand(${result}:${bitPattern}) <> x'00'`;
        freeForm += ` and %bitand(${result}:${bitPattern}) <> ${bitPattern}`;
        lines.push(freeForm);

    }
    if (resInd3 && resInd3.trim() !== '') {
        freeForm = `*in${resInd3} =  %bitand(${result}:${bitPattern}) = ${bitPattern}`;
        lines.push(freeForm);
    }

    return { lines, action };
}


export function convertBITON(
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
    let action = '';  // reserved for future use

    let freeForm = '';
    let bitPattern = '';
    function isBitLiteral(factor2: string): boolean {
        return /^'[0-7]{1,8}'$/.test(factor2);
    }
    if (isBitLiteral(factor2)) {
        bitPattern = rpgiv.bitStringToHex(factor2);
    }
    else {
        bitPattern = factor2.trim();
    }
    // Add a comment with the original statement, for reference purposes
    lines.push(` // BITON ${factor2} ${result} ${resInd1} ${resInd2} ${resInd3}`);

    freeForm = `${result} = %bitor(${result}  : bitPattern)`;
    lines.push(freeForm);

    return { lines, action };
}

export function convertBITOFF(
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
    let action = '';  // reserved for future use

    let freeForm = '';
    let bitPattern = '';
    function isBitLiteral(factor2: string): boolean {
        return /^'[0-7]{1,8}'$/.test(factor2);
    }
    if (isBitLiteral(factor2)) {
        bitPattern = rpgiv.bitStringToHex(factor2);
    }
    else {
        bitPattern = factor2.trim();
    }
    // Add a comment with the original statement, for reference purposes
    lines.push(` // BITOFF ${factor2} ${result} ${resInd1} ${resInd2} ${resInd3}`);

    freeForm = `${result} = %bitand(${result} : %bitnot(${bitPattern}))`;
    lines.push(freeForm);

    return { lines, action };
}


export function convertTESTN(
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
    let action = '';  // reserved for future use

    let freeForm = '';

    // Add a comment with the original statement, for reference purposes
    lines.push(` // TESTN ${result} ${resInd1} ${resInd2} ${resInd3}`);

    if (resInd1 && resInd1.trim() !== '') {
        freeForm = `*in${resInd1} = (%CHECK('0123456789':${result}) = 0) `;
        lines.push(freeForm);
    }
    if (resInd2 && resInd2.trim() !== '') {
        freeForm = `*in${resInd1} = (%CHECK('0123456789 ':${result}) = 0) and `;
        freeForm += `%SCANR(' ':${result}) < %CHECK(' ':${result})`;
        lines.push(freeForm);

    }
    if (resInd3 && resInd3.trim() !== '') {
        freeForm = `*in${resInd3} =  (${result} = ' ')`;
        lines.push(freeForm);
    }

    return { lines, action };
}

