// SPDX-License-Identifier: Apache-2.0

import {
    isFixedContinuation,
    isFixedEndExec,
    isFixedExecSqlStart,
    isFreeEndExec,
    isFreeExecSqlStart,
} from './sqlfmt_patterns';

function isFixedSqlLine(line: string): boolean {
    return isFixedExecSqlStart(line) || isFixedEndExec(line) || isFixedContinuation(line);
}

function isFreeSqlMarkerLine(line: string): boolean {
    const t = line.trim();
    return isFreeExecSqlStart(t) || isFreeEndExec(t);
}

function expandSelectionToFreeSqlBlock(
    lines: string[],
    startLine: number,
    endLine: number
): { start: number; end: number } {
    // Find nearest free-format EXEC SQL opener above/at the selection.
    let start = -1;
    for (let i = startLine; i >= 0; i--) {
        if (isFreeExecSqlStart((lines[i] ?? '').trim())) {
            start = i;
            break;
        }
    }

    if (start < 0) return { start: startLine, end: endLine };

    const openerTrimmed = (lines[start] ?? '').trim();
    const inline = openerTrimmed
        .replace(/^\/?\s*exec\s+sql\b\s*/i, '')
        .trim();

    // One-line EXEC SQL with inline terminator on opener.
    if (inline.endsWith(';')) {
        if (startLine <= start && endLine >= start) return { start, end: start };
        return { start: startLine, end: endLine };
    }

    // Find block end. Prefer /END-EXEC when present; only fall back to
    // first SQL-terminating ';' if no /END-EXEC is found.
    let end = -1;
    let firstSemicolon = -1;
    for (let i = start + 1; i < lines.length; i++) {
        const t = (lines[i] ?? '').trim();

        if (isFreeEndExec(t)) {
            end = i;
            break;
        }

        // New opener before terminator: treat previous line as end of prior block.
        if (isFreeExecSqlStart(t)) {
            break;
        }

        if (firstSemicolon < 0 && t.endsWith(';')) {
            firstSemicolon = i;
        }
    }

    if (end < 0 && firstSemicolon >= 0) {
        end = firstSemicolon;
    }

    if (end < 0) return { start: startLine, end: endLine };

    // Expand only when selection intersects the discovered SQL block.
    const intersects = startLine <= end && endLine >= start;
    return intersects ? { start, end } : { start: startLine, end: endLine };
}

/**
 * Expand a line selection range to full fixed-format SQL block boundaries
 * when the selection intersects fixed-format embedded SQL.
 *
 * If no complete /EXEC SQL ... /END-EXEC boundary can be found, the input
 * bounds are returned unchanged.
 */
export function expandSelectionToFixedSqlBlock(
    lines: string[],
    startLine: number,
    endLine: number
): { start: number; end: number } {
    let start = startLine;
    let end = endLine;

    let firstSqlLine = -1;
    let lastSqlLine = -1;

    for (let i = startLine; i <= endLine; i++) {
        const line = lines[i] ?? '';
        if (isFixedSqlLine(line)) {
            if (firstSqlLine < 0) firstSqlLine = i;
            lastSqlLine = i;
        }
    }

    if (firstSqlLine < 0 || lastSqlLine < 0) return { start, end };

    start = firstSqlLine;
    end = lastSqlLine;

    while (start > 0 && !isFixedExecSqlStart(lines[start])) {
        start--;
    }

    if (!isFixedExecSqlStart(lines[start] ?? '')) {
        return { start: startLine, end: endLine };
    }

    while (end < lines.length - 1 && !isFixedEndExec(lines[end])) {
        end++;
    }

    if (!isFixedEndExec(lines[end] ?? '')) {
        return { start: startLine, end: endLine };
    }

    return { start, end };
}

/**
 * Expand a line selection range to full embedded SQL block boundaries.
 * Supports both fixed-format and free-format embedded SQL styles.
 */
export function expandSelectionToEmbeddedSqlBlock(
    lines: string[],
    startLine: number,
    endLine: number
): { start: number; end: number } {
    const fixed = expandSelectionToFixedSqlBlock(lines, startLine, endLine);
    if (fixed.start !== startLine || fixed.end !== endLine) {
        return fixed;
    }

    // Quick check: if selection has a free SQL marker, or if the selected
    // region might be inside a free SQL body, try free block expansion.
    let hasMarker = false;
    for (let i = startLine; i <= endLine; i++) {
        if (isFreeSqlMarkerLine(lines[i] ?? '')) {
            hasMarker = true;
            break;
        }
    }

    if (!hasMarker) {
        // Still attempt free expansion for body-only selections.
        return expandSelectionToFreeSqlBlock(lines, startLine, endLine);
    }

    return expandSelectionToFreeSqlBlock(lines, startLine, endLine);
}
