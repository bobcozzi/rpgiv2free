
import * as rpgiv from './rpgedit'
import { stmtLines } from './types';

export function collectDirectives(allLines: string[], startIndex: number): stmtLines {
  const lines: string[] = [];
  const indexes: number[] = [];
  const comments: string[] = [];
  const eol = rpgiv.getEOL();
  const settings = rpgiv.getRPGIVFreeSettings();

  const fileInfo = rpgiv.getActiveFileInfo();
  const ext = fileInfo?.extension ? fileInfo.extension.trim() : '';
  const config = rpgiv.getRPGIVFreeSettings();

  let start = startIndex;
  // Find end of comment block by scanning forward
  let end = startIndex;
  for (let i = start; i < allLines.length; i++) {
    const line = allLines[i].trimEnd();
     if (rpgiv.isDirective(line)) {
      lines.push(convertDirective(allLines[i],ext, config));
       indexes.push(i);
       continue;
    } else if (rpgiv.isSpecEmpty(line) || rpgiv.isComment(line)) {
      continue
    }
    break;
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
  let enhancedDir = line;
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
      if ((isSQLType && settings.replaceCOPYinSQLRPG) || !isSQLType)
     // Replace only the directive, keep spacing after it intact
      enhancedDir = line.replace(/\/copy/i, '/include');
    }
  }
  // Replace everything before the first '/' (including the '/') with exactly 7 spaces and a '/'
  enhancedDir = enhancedDir.replace(/^.{0,7}\/\s*/i, '       /');

  return enhancedDir;
}