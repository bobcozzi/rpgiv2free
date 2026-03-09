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


export function convertLOOKUP(
    opcode: string,
    factor1: string,
    factor2: string,
    result: string,
    resInd1: string,
    resInd2: string,
    resInd3: string,
    extraDCL: string[]
): { lines: string[], action: string } {

    const config = rpgiv.getRPGIVFreeSettings();
    const lines: string[] = [];
    let action = '';  // reserved for future use

    let lookup = '';
    let bif = '';
    let extraIndy = '';
    let compBool = '';
    let compOper = '';
    let arrIndex = '';
    let target = '';
    const [arr, idx] = rpgiv.splitArray(factor2);

    if (idx && !/^\d+$/.test(idx.trim())) {
        target = idx.trim();
        arrIndex = `:${target}`;
    }
    // build %LOOKUPxx() built-in function name
    if (resInd1.trim() !== '') compBool = 'G';
    if (resInd2.trim() !== '') compBool = 'L';
    if (resInd3.trim() !== '') {
        compBool += 'E';
    }
    else {
        compBool += 'T';
    }
    if (compBool === 'E') {
        compBool = '';
    }
    if (result && result.trim() !== '') {
        bif = `%TLOOKUP${compBool}`;  // Table Lookup
    }
    else {
        bif = `%LOOKUP${compBool}`;  // Array Lookup
    }

    if (bif === '%LOOKUP' || bif === '%TLOOKUP') { // Lookup EQ only?
        lookup = '';
        if (arrIndex && arrIndex.trim() !== '') {  // Has an Array Index?
            lines.push(`${target} = ${bif}(${factor1} : ${arr} ${arrIndex})`);
            if (resInd3 && resInd3 !== '') {
                lines.push(`*in${resInd3} = (${target} > 0)`);
            }
        }
        else {
            if (resInd3 && resInd3 !== '') {
                lines.push(`*in${resInd3} = (${bif}(${factor1} : ${arr}) > 0)`);
            }
        }
    }
    else {  // Any other %LOOKUPxx() function with 1 or 2 indy's
        //  1,2
        //  1,3
        //  2,3
        //  1
        //  2
        //  3
        const indyCount = [resInd1, resInd2, resInd3].filter(s => s && s.trim() !== '').length;

        if (arrIndex && arrIndex.trim() !== '') {  // Has an Array Index?
            lines.push(`${target} = ${bif}(${factor1} : ${arr} ${arrIndex})`);
        }
        else {
            let targetIndy = '';
            if (resInd3 && resInd3 !== '') {
                targetIndy = resInd3;
            }
            else if (resInd2 && resInd2 !== '') {
                targetIndy = resInd2;
            }
            else if (resInd1 && resInd1 !== '') {
                targetIndy = resInd1;
            }

            lines.push(`*IN${targetIndy} = (${bif}(${factor1} : ${arr} ${arrIndex}) > 0)`);
        }
        if (resInd3 && resInd3 !== '') {
            lines.push(`*IN${resInd3} = %EQUAL()`)
            extraIndy = ' and NOT %EQUAL()';
            resInd3 = '';
        }
        if (resInd2 && resInd2 !== '') {
            if (indyCount > 1) {
                lines.push(`*IN${resInd2} = %FOUND() and NOT %EQUAL()`);
            }
            else {
                lines.push(`*IN${resInd2} = %FOUND()`)
            }
            resInd2 = '';
        }
        if (resInd1 && resInd1 !== '') {
            if (indyCount > 1) {
                lines.push(`*IN${resInd1} = %FOUND() and NOT %EQUAL()`);
            }
            else {
                lines.push(`*IN${resInd1} = %FOUND()`)
            }
            resInd1 = '';
        }


    }

    return { lines, action };
}
