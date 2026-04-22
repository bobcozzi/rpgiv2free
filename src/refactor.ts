/**
 * MIT License
 *
 * Copyright (c) 2026 Robert Cozzi, Jr.
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

/**
 * refactor.ts
 *
 * Converts fixed-format RPG IV PLIST/PARM and CALL/PARM groups into their
 * free-format equivalents:
 *
 *   *ENTRY PLIST + PARMs  →  dcl-pi ... end-pi  block (procedure interface)
 *   Named  PLIST + PARMs  →  dcl-pr ... end-pr  block (procedure prototype)
 *   CALL/CALLB  + PARMs   →  dcl-pr ... end-pr  block + free-format callp/call
 *
 * The scanning approach mirrors collectKList.ts: a single pre-pass over the
 * entire source collects all PLIST/PARM groups into a Map, then individual
 * conversion routines query that cache as lines are converted.
 *
 * C-spec fixed-format column reference (1-based):
 *   12-25  Factor 1    (PLIST name or *ENTRY for PLIST; input value for PARM)
 *   26-35  Opcode      (PLIST | PARM | CALL | CALLB)
 *   36-49  Factor 2    (program name for CALL; output value for PARM)
 *   50-63  Result      (parameter variable name for PARM)
 *   64-68  Length      (field length for inline PARM definition)
 *   69-70  Decimals    (decimal places for inline PARM definition)
 */

import * as vscode from 'vscode';
import * as rpgiv from './rpgedit';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One parameter from a PARM statement. */
export interface ParmEntry {
  /** Variable name from the Result field (cols 50-63). */
  name: string;
  /** Raw length string from cols 64-68 (may be blank when defined in D-spec). */
  length: string;
  /** Raw decimal-places string from cols 69-70 (blank = character). */
  decimals: string;
  /** Factor 1 (cols 12-25) — "from" value, rarely used. */
  factor1: string;
  /** Factor 2 (cols 36-49) — "to" value, rarely used. */
  factor2: string;
}

/** One PLIST group (named, *ENTRY, or inline after CALL). */
export interface PListEntry {
  /** PLIST label, or '*ENTRY', or a generated key for anonymous CALL parms. */
  plistName: string;
  /**
   * 'ENTRY'  — *ENTRY PLIST (generates dcl-pi)
   * 'NAMED'  — explicitly named PLIST (generates dcl-pr)
   * 'CALL'   — inline PARMs following a CALL/CALLB (generates dcl-pr + callp)
   */
  plistType: 'ENTRY' | 'NAMED' | 'CALL';
  /**
   * For 'CALL' entries: the program name from Factor 2 of the CALL statement,
   * e.g. 'MYPGM' (without quotes) or a variable name.
   * Empty for 'ENTRY' and 'NAMED'.
   */
  callTarget: string;
  /** Whether the call target is a literal ('PGMNAME') or a variable. */
  callTargetIsLiteral: boolean;
  /** The ordered list of PARM entries that follow this PLIST/CALL. */
  parms: ParmEntry[];
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

/**
 * plistCache maps an upper-cased PLIST name (or '*ENTRY', or a synthetic key
 * such as '__CALL_MYPGM__') to its PListEntry.
 *
 * For CALL statements that reference a named PLIST via the Result field of
 * the CALL line, the entry is stored under the PLIST name rather than a
 * synthetic key.
 */
export const plistCache = new Map<string, PListEntry>();

/** Tracks prototype names emitted during the current conversion pass. */
const emittedPrototypes = new Set<string>();

/** Tracks parm count for each prototype emitted during the current pass. */
const emittedParmCounts = new Map<string, number>();

/** Live extraDCL array references, keyed by prototype name, for same-pass augmentation. */
const emittedProtoRefs = new Map<string, string[]>();

/** Pending patches to apply to prototypes already written to the document. */
const pendingPatches: { name: string; additionalParms: ParmEntry[] }[] = [];

/** URI of the document for which plistCache / emittedPrototypes were last built. */
let lastCollectedUri = '';

/** Clear all per-command-invocation conversion state. */
export function clearConversionState(): void {
  emittedPrototypes.clear();
  emittedParmCounts.clear();
  emittedProtoRefs.clear();
  pendingPatches.length = 0;
}

/** Record that a dcl-pr for the given name has been emitted this pass. */
export function markPrototypeEmitted(name: string, parmCount: number): void {
  emittedPrototypes.add(name.toUpperCase());
  emittedParmCounts.set(name.toUpperCase(), parmCount);
}

/** Store a reference to the live extraDCL array that holds this prototype. */
export function registerEmittedProtoRef(name: string, linesRef: string[]): void {
  emittedProtoRefs.set(name.toUpperCase(), linesRef);
}

export function getPLISTSize(): number {
  return plistCache.size;
}

/** True when the PLIST name (or *ENTRY) has been collected. */
export function hasPLIST(name: string): boolean {
  return plistCache.has(name.toUpperCase());
}

// ---------------------------------------------------------------------------
// Collection (pre-pass scan)
// ---------------------------------------------------------------------------

function getF1(line: string): string {
  return rpgiv.getCol(line, 12, 25).trim();
}
function getF2(line: string): string {
  return rpgiv.getCol(line, 36, 49).trim();
}
function getResult(line: string): string {
  return rpgiv.getCol(line, 50, 63).trim();
}
function getLength(line: string): string {
  return rpgiv.getCol(line, 64, 68).trim();
}
function getDecimals(line: string): string {
  return rpgiv.getCol(line, 69, 70).trim();
}

/**
 * Scan the active document's C-specs and collect all PLIST/PARM groups and
 * CALL/CALLB+PARM groups into plistCache.
 *
 * Call this once before converting any C-spec lines (mirrors collectKLIST).
 */
export function collectPLIST(): void {
  plistCache.clear();

  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const currentUri = editor.document.uri.toString();
  if (currentUri !== lastCollectedUri) {
    // Different document — reset the emitted-prototype session state
    clearConversionState();
    lastCollectedUri = currentUri;
  }

  const allLines = editor.document.getText().split(rpgiv.getEOL());

  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i].padEnd(80, ' ');

