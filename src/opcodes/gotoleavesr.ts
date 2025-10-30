import * as vscode from 'vscode';
import * as rpgiv from '../rpgedit';

// Convert a GOTO that is within a Subroutine (SR) to a LEAVESR
// if, and only if that GOTO targets the "tag" named on the ENDSR opcode.

export function convertGOTO(
    curLineIndex: number,
    opcode: string,
    factor1: string,
    factor2: string,
    result: string
): string {

    const config = rpgiv.getRPGIVFreeSettings();
// at top of convertGOTO or before calling helper
    const factor2Normalized = (factor2 || '').trim().replace(/^["']|["']$/g, '').toUpperCase();
    const isEndsrMatch = getNextENDSR(curLineIndex, factor2Normalized);

    let line = '';  // final free format express

    if (isEndsrMatch) {
        line = 'LEAVESR';
    }

    return line;
}



/**
 * Scan forward from `startLine` looking for the next ENDSR.
 * If the first ENDSR found has a tag that matches `factor2` (case-insensitive),
 * returns true. If the first ENDSR found has a different tag, or no ENDSR is
 * found, returns false.
 *
 * @param startLine 0-based line index to start searching after
 * @param factor2 The GOTO's factor2 tag to compare (may be empty)
 */
export function getNextENDSR(startLine: number, factor2: string): boolean {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return false;
  const doc = editor.document;
  const needle = normalizeTag(factor2);

  for (let ln = startLine + 1; ln < doc.lineCount; ln++) {
    const raw = doc.lineAt(ln).text;
    // Skip blank lines, comments and directives using rpgedit helper
      if (rpgiv.isSkipStmt(raw)) continue;

      // If end of RPG source (e.g., ** or **ctdata) then return
      if (rpgiv.isEndSrc(raw)) return false;

    // Detect fixed-format statement using rpgedit helper
    if (rpgiv.isValidFixedFormat(raw)) {
      const opcode = (rpgiv.getRawOpcode(raw) || '').toUpperCase();
      if (opcode === 'ENDSR') {
        // Fixed-format: operand area starts at column 15 (index 14)
        const factor1 = rpgiv.getCol(raw, 12, 25).trim();
        const tag = normalizeTag(factor1);
        return tag === needle;
      }
      continue; // not an ENDSR, keep scanning
    }

    // Free-format handling:
    // Per RPG IV rules ENDSR accepts no operation extenders and may be:
    //   ENDSR;
    //   ENDSR <label>;
    // Label must be separated from ENDSR by at least one whitespace.
    const trimmed = raw.trimStart();
    const up = trimmed.toUpperCase();
    if (up.startsWith('ENDSR')) {
      const after = trimmed.substring(5); // chars after the 'ENDSR' token
      // If next char is '(' then this is not a valid ENDSR with extender (ENDSR does not support extenders)
      // We require next char to be whitespace, semicolon, or end-of-line.
      if (after.length > 0) {
        const firstChar = after[0];
        if (firstChar !== ' ' && firstChar !== '\t' && firstChar !== ';') {
          // Not a valid ENDSR token boundary (defensive), skip this line
          continue;
        }
      }

      // Collect everything after ENDSR up to the terminating semicolon, possibly across lines.
      let labelText = after; // may start with spaces or semicolon
      let curLn = ln;
      while (!labelText.includes(';') && curLn + 1 < doc.lineCount) {
        curLn++;
        const nextRaw = doc.lineAt(curLn).text;
        // If next line is entirely a comment/skip, include its text anyway because user asked to read until semicolon.
        labelText += ' ' + nextRaw.trim();
      }

      // Extract up to first semicolon (if present), otherwise use the collected text.
      const semiPos = labelText.indexOf(';');
      const between = semiPos >= 0 ? labelText.substring(0, semiPos) : labelText;
      const label = between.trim();

      // If there's no label (empty), then normalizeTag('') -> '' and will match only empty needle.
      const tag = normalizeTag(label);
      return tag === needle;
    }

    // otherwise continue scanning
  }

  // No ENDSR found
  return false;
}

/** Normalize tag/token: trim, remove trailing semicolon or surrounding quotes, uppercase. */
function normalizeTag(s: string | undefined | null): string {
  if (!s) return '';
  let t = String(s).trim();
  // remove trailing semicolon if present
  if (t.endsWith(';')) t = t.slice(0, -1).trim();
  // remove surrounding quotes only
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    t = t.substring(1, t.length - 1).trim();
  }
  return t.toUpperCase();
}