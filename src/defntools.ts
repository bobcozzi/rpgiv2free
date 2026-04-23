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

import * as rpgiv from './rpgedit';

export function getFieldAttr(
    varName: string,
    allLines: string[],
    startLine: number
): {
    fieldName: string;
    fieldType: string;
    fieldLen: number;
    decPos: number;
    extraAttr: string;
    } {
    // Deprecated NOT USED
    let fieldType = '';
    let fieldLen = 0;
    let decPos = 0;
    let extraAttr = '';

    const nameUpper = varName.trim().toUpperCase();

    for (let i = startLine; i < allLines.length; i++) {
        const line = allLines[i].trim();

        // --- Fixed-format D-spec (columns 7-21: name, 24: type, 25-29: length, 31-33: decimals, 44-80: keywords) ---
        if (rpgiv.getSpecType(line) === 'd') {
            // Extract name (columns 7-21)
            const name = line.substring(6, 21).trim().toUpperCase();
            if (name === nameUpper) {
                fieldType = rpgiv.getColUpper(line, 40); // Data Attribute
                if (!fieldType || fieldType.trim() === '') {
                    fieldType = rpgiv.getColUpper(line, 24, 25).trim();
                }
                fieldLen = parseInt(line.substring(24, 29).trim(), 10) || 0;
                decPos = parseInt(line.substring(30, 33).trim(), 10) || 0;
                extraAttr = line.substring(43, 80).trim();

                // Collect additional keyword lines
                let j = i + 1;
                while (j < allLines.length) {
                    const nextLine = allLines[j];
                    if (rpgiv.getSpecType(nextLine) === 'd' &&
                        nextLine.substring(6, 43).trim() === '' && // columns 7-43 blank
                        nextLine.substring(43, 80).trim() !== ''   // columns 44-80 not blank
                    ) {
                        const moreAttr = nextLine.substring(43, 80).trim();
                        extraAttr += (extraAttr ? ' ' : '') + moreAttr;
                        j++;
                    } else {
                        break;
                    }
                }
                break;
            }
        }

        if (!fieldType || fieldType === '') {
            // --- Free-format dcl-s or dcl-ds ---
            // Example: dcl-s myfield packed(7:2) inz(0);

            // List of known RPG IV data types
            const typeKeywords = [
                'varchar', 'char', 'packed', 'zoned', 'int', 'uns', 'date', 'time', 'timestamp',
                'vargraphic', 'graphic', 'pointer', 'object', 'float'
            ];

            // Build a regex to match any of the types, e.g. packed(7:2), char(10), etc.
            const typeRegex = new RegExp(
                `\\b(${typeKeywords.join('|')})\\s*\\((\\d+)(?::(\\d+))?\\)`,
                'i'
            );

            // Find the dcl-s/dcl-ds line and extract the variable name
            const { start: ds, cont: dc } = rpgiv.getIdentClasses(rpgiv.getRPGIVFreeSettings().nationalVariantChars);
            const dclMatch = line.match(new RegExp(`dcl-(s|ds)\\s+([${ds}][${dc}]*)`, 'i'));
            if (dclMatch) {
                const [, , name] = dclMatch;
                if (name.toLowerCase() === nameUpper) {
                    // Now search for the type keyword and its parameters
                    const typeMatch = line.match(typeRegex);
                    if (typeMatch) {
                        fieldType = typeMatch[1].toLowerCase();
                        fieldLen = parseInt(typeMatch[2], 10);
                        decPos = typeMatch[3] ? parseInt(typeMatch[3], 10) : 0;
                    } else {
                        // Handle types without parameters, e.g. pointer, object, date, time, timestamp, float
                        const simpleTypeRegex = new RegExp(`\\b(${typeKeywords.join('|')})\\b`, 'i');
                        const simpleTypeMatch = line.match(simpleTypeRegex);
                        if (simpleTypeMatch) {
                            fieldType = simpleTypeMatch[1].toLowerCase();
                            fieldLen = 0;
                            decPos = 0;
                        }
                    }
                    // Capture any extra attributes (everything after the type declaration)
                    const afterType = line.split(name)[1];
                    extraAttr = afterType ? afterType.replace(typeRegex, '').replace(/^\s*;/, '').trim() : '';
                    break;
                }
            }
        }
    }

    return {
        fieldName: nameUpper,
        fieldType,
        fieldLen,
        decPos,
        extraAttr,
    };
}