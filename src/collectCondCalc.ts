
import * as rpgiv from './rpgedit';
import { collectedStmt } from './types'

export function collectCondCalc(allLines: string[], startIndex: number): {
    condStmt: string,
    indexes: number[],
    comments: string[]
} {


    const indexes: number[] = [];
    const comments: string[] = [];
    let condIndy = '';
    let cmtArea = '';
    let conjunction = '';
    let polarization = '';
    let condString = '';

    // read backwards if LR section contains AN/OR otherwise we are at the top of the indy list

    // Walk BACKWARD to find the starting line of the condition
    let firstIndex = startIndex;
    let i = firstIndex;
    for (i = firstIndex; i >= 0; i--) {
        const line = allLines[i];
        if (rpgiv.isComment(line)) {
            comments.push(line);
            indexes.push(i);
            continue;
        }
        else if (rpgiv.isSkipStmt(line)) {
            continue;
        }

        if (rpgiv.getSpecType(line) !== 'c') { break; }

        // Unlike other collectors, we just want to find the top of the indicator stack
        conjunction = rpgiv.getCol(line, 7, 8).toUpperCase().trim();
        const condIndy = rpgiv.getCol(line, 9, 11).toUpperCase().trim();

        firstIndex = i;

        if (conjunction?.trim() === '') { break; }
        if (condIndy?.trim() === '') { break; }

    }
    conjunction = '';
    polarization = '';
    condIndy = '';
    cmtArea = '';
    // read forward and collect conditioning indicators
    for (i = firstIndex; i < allLines.length; i++) {
        const line = allLines[i];

        // Check spec type first - if not a C spec, break out
        if (rpgiv.getSpecType(line) !== 'c') {
            // But if it's a comment or blank, skip it and continue looking
            if (rpgiv.isComment(line)) {
                comments.push(line);
                indexes.push(i);
                continue;
            }
            else if (rpgiv.isSkipStmt(line)) {
                continue;
            }
            // Not a C spec and not a comment/blank, so we're done
            break;
        }

        if (rpgiv.isComment(line)) {
            comments.push(line);
            indexes.push(i);
            continue;
        }
        else if (rpgiv.isSkipStmt(line)) {
            continue;
        }

        // Unlike other collectors, we just want to find the top of the indicator stack
        conjunction = rpgiv.getCol(line, 7, 8).toLowerCase().trim();
        polarization = rpgiv.getCol(line, 9).toLowerCase().trim();
        condIndy = rpgiv.getCol(line, 10, 11).toUpperCase().trim();
        cmtArea = rpgiv.getCol(line, 81, 100);
        // If not conditioned, the bail out
        if ((!conjunction || conjunction.trim() === '') &&
            (!condIndy || condIndy.trim() === '')) {
            break;
            }
        if (conjunction !== '' && conjunction != 'an' && conjunction != 'or') {
            break;  // Break if level break indicator or SR (subroutine) marker.
        }
        if (conjunction?.trim() !== '') {
            if (conjunction === 'an') {
                conjunction = 'AND';
            }
            if (polarization.toLowerCase().startsWith('n')) {
                condString += `${conjunction} (NOT *IN${condIndy}) `;
            }
            else {
                condString += `${conjunction} *IN${condIndy} `;
            }
        }
        else if (condString !== '') { // done with the condition
            break;
        }
        else if (condIndy?.trim() !== '') {
           if (polarization.toLowerCase().startsWith('n')) {
                condString += `(NOT *IN${condIndy}) `;
            }
            else {
                condString += `*IN${condIndy} `;
            }
        }
        if (cmtArea !== '' && conjunction !== '') {
            comments.push(cmtArea);
        }
        indexes.push(i);
    }
    let condStmt: string = '';
    if (condString && condString.trim() !== '') {
        condString = `IF ${condString}`;
        condStmt = condString.trim();
    }

    return {
        condStmt: condStmt,
        indexes: indexes,
        comments: comments
    };

}
