
import * as vscode from 'vscode';
import * as ibmi from './IBMi';
import * as op from './opcodes';


type OpcodeEnhancement = {
  opcode: string;
  factor1: string;
  factor2: string;
  result: string;
};

export function convertCSpec(lines: string[], extraDCL: string[]): string[] {
  if (!Array.isArray(lines) || lines.length === 0) return [];

  const line = lines[0].padEnd(80, ' '); // RPG fixed-format always assumes 80-char line
  const specType = ibmi.getSpecType(line);
  // vscode.window.showInformationMessage('convertCSpec called. SpecType: ' + specType);
  if (specType !== 'c') return [];

  const levelBreak = ibmi.getCol(line, 7, 8).trim();
  const indicators = ibmi.getCol(line, 9, 11).trim();
  const factor1 = ibmi.getCol(line, 12, 25).trim();
  let opcode = ibmi.getOpcode(line);
  const factor2 = ibmi.getCol(line, 36, 49).trim();
  const factor2Ext = ibmi.getCol(line, 36, 80).trim();
  const result = ibmi.getCol(line, 50, 63).trim();
  const length = ibmi.getCol(line, 64, 68).trim();
  const decimals = ibmi.getCol(line, 69, 70).trim();
  const resInd1 = ibmi.getCol(line, 71, 72).trim();
  const resInd2 = ibmi.getCol(line, 73, 74).trim();
  const resInd3 = ibmi.getCol(line, 75, 76).trim();
  let extFactor2 = ibmi.getCol(line, 36, 80).trim();

  let freeFormLine: string[] = [];

  if (ibmi.isExtOpcode(opcode)) {
    if (lines.length > 1) {
      // Extract cols 36–80 (1-based) from each line starting with index 1
      extFactor2 = lines
        .map(line => ibmi.getCol(line, 36, 80))  // reuse your getCol helper
        .join(' ')
        .trim();
    }

    // e.g., IF extFactor2
    if (opcode.toLowerCase() === "eval" || opcode.toLowerCase() === 'callp') {
      opcode = "";  // EVAL/callp is not needed in free-form
    }
    freeFormLine.push(`${opcode.toLowerCase()} ${extFactor2}`);
  } else if (!ibmi.isUnsuppotedOpcode(opcode)) {
    // Common 3-operand statement: result = factor1 opcode factor2;
    const enhValues: OpcodeEnhancement = enhanceOpcode(opcode, factor1, factor2, result, length, decimals, resInd1, resInd2, resInd3);

    let reformattedLine: string[] = [];

    ({ newLines: reformattedLine, newOpcode: enhValues.opcode } =
      convertOpcodeToFreeFormat(
        opcode,
        factor1,
        factor2,
        result,
        length,
        decimals,
        resInd1,
        resInd2,
        resInd3,
        extraDCL
      ));

    if (enhValues.opcode == '*DLT') {
      enhValues.opcode = opcode;
    }
    else {
      if (reformattedLine.length > 0) {
        freeFormLine.push(...reformattedLine);
      } else {
        const newLine = `${enhValues.opcode.toLowerCase()} ${enhValues.factor1} ${enhValues.factor2} ${enhValues.result}`;
        freeFormLine.push(newLine.trimEnd() + ';');
      }
    }
    if (extraDCL.length === 0 && length.trim() !== '') {
      const dataType = (decimals.trim() !== '') ? `packed(${length}:${decimals})` : `char(${length})`;
      extraDCL.push(` dcl-s ${result} ${dataType}; // Calc Spec work-field`);
    }
    const addlLines = handleResultingIndicators(
      enhValues.opcode,
      enhValues.factor1,
      enhValues.factor2,
      enhValues.result,
      length,
      decimals,
      resInd1,
      resInd2,
      resInd3
    );

    if (addlLines.length > 0) {
      freeFormLine.push(...addlLines);
    }
  }

  return freeFormLine;
}


