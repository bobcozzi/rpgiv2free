import * as vscode from 'vscode';
import * as ibmi from './IBMi';

export function getVarName(lines: string[], startIndex = 0): { varName: string, nextIndex: number } {
  let nameParts: string[] = [];
  let i = startIndex;

  while (i < lines.length) {
    const line = lines[i].padEnd(80, ' ');
    const nameChunk = line.substring(6, 80).trimEnd(); // get from col 7 to 80

    if (nameChunk.endsWith('...')) {
      nameParts.push(nameChunk.slice(0, -3));
      i++;
    } else {
      // If it's the first line and not a long name continuation, fall back to default logic
      if (i === startIndex) {
        return { varName: '', nextIndex: startIndex };
      }

      nameParts.push(nameChunk.trim());
      i++;
      break;
    }
  }

  const fullName = nameParts.join('');
  return { varName: fullName.trim(), nextIndex: i };
}

// Function to convert D specs from fixed-format to free-format
export function convertDSpec(lines: string[], entityName: string | null, extraDCL: string[] | null): string[] {

  ibmi.log(`convertDSpec called. Lines: ${lines?.length ?? 'undefined'}`);

  if (!Array.isArray(lines) || lines.length === 0) return [];
  let varName = entityName;
  let nextIndex = 0;
  let kwdArea = '';
  const settings = ibmi.getRPGIVFreeSettings();

  const dftName = '*n'; // Default name for D specs

  if (!varName) {
    const joined = lines.map(line => line.padEnd(80, ' ')).join('');
    varName = ibmi.getCol(joined, 7, 21).trim(); // fallback to classic defn name extraction
  }
  // If still empty, then use the default "name" which is '*n' meaning "no name"
  if (!varName) {
    varName = dftName;
  }

  const joined = lines.map(line => line.padEnd(80, ' ')).join('');

  const specType = ibmi.getSpecType(joined).trim();   // Get column 6 Spec Type
  const dclType = ibmi.getColUpper(joined, 24, 25).trim();  // Get column 24-25 DCL Type
  const extType = ibmi.getColUpper(joined, 22).trim();  // Get column 22 Ext Type
  const PSDS = ibmi.getColUpper(joined, 23).trim();  // Get column 23 PSDS Flag
  const fromPos = ibmi.getColUpper(joined, 26, 32).trim();
  let toPosOrLen = ibmi.getColUpper(joined, 33, 39).trim();
  const dataType = ibmi.getColUpper(joined, 40).trim(); // Get column 40 Data Type
  const decPos = ibmi.getColUpper(joined, 41, 42).trim();

  kwdArea = combineKwdAreaLines(lines);

  let fieldType = '';
  let fmt = '*ISO'; // Default format

  const lenMatch = kwdArea.match(/LEN\(([^)]+)\)/i);

  if (lenMatch && lenMatch[1]) {
    toPosOrLen = lenMatch[1];
  }

  if (fromPos.charAt(0) === '*') {
    const specPos = fromPos + toPosOrLen;
    fieldType = `pos(${specPos.trim()})`;
  }
  else {
    ({ fieldType, kwds: kwdArea } = convertTypeToKwd(dclType.trim(), dataType.trim(), fromPos.trim(), toPosOrLen.trim(), decPos.trim(), fmt.trim(), kwdArea.trim()));
  }

  if (fieldType === '') {
    if (fromPos.charAt(0) === '*') {
      const specPos = fromPos + toPosOrLen;
      fieldType = `pos(${specPos.trim()})`;
      }
    else if (/^\d+$/.test(decPos)) {
      if (dclType === 'S') {
        fieldType = `packed(${toPosOrLen}:${decPos || '0'})`;
      }
      else {
        fieldType = `zoned(${toPosOrLen}:${decPos || '0'})`;
      }
    }
    else {
      if (/varying/i.test(kwdArea)) {
        fieldType = `varchar(${toPosOrLen})`;
        kwdArea = kwdArea.replace(/\bvarying\b\s*/i, '').replace(/\s{2,}/g, ' ').trim();
      } else if (toPosOrLen) {
        fieldType = `char(${toPosOrLen})`;
      }
    }
  }


  if (lenMatch && lenMatch[1]) {
    const lenValue = lenMatch[1];

    // Replace size in CHAR(n) or VARCHAR(n) if the LEN() keyword was used
    kwdArea = kwdArea.replace(/(CHAR|VARCHAR)\(\d+\)/i, (match, type) => {
      return `${type}(${lenValue})`;
    });

    if (dclType !== 'DS') {
      // Remove the LEN(n) keyword
      kwdArea = kwdArea.replace(/,\s*LEN\([^)]+\)|LEN\([^)]+\),?\s*/i, '').trim();
    }
  }

  let decl = '';
  if (PSDS === 'S') {
    // For PSDS, we need to add the PSDS keyword
    kwdArea = `${kwdArea} PSDS`;
  }
  if (dclType !== 'DS' && dclType !== 'S' && dclType !== 'C') {
    // For DS, we need to add the DS keyword
    if (extType === 'E' && !/\b(EXTFLD)\b/i.test(kwdArea)) {
      kwdArea = kwdArea ? `EXTFLD ${kwdArea.trim()}` : 'EXTFLD';
    }
  }
  if (dclType === 'DS') {
    // For DS, we need to add the DS keyword
    if (extType === 'E' && !/\b(EXTNAME|EXTFILE|EXT)\b/i.test(kwdArea)) {
      kwdArea = kwdArea ? `EXT ${kwdArea.trim()}` : 'EXT';
    }
    if (settings.addINZ && !/\b(INZ)\b/i.test(kwdArea)) {
      if (!/\bPSDS\b/i.test(kwdArea)) {
        kwdArea = kwdArea ? `INZ ${kwdArea.trim()}` : 'INZ';
      }
    }
    // If the Data Structure is something such as LIKEDS(xxx),
    // then an END-DS keyword is NOT allowed.
    // e.g.,  dcl-ds custmast likeds(cust_t); // END-DS is NOT allowed

    // If the Data Structure is something such as EXTNAME(xxx),
    // then an END-DS keyword is required either as a keyword style
    // or as a separate statement.
    // e.g.,  dcl-ds custmast extname('CUSTMAST') end-ds; // requires END-DS
    // or
    //        dcl-ds custmast extname('CUSTMAST');
    //        end-ds; // requires END-DS
    // comment out the following block since it is done elsewhere
    // if (/\b(EXTNAME|EXTFILE|EXT)\b/i.test(kwdArea)) {
    //   if (!/\bEND-DS\b/i.test(kwdArea)) {
    //     if (extraDCL != null) {
    //       extraDCL.push(`end-ds;`);
    //     }
    //   }
    // }
  }

  kwdArea = fixKeywordArgs(kwdArea);
  fieldType = (fieldType?.length >= 2) ? fieldType : '';
  const isOpCode = ibmi.isValidOpcode(varName);

  switch (dclType.toLowerCase()) {
    case 'ds': decl = `dcl-ds ${varName} ${kwdArea}`.trim();
      if (!(/\b(LIKEDS)\b/i.test(kwdArea))) {
        extraDCL?.push(`end-ds;`);
      }
      break;
    case 's': decl = `dcl-s ${varName} ${fieldType} ${kwdArea ? ' ' + kwdArea : ''}`.trim(); break;
    case 'pr': decl = `dcl-pr ${varName} ${fieldType} ${kwdArea}`.trim();
      extraDCL?.push(`end-pr;`);
      break;
    case 'pi': decl = `dcl-pi ${varName} ${fieldType} ${kwdArea}`.trim();
      extraDCL?.push(`end-pi;`);
      break;
    case 'c': decl = `dcl-c ${varName} ${kwdArea}`.trim(); break;
    default:
      if (isOpCode) {
        varName = 'dcl-subf ' + varName;
      }
      decl = `${varName} ${fieldType}${kwdArea ? ' ' + kwdArea : ''}`.trim(); break;
  }

  return [decl];
}

