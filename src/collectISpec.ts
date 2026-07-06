// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 1996-2026 by R. Cozzi, Jr.
// @author BobCozzi

import * as rpgiv from './rpgtools';
import {
    InputSpecType,
    getInputSpecType,
    isInputSpecLine,
} from './iSpecs';

function isGroupedType(iType: InputSpecType): boolean {
    return iType === 'I' || iType === 'IC' || iType === 'J' || iType === 'IX' || iType === 'JX';
}

function isProgramGroupType(iType: InputSpecType): boolean {
    return iType === 'I' || iType === 'IC' || iType === 'J';
}

function isExternalGroupType(iType: InputSpecType): boolean {
    return iType === 'IX' || iType === 'JX';
}

/**
 * Collects all I-spec lines that belong to one logical record-format group,
 * anchored by `startIndex`.
 *
 * Algorithm:
 *  1. Walk BACKWARD from startIndex to find the record-identification header
 *     for the group (handles the case where the user selected a field line).
 *  2. Walk FORWARD from that header collecting the header + all its
 *     field / AND-OR / IXF continuation lines.
 *  3. Stop when a new record-identification header is encountered, or when
 *     the spec type changes to something other than 'I'.
 *
 * Returns the same shape as collectDSpecs for consistency with collectStmts.ts.
 */
export function collectISpecs(
    allLines: string[],
    startIndex: number,
    selectedLineIndexes: number[] = []
): {
    lines: string[];
    indexes: number[];
    entityName: string | null;
    specType: string | null;
    comments: string[];
} {
    const empty = { lines: [], indexes: [], entityName: null, specType: null, comments: [] };

    const startLine = allLines[startIndex] ?? '';
    const startType = getInputSpecType(startLine);
    if (startType === 'UNKNOWN') return empty;

    // Standalone field selections are converted as one-line units.
    if (startType === 'J' || startType === 'JX') {
        const standaloneName = startType === 'JX'
            ? rpgiv.getCol(startLine, 21, 30).trim() || null
            : rpgiv.getCol(startLine, 49, 62).trim() || null;

        return {
            specType: 'I',
            lines: [startLine],
            indexes: [startIndex],
            entityName: standaloneName,
            comments: []
        };
    }

    const programGroup = startType === 'I' || startType === 'IC';
    const headerType: InputSpecType = programGroup ? 'I' : 'IX';

    // ── 1. Walk BACKWARD from startIndex to find the start of the record group ─
    // But only within consecutive I-spec lines (respect structure, not selection boundary here)
    let firstIndex = startIndex;
    for (let i = startIndex; i >= 0; i--) {
        const line = allLines[i];
        if (rpgiv.isComment(line)) continue;
        if (!isInputSpecLine(line)) break;
        const lineType = getInputSpecType(line);
        if (lineType === 'UNKNOWN') break;

        if (programGroup && !isProgramGroupType(lineType)) break;
        if (!programGroup && !isExternalGroupType(lineType)) break;

        firstIndex = i;
        if (lineType === headerType) break;
    }

    // ── 2. Walk FORWARD collecting the group ──────────────────────────────────
    const lines: string[] = [];
    const indexes: number[] = [];
    const comments: string[] = [];
    let entityName: string | null = null;
    let headerSeen = false;

    for (let i = firstIndex; i < allLines.length; i++) {
        const line = allLines[i];

        if (rpgiv.isComment(line)) {
            // Include comment lines in the lines array so convertISpec can associate them
            // with following fields
            lines.push(line);
            indexes.push(i);
            continue;
        }

        // Skip blank lines but don't stop collecting
        if (!line.trim()) {
            lines.push(line);
            indexes.push(i);
            continue;
        }

        if (!isInputSpecLine(line)) break;
        const lineType = getInputSpecType(line);
        if (!isGroupedType(lineType)) break;

        if (programGroup && !isProgramGroupType(lineType)) break;
        if (!programGroup && !isExternalGroupType(lineType)) break;

        // A new record-identification header means the next group starts
        if (headerSeen && lineType === headerType) break;

        if (!headerSeen && lineType === headerType) {
            // Capture the file/record name from cols 7-16 as the entity name
            entityName = rpgiv.getCol(line, 7, 16).trim() || null;
            headerSeen = true;
        }

        lines.push(line);
        indexes.push(i);
    }

    // ── 3. I-specs handle their own trailing comments inline during conversion ─
    // So we don't extract them here; convertISpec will handle comment preservation

    // ── 4. Filter to only include lines in the selection (if selection provided) ──
    // IMPORTANT: structural group lines are always included once the group is selected,
    // so record-id + continuation + related field entries stay together.
    if (selectedLineIndexes.length > 0) {
        const selectedSet = new Set(selectedLineIndexes);
        const filteredLines: string[] = [];
        const filteredIndexes: number[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].padEnd(80, ' ');
            const iType = getInputSpecType(line);
            const isStructuralProgramLine = iType === 'I' || iType === 'IC' || iType === 'J';
            const isStructuralExternalLine = iType === 'IX' || iType === 'JX';
            const isCommentLine = rpgiv.isComment(line);

            const isStructuralLine = programGroup ? isStructuralProgramLine : isStructuralExternalLine;

            if (selectedSet.has(indexes[i]) || isStructuralLine || isCommentLine) {
                filteredLines.push(lines[i]);
                filteredIndexes.push(indexes[i]);
            }
        }

        // Only return filtered results if we have any selected lines from this group
        if (filteredLines.length > 0) {
            return { specType: 'I', lines: filteredLines, indexes: filteredIndexes, entityName, comments };
        }
        return empty;
    }

    return { specType: 'I', lines, indexes, entityName, comments };
}