    if (rpgiv.isEOP(line)) break;
    if (!rpgiv.isValidFixedFormat(line)) continue;
    if (rpgiv.getSpecType(line) !== 'c') continue;

    const opcode = rpgiv.getRawOpcode(line).toUpperCase();

    // -----------------------------------------------------------------------
    // PLIST (named or *ENTRY)
    // -----------------------------------------------------------------------
    if (opcode === 'PLIST') {
      const f1 = getF1(line).toUpperCase();
      const plistName = f1 || '*ENTRY';
      const plistType: PListEntry['plistType'] = (plistName === '*ENTRY') ? 'ENTRY' : 'NAMED';
      const parms = collectFollowingPARMs(allLines, i);

      plistCache.set(plistName, {
        plistName,
        plistType,
        callTarget: '',
        callTargetIsLiteral: false,
        parms,
      });
    }

    // -----------------------------------------------------------------------
    // CALL / CALLB with inline PARM list (no separate named PLIST)
    // -----------------------------------------------------------------------
    if (opcode === 'CALL' || opcode === 'CALLB') {
      const rawTarget = getF2(line);
      const namedPlist = getResult(line).toUpperCase(); // Result = optional PLIST name

      // If this CALL references an already-collected named PLIST, skip — the
      // named PLIST entry already holds the parameters.
      if (namedPlist && plistCache.has(namedPlist)) continue;

      const isLiteral = rawTarget.startsWith("'") && rawTarget.endsWith("'");
      const callTarget = isLiteral ? rawTarget.slice(1, -1).trim() : rawTarget.trim();

      // Peek ahead to see if inline PARMs follow
      const inlineParms = collectFollowingPARMs(allLines, i);
      if (inlineParms.length === 0 && !namedPlist) continue; // nothing to do

      const key = namedPlist || `__CALL_${callTarget.toUpperCase()}__`;

      plistCache.set(key, {
        plistName: key,
        plistType: 'CALL',
        callTarget,
        callTargetIsLiteral: isLiteral,
        parms: namedPlist ? [] : inlineParms, // parms already stored under namedPlist
      });
    }
  }
}