//  Search this kind of stuff for keywords
//      D externDS      E DS                  EXTName(custmast)
// replace it with this:
//      D externDS      E DS                  EXTName('CUSTMAST')
function fixKeywordArgs(KwdArea: string): string {
  const keywords = ['EXTNAME', 'DTAARA', 'EXTFILE', 'EXTFLD'];
  const regex = new RegExp(`\\b(${keywords.join('|')})\\s*\\(([^)]+)\\)`, 'gi');

  // Find all matches and collect them
  let matches: string[] = [];
  let modifiedLine = KwdArea.replace(regex, (match, keyword, arg) => {
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
  // modifiedLine = modifiedLine.replace(/^[, ]+|[, ]+$/g, '').replace(/[, ]{2,}/g, ' ').trim();
  modifiedLine = modifiedLine.replace(/^[, ]+|[, ]+$/g, '').trim();

  // Prepend the found keywords (in order of appearance)
  if (matches.length > 0) {
    modifiedLine = `${matches.join(' ')}${modifiedLine ? ' ' + modifiedLine : ''}`.trim();
  }

  return modifiedLine;
}

/**
 * Calculates the length for use in convertTypeToKwd.
 * - If fromPos and toPos are both all digits, length = toPos - (fromPos - 1)
 * - If fromPos is not all digits, length = toPos
 * - If dataType is 'P', use packed decimal rules: positions = toPos - (fromPos - 1); if positions is even, length = positions - 1; if odd, length = positions
 */
function calcLength(dataType: string, fromPos: string, toPos: string): number {
  const isDigits = (s: string) => /^\d+$/.test(s);
  if (dataType === 'P') {
    if (isDigits(fromPos) && isDigits(toPos)) {
      // Packed: number of digits = toPos - (fromPos - 1)
      const positions = (parseInt(toPos, 10) - (parseInt(fromPos, 10) - 1)) * 2;
      // Packed storage: if positions is even, subtract 1; if odd, use positions
      return positions % 2 === 0 ? positions - 1 : positions;
    } else if (isDigits(toPos)) {
      return parseInt(toPos, 10);
    }
  }
  else if (["I", "U", "B"].includes(dataType)) {
    return calcIntLength(dataType, fromPos, toPos); // length calc for Integers
  }
  else if (isDigits(fromPos) && isDigits(toPos)) {
    return parseInt(toPos, 10) - (parseInt(fromPos, 10) - 1);  // From To "columns"
  } else if (isDigits(toPos)) {
    return parseInt(toPos, 10);
  }
  return 0;
}

function calcIntLength(dataType: string, fromPos: string, toPos: string): number {
  const isDigits = (s: string) => /^\d+$/.test(s);
  if (dataType === 'I' || dataType === 'U') {
    if (isDigits(fromPos) && isDigits(toPos)) {
      // Packed: number of digits = toPos - (fromPos - 1)
      const positions = (parseInt(toPos, 10) - (parseInt(fromPos, 10) - 1));
      // If from/To columns equate to 1, 2, 4, or 8, assign the "length" accordingly
      // Int(3) = 1 byte
      // Int(5) = 2 bytes
      // Int(10) = 4 bytes
      // Int(20) = 8 bytes
      switch (positions) {
        case 1: return 3; // 1 byte
        case 2: return 5; // 2 bytes
        case 4: return 10; // 4 bytes
        case 8: return 20; // 8 bytes
        case 16: return 40; // 16 bytes
        default:
          return positions;
      }
    } else if (isDigits(toPos)) {
      return parseInt(toPos, 10);
    }
  }
  else if (dataType === 'B') {
    if (isDigits(fromPos) && isDigits(toPos)) {
      // Packed: number of digits = toPos - (fromPos - 1)
      const positions = (parseInt(toPos, 10) - (parseInt(fromPos, 10) - 1));
      // Packed storage: if positions is even, subtract 1; if odd, use positions
      if (positions <= 2) {
        return 5;
      } else if (positions <= 4) {
        return 9;
      }
    } else if (isDigits(toPos)) {
      return parseInt(toPos, 10);
    }
  }
  return 0;
}


function convertTypeToKwd(
  dclType: string,
  dataType: string,
  fromPos: string,
  toPos: string,
  dec: string,
  fmt: string,
  kwds: string
): { fieldType: string; kwds: string } {
  let fieldType = '';
  const datfmtMatch = kwds.match(/DATFMT\(([^)]+)\)/i);
  const timfmtMatch = kwds.match(/TIMFMT\(([^)]+)\)/i);
  const settings = ibmi.getRPGIVFreeSettings(); //
  if (settings.convertBINTOINT === 2) {
    // Do conditional conversion
  }

  let length = 0;

  if (["B", "I", "U", "P", "S"].includes(dataType) || dec !== '') {
    // Data Structure Subfields that are numeric default to Zoned,
    // Stand-alone fields default to Packed
    if (dclType.trim() === '' && (!dataType || dataType.trim() === '')) {
      dataType = 'S';
      length = calcLength(dataType, fromPos, toPos);
    }
    else if (dclType.trim() === 'S' && (!dataType || dataType.trim() === '')) {
      dataType = 'P';
      length = calcLength(dataType, fromPos, toPos);
    }
    else if (dataType.trim() === 'B') {
      if (settings.convertBINTOINT === 2 && dec === '0') { // Convert to int when dec = 0
        dataType = 'I';
        length = calcIntLength(dataType, fromPos, toPos); // length calc for Integers
      }
      else if (settings.convertBINTOINT === 1) { // Convert to int always
        dataType = 'I';
        length = calcIntLength(dataType, fromPos, toPos); // length calc for Integers
      }
      else {
        length = calcLength(dataType, fromPos, toPos);
      }
    }
    else if (dataType.trim() === 'I' || dataType.trim() === 'U') {
      length = calcIntLength(dataType, fromPos, toPos); // length calc for Integers
    }
    else {
      length = calcLength(dataType, fromPos, toPos);
    }
  }
  else {
    length = calcLength(dataType, fromPos, toPos); // simple length calc for other data types
  }

  // If Data Structure has a length, then add the LEN(nnn) keyword
  if (dclType === 'DS') {
    if (toPos) {
      kwds += ` LEN(${toPos})`
    }
    if (fromPos) {
      kwds += ` OCCURS(${fromPos})`
    }
  }

  switch (dataType) {
    case 'A':
      if (/varying/i.test(kwds)) {
        fieldType = `varchar(${length})`;
        kwds = kwds.replace(/\bvarying\b\s*/i, '').replace(/\s{2,}/g, ' ').trim();
      } else {
        fieldType = `char(${length})`;
      }
      return { fieldType, kwds };

    case 'P': return { fieldType: `packed(${length}:${dec || '0'})`, kwds };
    case 'S': return { fieldType: `zoned(${length}:${dec || '0'})`, kwds };
    case 'B':
      if (settings.convertBINTOINT === 1) {  // Convert to Int, always
        fieldType = `int(${length})`;
      }
      else if (settings.convertBINTOINT === 2 && dec === '0') { // Convert to int when dec = 0
        fieldType = `int(${length})`;
      }
      else {
        fieldType = `bindec(${length}:${dec || '0'})`;
      }
      return { fieldType: fieldType, kwds };

    case 'I': return { fieldType: `int(${length})`, kwds };
    case 'U': return { fieldType: `uns(${length})`, kwds };
    case 'F': return { fieldType: `float(${length})`, kwds };
    case 'Z': return { fieldType: `timestamp`, kwds };

    case 'D':
      if (datfmtMatch) {
        const datfmt = datfmtMatch[1].toUpperCase();
        fieldType = `date(${datfmt})`;
        kwds = kwds.replace(datfmtMatch[0], '').trim();
      } else {
        fieldType = `date(${fmt})`;
      }
      return { fieldType, kwds };

    case 'T':
      if (timfmtMatch) {
        const timfmt = timfmtMatch[1].toUpperCase();
        fieldType = `time(${timfmt})`;
        kwds = kwds.replace(timfmtMatch[0], '').trim();
      } else {
        fieldType = `time(${fmt})`;
      }
      return { fieldType, kwds };

    case 'G': return { fieldType: `graphic(${length})`, kwds };
    case 'C': return { fieldType: `USC2(${length})`, kwds };
    case '*': return { fieldType: `pointer`, kwds };
    case 'N': return { fieldType: `ind`, kwds };

    case 'O': {
      const classRegex = /CLASS\s*\(([^)]*)\)/i;
      const procRegex = /EXTPROC\s*\(([^)]*)\)/i;
      if (classRegex.test(kwds)) {
        kwds = kwds.replace(classRegex, 'OBJECT($1)');
        fieldType = 'O';
      } else {
        fieldType = 'OBJECT ';
      }
      return { fieldType, kwds };
    }

    default:
      return { fieldType: '', kwds };
  }
}

