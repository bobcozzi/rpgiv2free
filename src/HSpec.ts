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
  if (firstOpt.startsWith('ctl-opt')) {
    return [ctlOpts.join(' ')];
  }
  return [`ctl-opt ${ctlOpts.join(' ')};`];
}