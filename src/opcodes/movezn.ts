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
