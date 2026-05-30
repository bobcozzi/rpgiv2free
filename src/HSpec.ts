// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 1996-2026 by R. Cozzi, Jr.
// @author BobCozzi

import * as rpgiv from './rpgtools';

export function convertHSpec(lines: string[]): string[] {
  if (!Array.isArray(lines) || lines.length === 0) return [];

  const ctlOpts = lines
    .map(line => {
      // Ignore comments: column 7 is at index 6
      if (line.length >= 7 && line[6] === '*') return null;
      // Get columns 7–80 (index 6 to 80)
      return line.length > 6 ? line.substring(6, 80).trim() : null;
    })
    .filter((part): part is string => !!part && part.trim().length > 0); // remove nulls and empty lines

  if (ctlOpts.length === 0) return [];
  if (rpgiv.isDirective(lines[0])) return ctlOpts;
  const firstOpt = ctlOpts[0].trimStart().toLowerCase();

  // Preserve trailing comment from columns 81-100 of the first source line
  const trailingCmt = rpgiv.getCol(lines[0] ?? '', 81, 100).trim();
  const altCmt = rpgiv.getCol(lines[0] ?? '', 1, 5).trim();
  const effectiveCmt = (() => {
    const a = altCmt || '';
    const c = trailingCmt || '';
    if (a && c) return `${a} * ${c}`;
    return a || c;
  })();
  const cmtSuffix = effectiveCmt ? ` // ${effectiveCmt}` : '';

  if (firstOpt.startsWith('ctl-opt')) {
    return [ctlOpts.join(' ') + cmtSuffix];
  }
  return [`ctl-opt ${ctlOpts.join(' ')};${cmtSuffix}`];
}