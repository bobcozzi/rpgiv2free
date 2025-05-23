
import * as rpgiv from './rpgedit'
import { stmtLines } from './types';

export function collectDirectives(allLines: string[], startIndex: number): stmtLines {
  const lines: string[] = [];
  const indexes: number[] = [];
  const comments: string[] = [];
  const eol = rpgiv.getEOL();
  const settings = rpgiv.getRPGIVFreeSettings();

  // NOTE: Updates various compiler directives to modern versions

  // Find start of comment block by scanning backward
  let start = startIndex;
  while (start > 0) {
    const line = allLines[start-1].trimEnd();
    if (rpgiv.isEmptyStmt(line) || rpgiv.isDirective(line)) {
      start--;
    } else {
      break;
    }
  }

  // Find end of comment block by scanning forward
  let end = start;
  while (end < allLines.length) {
    const line = allLines[end+1].trimEnd();
     if (rpgiv.isEmptyStmt(line) || rpgiv.isDirective(line)) {
      end++;
    } else {
      break;
    }
  }
  const fileInfo = rpgiv.getActiveFileInfo();
  const ext = fileInfo?.extension ? fileInfo.extension.trim() : '';
  const config = rpgiv.getRPGIVFreeSettings();

  for (let i = start; i <= end; i++) {
    lines.push(convertDirective(allLines[i],ext, config));
    indexes.push(i);
  }

  return {
    lines,
    indexes,
    comments: comments.length > 0 ? comments : null
  };
}

function convertDirective(line: string, extension: string,  settings: rpgiv.configSettings): string {

  if (!rpgiv.isDirective(line)) {
    return line;
  }
  let enhancedDir = '';
  const isSQLType = extension?.startsWith('.sql');
  // ...existing code...
  const col = rpgiv.getCol(line, 7, 80);
  const dir = typeof col === 'string' ? col.trimEnd() : '';
  if (dir) {
    const dirLower = dir.trim().toLowerCase();
    if (settings.removeFREEdir &&
       (dirLower === '/free' ||
        dirLower === '/end-free')) {
      enhancedDir = ` // F2FF: Removed deprecated ${dir} statement`
    } else if (settings.replaceCOPYinRPG && dirLower.startsWith('/copy')) {
      if (isSQLType && settings.replaceCOPYinSQLRPG)
     // Replace only the directive, keep spacing after it intact
      enhancedDir = line.replace(/\/copy/i, '/include');
    }
  }

  return enhancedDir;
}