/**
 * Starting from the line AFTER startIndex, collect consecutive PARM lines
 * (skipping blanks and comments) until a non-PARM C-spec is encountered.
 */
function collectFollowingPARMs(allLines: string[], startIndex: number): ParmEntry[] {
  const parms: ParmEntry[] = [];
  for (let j = startIndex + 1; j < allLines.length; j++) {
    const nextLine = allLines[j].padEnd(80, ' ');
    if (rpgiv.isSkipStmt(nextLine)) continue;
    if (rpgiv.isEOP(nextLine)) break;
    if (rpgiv.getSpecType(nextLine) !== 'c') break;
    const kfld = rpgiv.getRawOpcode(nextLine).toUpperCase();
    if (kfld === 'PARM') {
      parms.push({
        name: getResult(nextLine),
        length: getLength(nextLine),
        decimals: getDecimals(nextLine),
        factor1: getF1(nextLine),
        factor2: getF2(nextLine),
      });
    } else {
      break; // Any other opcode stops the PARM collection
    }
  }
  return parms;
}

// ---------------------------------------------------------------------------
// Type inference
// ---------------------------------------------------------------------------

/**
 * Infer the free-format data type for a single PARM.
 *
 * Rules (mirrors RPG IV convention):
 *   length > 0 && decimals > 0  →  packed(length:decimals)
 *   length > 0 && decimals == 0 →  char(length)
 *   no length                   →  like(name)   — type comes from D-spec
 */
function getParmType(parm: ParmEntry): string {
  const len = parm.length.trim();
  const dec = parm.decimals.trim();
  if (!len) {
    // No inline length — assume the variable is declared in D-specs
    return parm.name ? `like(${parm.name})` : '';
  }
  if (dec !== '') {
    return `packed(${len}:${dec})`;
  }
  return `char(${len})`;
}

// ---------------------------------------------------------------------------
// Code generation
// ---------------------------------------------------------------------------

/** Indent used for parameter lines inside dcl-pi / dcl-pr blocks. */
const PARM_INDENT = '  ';

/**
 * Build the DCL-PI block for the *ENTRY PLIST.
 * Returns an empty array when no *ENTRY PLIST was found.
 *
 * Example output:
 *   dcl-pi *n;
 *     CustNum packed(7:0);
 *     CustName char(30);
 *   end-pi;
 */
export function getEntryPILines(): string[] {
  const entry = plistCache.get('*ENTRY');
  if (!entry || entry.parms.length === 0) return [];
  return buildPIBlock(entry.parms);
}

/**
 * Build the DCL-PI block for a *ENTRY PLIST.
 *
 * @param parms       Parameter list.
 * @param piName      Optional procedure-interface name (default `*n`).
 * @param extpgmName  Optional EXTPGM target; when supplied adds `extpgm('...')`
 *                    to the dcl-pi header.
 */
export function buildPIBlock(parms: ParmEntry[], piName?: string, extpgmName?: string): string[] {
  const lines: string[] = [];
  const name = piName || '*n';
  const extKwd = extpgmName ? ` extpgm('${extpgmName}')` : '';
  lines.push(`dcl-pi ${name}${extKwd};`);
  for (const p of parms) {
    const type = getParmType(p);
    lines.push(`${PARM_INDENT}${p.name}${type ? ' ' + type : ''};`);
  }
  lines.push(`end-pi;`);
  return lines;
}

/**
 * Build the DCL-PI block for *ENTRY PLIST, deriving the procedure-interface
 * name and EXTPGM keyword from the active source file name.
 *
 * For a source file named `SALEIMP.RPGLE` this produces:
 *   dcl-pi SALEIMP_ENTRY extpgm('SALEIMP');
 *     ...
 *   end-pi;
 *
 * Falls back to `dcl-pi *n;` when no editor is active.
 */
export function buildEntryPIBlock(parms: ParmEntry[]): string[] {
  const fileInfo = rpgiv.getActiveFileInfo();
  let memberName = '';
  if (fileInfo && fileInfo.fileName) {
    const basename = fileInfo.extension
      ? fileInfo.fileName.slice(0, -fileInfo.extension.length)
      : fileInfo.fileName;
    memberName = basename.toUpperCase();
  }
  const piName = memberName ? `${memberName}_ENTRY` : '*n';
  const extpgmName = memberName || undefined;
  return buildPIBlock(parms, piName, extpgmName);
}

