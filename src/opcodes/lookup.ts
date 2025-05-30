
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
    let resBIF = '';
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

    if (arrIndex && arrIndex.trim() !== '') {  // Has an Array Index?

        lookup = `${target} = ${bif}(${factor1} : ${arr} ${arrIndex})`;
    }
    else {  // if no array index, then assign the resulting indicator as a result so it runs correctly
        if (resInd3 && resInd3 !== '') {
            target = `*in${resInd3}`;
            compOper = '=';
            resBIF = '%EQUAL()';
        }
        else if (resInd2 && resInd2 !== '') {
            target = `*in${resInd2}`;
            compOper = '<';
            resBIF = '%FOUND()';
        }
        else if (resInd1 && resInd1 !== '') {
            target = `*in${resInd1}`;
            compOper = '>';
            resBIF = '%FOUND()';
        }
        if (bif.startsWith('%T')) {
            lookup = `${target} = (${bif}(${factor1} : ${arr} ${arrIndex}) and ${resBIF})`;
        }
        else {
            lookup = `${target} = (${bif}(${factor1} : ${arr} ${arrIndex}) > 0 and ${resBIF})`;
        }
    }
    if (lookup && lookup.trim() !== '') {
        lines.push(lookup);
    }
    if (resInd1 && resInd1.trim() !== '') {
        if (compOper !== '=') {
            lines.push(`*in${resInd1} = %FOUND()`);
        }
    }
    if (resInd2 && resInd2.trim() !== '') {
        if (compOper !== '<') {
            lines.push(`*in${resInd2} = %FOUND()`);
        }
    }
    if (resInd3 && resInd3.trim() !== '') {
        if (compOper !== '=') {
            lines.push(`*in${resInd3} = %EQUAL()`);
        }
    }

    return { lines, action };
}
