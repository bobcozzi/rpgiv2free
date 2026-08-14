// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 1996-2026 by R. Cozzi, Jr.
// @author BobCozzi

import * as rpgiv from './rpgtools';
import { configSettings } from './rpgtools';
import {
    getInputSpecType,
    isPgmField,
    isPgmRecIdCont,
} from './iSpecs';

interface RICCondition {
    position: number;
    compareValue: string;
    operator: '=' | '<>';
    sequence: number;
}

/**
 * Parses fixed RIC entries from columns 23-46.
 * Layout per RIC entry (8 chars): Pos(5) + N(1) + Type(1 C/Z/D) + Compare(1)
 * Example: "    1 CA" and "    3NCD" -> RecID_Check(1) = 'A', RecID_Check(3) <> 'D'
 */
function parseRICCodes(ricString: string): RICCondition[] {
    const rics: RICCondition[] = [];

    if (!ricString || ricString.trim().length === 0) return rics;

    const src = ricString.padEnd(24, ' ');
    let sequence = 0;
    const starts = [0, 8, 16];

    for (const start of starts) {
        const entry = src.slice(start, start + 8);
        const positionTxt = entry.slice(0, 5).trim();
        if (!/^\d+$/.test(positionTxt)) continue;

        const notFlag = entry.charAt(5).toUpperCase();
        const compareType = entry.charAt(6).toUpperCase();
        const compareValue = entry.charAt(7);

        if (!['C', 'Z', 'D'].includes(compareType)) continue;
        if (!compareValue.trim()) continue;

        rics.push({
            position: parseInt(positionTxt, 10),
            compareValue: compareValue.trim(),
            operator: notFlag === 'N' ? '<>' : '=',
            sequence: ++sequence
        });
    }


    return rics;
}

/**
 * Collects RIC codes from header line and any AND/OR continuation lines
 * Returns all RICs grouped with their logical operators (AND vs OR relationships)
 * For continuation lines, checks positions 16-18 for logical relationship indicator
 */
function collectRICsWithContinuations(
    lines: string[],
    headerLineIndex: number = 0
): Array<{ rics: RICCondition[]; logicalOp?: 'AND' | 'OR' }> {
    const result: Array<{ rics: RICCondition[]; logicalOp?: 'AND' | 'OR' }> = [];

    // Parse header line RICs
    const headerLine = lines[headerLineIndex].padEnd(80, ' ');
    const headerRicCodes = rpgiv.getCol(headerLine, 23, 46);
    const headerRics = parseRICCodes(headerRicCodes);
    if (headerRics.length > 0) {
        result.push({ rics: headerRics });
    }

    // Look ahead for AND/OR continuation lines
    for (let i = headerLineIndex + 1; i < lines.length; i++) {
        const line = lines[i].padEnd(80, ' ');

        // Skip comment lines
        if (rpgiv.isComment(line)) continue;

        // Skip blank lines
        if (!line.trim()) continue;

        if (!isPgmRecIdCont(line)) {
            // Not a continuation, stop looking
            break;
        }

        // Parse RIC codes from continuation line (cols 23-46)
        const contRicCodes = rpgiv.getCol(line, 23, 46);
        const contRics = parseRICCodes(contRicCodes);
        if (contRics.length > 0) {
            const seqType = rpgiv.getColUpper(line, 16, 18).trim();
            const logicalOp = seqType === 'OR' ? 'OR' : 'AND';
            result.push({ rics: contRics, logicalOp });
        }
    }

    return result;
}

/**
 * Generates RIC test comment using single RecID_Check work field with array
 * Handles AND/OR continuation groups to generate proper conditional logic
 * For example: RecID_Check Char(3) DIM(3) Pos(1);
 * Comments:
 *   // TEST: read cca9831 cca9831_NS_01;
 *   // TEST: *IN01 = ((RecID_Check(1) = 'A' and RecID_Check(3) <> 'D') or (RecID_Check(2) = 'B'));
 */
