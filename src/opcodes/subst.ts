import * as vscode from 'vscode';
import { commands, ExtensionContext, Uri, window } from "vscode";

import * as rpgiv from '../rpgedit';
import * as vartypes from '../vartype';
import { getStructTypeInfo } from '../calcStructLen';

export async function convertSUBST(
    opcode: string,
    factor1: string,
    factor2: string,
    result: string,
    extraDCL: string[]
): Promise<{ lines: string[], action: string }> {
    const lines: string[] = [];
    let action = '';

    const config = rpgiv.getRPGIVFreeSettings();

    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
        return { lines: ['// No active editor found.'], action: '' };
    }
    const uri = activeEditor.document.uri;
    const symbols = await commands.executeCommand(`vscode-rpgle.server.getCache`, uri) as any;

    const { rawOpcode: rawOpcode, extenders: extender } = rpgiv.splitOpCodeExt(opcode);
    const hasP = extender.includes('P');

    let exprParts: string[] = [];

    let f1 = '';
    let f2Var = '';
    let f2Parm = '';
    let source = '';
    let freeFormStmt = '';

    // === Parse Factor 2 (source:startPos) ===
    let sourceVar = '';
    let sourceStart = '1';
    let sourceLen = `%len(${result})`;
    let expr = '';  // final free format express
    let bPlainSUBST = false;


    // SUBST Opcode:
    //    F1 = Length or empty for "entire string until end of it)
    //    F2 = Variable with optional 2nd argument of starting position
    //  %SUBST( F2Var : F2Start : F1)
    if (factor1?.trim() !== '') {
        f1 = factor1;
    }
    if (factor2?.trim() !== '') {
        [f2Var, f2Parm] = rpgiv.splitFactor(factor2);
    }

    const f1a = vartypes.getTypeInfo(symbols, f1);
    const f2a = vartypes.getTypeInfo(symbols, f2Var);
    const rfa = vartypes.getTypeInfo(symbols, result);

    let f2Start: number = 0;
    if (f2Parm?.trim() !== '') {
        const parsed = Number(f2Parm.trim());
        f2Start = Number.isFinite(parsed) ? parsed : 0;
    }

    let f1Len: number = 0;
    let copyLen = '';
    let f1IsVariable: boolean = false;

    if (f1?.trim() !== '') {
        const f1Info = vartypes.getTypeInfo(symbols, f1);
        if (f1Info?.type === 'CONST') {
            // f1 is a known variable/constant
            f1IsVariable = true;
        } else if (vartypes.isNumericLiteral(f1)) {
            // f1 is a numeric literal
            f1Len = Number(f1.trim());
        }
        // else: f1 is unrecognized (handle as literal?)


        if (f1IsVariable) {
            source = `${f1}`;  // Use variable name
            copyLen = `${f1}`;  // Use variable length
        } else if (f1Len > 0) {
            source = `${f1Len}`;  // Use numeric value
            copyLen = `${f1Len}`;  // Use variable length
        }
    }

    if (f2Start > 0) {
        if (source && source != '') {
            source = `${f2Start} : ${source}`;
        }
        else
        {
            source = `${f2Start}`;
        }
    }
    else if (f1Len > 0) {
        source = `1 : ${source}`;
    }
    if ((f1Len == 0 && f2Start == 0) || (!f1IsVariable && f1a?.length && f1Len >= f1a.length && f2Start <= 1)) {
        source = f2Var;
    }
    else {
        source = `%SUBST(${f2Var} : ${source})`;
    }


    if (hasP) {
        freeFormStmt = `${result} = ${source}`;
    }
    else {
        freeFormStmt = `%SUBST(${result}:1: %MIN(%LEN(${result}) : ${copyLen})) = ${source}`;
    }

    const orgStmt = ` // ${factor1}  ${opcode}  ${factor2}  ${result}`
    lines.push(orgStmt);
    lines.push(freeFormStmt);

    return { lines, action };
}