export function enhanceOpcode(
  opcode: string,
  factor1: string,
  factor2: string,
  result: string,
  length: string, decimals: string,
  resInd1: string,
  resInd2: string,
  resInd3: string
): OpcodeEnhancement {
  // Match opcode and optional extenders with optional whitespace
  const opcodeMatch = opcode.match(/^([A-Z\-]+)(\(\s*([A-Z\s]+)\s*\))?$/i);
  let baseOpcode = "";
  let extenders: string[] = [];

  if (opcodeMatch) {
    baseOpcode = opcodeMatch[1].toUpperCase();
    const existingExt = opcodeMatch[3];
    if (existingExt) {
      // Normalize: remove whitespace and convert to uppercase letters
      extenders = existingExt.replace(/\s+/g, "").toUpperCase().split("");
    }
  } else {
    baseOpcode = opcode.toUpperCase();
  }

  // Add required extenders based on opcode and resIndx
  switch (baseOpcode) {
    case "CHAIN":
      if (resInd2 && !extenders.includes("E")) {
        extenders.push("E");
      }
      break;
    case "COMMIT":
      if (resInd2 && !extenders.includes("E")) {
        extenders.push("E");
      }
      break;

    // Add more cases as needed
    default:
      break;
  }

  // Remove duplicates and reassemble extenders
  const uniqueExtenders = [...new Set(extenders)];
  const newOpcode =
    uniqueExtenders.length > 0
      ? `${baseOpcode}(${uniqueExtenders.join(" ")})`
      : baseOpcode;

  return {
    opcode: newOpcode,
    factor1,
    factor2,
    result,
  };
}

