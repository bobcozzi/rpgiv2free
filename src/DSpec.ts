import * as vscode from 'vscode';
import * as rpgiv from './rpgedit';
import { convertChildVar } from './convertChildVar';

const isDigits = (s: string) => /^\d+$/.test(s);

// Function to convert D specs from fixed-format to free-format
export function convertDSpec(lines: string[],
  entityName: string | null,
  extraDCL: string[] | null,
  allLines: string[],
  curLineIndex: number
): string[] {

  rpgiv.log(`convertDSpec Lines: ${lines?.length ?? 'undefined'}`);

  if (!Array.isArray(lines) || lines.length === 0) return [];
  let varName = entityName;
  let nextIndex = 0;
  let kwdArea = '';
  const settings = rpgiv.getRPGIVFreeSettings();

  const dftName = '*n'; // Default name for D specs

  if (!varName) {
    const joined = lines.map(line => line.padEnd(80, ' ')).join('');
    varName = rpgiv.getCol(joined, 7, 21).trim(); // fallback to classic defn name extraction
  }
  // If still empty, then use the default "name" which is '*n' meaning "no name"
  if (!varName) {
    varName = dftName;
  }

  const joined = lines.map(line => line.padEnd(80, ' ')).join('');

  const specType = rpgiv.getSpecType(joined).trim();   // Get column 6 Spec Type
  const dclType = rpgiv.getColUpper(joined, 24, 25).trim();  // Get column 24-25 DCL Type
  const extType = rpgiv.getColUpper(joined, 22).trim();  // Get column 22 Ext Type
  const dsType = rpgiv.getColUpper(joined, 23).trim();  // Get column 23 dsType Flag
  const fromPos = rpgiv.getColUpper(joined, 26, 32).trim();
  let toPosOrLen = rpgiv.getColUpper(joined, 33, 39).trim();
  const dataType = rpgiv.getColUpper(joined, 40).trim(); // Get column 40 Data Type
  const decPos = rpgiv.getColUpper(joined, 41, 42).trim();

  kwdArea = combineKwdAreaLines(lines);

  let fieldType = '';
  let length = 0;
  let fmt = '*ISO'; // Default format

  const lenMatch = kwdArea.match(/LEN\(([^)]+)\)/i);
  let fieldStartPos = '';
  if (lenMatch && lenMatch[1]) {
    toPosOrLen = lenMatch[1];
  }
  else {
    length = calcLength(dataType, fromPos, toPosOrLen);
  }



  if (fromPos.charAt(0) === '*') {
    const specPos = fromPos + toPosOrLen;
    fieldType = specPos.trim();
  }
  else {
    ({ fieldType, kwds: kwdArea } = convertTypeToKwd(dclType.trim(), dataType.trim(), fromPos.trim(), toPosOrLen.trim(), decPos.trim(), fmt.trim(), kwdArea.trim()));
  }

  if (fieldType === '') {
    if (fromPos.charAt(0) === '*') { // Things like *ROUTINE or *STATUS or *PARMS etc
      const specPos = fromPos + toPosOrLen;
      fieldType = `pos(${specPos.trim()})`;
    }
    else if (/^\d+$/.test(decPos)) {
      if (dclType === 'S') {
        fieldType = `packed(${length}:${decPos || '0'})`;
      }
      else {
        fieldType = `zoned(${length}:${decPos || '0'})`;
      }
    }
    else {
      if (/varying/i.test(kwdArea)) {
        fieldType = `varchar(${length})`;
        kwdArea = kwdArea.replace(/\bvarying\b\s*/i, '').replace(/\s{2,}/g, ' ').trim();
      } else if (length) {
        fieldType = `char(${length})`;
      }
      else if (/len/i.test(kwdArea)) {
        kwdArea = kwdArea.replace(/\blen\(\b\s*/i, 'char(').replace(/\s{2,}/g, ' ').trim();
      }
    }
  }
  // Adds POS keyword when from and to columns are specified
  if (fieldStartPos) {
    fieldType = `${fieldType} ${fieldStartPos}`;
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

  if (isDigits(fromPos)) {
    const adjResult = AdjLenForDIM(length, kwdArea, fieldType, decPos);
    if (adjResult.fieldType) {
      fieldType = adjResult.fieldType;
      length = adjResult.length;
    }
  }

  let decl = '';
  if (dclType === 'DS') {
    if (dsType === 'S') {
      // For the PSDS (program status data structure) we need the PSDS kwd in free format
      kwdArea = `${kwdArea} PSDS`;
    }
    else if (dsType === 'U' || hasDTAARA(kwdArea)) {
      // For data area data structures, ensure DTAARA(*AUTO) is present and formatted
      kwdArea = buildDtaaraKeyword(kwdArea, dsType, varName);
    }
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
    if (dsType === '' && !hasLDA(kwdArea) && settings.addINZ && !/\b(INZ)\b/i.test(kwdArea)) {
      if (!/\bPSDS\b/i.test(kwdArea)) {
        kwdArea = kwdArea ? `INZ ${kwdArea.trim()}` : 'INZ';
      }
    }
  }

  kwdArea = fixKeywordArgs(kwdArea);
  fieldType = (fieldType?.length >= 2) ? fieldType : '';
  const isNameOfOpcode = rpgiv.isValidOpcode(varName) || rpgiv.isReservedWord(varName);
  const dclName = (!varName || varName.trim().toLowerCase() === '*n') ? '' : varName;

  switch (dclType.toLowerCase()) {
    case 's': decl = `dcl-s ${varName} ${fieldType} ${kwdArea ? ' ' + kwdArea : ''}`.trim(); break;
    case 'ds': decl = `dcl-ds ${varName} ${kwdArea}`.trim();
      if (!(/\b(LIKEDS)\b/i.test(kwdArea))) {
        extraDCL?.push(`end-ds ${dclName}`);
      }
      break;
    case 'pr': decl = `dcl-pr ${varName} ${fieldType} ${kwdArea}`.trim();
      extraDCL?.push(`end-pr ${dclName}`);
      break;
    case 'pi': decl = `dcl-pi ${varName} ${fieldType} ${kwdArea}`.trim();
      extraDCL?.push(`end-pi ${dclName}`);
      break;
    case 'c': decl = `dcl-c ${varName} ${kwdArea}`.trim(); break;
    default:  // Data structure Subfield?
      if (isNameOfOpcode) {  // If subfield name matches an opcode or "exec", then use dcl-subf to protect it.
        varName = 'dcl-subf ' + varName;
      }
      decl = `${varName} ${fieldType}${kwdArea ? ' ' + kwdArea : ''}`.trim();
      // converts overlay to pos if needed, and changes dcl-subf to dcl-parm is needed
      decl = convertChildVar(decl, allLines, curLineIndex);
      break;
  }

  return [decl];
}

function AdjLenForDIM(length: number, kwdArea: string, dataType: string, decPos: string): { length: number, fieldType?: string } {
  const dimMatch = kwdArea.match(/DIM\s*\(\s*(\d+)\s*\)/i);
  if (!dimMatch) return { length };

  const dimValue = parseInt(dimMatch[1], 10);
  if (!dimValue || dimValue <= 0) return { length };

  let newLength = length;
  let fieldType;

  if (/char/i.test(dataType)) {
    newLength = Math.floor(length / dimValue);
    fieldType = `char(${newLength})`;
  } else if (/packed/i.test(dataType)) {
    const packedBytes = Math.floor(length / dimValue);
    const digits = packedBytes * 2 - 1;
    fieldType = `packed(${digits}:${decPos || '0'})`;
    newLength = packedBytes;
  } else if (/int/i.test(dataType) || /uns/i.test(dataType)) {
    // RPG IV INT/UNS rules: INT(3)=1, INT(5)=2, INT(10)=4, INT(20)=8
    // Find the per-entry length by dividing total length by DIM value
    const perEntryLen = Math.floor(length / dimValue);
    let intLen = perEntryLen;
    let intType = /uns/i.test(dataType) ? 'uns' : 'int';
    // Map to RPG IV INT/UNS byte sizes
    switch (perEntryLen) {
      case 1: intLen = 3; break;  // 1 byte
      case 2: intLen = 5; break;  // 2 bytes
      case 4: intLen = 10; break; // 4 bytes
      case 8: intLen = 20; break; // 8 bytes
      default: intLen = perEntryLen;
    }
    fieldType = `${intType}(${intLen})`;
    newLength = intLen;
  }
  // Add more types as needed

  return { length: newLength, fieldType };
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
 * - If dataType is 'P', use packed decimal rules: positions = toPos - (fromPos - 1);
 * - If positions is even, length = positions - 1; if odd, length = positions
 */
// Likely need to pass in decimal positions as a string so that,
// if decimal positions and no dataType, then assume Packed or Zoned
// likely also need to know if this is a stand-aloe field (DCL-S) or not
// so we can default to Packed or Zoned respectively.
function calcLength(dataType: string, fromPos: string, toPos: string): number {

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
  inKwds: string
): { fieldType: string; kwds: string } {
  let fieldType = '';
  const datfmtMatch = inKwds.match(/DATFMT\(([^)]+)\)/i);
  const timfmtMatch = inKwds.match(/TIMFMT\(([^)]+)\)/i);
  const settings = rpgiv.getRPGIVFreeSettings(); //
  if (settings.convertBINTOINT === 2) {
    // Do conditional conversion
  }
  let kwds = '';
  let length = calcLength(dataType, fromPos, toPos);
  if (isDigits(fromPos)) {
    kwds += `POS(${fromPos})`;
  }

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


  // If Data Structure has a length, then add the LEN(nnn) keyword
  if (dclType === 'DS') {
    if (toPos && fromPos) {
      kwds += `LEN(${length})`;
    }
    else if (toPos) {
      kwds += ` LEN(${toPos})`
    }
    if (fromPos) {
      kwds += ` OCCURS(${fromPos})`
    }
  }

  kwds += ` ${inKwds}`;

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
    const kwdField = line.length >= 44 ? rpgiv.getCol(line, 44, 80).trimEnd() : '';

    // Determine if this line ends with a continuation character (for next line)
    let nextContinuation: '' | '+' | '-' | '...' = '';
    if (kwdField.endsWith('...')) {
      nextContinuation = '...';
    } else if (kwdField.endsWith('+')) {
      nextContinuation = '+';
    } else if (kwdField.endsWith('-')) {
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

function hasDTAARA(kwdArea: string): boolean {
  const dtaaraRegex = /\bDTAARA\s*\(([^)]*)\)/i;
  const match = kwdArea.match(dtaaraRegex);
  if (match) return true;
  return false
}

function hasLDA(kwdArea: string): boolean {
  const dtaaraRegex = /\bDTAARA\s*\(([^)]*)\)/i;
  const match = kwdArea.match(dtaaraRegex);
  if (!match) return false;
  // Split parameters by colon, trim spaces, ignore case
  const params = match[1].split(':').map(p => p.trim().toUpperCase());
  return params.includes('*LDA');
}
function buildDtaaraKeyword(kwdArea: string, dsType: string, dsName: string): string {

  let kwd = kwdArea;
  const dtaaraRegex = /\bDTAARA\s*\(([^)]*)\)/i;
  const match = kwd.match(dtaaraRegex);
  const bDTAARAKwd = hasDTAARA(kwdArea);
  const bLDAKwd = hasLDA(kwdArea);
  const bUDS = (dsType.trim().toLowerCase() === 'u');
  // If DTAARA contains *LDA and bUDS is true, force parameters to (*LDA : *AUTO : *USRCTL)
  if (bLDAKwd && bUDS) {
    kwd = kwd.replace(dtaaraRegex, 'DTAARA(*LDA:*AUTO:*USRCTL)');
    return kwd.trim();
  }
  if (!bUDS) {
    return kwd.trim();
  }
  if (match) {
    // Split parameters by colon, trim spaces
    let params = match[1].split(':').map(p => p.trim()).filter(p => p.length > 0);

    // Ensure *AUTO is the first parameter
    if (!params[0] || params[0].toUpperCase() !== '*AUTO') {
      params = ['*AUTO', ...params.filter(p => p.toUpperCase() !== '*AUTO')];
    }

    // If the (now) second parameter matches dsName, quote and uppercase it
    if (!(!dsName || dsName.trim() === '' || dsName.toUpperCase() === '*n')) {
      if (params[1] && params[1].replace(/['"]/g, '').toLowerCase() === dsName.toLowerCase()) {
        params[1] = `'${dsName.toUpperCase()}'`;
      }
    }

    // If only one parameter and it matches dsName, quote and uppercase it, unless it is *LDA
    if (params.length === 2 && params[1] === '*AUTO' && params[0].replace(/['"]/g, '').toLowerCase() === dsName.toLowerCase()) {
      params[0] = `'${dsName.toUpperCase()}'`;
    }

    // Replace the original DTAARA keyword with the new one
    kwd = kwd.replace(dtaaraRegex, `DTAARA(${params.join(':')})`);
  } else {
    // Add DTAARA(*AUTO)
    kwd = kwd ? `DTAARA(*AUTO) ${kwd}` : 'DTAARA(*AUTO)';
  }

  return kwd.trim();
}