export function formatSQL(sql: string): string {
  const keywords = [
    'with', 'select', 'from', 'where', 'and', 'or', 'order by', 'group by', 'having',
    'join', 'inner join', 'left join', 'right join', 'on', 'as', 'in', 'like',
    'between', 'is null', 'is not null', 'exists', 'not exists',
    'declare', 'cursor', 'for', 'prepare', 'open', 'fetch', 'close'
  ];

  // Normalize whitespace and uppercase keywords
  let formattedSQL = sql.trim().replace(/\s+/g, ' ');
  for (const keyword of keywords.sort((a, b) => b.length - a.length)) {
    const re = new RegExp(`\\b${keyword}\\b`, 'gi');
    formattedSQL = formattedSQL.replace(re, keyword.toUpperCase());
  }

  // Handle DECLARE ... CURSOR FOR with line breaks
  formattedSQL = formattedSQL.replace(
    /\bDECLARE\s+(\w+)\s+CURSOR\s+FOR\s+(SELECT\b[\s\S]+)/i,
    (_, name, select) => {
      return `DECLARE ${name} CURSOR FOR\n${select.trim()}`;
    }
  );

  // Break SELECT and clause lines
  formattedSQL = formattedSQL.replace(/\b(SELECT|FROM|WHERE|ORDER BY|GROUP BY|HAVING|JOIN|ON)\b/gi, '\n$1');
  formattedSQL = formattedSQL.replace(/\b(AND|OR)\b/gi, '\n$1');

  return formattedSQL;
}