/**
 * Build the DCL-PR block for a named PLIST or a CALL target.
 *
 * @param plistName  Key in plistCache (upper-cased).  For CALL entries this
 *                   is the synthetic '__CALL_PGMNAME__' key.
 * @returns          Array of free-format lines, or [] if not found.
 *
 * Example output for a program prototype:
 *   dcl-pr MYPGM extpgm('MYPGM');
 *     Val1 char(10);
 *     Val2 packed(7:2);
 *   end-pr;
 */
export function getPRLines(plistName: string): string[] {
  const entry = plistCache.get(plistName.toUpperCase());
  if (!entry) return [];
  return buildPRBlock(entry);
}

/**
 * Build the DCL-PR block from a PListEntry directly.
 */
export function buildPRBlock(entry: PListEntry): string[] {
  const lines: string[] = [];

  // Derive a clean procedure/program name for the dcl-pr header.
  let prName: string;
  let extKwd: string;

  if (entry.plistType === 'CALL') {
    // External program prototype
    prName = entry.callTarget || entry.plistName;
    const quotedTarget = entry.callTargetIsLiteral
      ? `'${entry.callTarget}'`
      : entry.callTarget;
    extKwd = `extpgm(${quotedTarget})`;
  } else {
    // Named PLIST — treat as an external procedure prototype
    prName = entry.plistName;
    extKwd = `extproc('${entry.plistName}')`;
  }

  // Sanitize: if prName starts with *, it's special — use *n
  if (prName.startsWith('*')) prName = '*n';

  lines.push(`dcl-pr ${prName} ${extKwd};`);
  for (const p of entry.parms) {
    const type = getParmType(p);
    const nopass = entry.plistType === 'CALL' ? ' options(*nopass)' : '';
    lines.push(`${PARM_INDENT}${p.name}${type ? ' ' + type : ''}${nopass};`);
  }
  lines.push(`end-pr;`);
  return lines;
}

// ---------------------------------------------------------------------------
// Free-format CALL/CALLP generation
// ---------------------------------------------------------------------------

/**
 * Return the free-format call statement for a CALL/CALLB opcode line.
 *
 * For external *program* calls (extpgm), the generated statement is:
 *   MYPGM(Val1 : Val2);
 *
 * If a named PLIST is referenced in the Result field of the CALL line,
 * that PLIST's parameters are used; otherwise the inline PARMs cached
 * under the synthetic key are used.
 *
 * @param callLine  The original fixed-format CALL/CALLB C-spec line.
 * @returns         Array of free-format output lines.
 */
export function getFreeCallLines(callLine: string, allLines?: string[], curLineIndex?: number): string[] {
  const padded = callLine.padEnd(80, ' ');
  const rawTarget = getF2(padded);
  const namedPlist = getResult(padded).toUpperCase();

  const isLiteral = rawTarget.startsWith("'") && rawTarget.endsWith("'");
  const callTarget = isLiteral ? rawTarget.slice(1, -1).trim() : rawTarget.trim();

  // The call statement argument list must reflect only the PARMs actually
  // coded at THIS call site — not a cached maximum from another occurrence.
  let parms: ParmEntry[] = [];
  if (namedPlist) {
    // Named PLIST reference — parms come from the PLIST definition
    if (allLines) {
      parms = findNamedPLISTParms(allLines, namedPlist);
    }
    if (parms.length === 0) {
      const cacheKey = plistCache.has(namedPlist) ? namedPlist : `__CALL_${callTarget.toUpperCase()}__`;
      parms = plistCache.get(cacheKey)?.parms ?? [];
    }
  } else if (allLines && curLineIndex !== undefined) {
    // Inline PARMs — scan the actual lines following this CALL
    parms = collectInlinePARMs(allLines, curLineIndex);
  } else {
    // Last-resort fallback (no allLines supplied)
    const cacheKey = `__CALL_${callTarget.toUpperCase()}__`;
    parms = plistCache.get(cacheKey)?.parms ?? [];
  }

  // The argument list uses the Result-field variable names.
  // Factor 1 and Factor 2 pre/post assignments are generated separately.
  const argList = parms.map(p => p.name);

  const procName = callTarget || namedPlist;
  if (argList.length > 0) {
    return [`${procName}(${argList.join(' : ')});`];
  }
  return [`${procName}();`];
}

