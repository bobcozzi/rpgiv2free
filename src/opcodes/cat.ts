// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 1996-2026 by R. Cozzi, Jr.
// @author BobCozzi


import * as vscode from 'vscode';
import * as rpgiv from '../rpgtools';

export function convertCAT(
  opcode: string,
  factor1: string,
  factor2: string,
  result: string,
  extraDCL: string[]
): string[] {
  const lines: string[] = [];

  // === Extract Extender (e.g., from CAT(P)) ===
  const extenderMatch = opcode.match(/\(([^)]+)\)/);
  const extender = extenderMatch ? extenderMatch[1].toUpperCase() : '';
  const hasP = extender.includes('P');
  const config = rpgiv.getRPGIVFreeSettings();

  let exprParts: string[] = [];

  // === Rule 1: If no Factor 1, use result field ===
  let f1 = '';

  // === Rule 2 + 3: Parse Factor 2 ===
  let f2Expr = '';
  let hasBlanks = false;
  if (factor2.includes(':')) {
    const [leftRaw, rightRaw] = factor2.split(':');
    const left = leftRaw.trim();
    const right = rightRaw.trim();
    const blanks = `'${' '.repeat(Number(right))}'`;
    f2Expr = `${blanks} + ${left}`;
    hasBlanks = true;
    f1 = factor1.trim() ? `%TRIMR(${factor1.trim()})` : `%TRIMR(${result.trim()})`;
  } else {
    f2Expr = factor2.trim();
    f1 = factor1.trim() ? `${factor1.trim()}` : `${result.trim()}`;
  }
  exprParts.push(f1);
  exprParts.push(f2Expr);

  const fullExpr = exprParts.join(' + ');

  if (hasP) {
    // Rule: If extender (P), assign directly
    lines.push(`${result} = ${fullExpr};`);
  } else {
    // Rule: If no extender (P), wrap in %SUBST
    const temp_LenVar = config.tempVar1STG;
    lines.push(`${temp_LenVar} = %LEN(${fullExpr});  // workfield ${temp_LenVar} for CAT opcode`);
    lines.push(`${temp_LenVar} = %MIN(${temp_LenVar} : %LEN(${result})); // Avoid overlow error`);
    lines.push(`%SUBST(${result} : 1 : ${temp_LenVar}) = ${fullExpr};`);
    if (!rpgiv.isVarDcl(temp_LenVar)) { // If not already declared, declare work field
      extraDCL.push(`DCL-S ${temp_LenVar} INT(10); // Ad hoc length field used by CAT opcode `);
      }
  }

  return lines;
}