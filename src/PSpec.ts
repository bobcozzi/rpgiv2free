import * as vscode from 'vscode';
import * as ibmi from './IBMi';
import { getVarName, combineKwdAreaLines } from './DSpec'; // borrow some DSpec functions

// Function to convert D specs from fixed-format to free-format
export function convertPSpec(lines: string[], entityName: string | null): string[] {
 // vscode.window.showInformationMessage(`convertPSpec called. Lines: ${lines?.length ?? 'undefined'}`);

  if (!Array.isArray(lines) || lines.length === 0) return [];
  let varName = entityName;
  let nextIndex = 0;
  let kwdArea = '';
  const settings = ibmi.getRPGIVFreeSettings();

  const dftName = '*n'; // Default name for D specs

  if (!varName) {
    const joined = lines.map(line => line.padEnd(80, ' ')).join('');
    varName = ibmi.getCol(joined, 7, 21).trim(); // fallback to default extraction
  } else {
    lines = lines.slice(nextIndex);
  }
  if (!varName) {
    varName = dftName;
  }

  const joined = lines.map(line => line.padEnd(80, ' ')).join('');

  const specType = ibmi.getSpecType(joined);   // Get column 6 Spec Type
  const dclType = ibmi.getColUpper(joined, 24, 25);  // Get column 24-25 DCL Type
  let decl = '';

  kwdArea = combineKwdAreaLines(lines);
  kwdArea = fixKeywordArgs(kwdArea);

  switch (dclType.toLowerCase()) {
    case 'b': decl = `dcl-proc ${varName} ${kwdArea}`.trim(); break;
    case 'e': decl = `end-proc ${varName}`.trim(); break;
  }

  return [decl];
}

//  Search this kind of stuff for keywords
//      D externDS      E DS                  EXTName(custmast)
// replace it with this:
//      D externDS      E DS                  EXTName('CUSTMAST')
function fixKeywordArgs(line: string): string {
  const keywords = ['EXPORT', 'EXTPROC'];
  const regex = new RegExp(`\\b(${keywords.join('|')})\\s*\\(([^)]+)\\)`, 'gi');

  // Find all matches and collect them
  let matches: string[] = [];
  let modifiedLine = line.replace(regex, (match, keyword, arg) => {
    const trimmed = arg.trim();
    let formatted = '';
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
      trimmed.startsWith('*')
    ) {
      formatted = `${keyword}(${trimmed})`;
    } else {
      formatted = `${keyword}('${trimmed.toUpperCase()}')`;
    }
    matches.push(formatted);
    return ''; // Remove from original position
  });

  // Remove extra spaces and commas left behind
  modifiedLine = modifiedLine.replace(/^[, ]+|[, ]+$/g, '').replace(/[, ]{2,}/g, ' ').trim();

  // Prepend the found keywords (in order of appearance)
  if (matches.length > 0) {
    modifiedLine = `${matches.join(' ')}${modifiedLine ? ' ' + modifiedLine : ''}`.trim();
  }

  return modifiedLine;
}