// ---------------------------------------------------------------------------
// Convenience: parm lines for a given PLIST (used in on-the-fly conversion)
// ---------------------------------------------------------------------------

/**
 * Collect the PARM entries that follow a PLIST or CALL line in the live source
 * array.  This mirrors collectFollowingPARMs but works on an externally-supplied
 * lines array and start index, making it usable during single-line conversion.
 */
export function collectInlinePARMs(allLines: string[], afterIndex: number): ParmEntry[] {
  return collectFollowingPARMs(allLines, afterIndex);
}

/**
 * Scan allLines directly for a named PLIST (Factor 1 matching plistName) and
 * return its PARM entries.  Does NOT use the module-level plistCache, so it is
 * immune to stale-cache issues from previous conversions.
 *
 * @param allLines   Full source line array (unmodified original).
 * @param plistName  Upper-cased PLIST name to locate.
 * @returns          Array of ParmEntry, empty when not found.
 */
export function findNamedPLISTParms(allLines: string[], plistName: string): ParmEntry[] {
  const target = plistName.toUpperCase();
  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i].padEnd(80, ' ');
    if (rpgiv.isEOP(line)) break;
    if (!rpgiv.isValidFixedFormat(line)) continue;
    if (rpgiv.getSpecType(line) !== 'c') continue;
    if (rpgiv.getRawOpcode(line).toUpperCase() !== 'PLIST') continue;
    if (getF1(line).toUpperCase() !== target) continue;
    return collectFollowingPARMs(allLines, i);
  }
  return [];
}

/**
 * Build the pre-call assignment statements for a CALL/PARM group.
 *
 * For each PARM where Factor 2 is non-blank, emits:
 *   result = factor2;
 * These must be placed BEFORE the free-format call statement.
 */
export function buildPreCallAssignments(parms: ParmEntry[]): string[] {
  return parms
    .filter(p => p.factor2.trim() !== '')
    .map(p => `${p.name} = ${p.factor2};`);
}

/**
 * Build the post-call assignment statements for a CALL/PARM group.
 *
 * For each PARM where Factor 1 is non-blank, emits:
 *   factor1 = result;
 * These must be placed AFTER the free-format call statement.
 */
export function buildPostCallAssignments(parms: ParmEntry[]): string[] {
  return parms
    .filter(p => p.factor1.trim() !== '')
    .map(p => `${p.factor1} = ${p.name};`);
}

/**
 * Build the on-entry assignment statements for an *ENTRY PLIST/PARM group.
 *
 * Appended immediately after the dcl-pi / end-pi block so they execute as
 * the first statements when the program receives control:
 *
 *   Result → Factor 1  (copy received parameter to a local variable)
 *     e.g. factor1 = result;
 */
export function buildEntryAssignments(parms: ParmEntry[]): string[] {
  return parms
    .filter(p => p.factor1.trim() !== '')
    .map(p => `${p.factor1} = ${p.name};`);
}

/**
 * Build an ON-EXIT block for *ENTRY PLIST Factor 2 assignments.
 *
 * Factor 2 on an *ENTRY PARM is copied back to the Result field upon program
 * exit (i.e., when returning to the caller).  In free-format RPG this must
 * live in an ON-EXIT block placed at the bottom of the main procedure body,
 * before any BEGSR subroutines.
 *
 * Returns an empty array when no PARM has a Factor 2.
 *
 * Example output:
 *   on-exit;
 *     PARM1 = LOCALVAL;
 *   on-exit;
 */
