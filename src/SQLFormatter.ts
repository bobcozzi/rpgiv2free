

import * as rpgiv from './rpgedit';
/**
 * Checks if the match is a real SQL keyword (not a host variable like :SELECT or &WHERE).
 */
function isRealKeyword(sqlKwd: string, matchIndex: number): boolean {
  // Look behind for the previous non-whitespace character
  let i = matchIndex - 1;
  while (i >= 0 && /\s/.test(sqlKwd[i])) i--;
  if (i >= 0 && (sqlKwd[i] === ':' || sqlKwd[i] === '&')) {
    return false;
  }
  return true;
}
export function formatSQL(sql: string): string {
  const keywords = [
    'with', 'select', 'from', 'where', 'and', 'or', 'order by', 'group by', 'having',
    'join', 'inner join', 'left join', 'right join', 'on', 'as', 'in', 'like',
    'between', 'is null', 'is not null', 'exists', 'not exists',
    'declare', 'cursor', 'for', 'prepare', 'open', 'fetch', 'close'
  ];
  // Replace keywords only if they are real SQL keywords (not host variables)
  let formattedSQL = sql.trim().replace(/\s+/g, ' ');
  for (const keyword of keywords.sort((a, b) => b.length - a.length)) {
    const re = new RegExp(`\\b${keyword}\\b`, 'gi');
    formattedSQL = formattedSQL.replace(re, (match, offset) => {
      if (isRealKeyword(formattedSQL, offset)) {
        return keyword.toUpperCase();
      }
      return match;
    });
  }

  // Handle DECLARE ... CURSOR FOR with line breaks
  formattedSQL = formattedSQL.replace(
    /\bDECLARE\s+(\w+)\s+CURSOR\s+FOR\s+(SELECT\b[\s\S]+)/i,
    (_, name, select) => {
      return `DECLARE ${name} CURSOR FOR\n${select.trim()}`;
    }
  );

  // Break SELECT and clause lines
  const eol = rpgiv.getEOL();
  // Only insert EOL before real SQL keywords, not host variables
  function insertEOLIfRealKeyword(pattern: RegExp) {
    let result = '';
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(formattedSQL)) !== null) {
      const matchIndex = match.index;
      if (isRealKeyword(formattedSQL, matchIndex)) {
        result += formattedSQL.slice(lastIndex, matchIndex) + eol + match[1];
      } else {
        result += formattedSQL.slice(lastIndex, pattern.lastIndex - match[1].length) + match[1];
      }
      lastIndex = pattern.lastIndex;
    }
    result += formattedSQL.slice(lastIndex);
    formattedSQL = result;
  }

  insertEOLIfRealKeyword(/\b(SELECT|FROM|WHERE|ORDER BY|GROUP BY|HAVING|JOIN|ON)\b/gi);
  insertEOLIfRealKeyword(/\b(AND|OR)\b/gi);

  return formattedSQL;
}