function convertOpcodeToFreeFormat(
  opcode: string,
  factor1: string,
  factor2: string,
  result: string,
  length: string, decimals: string,
  resInd1: string,
  resInd2: string,
  resInd3: string,
  extraDCL: string[]
): { newLines: string[], newOpcode: string } {


  // First try the conditional opcode logic
  const condLines = convertConditionalOpcode(opcode, factor1, factor2);
  if (condLines.length > 0) return { newLines: condLines, newOpcode: opcode };
  const fullOpcode = opcode.toUpperCase();

  const newLines: string[] = [];
  let freeFormat = '';
  let newOpcode = '';

  let extenders: string[] = [];
  const opcodeMatch = opcode.match(/^([A-Z\-]+)(\(\s*([A-Z\s]+)\s*\))?$/i);
  if (opcodeMatch) {
    newOpcode = opcodeMatch[1].toUpperCase();
    const existingExt = opcodeMatch[3];
    if (existingExt) {
      // Normalize: remove whitespace and convert to uppercase letters
      extenders = existingExt.replace(/\s+/g, "").toUpperCase().split("");
    }
  } else {
    newOpcode = opcode.toUpperCase();
  }
  newOpcode =
    extenders.length > 0
      ? `${newOpcode}(${extenders.join(" ")})`
      : newOpcode;
  const opCode = opcode.toUpperCase().replace(/\(.*\)$/, "");
  // newOpcode = opCode;

  let lValue = '';
  let kwd = '';
  let bif = '';
  switch (opCode.toUpperCase()) {
    case 'COMP':   // Skippable non-opcode in free format (indy manipulations only)
    case 'SETON':
    case 'SETOFF':
      newOpcode = '*DLT';
    case "Z-ADD":
      newLines.push(`${result} = ${factor2}`);
      break;
    case "Z-SUB":
      newLines.push(`${result} = 0`);
      newLines.push(`${result} -= ${factor2}`);
      break;
    case "END":
      freeFormat = `${opCode}xx; // "END" opcode deprecated. Use ENDxx (e.g., ENDIF, ENDDO, etc.)`;
      break;
    case 'SUBST':
      newLines.push(...op.convertSUBST(fullOpcode, factor1, factor2, result, extraDCL));
      newOpcode = '';
      break;
    case 'CHECK':
      newLines.push(...op.convertCHECK(fullOpcode, factor1, factor2, result, extraDCL));
      newOpcode = '';
      break;

    case 'CHECKR':
      newLines.push(...op.convertCHECK(fullOpcode, factor1, factor2, result, extraDCL));
      newOpcode = '';
      break;

    case 'CAT':
      newLines.push(...op.convertCAT(fullOpcode, factor1, factor2, result, extraDCL));
      newOpcode = '';
      break;
    case "ENDSR":
      if (factor2.trim() !== '') {
        freeFormat = `${opCode} ${factor2}; `;
      }
      else {
        freeFormat = `${opCode}; `;
      }
      if (factor1.trim() !== '') {
        // If factor1 is empty, use the result as the first operand
        freeFormat += ` // Label: ${factor1}`;
      }
      newLines.push(freeFormat);
      break;

    case "DSPLY":
      freeFormat = `${opCode} ${factor1} ${factor2} ${result}; // Consider using SND-MSG instead`;
      newLines.push(freeFormat);
      break;

    case 'EXTRCT':
    case 'EXTRACT':
      [lValue, kwd] = factor2.split(':').map(s => s.trim());
      freeFormat = `${result} = %SUBDT(${lValue} : ${ kwd });`;
      newLines.push(freeFormat);
      break;

    case "ADDDUR":
      const [value, keyword] = factor2.split(':').map(s => s.trim());
      const add_builtinFunc = keyword?.startsWith('*') ? `%${keyword.slice(1).toLowerCase()}` : `// INVALID DURATION`;
      if (factor1.trim() === '') {
        // If factor1 is empty, use the result as the first operand
        freeFormat = `${result} += ${add_builtinFunc}(${value});`;
      }
      else {
        freeFormat = `${result} = ${factor1} + ${add_builtinFunc}(${value});`;
      }
      newLines.push(freeFormat);
      break;

    case "SUBDUR":
      freeFormat = '';
      if (factor2.includes(':')) {
        // SUBDUR same as ADDDUR pattern
        const [value, keywordRaw] = factor2.split(':').map(s => s.trim());
        const keyword = keywordRaw || '';
        const builtinFunc = keyword.startsWith('*')
          ? `%${keyword.slice(1).toLowerCase()}`
          : '// INVALID or missing keyword ';
        if (factor1.trim() === '') {
          freeFormat = `${result} -= ${builtinFunc}(${value});`;
        }
        else {
          freeFormat = `${result} = ${factor1} - ${builtinFunc}(${value});`;
        }

      } else if (result.includes(':')) {
        // SUBDUR as %DIFF
        const [target, keywordRaw] = result.split(':').map(s => s.trim());
        const keyword = keywordRaw || '';
        freeFormat = `${target} = %diff(${factor1} : ${factor2} : ${keyword.toLowerCase()});`;
      } else {
        // fallback
        freeFormat = `// Unrecognized SUBDUR format `;
      }
      newLines.push(freeFormat);
      break;

    case "ALLOC":
      newLines.push(`${result} = %ALLOC(${factor2})`);
      break
    case "REALLOC":
      newLines.push(`${result} = %REALLOC(${factor2})`);
      break
    case "DEALLOC":
      newLines.push(`${opcode} ${result};`);
      break
    case "XFOOT":
      newLines.push(`${result} = %XFOOT(${factor2})`);
      break
    case 'XLATE':
      const [from1, to1] = factor1.split(':').map(s => s.trim());
      const [src2, start2] = factor2.split(':').map(s => s.trim());
      freeFormat = `${result} = %XLATE(${from1}:${to1} : ${src2} : ${start2});`;
      newLines.push(freeFormat);
      break;

    case "MOVEL":
      newLines.push(`${result} = ${factor2}`);
      break;
    case "MOVE":
      newLines.push(`EVALR ${result} = ${factor2}`);
      break;
    case 'DO':
      newLines.push(...op.convertDO(fullOpcode, factor1, factor2, result, extraDCL));
      newOpcode = '';
      break;
    case "SUB":
      if (factor1) {
        newLines.push(`${result} = ${factor1} - ${factor2}`);
      } else {
        newLines.push(`${result} -= ${factor2}`);
      }
      break;
    case "ADD":
      if (factor1) {
        newLines.push(`${result} = ${factor1} + ${factor2}`);
      } else {
        newLines.push(`${result} += ${factor2}`);
      }
      break;
    case "DEFN":
    case "DEFINE":
      let newDEFN = '';
      if (factor1.toUpperCase() === "*LIKE") {
        if (length.trim() !== '') {
          newDEFN = ` dcl-s ${result} LIKE(${factor2} : ${length})`;
        }
        else {
          newDEFN = ` dcl-s ${result} LIKE(${factor2})`;
        }
      } else if (factor1.toUpperCase() === '*DTAARA') { // Handle *DTAARA DEFN here
        newDEFN = ` dcl-ds ${result}`;
        if (length.trim() !== '') {
          if (decimals.trim() !== '') {
            newDEFN += ` ${result} packed(${length}:${decimals})`
          }
          else {
            newDEFN += ` ${result} char(${length} : ${length})`;
          }
        }
        if (!factor2) {
          newDEFN += ` DTAARA;`;
        }
        else {
          newDEFN += ` DTAARA('${factor2.toUpperCase()}');`;
        }
      }
      newDEFN +=
        extraDCL.push(newDEFN);
      newDEFN = `           // ${factor1} ${opcode} ${factor2} ${result}; // See converted DCL-xx`;
      newLines.push(newDEFN);
      break;
    case "MULT":
      if (factor1) {
        newLines.push(`${result} = ${factor1} * ${factor2}`);
      } else {
        newLines.push(`${result} *= ${factor2}`);
      }
      break;
    case "DIV":
      if (factor1) {
        newLines.push(`${result} = ${factor1} / ${factor2}`);
      } else {
        newLines.push(`${result} /= ${factor2}`);
      }
      break;
    case "COMP":
      if (resInd1) {
        newLines.push(`*IN${resInd1} = (${factor1} > ${factor2});`);
      }
      if (resInd2) {
        newLines.push(`*IN${resInd2} = (${factor1} < ${factor2});`);
      }
      if (resInd3) {
        newLines.push(`*IN${resInd3} = (${factor1} = ${factor2});`);
      }
      break;
    default:
      freeFormat = `${opCode} ${factor1} ${factor2} ${result};`;
      newLines.push(freeFormat);
      break;
      // handle unrecognized opcode
      break;
  }
  return { newLines: newLines, newOpcode: newOpcode };;
}

