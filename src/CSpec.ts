
import * as vscode from 'vscode';

export function convertCSpec(lines: string[]): string[] {
    if (!Array.isArray(lines) || lines.length === 0) return [];

    const line = lines[0].padEnd(80, ' '); // RPG fixed-format always assumes 80-char line
    const specType = line[5];
    vscode.window.showInformationMessage('convertCSpec called. SpecType: ' + specType);
    if (specType !== 'C') return [];

    const levelBreak = line.substring(6, 8).trim();
    const indicators = line.substring(8, 11).trim();
    const factor1 = line.substring(11, 25).trim();
    const opcode = line.substring(25, 35).trim().toUpperCase();
    const factor2 = line.substring(35, 49).trim();
    const result = line.substring(49, 63).trim();
    const length = line.substring(63, 68).trim();
    const decimals = line.substring(68, 70).trim();
    const resInd1 = line.substring(70, 72).trim();
    const resInd2 = line.substring(72, 74).trim();
    const resInd3 = line.substring(74, 76).trim();
    const extFactor2 = line.substring(35, 80).trim();

    const isFreeFormOpcode = ['IF', 'WHEN', 'ELSEIF', 'DOW', 'DOU'].includes(opcode);

    // If 7–35 are blank, treat as a keyword line
    const preOpcode = line.substring(6, 35).trim();
    if (preOpcode === '') {
        return [line.substring(35).trim()];
    }

    let freeFormLine = '';

    if (isFreeFormOpcode) {
        // e.g., IF extFactor2
        freeFormLine = `${opcode.toLowerCase()} ${extFactor2}`;
    } else if (opcode && factor1 && factor2 && result) {
        // Common 3-operand statement: result = factor1 opcode factor2;
        freeFormLine = `${result} = ${factor1} ${opcode.toLowerCase()} ${factor2};`;
    } else if (opcode && factor1 && factor2) {
        // 2-operand operation, no result
        freeFormLine = `${factor1} ${opcode.toLowerCase()} ${factor2};`;
    } else if (opcode && factor1) {
        // 1-operand operation, like EVAL or MOVE
        freeFormLine = `${opcode.toLowerCase()} ${factor1};`;
    } else {
        // Fallback
        freeFormLine = `${opcode.toLowerCase()} ${factor2};`;
    }

    // Add comment with indicators if any were found
    const indicatorsComment =
        levelBreak || indicators || resInd1 || resInd2 || resInd3
            ? ` // Indicators: ${[levelBreak, indicators, resInd1, resInd2, resInd3].filter(Boolean).join(', ')}`
            : '';

    return [freeFormLine + indicatorsComment];
}
