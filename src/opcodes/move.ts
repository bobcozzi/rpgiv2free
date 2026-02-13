import * as vscode from 'vscode';
import * as rpgiv from '../rpgedit';
import { commands, ExtensionContext, Uri, window } from "vscode";
import * as vartypes from '../vartype';
import { getStructTypeInfo } from '../calcStructLen';


export async function convertMOVE(
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
    // console.log('CODE4IBMi Symbols.variables:', JSON.stringify(symbols.variables, null, 2));

    // === Extract Extender (e.g., from CAT(P)) ===
    const { rawOpcode: rawOpcode, extenders: extender } = rpgiv.splitOpCodeExt(opcode);
    const hasP = extender.includes('P');

    let f1 = '';
    let f2 = '';
    let f1Parm = '';
    let f2Parm = '';
    let ff = '';
    let dateFmt = '*ISO';
    let move: string[] = [];  // resulting operations (if any)

    // This is MOVE/MOVEL Opcodes Bob, what the BITON/BITOFF Factor 2 test?
    // Likely when you cloned the ts from the biton.ts logic?
    if (factor1?.trim() !== '') {
        [f1, f1Parm] = rpgiv.splitFactor(factor1);
    }
    if (factor2?.trim() !== '') {
        [f2, f2Parm] = rpgiv.splitFactor(factor2);
    }
    if (f1 && vartypes.isDateFmt(f1)) {
        dateFmt = f1.toUpperCase();
    }
    // If Factor 1 contains a Date Format such as *ISO
    // then assume this is a move date to non-date or move non-date to date.
    //  result = %CHAR(factor2:factor1);
    //  or
    //  result = %DATE(factor2:factor1);

    const f1a = vartypes.getTypeInfo(symbols, f1);
    const f2a = vartypes.getTypeInfo(symbols, f2);
    const rfa = vartypes.getTypeInfo(symbols, result);

    console.log(`${f1} ${opcode} ${f2}  ${result})`);
    console.log(`${opcode} Factor 1 ${f1} is ${f1a?.type}(${f1a?.length})`);
    console.log(`${opcode} Factor 2 ${f2} is ${f2a?.type}(${f2a?.length})`);
    console.log(`${opcode} Result   ${result} is ${rfa?.type}(${rfa?.length})`);

    const bF2IsLiteral = vartypes.isLiteral(f2);
    const bF2DecLiteral = (bF2IsLiteral && vartypes.isDecLiteral(f2));
    if (bF2DecLiteral && f2a) {
        f2a.type = "DEC";
    }
    const f2DTS = ['DATE', 'TIME', 'TIMESTAMP'].includes(f2a?.type || '');
    const rfDTS = ['DATE', 'TIME', 'TIMESTAMP'].includes(rfa?.type || '');
    let oper = '';
    const isResultIndicator = result.trim().toUpperCase().startsWith('*IN');
    const factor2Upper = f2.trim().toUpperCase();
    const isFactor2Indicator =
        factor2Upper.startsWith('*IN') ||
        factor2Upper === 'ON'  ||
        factor2Upper === 'OFF' ||
        factor2Upper === "'1'" ||
        factor2Upper === "'0'";
    if (rawOpcode === 'MOVE') {
        oper = 'evalR';
    }
    // If no DATE Format is specified in Factor1,
    // then instead of defaulting to ISO,
    // MOVE/MOVEL default to the date format
    // for the date variable used on the opcode.
    // Fortunately, so does %CHAR(dateVar) when the
    // date format (parameter 2) is omitted.

    if (f2a && f2DTS && (!f1 || f1 === '')) {
        dateFmt = f2a.type;
    }
    else if (rfa && rfDTS && (!f1 || f1 === '')) {
        dateFmt = rfa.type;
    }

    // Handle date to any or any to date assignment
    if (f2DTS && rfDTS) {  // Date to Date? Just plain assignment
        ff = `${result} = ${f2};`;
        lines.push(ff);
    } else if (!f2DTS && rfDTS) { // Factor 2 is not date, but Result is date?
        if (['DATE', 'TIME', 'TIMESTAMP'].includes(dateFmt)) {
            // If not Factor 1 is specified then dateFmt will be DataType
            // This is because the code4i symbols table doesn't fully populate
            // the symbols for dates or data structures and '*SYS' isn't a thing
            ff = `${oper} ${result} = %DATE(${f2})`;
        }
        else {
            ff = `${oper} ${result} = %DATE(${f2} : ${dateFmt})`;
        }
        lines.push(ff);
    } else if (f2DTS && !rfDTS) {  // Factor 2 is date, but Result is not date?
        let lval = '';
        let rval = '';
        let dateLen = (dateFmt.endsWith('0')) ? 8 : 10;
        let trim0 = 0;
        if (['*ISO', '*USA', '*EUR', '*JIS'].some(fmt => dateFmt.startsWith(fmt))) {
            dateLen = 10;
            trim0 = 2;
        }
        else if (['*MDY', '*YMD', '*DMY'].some(fmt => dateFmt.startsWith(fmt))) {
            dateLen = 8;
            trim0 = 2;
        }
        else if (['*CMDY', '*CYMD', '*CDMY'].some(fmt => dateFmt.startsWith(fmt))) {
            dateLen = 9;
            trim0 = 2;
        }
        else if (dateFmt.startsWith('*JUL')) {
            dateLen = 6;
            trim0 = 1;
        }
        else if (dateFmt.startsWith('*LONGJUL')) {
            dateLen = 8;
            trim0 = 1;
        }

        dateLen -= (dateFmt.endsWith('0')) ? trim0 : 0;

        // TODO: Handle struct to date and date to struct via MOVE/MOVEL opcodes

        if (rfa && ['STRUCT', 'CHAR', 'VARCHAR', 'GRAPH', 'VARGRAPH'].includes(rfa?.type)) {
            if (typeof rfa?.length === 'number' && rfa.length > dateLen) {
                let newStart = (rawOpcode === 'MOVE') ? (rfa.length - dateLen) + 1 : 1;
                lval = `%SUBST(${result}: ${newStart} : ${dateLen})`;
            }
            else {
                lval = `${result}`.trimStart();
            }
            if (['DATE', 'TIME', 'TIMESTAMP'].includes(dateFmt)) {
                rval = `%CHAR(${f2})`;
            }
            else {
                rval = `%CHAR(${f2} : ${dateFmt})`;
            }
        }
        else if (['INT', 'UNS', 'ZONED', 'PACKED', 'DEC', 'BINDEC'].includes(rfa?.type || '')) {
            if (['DATE', 'TIME', 'TIMESTAMP'].includes(dateFmt)) {
                rval = `%DEC(${f2})`;
            }
            else {
                rval = `%DEC(${f2} : ${dateFmt})`;
            }
            lval = `${result}`.trimStart();
        }
        ff = `${oper} ${lval} = ${rval}`;
        lines.push(ff);
    }  // end Date handling

    else if (!hasP && (rfa && ['STRUCT', 'CHAR', 'VARCHAR', 'GRAPH', 'VARGRAPH'].includes(rfa?.type) &&
        (f2a && ['STRUCT', 'CHAR', 'VARCHAR', 'GRAPH', 'VARGRAPH', 'CONST', 'LITERAL'].includes(f2a?.type)))) {
        // Begin char-to-char based variable handling

        if (isResultIndicator || isFactor2Indicator) {
            lines.push(`${result} = ${factor2}`);
            return { lines, action }; // stop before adding a second line
        }
        else if (factor2.startsWith('*')) { // hasP is false in this block
            lines.push(`${oper} ${result} = ${factor2}`);
            return { lines, action }; // stop before adding a second line
        }

        // When Factor 2 is a numeric literal or named constant that is a numeric value
        // Then treate it like a Decimal/Numeric field being copied to the target/result field
        const bF2Literal = (f2a === null || vartypes.isLiteral(f2));
        let f2Len = (f2a && f2a.length) ? f2a.length : 0;
        let f2Size = `%LEN(${f2})`;
        let rfSize = `%LEN(${result})`;
        let copyLen = `%MIN(${f2Size} : ${rfSize})`;
        // Example: MOVEL f2 to result  => %SUBST(result : 1 : len(f2)) = f2;
        let startPos: string;
        if (rawOpcode === 'MOVEL') {
            startPos = '1';
        } else {
            startPos = `(${rfSize} - ${copyLen}) + 1`;
        }
        if (typeof rfa?.length !== 'number' || f2Len === 0) {
            lines.push(`${oper} %SUBST(${result} : ${startPos} : ${copyLen}) = ${f2}`);
        }
        else if (typeof rfa?.length === 'number' && f2Len > 0) {
            if (f2Len >= rfa.length) {
                lines.push(`${oper} ${result} = ${f2}`);
            }
            else {
                lines.push(`%SUBST(${result} : ${startPos} : ${copyLen}) = ${f2}`);
            }
        }

    }
    else {
        if ((f2a && rfa) && ((['PACKED', 'DEC', 'DECIMAL', 'ZONED', 'INT', 'UNS', 'FLOAT'].includes(f2a.type) &&
            ['STRUCT', 'CHAR', 'VARCHAR', 'GRAPH', 'VARGRAPH'].includes(rfa.type)) ||

            (['STRUCT', 'CHAR', 'VARCHAR', 'GRAPH', 'VARGRAPH', 'LITERAL', 'CONST'].includes(f2a.type) &&
                ['PACKED', 'ZONED', 'INT', 'UNS', 'FLOAT'].includes(rfa.type))))
        {
            let rType = (rfa.type === 'PACKED') ? 'DEC' : rfa.type;
              // Is Char to Numeric or Numeric to numeric?
            if ((f2a && rfa) && ['DEC','PACKED', 'ZONED', 'INT', 'UNS', 'FLOAT'].includes(rType)) {
                let rfLen = rfa.length;
                let rfDec = (typeof rfa.decimals === 'number') ? rfa.decimals : 0;
                if (['INT', 'UNS', 'FLOAT'].includes(rType)) {
                    lines.push(`${result} = %${rType}(${f2})`);
                }
                else
                {
                    lines.push(`${result} = %${rType}(${f2} : ${rfLen} : ${rfDec})`);
                }
            }
            else { // Is Numeric to non-numeric?
                // lines.push(`${result} = %${rType}(${f2})`);
                lines.push(`${oper} ${result} = %editC(${f2} : 'X')`);
            }
        }
        else {  // Numeric to Numeric or Char to Char or "like to like"
            if ((f2a && rfa) &&
                ( ['DEC', 'PACKED', 'ZONED', 'INT', 'UNS', 'FLOAT'].includes(rfa.type) ||
                    ['DEC', 'PACKED', 'ZONED', 'INT', 'UNS', 'FLOAT'].includes(f2a.type) &&
                    f2a.type != rfa.type)) {
                lines.push(`${oper} ${result} = ${f2}`);
            }
            else {
                lines.push(`${result} = ${f2}`);
            }
        }
    }

    return { lines, action };
}