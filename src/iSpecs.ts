// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 1996-2026 by R. Cozzi, Jr.
// @author BobCozzi

import * as rpgiv from './rpgtools';

export type InputSpecType = 'IX' | 'JX' | 'I' | 'IC' | 'J' | 'UNKNOWN';

function padLine(line: string): string {
    return (line || '').padEnd(80, ' ');
}

export function isInputSpecLine(line: string): boolean {
    return rpgiv.getSpecType(line) === 'i' && rpgiv.isNotComment(line) && !rpgiv.isDirective(line);
}

function hasProgramFieldPositions(line: string): boolean {
    const fromPos = rpgiv.getCol(line, 37, 41).trim();
    const toPos = rpgiv.getCol(line, 42, 46).trim();
    return /^\d+$/.test(fromPos) || /^\d+$/.test(toPos);
}

export function isPgmRecIdCont(line: string): boolean {
    const src = padLine(line);
    if (!isInputSpecLine(src)) return false;

    const andOr = rpgiv.getColUpper(src, 16, 18).trim();
    return andOr === 'AND' || andOr === 'OR' || andOr === 'AN';
}

export function isPgmField(line: string): boolean {
    const src = padLine(line);
    if (!isInputSpecLine(src)) return false;
    if (isPgmRecIdCont(src)) return false;
    return hasProgramFieldPositions(src);
}

export function isExtField(line: string): boolean {
    const src = padLine(line);
    if (!isInputSpecLine(src)) return false;
    if (isPgmRecIdCont(src) || isPgmField(src)) return false;

    const fileName = rpgiv.getCol(src, 7, 16).trim();
    const extField = rpgiv.getCol(src, 21, 30).trim();
    return !fileName && !!extField;
}

export function isPgmRecId(line: string): boolean {
    const src = padLine(line);
    if (!isInputSpecLine(src)) return false;
    if (isPgmRecIdCont(src) || isPgmField(src)) return false;

    const fileName = rpgiv.getCol(src, 7, 16).trim();
    if (!fileName) return false;

    const seqType = rpgiv.getColUpper(src, 17, 18).trim();
    const ricArea = rpgiv.getCol(src, 23, 46).trim();

    return !!seqType || !!ricArea;
}

export function isExtRecId(line: string): boolean {
    const src = padLine(line);
    if (!isInputSpecLine(src)) return false;
    if (isPgmRecIdCont(src) || isPgmField(src) || isExtField(src)) return false;

    const fileName = rpgiv.getCol(src, 7, 16).trim();
    if (!fileName) return false;

    return !isPgmRecId(src);
}

export function getInputSpecType(line: string): InputSpecType {
    const src = padLine(line);
    if (!isInputSpecLine(src)) return 'UNKNOWN';

    if (isExtRecId(src)) return 'IX';
    if (isExtField(src)) return 'JX';
    if (isPgmRecId(src)) return 'I';
    if (isPgmRecIdCont(src)) return 'IC';
    if (isPgmField(src)) return 'J';

    return 'UNKNOWN';
}
