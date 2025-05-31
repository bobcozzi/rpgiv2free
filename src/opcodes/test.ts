

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
    let action = '';  // reserved for future use

    let freeForm = '';
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
    // Add a comment with the original statement, for reference purposes
    lines.push(` // TESTZ ${factor2} ${result} ${resInd1} ${resInd2} ${resInd3}`);

    if (resInd1 && resInd1.trim() !== '') {
        freeForm = `*in${resInd1} = (%BITAND(X'F0': %SUBST(${result}:1:1)) = %BITAND(X'F0':'A'))`;
        lines.push(freeForm);
    }
    if (resInd1 && resInd1.trim() !== '') {
        freeForm = `*in${resInd2} = (%BITAND(X'F0': %SUBST(${result}:1:1)) = %BITAND(X'F0':'J'))`;
        lines.push(freeForm);
    }
    if (resInd1 && resInd1.trim() !== '') {
        freeForm = `*in${resInd3} = NOT (%BITAND(X'F0': %SUBST(${result}:1:1)) =`;
        freeForm += ` %BITAND(X'F0':'A') or %BITAND(X'F0': %SUBST(${result}:1:1)) = %BITAND(X'F0':'J'))`;
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