export function buildEntryOnExitBlock(parms: ParmEntry[], includeOpcode: boolean = true): string[] {
  const assigns = parms
    .filter(p => p.factor2.trim() !== '')
    .map(p => `${p.name} = ${p.factor2};`);
  if (assigns.length === 0) return [];
  const comment = '// Copy Factor 2 values back to returning parameter fields';
  return includeOpcode
    ? ['on-exit;', comment, ...assigns]
    : [comment, ...assigns];
}

/**
 * Returns true when a `dcl-pr <name>` declaration already exists in either
 * the original source lines or in the pending extraDCL entries for this
 * conversion pass.  Used to suppress duplicate prototype generation when the
 * same external program is called more than once.
 *
 * @param name     Program / procedure name to search for (case-insensitive).
 * @param allLines Full source line array.
 * @param extraDCL Pending extra-DCL lines accumulated during this conversion.
 */
export function isDclPrDeclared(name: string, allLines: string[], extraDCL: string[]): boolean {
  if (!name) return false;
  if (emittedPrototypes.has(name.toUpperCase())) return true;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`\\bdcl-pr\\s+${escaped}\\b`, 'i');
  return allLines.some(l => pattern.test(l)) || extraDCL.some(l => pattern.test(l));
}

/** Build just the parm declaration lines (no dcl-pr / end-pr wrapper). */
export function buildParmLines(parms: ParmEntry[], isCall: boolean): string[] {
  return parms.map(p => {
    const type = getParmType(p);
    const nopass = isCall ? ' options(*nopass)' : '';
    return `${PARM_INDENT}${p.name}${type ? ' ' + type : ''}${nopass};`;
  });
}

/**
 * Find an existing dcl-pr block for the given name in allLines.
 * Returns { startLine, endLine, parmCount } (0-based), or null if not found.
 */
export function findPRBlock(
  name: string,
  allLines: string[]
): { startLine: number; endLine: number; parmCount: number } | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const startPattern = new RegExp(`\\bdcl-pr\\s+${escaped}\\b`, 'i');
  for (let i = 0; i < allLines.length; i++) {
    if (startPattern.test(allLines[i])) {
      let parmCount = 0;
      for (let j = i + 1; j < allLines.length; j++) {
        if (allLines[j].trim().toLowerCase().startsWith('end-pr')) {
          return { startLine: i, endLine: j, parmCount };
        }
        if (allLines[j].trim()) parmCount++;
      }
    }
  }
  return null;
}

/**
 * Return the parm count of an already-emitted or written prototype.
 * Checks same-pass emitted registry first, then scans allLines.
 */
export function getExistingPRParmCount(name: string, allLines: string[]): number {
  const upper = name.toUpperCase();
  if (emittedParmCounts.has(upper)) return emittedParmCounts.get(upper)!;
  return findPRBlock(name, allLines)?.parmCount ?? 0;
}

/**
 * Splice additional parm lines into the live extraDCL array that holds the
 * same-pass prototype, just before end-pr.  Returns true on success.
 */
export function augmentEmittedProto(name: string, additionalParms: ParmEntry[]): boolean {
  const ref = emittedProtoRefs.get(name.toUpperCase());
  if (!ref) return false;
  const endIdx = ref.findIndex(l => l.trim().toLowerCase().startsWith('end-pr'));
  if (endIdx < 0) return false;
  const newLines = buildParmLines(additionalParms, true);
  ref.splice(endIdx, 0, ...newLines);
  const prev = emittedParmCounts.get(name.toUpperCase()) ?? 0;
  emittedParmCounts.set(name.toUpperCase(), prev + additionalParms.length);
  return true;
}

/**
 * Schedule a patch to augment a prototype already written to the document.
 * The command handler applies these patches after collecting all edits.
 */
export function schedulePrototypePatch(name: string, additionalParms: ParmEntry[]): void {
  const upper = name.toUpperCase();
  const existing = pendingPatches.find(p => p.name === upper);
  if (existing) {
    existing.additionalParms.push(...additionalParms);
  } else {
    pendingPatches.push({ name: upper, additionalParms: [...additionalParms] });
  }
}

/** Return all scheduled prototype patches for the current command pass. */
export function getPendingPatches(): { name: string; additionalParms: ParmEntry[] }[] {
  return pendingPatches;
}

