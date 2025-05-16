
import * as vscode from 'vscode';
import * as ibmi from './IBMi'


export function getVarName(lines: string[], startIndex = 0): { varName: string, nextIndex: number } {
    let nameParts: string[] = [];
    let i = startIndex;

    while (i < lines.length) {
        const line = lines[i].padEnd(80, ' ');
        const nameChunk = line.substring(6, 80).trimEnd(); // get from col 7 to 80

        if (nameChunk.endsWith('...')) {
            nameParts.push(nameChunk.slice(0, -3));
            i++;
        } else {
            // If it's the first line or not a long name continuation, fall back to default logic
            if (i === startIndex) {
                return { varName: '', nextIndex: startIndex };
            }

            nameParts.push(nameChunk.trim());
            i++;
            break;
        }
    }

    const fullName = nameParts.join('');
    return { varName: fullName.trim(), nextIndex: i };
}

export function convertChildVar(
    sourceLine: string,
    fullSource: string[],
    currentLineIndex: number
): string {
    let fullMatch = '';
    let overlayTarget = '';
    let overlayOffset = '';
    const overlayRegex = /overlay\s*\(\s*([a-zA-Z0-9_]+)\s*(?::\s*([0-9]+))?\s*\)/i;
    const match = overlayRegex.exec(sourceLine);

    if (!match) {
        if (!(/^dcl-subf\b/i.test(sourceLine))) {
            return sourceLine; // No OVERLAY() or dcl-subf found so return origin sourceLine
        }
    }
    else {
        [fullMatch, overlayTarget, overlayOffset] = match!;
    }

    const targetName = overlayTarget.toLowerCase();
    let nameToken = '';
    let dclType = '';
    // Search backwards for matching D-spec or DCL-DS
    for (let i = currentLineIndex - 1; i >= 0; i--) {
        const line = fullSource[i].trimEnd().toLowerCase();
        nameToken = '';
        let lastIndex = 0;
        if (ibmi.isNotComment(line)) {
            if (ibmi.getSpecType(line) === 'd') {
                dclType = ibmi.getDclType(line).toLowerCase();
                if (["ds", "pr", "pi"].includes(dclType)) {
                    if (line.trimEnd().endsWith('...')) {
                        ({ varName: nameToken, nextIndex: lastIndex } = getVarName(fullSource, i));
                    }
                    else {
                        nameToken = ibmi.getCol(line, 7, 21).trim();
                    }
                    break;
                }
            }
            else if (line.trimStart().startsWith('dcl-')) {
                const match = line.trimStart().match(/^dcl-(ds|pi|pr|proc)\b/i);
                if (match) {
                    dclType = match[1].toLowerCase(); // "ds", "pi", "pr", or "proc"
                    if (line.trimEnd().endsWith('...')) {
                        ({ varName: nameToken, nextIndex: lastIndex } = getVarName(fullSource, i));
                    }
                    else {
                        const match = line.match(/\bdcl-(ds|pi|pr|proc)\s+([a-zA-Z0-9_@#$]+)/i);
                        nameToken = match ? match[2] : '';
                    }
                }
                break;
            }
        }
    }
    // if the parent type is a data structure,
    // then convert the overlay(dsName:x) keyword to pos(x);
    // otherwise, if the parent type is a proce, pr, or pi,
    // then convert any leading 'dcl-subf' to 'dcl-parm'
    if (dclType === 'ds' && nameToken === targetName) {
        const posValue = overlayOffset || '1';
        return sourceLine.replace(overlayRegex, `pos(${posValue})`);
    }
    else if (/^dcl-subf\b/i.test(sourceLine) && ['pi', 'pr', 'proc'].includes(dclType)) {
        sourceLine = sourceLine.replace(/^dcl-subf\b/i, 'dcl-parm');
    }

    // No matching DS found, return original
    return sourceLine;
}