import * as vscode from 'vscode';
import * as ibmi from './IBMi';
import { log } from './extension'; // adjust path if needed

function getVarName(lines: string[], startIndex = 0): { varName: string, nextIndex: number } {
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
export function convertDSpec(lines: string[], entityName: string | null): string[] {
    vscode.window.showInformationMessage(`convertDSpec called. Lines: ${lines?.length ?? 'undefined'}`);

    if (!Array.isArray(lines) || lines.length === 0) return [];
    let varName = entityName;
    let nextIndex = 0;
    let kwdArea = '';

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
    const extType = ibmi.getColUpper(joined, 22);  // Get column 22 Ext Type
    const PSDS = ibmi.getColUpper(joined, 23);  // Get column 23 PSDS Flag
    const fromPos = ibmi.getColUpper(joined, 26, 32);
    let   toPosOrLen = ibmi.getColUpper(joined, 33, 39);
    const dataType = ibmi.getColUpper(joined, 40); // Get column 40 Data Type
    const decPos = ibmi.getColUpper(joined, 41, 42);

    kwdArea = processKeywordLines(lines);

    let fieldType = '';
    let fmt = '*ISO'; // Default format

    const lenMatch = kwdArea.match(/LEN\(([^)]+)\)/i);

    if (lenMatch && lenMatch[1]) {
        toPosOrLen = lenMatch[1];
    }

    if (fromPos.charAt(0) === '*') {
        fieldType = `pos(${fromPos.trim()})`;
  }



    ({ fieldType, kwds: kwdArea } = convertTypeToType(dataType, toPosOrLen, decPos, fmt, kwdArea));

    if (fieldType === '') {
      if (fromPos.charAt(0) === '*') {
        fieldType = `pos(${fromPos.trim()})`;
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
        } else {
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

      // Remove the LEN(n) keyword
      kwdArea = kwdArea.replace(/,\s*LEN\([^)]+\)|LEN\([^)]+\),?\s*/i, '').trim();
    }

    let decl = '';
    if (PSDS === 'S') {
        // For PSDS, we need to add the PSDS keyword
        kwdArea = `${kwdArea} PSDS`;
    }
    if (extType === 'E' && !/\b(bEXTNAME|EXTFILE|EXT)\b/i.test(kwdArea)) {
        kwdArea = kwdArea ? `${kwdArea.trim()} EXT` : 'EXT';
    }

    // If kwdArea contains EXT or EXTNAME (case-insensitive), add 'end-ds'
    if (/\b(bEXTNAME|EXTFILE|EXT)\b/i.test(kwdArea)) {
        if (!/\bEND-DS\b/i.test(kwdArea)) {
            kwdArea = `${kwdArea.trim()} end-ds`;
        }
    }

    kwdArea = fixKeywordArgs(kwdArea);
    fieldType = (fieldType?.length >= 2) ? fieldType : '';

    switch (dclType.toLowerCase()) {
        case 'ds': decl = `dcl-ds ${varName} ${kwdArea}`.trim(); break;
        case 's' : decl = `dcl-s ${varName} ${fieldType}${kwdArea ? ' ' + kwdArea : ''}`.trim(); break;
        case 'pr': decl = `dcl-pr ${varName} ${fieldType}${kwdArea}`.trim(); break;
        case 'pi': decl = `dcl-pi ${varName} ${fieldType}${kwdArea}`.trim(); break;
        case 'c': decl = `dcl-c ${varName} ${kwdArea}`.trim(); break;
        default:
            decl = `${varName} ${fieldType}${kwdArea ? ' ' + kwdArea : ''}`.trim(); break;
    }

    return [decl];
}

//  Search this kind of stuff for keywords
//      D externDS      E DS                  EXTName(custmast)
// replace it with this:
//      D externDS      E DS                  EXTName('CUSTMAST')

function fixKeywordArgs(line: string): string {
    const keywords = ['EXTNAME', 'DTAARA', 'EXTFILE'];
    const regex = new RegExp(`\\b(${keywords.join('|')})\\s*\\(([^)]+)\\)`, 'gi');

    // Apply the regex replace to each line separately to avoid issues with multiline input
    return line
        .split('\n')
        .map(singleLine =>
            singleLine.replace(regex, (match, keyword, arg) => {
                const trimmed = arg.trim();
                if (
                    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
                    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
                    trimmed.startsWith('*')
                ) {
                    return `${keyword}(${trimmed})`;
                }
                return `${keyword}(\'${trimmed.toUpperCase()}\')`;
            })
        )
        .join('\n');
}

function convertTypeToType(
    dataType: string,
    length: string,
    dec: string,
    fmt: string,
    kwds: string
  ): { fieldType: string; kwds: string } {
    let fieldType = '';
    const datfmtMatch = kwds.match(/DATFMT\(([^)]+)\)/i);
    const timfmtMatch = kwds.match(/TIMFMT\(([^)]+)\)/i);

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
      case 'B': return { fieldType: `bindec(${length}:${dec || '0'})`, kwds };
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

function processKeywordLines(lines: string[]): string {
  let kwdArea = '';
  let i = 0;
  let continuation = false;
  let endsWith = '';

  while (i < lines.length) {
    const line = lines[i].padEnd(80, ' ');
    let currentLineKwd = ibmi.getCol(line, 44, 80).trimEnd(); // get from col 44 to 80

    if (!continuation) {
      kwdArea += ` ${currentLineKwd}`;
    }
    else {

      endsWith = kwdArea.trimEnd().slice(-1); // get last non-blank char

      if (endsWith === '+') {
        kwdArea = kwdArea.slice(0, -1); // Remove the trailing + symbol
        currentLineKwd = currentLineKwd.trimStart(); // trim leading blanks
      }
      else if (endsWith === '-') {
        kwdArea = kwdArea.slice(0, -1); // Remove the trailing - symbol
      }
      kwdArea += currentLineKwd;
      continuation = false; // Reset continuation flag
    }
    endsWith = kwdArea.trimEnd().slice(-1); // get last non-blank char

    if (endsWith === '+' || endsWith === '-') {
      continuation = true;
    }

    i += 1;
  }

  return kwdArea.trim();
}