/**
 * Return the 0-based indexes of all PARM lines that immediately follow the
 * given startIndex (skipping blank/comment lines).  Used by the converter to
 * mark those lines as processed so they are not round-tripped.
 */
export function getPARMIndexes(allLines: string[], afterIndex: number): number[] {
  const indexes: number[] = [];
  for (let j = afterIndex + 1; j < allLines.length; j++) {
    const line = allLines[j].padEnd(80, ' ');
    if (rpgiv.isSkipStmt(line)) continue;
    if (rpgiv.isEOP(line)) break;
    if (rpgiv.getSpecType(line) !== 'c') break;
    const op = rpgiv.getRawOpcode(line).toUpperCase();
    if (op === 'PARM') {
      indexes.push(j);
    } else {
      break;
    }
  }
  return indexes;
}

/**
 * When the cursor is on a PARM line, walk backward to find the parent
 * PLIST / CALL / CALLB line index.  Returns that 0-based index, or -1 if
 * this line is not part of a PLIST/CALL group.
 *
 * Skips blank/comment lines while scanning.  Stops (returns -1) when a
 * non-C spec or an opcode other than PARM/PLIST/CALL/CALLB is encountered.
 */
export function findPARMParent(allLines: string[], lineIndex: number): number {
  const line = allLines[lineIndex]?.padEnd(80, ' ') ?? '';
  if (rpgiv.getSpecType(line) !== 'c') return -1;
  if (rpgiv.getRawOpcode(line).toUpperCase() !== 'PARM') return -1;

  for (let j = lineIndex - 1; j >= 0; j--) {
    const l = allLines[j].padEnd(80, ' ');
    if (rpgiv.isSkipStmt(l)) continue;
    if (rpgiv.isEOP(l)) break;
    if (rpgiv.getSpecType(l) !== 'c') break;
    const op = rpgiv.getRawOpcode(l).toUpperCase();
    if (op === 'PLIST' || op === 'CALL' || op === 'CALLB') return j;
    if (op === 'PARM') continue; // keep scanning past sibling PARMs
    break; // any other opcode — not our parent
  }
  return -1;
}

/**
 * Scan forward from `startIndex` through the source to find where an ON-EXIT
 * block should be inserted (or appended to, if one already exists).
 *
 * Rules:
 *  - Blank lines, comments, and compiler directives are skipped.
 *  - Fixed-format C-specs advance the insert point; BEGSR stops the scan.
 *  - A free-format `on-exit` line stops the scan and signals an existing block.
 *  - A free-format `dcl-` line stops the scan (declaration-area boundary).
 *  - Any other free-format line is treated as a mainline calc and advances
 *    the insert point.
 *
 * Returns `{ insertAt, existingOnExit }` where `insertAt` is the 0-based line
 * index *after which* the new content should be inserted, and `existingOnExit`
 * indicates whether a `on-exit` opcode is already present (so the caller
 * should omit generating a new one).
 */
export function findOnExitInsertPosition(
  allLines: string[],
  startIndex: number
): { insertAt: number; existingOnExit: boolean } {
  let insertAt = startIndex;
  let existingOnExit = false;

  for (let s = startIndex + 1; s < allLines.length; s++) {
    const sl = allLines[s].padEnd(80, ' ');
    if (rpgiv.isEOP(sl)) break;
    // Skip blank lines, comments, and compiler directives
    if (rpgiv.isSkipStmt(sl)) continue;
    // Detect a free-format on-exit line
    if (/^\s*on-exit\s*;?\s*$/i.test(allLines[s])) {
      insertAt = s;
      existingOnExit = true;
      break;
    }
    if (rpgiv.getSpecType(sl) === 'c') {
      // Fixed-format C-spec: stop at BEGSR, otherwise advance insert point
      const sOp = rpgiv.getRawOpcode(sl).toUpperCase();
      if (sOp === 'BEGSR') break;
      insertAt = s;
    } else {
      // Non-C, non-skippable: stop at any dcl- declaration line
      if (/^dcl-/i.test(allLines[s].trimStart())) break;
      // Free-format calc statement — advance insert point
      insertAt = s;
    }
  }

  return { insertAt, existingOnExit };
}