export function combineKwdAreaLines(lines: string[]): string {
  let kwdArea = '';
  let continuation: '' | '+' | '-' | '...' = '';

  for (const line of lines) {
    const kwdField = line.length >= 44 ? line.substring(43, 80).trimEnd() : '';
    const trimmedEnd = kwdField.trimEnd();

    // Determine if this line ends with a continuation character (for next line)
    let nextContinuation: '' | '+' | '-' | '...' = '';
    if (trimmedEnd.endsWith('...')) {
      nextContinuation = '...';
    } else if (trimmedEnd.endsWith('+')) {
      nextContinuation = '+';
    } else if (trimmedEnd.endsWith('-')) {
      nextContinuation = '-';
    }

    // Remove any continuation character from current line for processing
    let content = kwdField.replace(/\.\.\.$/, '').replace(/[+-]$/, '');

    // Apply prior continuation to current line
    if (continuation === '+') {
      kwdArea += content.trimStart(); // join tightly
    } else if (continuation === '-') {
      kwdArea += content; // preserve leading spaces
    } else if (continuation === '...') {
      kwdArea += content.trimStart(); // join tightly
    } else {
      if (kwdArea) kwdArea += ' ';
      kwdArea += content.trimStart();
    }

    // Set continuation for next iteration
    continuation = nextContinuation;
  }

  return kwdArea.trimEnd();
}