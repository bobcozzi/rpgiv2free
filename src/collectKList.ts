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
import * as rpgiv from './rpgedit';

export const keyListCache = new Map<string, string[]>();

// Scan the entire RPG IV fixed-format Calc Spec for KLIST/KFLD entries
// Create a cache of key lists to be used in free format.
function getFactor1(line: string): string {
    return rpgiv.getCol(line, 12, 25).trim().toUpperCase();
}
function getResult(line: string): string {
    return rpgiv.getCol(line, 50, 63).trim();
}

export function getKLISTSize(): number {
    return keyListCache.size;
}
export function getKeyList(klistName: string): string {
  const fields = keyListCache.get(klistName.toUpperCase());
  if (!fields || fields.length === 0) return klistName;
  return `(${fields.join(' : ')})`;
}

export function collectKLIST() {
    keyListCache.clear(); // Clear cache at the start of each conversion
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active editor found.');
        return;
    }
    const doc = editor.document;
    const allLines = doc.getText().split(rpgiv.getEOL());

    for (let i = 0; i < allLines.length; i++) {
        const line = allLines[i];
        const len = line.trim().length;

        if (rpgiv.isEOP(line)) {
            break;
        }

        if (rpgiv.isValidFixedFormat(line) && rpgiv.getSpecType(line) === 'c') {
            // Look for a KLIST definition
            const opcode = rpgiv.getRawOpcode(line).toUpperCase();
            if (opcode === 'KLIST') { // Start of a keylist?
                const klistName = getFactor1(line);
                const keyFields: string[] = [];
                // Scan lines for KFLD entries
                for (let j = i + 1; j < allLines.length; j++) {
                    const nextLine = allLines[j].padEnd(80, ' ');
                    if (rpgiv.isSkipStmt(nextLine)) { continue; }
                    if (rpgiv.isEOP(nextLine)) { break; }
                    const kfld = rpgiv.getRawOpcode(nextLine).toUpperCase();
                    if (kfld === 'KFLD') {
                        keyFields.push(getResult(nextLine));
                    } else {
                        break; // Stop at first non-KFLD line
                    }
                }
                keyListCache.set(klistName, keyFields);
            }
        }
    }
}