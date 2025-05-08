
import * as vscode from 'vscode';
import * as ibmi from './IBMi';

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
  let opcode = ibmi.getColUpper(line, 26, 35);
  const factor2 = ibmi.getCol(line, 36, 49).trim();
  const factor2Ext = ibmi.getCol(line, 36, 80).trim();
  const result = ibmi.getCol(line, 50, 63).trim();
  const length = ibmi.getCol(line, 64, 68).trim();
  const decimals = ibmi.getCol(line, 69, 70).trim();
  const resInd1 = ibmi.getCol(line, 71, 72).trim();
  const resInd2 = ibmi.getCol(line, 73, 74).trim();
  const resInd3 = ibmi.getCol(line, 75, 76).trim();
  let extFactor2 = ibmi.getCol(line, 36, 80).trim();



  // If 7–35 are blank, treat as a keyword line
  const preOpcode = ibmi.getCol(line, 7, 35).trim();
  if (preOpcode === '') {
    return [ibmi.getCol(line, 35).trim()];
  }

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
  } else {
    // Common 3-operand statement: result = factor1 opcode factor2;
    const enhValues: OpcodeEnhancement = enhanceOpcode(opcode, factor1, factor2, result, length, decimals, resInd1, resInd2, resInd3);
    let reformattedLine: string[] = [];
    if (opcode === 'CAT') {
      reformattedLine = convertCAT(opcode, factor1, factor2, result, extraDCL);
    }
    else {
      reformattedLine = reformatOpcode(
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
      );
    }
    if (reformattedLine.length > 0) {
      freeFormLine.push(...reformattedLine);
    } else {
      freeFormLine.push(`${enhValues.opcode.toLowerCase()} ${enhValues.factor1} ${enhValues.factor2} ${enhValues.result};`);
    }
    if (extraDCL.length === 0 && length.trim() !== '') {
      const dataType = (decimals.trim() !== '') ? `packed(${length}:${decimals})` : `char(${length})`;
      extraDCL.push(` dcl-s ${result} ${dataType}; // Calc Spec work field`);
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
      ? `${baseOpcode}(${uniqueExtenders.join("")})`
      : baseOpcode;

  return {
    opcode: newOpcode,
    factor1,
    factor2,
    result,
  };
}

function reformatOpcode(
  opcode: string,
  factor1: string,
  factor2: string,
  result: string,
  length: string, decimals: string,
  resInd1: string,
  resInd2: string,
  resInd3: string,
  extraDCL: string[]
): string[] {


  // First try the conditional opcode logic
  const condLines = convertConditionalOpcode(opcode, factor1, factor2);
  if (condLines.length > 0) return condLines;

  const opCode = opcode.toUpperCase().replace(/\(.*\)$/, "");
  const newLines: string[] = [];
  let freeFormat = '';
  const caseMatch = opCode.match(/^(CAS)(EQ|NE|LT|LE|GT|GE)$/);

  switch (opCode.toUpperCase()) {
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
          : '/* INVALID or missing keyword */';
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
        freeFormat = `/* Unrecognized SUBDUR format */`;
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

    case "MOVEL":
      newLines.push(`${result} = ${factor2}`);
      break;
    case "MOVE":
      newLines.push(`EVALR ${result} = ${factor2}`);
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
        if (length.trim() !== '') {
          if (decimals.trim() !== '') {
            newDEFN = ` dcl-ds ${result} packed(${length}:${decimals})`
          }
          else {
            newDEFN = ` dcl-ds ${result} char(${length} : ${length})`;
          }
        }
        else {
          newDEFN = ` dcl-ds ${result}`;
        }
        if (!factor2) {
          newDEFN += `DTAARA;`;
        }
        else {
          newDEFN += `DTAARA('${factor2.toUpperCase()}');`;
        }
      }
      newDEFN +=
        extraDCL.push(newDEFN);
      newDEFN = `          // ${factor1} ${opcode} ${factor2} ${result}; // See converted DCL-xx`;
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
      // handle unrecognized opcode
      break;
  }
  return newLines;
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
    case "ADD":
    case "SUB":
    case "MULLT":
    case "DIV":
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
      if (resInd1) {
        newLines.push(`*IN${resInd1} = NOT %FOUND(${factor2});`);
      }
      if (resInd2) {
        newLines.push(`*IN${resInd2} = %ERROR(${factor2});`);
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
      break;

    case "CALLP":
      if (resInd1) {
        newLines.push(`*IN${resInd1} = %SUCCESS(${factor2 || result});`);
      }
      if (resInd2) {
        newLines.push(`*IN${resInd2} = %ERROR(${factor2 || result});`);
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
function convertCAT(
  opcode: string,
  factor1: string,
  factor2: string,
  result: string,
  extraDCL: string[]
): string[] {
  const lines: string[] = [];

  // === Extract Extender (e.g., from CAT(P)) ===
  const extenderMatch = opcode.match(/\(([^)]+)\)/);
  const extender = extenderMatch ? extenderMatch[1].toUpperCase() : '';
  const hasP = extender.includes('P');

  let exprParts: string[] = [];

  // === Rule 1: If no Factor 1, use result field ===
  const f1 = factor1.trim() ? `%TRIMR(${factor1.trim()})` : `%TRIMR(${result.trim()})`;
  exprParts.push(f1);

  // === Rule 2 + 3: Parse Factor 2 ===
  let f2Expr = '';
  if (factor2.includes(':')) {
    const [leftRaw, rightRaw] = factor2.split(':');
    const left = leftRaw.trim();
    const right = rightRaw.trim();
    const blanks = `'${' '.repeat(Number(right))}'`;
    f2Expr = `${blanks} + ${left}`;
  } else {
    f2Expr = factor2.trim();
  }

  exprParts.push(f2Expr);

  const fullExpr = exprParts.join(' + ');

  if (hasP) {
    // Rule: If extender (P), assign directly
    lines.push(`${result} = ${fullExpr};`);
  } else {
    // Rule: If no extender (P), wrap in %SUBST
    const lenVar = `${result}_LEN_FF`;
    lines.push(`${lenVar} = %LEN(${fullExpr});  // Generated workfield ${lenVar} from CAT opcode`);
    lines.push(`${result} = %SUBST(${result} : 1 : ${lenVar}) = ${fullExpr};`);
    extraDCL.push(`DCL-S ${lenVar} INT(10);`);
  }

  return lines;
}