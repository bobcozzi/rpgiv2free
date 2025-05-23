
import * as vscode from 'vscode';
import * as rpgiv from './rpgedit'

export function convertFSpec(lines: string[]): string[] {
  if (!Array.isArray(lines) || lines.length === 0) return [];

  const joined = lines.map((line, idx) =>
    idx === 0 ? line.padEnd(80, ' ') : line
  ).join('');

  const settings = rpgiv.getRPGIVFreeSettings();

  // Extract fields based on RPG fixed-format layout
  const dclType = rpgiv.getSpecType(joined);                  // Position 6
  const fileName = rpgiv.getColUpper(joined,7, 16).trim();            // Positions 7–16
  const fileType = rpgiv.getColUpper(joined,17);                 // Position 17
  const fileDesignation = rpgiv.getColUpper(joined,18);                 // Position 18
  const endOfFileIndicator = rpgiv.getColUpper(joined,19);                 // Position 19
  const fileAddition = rpgiv.getColUpper(joined,20);                 // Position 20
  const sequence = rpgiv.getColUpper(joined,21);                 // Position 21
  const fileDesc = rpgiv.getColUpper(joined,22);                 // Position 22 (F or E)
  const rcdLength = rpgiv.getColUpper(joined,23, 27).trim();           // Positions 23–27
  const limitsProcessing = rpgiv.getColUpper(joined,28);                 // Position 28
  const keyOrRecAddrLength = rpgiv.getColUpper(joined,29, 33).trim();           // Positions 29–33
  const recAddrType = rpgiv.getColUpper(joined, 34);
  const fileOrg = rpgiv.getColUpper(joined,35);                 // Position 35
  const deviceType = rpgiv.getColUpper(joined,36, 42).trim();           // Positions 36–42
  const reserved = rpgiv.getColUpper(joined,43);                 // Position 43
  const kwd = rpgiv.getColUpper(joined,44, 80).trim();           // Positions 44–80

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
      if (settings.addEXTDEVFLAG) {
        decl += ` ${deviceType.toLowerCase()}(*ext)`;
      }
      else {
        decl += ` ${deviceType.toLowerCase()}`;
      }
    } else {
      decl += ` ${deviceType.toLowerCase()}(${rcdLength})`;
    }
  }

  // Add KEYED clause
  let keyedClause = '';
  if (recAddrType === 'K') {
    keyedClause = 'KEYED';
  } else if (recAddrType.trim())  {
    keyedClause = `KEYED(*CHAR:${keyOrRecAddrLength})`;
  }

  // Combine everything
  if (usage) decl += ` usage(${usage})`;
  if (keyedClause) decl += ` ${keyedClause}`;
  if (kwdArea) decl += ` ${kwdArea.trim()}`;

  return [decl];
}