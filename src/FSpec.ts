
import * as vscode from 'vscode';

export function convertFSpec(lines: string[]): string[] {
  if (!Array.isArray(lines) || lines.length === 0) return [];

  const joined = lines.map((line, idx) =>
    idx === 0 ? line.padEnd(80, ' ') : line
  ).join('');

  // Extract fields based on RPG fixed-format layout
  const dclType = joined.charAt(5)?.trim() || ' ';                  // Position 6
  const fileName = joined.substring(6, 16)?.trim() || '';            // Positions 7–16
  const fileType = joined.charAt(16)?.trim() || ' ';                 // Position 17
  const fileDesignation = joined.charAt(17)?.trim() || ' ';                 // Position 18
  const endOfFileIndicator = joined.charAt(18)?.trim() || ' ';                 // Position 19
  const fileAddition = joined.charAt(19)?.trim() || ' ';                 // Position 20
  const sequence = joined.charAt(20)?.trim() || ' ';                 // Position 21
  const fileDesc = joined.charAt(21)?.trim() || ' ';                 // Position 22 (F or E)
  const rcdLength = joined.substring(22, 27)?.trim() || '';           // Positions 23–27
  const limitsProcessing = joined.charAt(27)?.trim() || ' ';                 // Position 28
  const keyOrRecAddrLength = joined.substring(28, 33)?.trim() || '';           // Positions 29–33
  const recAddrType = joined.charAt(33)?.trim() || ' ';                 // Position 34
  const fileOrg = joined.charAt(34)?.trim() || ' ';                 // Position 35
  const deviceType = joined.substring(35, 42)?.trim() || '';           // Positions 36–42
  const reserved = joined.charAt(42)?.trim() || ' ';                 // Position 43
  const kwd = joined.substring(43, 80)?.trim() || '';           // Positions 44–80

  // Usage based on file type
  let usage = '';
  if (fileType === 'I') usage = '*input';
  else if (fileType === 'O') usage = '*output';
  else if (fileType === 'U') usage = '*update:*delete';
  else if (fileType === 'C') usage = '*input:*output';

  // Append *output if needed
  if (fileAddition === 'A' && !usage.toLowerCase().includes('*output')) {
    usage += (usage ? ':' : '') + '*output';
  }

  const isExternallyDescribed = fileDesc === 'E';

  let kwdArea = '';
  for (const line of lines) {
    kwdArea += ' ' + line.substring(43, 80).trim(); // 44 to 80
  }
 // vscode.window.showInformationMessage(`dclType=${dclType}, fileName=${fileName} fileDesc=${fileDesc} kwd=${kwdArea}`);


  let decl = '';
  if (fileName && fileName.trim() !== '') {
    decl = `dcl-f ${fileName}`;
  }

  // Add device type and record length
  if (['DISK', 'PRINTER', 'WORKSTN', 'SPECIAL', 'SEQ'].includes(deviceType)) {
    if (isExternallyDescribed) {
      decl += ` ${deviceType.toLowerCase()}(*ext)`;
    } else {
      decl += ` ${deviceType.toLowerCase()}(${rcdLength})`;
    }
  }

  // Add KEYED clause
  let keyedClause = '';
  if (recAddrType === 'K') {
    keyedClause = 'KEYED';
  } else if (recAddrType !== ' ') {
    keyedClause = `KEYED(*CHAR:${keyOrRecAddrLength})`;
  }

  // Combine everything
  if (usage) decl += ` usage(${usage})`;
  if (keyedClause) decl += ` ${keyedClause}`;
  if (kwdArea) decl += ` ${kwdArea.trim()}`;

  return [decl];
}