function generateRICOutput(
    ricGroups: Array<{ rics: RICCondition[]; logicalOp?: 'AND' | 'OR' }>,
    recIdInd: string,
    fileName: string,
    dsName: string
): string[] {
    const output: string[] = [];

    if (ricGroups.length === 0) return output;

    // Find the maximum position across all RIC groups
    const allRics = ricGroups.flatMap(g => g.rics);
    const maxPosition = Math.max(...allRics.map(ric => ric.position));

    // Generate RecID_Check field with array dimension
    output.push(`  RecID_Check Char(1) DIM(${maxPosition}) Pos(1);`);

    // Generate READ comment (original spec format → new DS name)
    output.push(`  // TEST: read ${fileName} ${dsName};`);

    // Generate test condition comment with AND/OR grouping
    const conditionParts = ricGroups.map((group, idx) => {
        const groupConditions = group.rics
            .map(ric => `RecID_Check(${ric.position}) ${ric.operator} '${ric.compareValue}'`)
            .join(' and ');

        // Wrap in parentheses if there are multiple groups and this is not the first
        if (ricGroups.length > 1 && group.rics.length > 1) {
            return `(${groupConditions})`;
        }
        return groupConditions;
    });

    // Join groups with their logical operators
    let fullCondition = conditionParts[0];
    for (let i = 1; i < conditionParts.length; i++) {
        const logicalOp = ricGroups[i].logicalOp || 'AND';
        fullCondition += ` ${logicalOp.toLowerCase()} ${conditionParts[i]}`;
    }

    output.push(`  // TEST: *IN${recIdInd} = (${fullCondition});`);
    return output;
}

function buildProgramRecordDSName(
    fileName: string,
    seqType: string,
    recIdInd: string
): string {
    const parts = [fileName];

    if (seqType) {
        parts.push(seqType);
    }

    if (recIdInd) {
        parts.push(recIdInd);
    }

    return parts.join('_');
}

function convertProgramFieldLine(line: string, inDataStructure: boolean, fallbackIndex: number): string[] {
    const src = line.padEnd(80, ' ');
    if (!isPgmField(src)) return [];

    const lineName = rpgiv.getCol(src, 49, 62).trim();
    const lineFromPos = rpgiv.getCol(src, 37, 41).trim();
    const lineToPos = rpgiv.getCol(src, 42, 46).trim();
    const lineDataType = rpgiv.getColUpper(src, 34).trim();
    const lineDecPos = rpgiv.getCol(src, 47, 48).trim();

    const { fieldType, kwds } = rpgiv.convertTypeToKwd(
        '',
        lineDataType,
        lineFromPos,
        lineToPos,
        lineDecPos,
        '*ISO',
        '',
        [],
        0
    );

    let typeStr = fieldType.trim();
    if (!typeStr) {
        const len = rpgiv.calcFieldLength(lineDataType, lineFromPos, lineToPos);
        if (len > 0) {
            typeStr = /^\d+$/.test(lineDecPos)
                ? `zoned(${len}:${lineDecPos})`
                : `char(${len})`;
        }
    }

    const kwdStr = kwds.trim().replace(/\bPOS\(1\)\s*/i, '').trim();
    const parts = [typeStr, kwdStr].filter(Boolean).join(' ');
    if (!parts) return [];

    const actualName = lineName || `Filler_${String(fallbackIndex).padStart(3, '0')}`;
    return [inDataStructure ? `  ${actualName} ${parts};` : `dcl-s ${actualName} ${parts};`];
}

function convertExternalRecordId(line: string): string[] {
    const src = line.padEnd(80, ' ');
    const recName = rpgiv.getCol(src, 7, 16).trim();
    const recIdInd = rpgiv.getColUpper(src, 21, 22).trim();

    if (!recName) return [line];

    const recInfo = recIdInd ? ` indicator *IN${recIdInd}` : '';
    return [`// EXTERNAL I-SPEC RECORD: ${recName}${recInfo};`];
}

function convertExternalField(line: string): string[] {
    const src = line.padEnd(80, ' ');
    const extFieldName = rpgiv.getCol(src, 21, 30).trim();
    const rpgFieldName = rpgiv.getCol(src, 49, 62).trim();

    if (!extFieldName) return [line];

    if (rpgFieldName) {
        return [`// EXTERNAL I-SPEC FIELD: ${extFieldName} as ${rpgFieldName};`];
    }
    return [`// EXTERNAL I-SPEC FIELD: ${extFieldName};`];
}

function findFirstExternalHeaderIndex(lines: string[]): number {
    for (let i = 0; i < lines.length; i++) {
        if (getInputSpecType(lines[i]) === 'IX') return i;
    }
    return -1;
}

function buildExternalRecordDSName(recName: string, recIdInd: string): string {
    return [recName, 'EXT', recIdInd || '00'].filter(Boolean).join('_');
}

function findDsCloseInsertIndex(lines: string[], minIndex: number = 0): number {
    for (let i = lines.length - 1; i >= minIndex; i--) {
        const line = lines[i].padEnd(80, ' ');
        if (!line.trim()) continue;
        if (rpgiv.isComment(line)) continue;
        return i;
    }
    return minIndex;
}