function handleResultingIndicators(
  opcode: string,
  factor1: string,
  factor2: string,
  result: string,
  length: string, decimals: string,
  resInd1: string,
  resInd2: string,
  resInd3: string
): string[] {
  const normalizedOpcode = opcode.toUpperCase().replace(/\(.*\)$/, "");
  const newLines: string[] = [];

  switch (normalizedOpcode) {
    case '':  // default is no Ind1, ind2=Error, ind2 = %Found()
      if (resInd3) {
        newLines.push(`*IN${resInd3} = %FOUND();`);
      }
      if (resInd2) {
        newLines.push(`*IN${resInd2} = %ERROR();`);
      }
      break;
    case 'SETON':
          if (resInd1) {
        newLines.push(`*IN${resInd1} = *ON;`);
      }
      if (resInd2) {
        newLines.push(`*IN${resInd2} = *ON;`);
      }
      if (resInd3) {
        newLines.push(`*IN${resInd3} = *ON;`);
      }
      break;
    case 'SETOF':
    case 'SETOFF':
      if (resInd1) {
        newLines.push(`*IN${resInd1} = *OFF;`);
      }
      if (resInd2) {
        newLines.push(`*IN${resInd2} = *OFF;`);
      }
      if (resInd3) {
        newLines.push(`*IN${resInd3} = *OFF;`);
      }
      break;

    case "ADD":
    case "SUB":
    case "MULLT":
    case "DIV":
    case 'XFOOT':
      if (resInd1) {
        newLines.push(`*IN${resInd1} = (${result} > 0);`);
      }
      if (resInd2) {
        newLines.push(`*IN${resInd2} = (${result} <> 0);`);
      }
      if (resInd3) {
        newLines.push(`*IN${resInd3} = (${result} = 0);`);
      }
      break;

    case "COMP":
      if (resInd1) {
        newLines.push(`*IN${resInd1} = (${factor1} > ${factor2});`);
      }
      if (resInd2) {
        newLines.push(`*IN${resInd2} = (${factor1} < ${factor2});`);
      }
      if (resInd3) {
        newLines.push(`*IN${resInd3} = (${factor1} = ${factor2});`);
      }
      break;

    case "CHAIN":
      if (resInd1) {
        newLines.push(`*IN${resInd1} = NOT %FOUND(${factor2});`);
      }
      if (resInd2) {
        newLines.push(`*IN${resInd2} = %ERROR(${factor2});`);
      }
      break;
    case "COMMIT":
      if (resInd2) {
        newLines.push(`*IN${resInd2} = %ERROR(${factor2});`);
      }
      break;

    case "READ":
    case "READE":
    case "READP":
    case "READPE":
    case "READC":
      if (resInd3) {
        newLines.push(`*IN${resInd3} = %EOF();`);
      }
      if (resInd2) {
        newLines.push(`*IN${resInd2} = %ERROR();`);
      }
      break;
    case "SETGT":
      if (resInd1) {
        newLines.push(`*IN${resInd3} = NOT %FOUND();`);
      }
      if (resInd2) {
        newLines.push(`*IN${resInd2} = %ERROR();`);
      }
      break;
    case "SETLL":
      if (resInd1) {
        newLines.push(`*IN${resInd3} = NOT %FOUND();`);
      }
      if (resInd2) {
        newLines.push(`*IN${resInd2} = %ERROR();`);
      }
      if (resInd3) {
        newLines.push(`*IN${resInd3} = %EOF();`);
      }
      break;

    case "UPDATE":
    case "DELETE":
      if (resInd2) {
        newLines.push(`*IN${resInd2} = %ERROR(${factor2});`);
      }
      break;

    case "WRITE":
      if (resInd2) {
        newLines.push(`*IN${resInd2} = %ERROR(${factor2});`);
      }
      if (resInd3) {
        newLines.push(`*IN${resInd2} = %EOF();`);
      }
      break;

    case "IF":
    case "DOW":
    case "DOU":
    case "WHEN":
      // These usually don't take indicators, but placeholders in case needed
      break;

    default:
      // Other opcodes can be added here
      if (resInd3) {
        newLines.push(`*IN${resInd3} = %FOUND();`);
      }
      if (resInd2) {
        newLines.push(`*IN${resInd2} = %ERROR();`);
      }
      break;
  }

  return newLines;
}

/**
 * Check if a given string is a valid RPG IV operation code (opcode).
 *
 * @param id - The string to test, possibly including operation extenders like "(E)".
 * @returns True if the base string is a valid opcode, false otherwise.
 */

function convertConditionalOpcode(
  opcode: string,
  factor1: string,
  factor2: string
): string[] {
  const comparisonMap: Record<string, string> = {
    EQ: "=",
    NE: "<>",
    LT: "<",
    LE: "<=",
    GT: ">",
    GE: ">="
  };

  const opCode = opcode.toUpperCase().replace(/\(.*\)$/, "");
  const condMatch = opCode.match(/^(IF|OR|AND|WHEN|DOW|DOU)(EQ|NE|LT|LE|GT|GE)$/);

  if (condMatch) {
    const keyword = condMatch[1]; // IF, OR, etc.
    const cmp = condMatch[2];     // EQ, NE, etc.
    const operator = comparisonMap[cmp];
    if (operator && factor1 && factor2) {
      return [`${keyword} ${factor1} ${operator} ${factor2}`];
    }
  }
  return [];
}
