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
import { stmtLines } from './types';

export function collectComments(allLines: string[], startIndex: number): stmtLines {
  const lines: string[] = [];
  const indexes: number[] = [];
  const comments: string[] = [];
  const eol = rpgiv.getEOL();

  // NOTE: This routine returns comments as "lines" not in the "comments" return value

  // Find start of comment block by scanning backward
  let start = startIndex;
  while (start > 0 && start < allLines.length) {
    const line = allLines[start-1].trimEnd();
    if (line === '' || rpgiv.isComment(line)) {
      start--;
    } else {
      break;
    }
  }

  // Find end of comment block by scanning forward
  let end = start;
  while (end < allLines.length) {
    const line = allLines[end+1].trimEnd();
    if (line === '' || rpgiv.isComment(line)) {
      end++;
    } else {
      break;
    }
  }

  for (let i = start; i <= end; i++) {
    lines.push(rpgiv.convertCmt(allLines[i]));
    indexes.push(i);
  }

  return {
    lines,
    indexes,
    comments: comments.length > 0 ? comments : null
  };
}