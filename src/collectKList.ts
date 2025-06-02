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
        const line = allLines[i].padEnd(80, ' ');
        const specType = rpgiv.getSpecType(line); // Get fixed-format Spec type
        if (rpgiv.isValidFixedFormat(line)) {
            if (['p', 'o', 'i', 'd', 'h'].includes(specType)) continue;
        }
        const len = line.trim().length;
        if (len >= 2 && len <= 20) {
            if (len == 2 && line === '**') break;
            if (len > 2 && line.toUpperCase().startsWith('**CTDATA')) break;
        }
        if (rpgiv.isValidFixedFormat(line) && rpgiv.getSpecType(line) === 'c') {
            // Look for a KLIST definition
            const opcode = rpgiv.getRawOpcode(line).toUpperCase();
            if (opcode === 'KLIST') { // Start of a keylist?
                const klistName = getFactor1(line);
                const keyFields: string[] = [];
                // Scan following lines for KFLD entries
                for (let j = i + 1; j < allLines.length; j++) {
                    const nextLine = allLines[j].padEnd(80, ' ');
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