function convertExternalRecordGroup(lines: string[]): string[] {
    const headerIndex = findFirstExternalHeaderIndex(lines);
    if (headerIndex < 0) return lines;

    const headerLine = lines[headerIndex].padEnd(80, ' ');
    const recName = rpgiv.getCol(headerLine, 7, 16).trim();
    const recIdInd = rpgiv.getColUpper(headerLine, 21, 22).trim();
    if (!recName) return lines;

    const dsName = buildExternalRecordDSName(recName, recIdInd);
    const result: string[] = [];
    const extFileStub = `EXTFILE_${recName}`;
    const dsCloseIndex = findDsCloseInsertIndex(lines, headerIndex);
    const trailingComments: string[] = [];

    result.push(`// TODO: Replace '${extFileStub}' with the real file name.`);
    result.push(`//       EXTNAME format '${recName}' came from I-spec conversion.`);
    result.push(`dcl-ds ${dsName} extname('${extFileStub}':'${recName}');`);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].padEnd(80, ' ');

        if (rpgiv.isComment(line)) {
            if (i > dsCloseIndex) {
                trailingComments.push(rpgiv.convertCmt(line));
                continue;
            }
            result.push(rpgiv.convertCmt(line));
            continue;
        }

        if (!line.trim()) continue;

        const iType = getInputSpecType(line);
        if (iType !== 'JX') continue;

        const extFieldName = rpgiv.getCol(line, 21, 30).trim();
        const rpgFieldName = rpgiv.getCol(line, 49, 62).trim();
        if (!extFieldName) continue;

        const subFieldName = rpgFieldName || extFieldName;
        result.push(`  ${subFieldName} extfld(${extFieldName});`);
    }

    result.push(`end-ds ${dsName};`);
    result.push(...trailingComments);

    if (recIdInd) {
        result.push(`// EXTERNAL I-SPEC RECORD: ${recName} indicator *IN${recIdInd};`);
    } else {
        result.push(`// EXTERNAL I-SPEC RECORD: ${recName};`);
    }

    return result;
}

function findFirstProgramHeaderIndex(lines: string[]): number {
    for (let i = 0; i < lines.length; i++) {
        if (getInputSpecType(lines[i]) === 'I') return i;
    }
    return -1;
}

function convertProgramRecordGroup(lines: string[]): string[] {
    const headerIndex = findFirstProgramHeaderIndex(lines);
    if (headerIndex < 0) return lines;

    const headerLine = lines[headerIndex].padEnd(80, ' ');
    const fileName = rpgiv.getCol(headerLine, 7, 16).trim();
    const seqType = rpgiv.getColUpper(headerLine, 17, 18).trim();
    const recIdInd = rpgiv.getColUpper(headerLine, 21, 22).trim();

    if (!fileName) return lines;

    const ricGroups = collectRICsWithContinuations(lines, headerIndex);
    const dsName = buildProgramRecordDSName(fileName, seqType, recIdInd);
    const dsCloseIndex = findDsCloseInsertIndex(lines, headerIndex);
    const trailingComments: string[] = [];

    const result: string[] = [];
    result.push(`dcl-ds ${dsName};`);

    if (ricGroups.length > 0) {
        const ricOutput = generateRICOutput(ricGroups, recIdInd, fileName, dsName);
        result.push(...ricOutput);
    }

    let fillerCount = 0;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].padEnd(80, ' ');

        if (rpgiv.isComment(line)) {
            if (i > dsCloseIndex) {
                trailingComments.push(rpgiv.convertCmt(line));
                continue;
            }
            result.push(rpgiv.convertCmt(line));
            continue;
        }

        if (!line.trim()) continue;

        const iType = getInputSpecType(line);
        if (iType === 'IC') continue;
        if (iType !== 'J') continue;

        const fieldLines = convertProgramFieldLine(line, true, ++fillerCount);
        result.push(...fieldLines);
    }

    result.push(`end-ds ${dsName};`);
    result.push(...trailingComments);
    return result;
}

/**
 * Converts fixed-format RPG IV I-spec (Input) to free-format DCL-DS.
 *
 * Pattern: Extract fixed columns → determine record type → build DS structure
 * Follows same methodology as DSpec.ts and FSpec.ts
 */
export function convertISpec(
    lines: string[],
    settings: configSettings,
    allLines: string[] = [],
    indexes: number[] = []
): string[] {
    if (!Array.isArray(lines) || lines.length === 0) return [];
    const firstCodeLine = lines.find(line => {
        const src = line.padEnd(80, ' ');
        return !rpgiv.isComment(src) && !!src.trim();
    }) ?? lines[0];

    const iType = getInputSpecType(firstCodeLine);

    if (iType === 'I' || iType === 'IC') {
        return convertProgramRecordGroup(lines);
    }

    if (iType === 'IX') {
        return convertExternalRecordGroup(lines);
    }

    if (iType === 'J') {
        return convertProgramFieldLine(firstCodeLine, false, 1);
    }

    if (iType === 'JX') {
        return convertExternalField(firstCodeLine);
    }

    return lines;
};
