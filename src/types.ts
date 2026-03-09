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

export let ibmiAPI: any = undefined;

export function setIbmiApi(api: any) {
  ibmiAPI = api;
}

export interface collectedStmt {
  specType: string;
  lines: string[];
  indexes: number[];
  entityName: string | null; // For P and D specs, else NULL
  comments: string[] | null; // embedded comments in statement
}

export interface stmtLines {
    lines: string[];
    indexes: number[];
    comments: string[] | null; // embedded comments in statement
}

let suppressTabZoneUpdate = false;

export function setSuppressTabZoneUpdate(value: boolean) {
  suppressTabZoneUpdate = value;
}

export function isTabZoneUpdateSuppressed(): boolean {
  return suppressTabZoneUpdate;
}