
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
    const specType = line[5];
    vscode.window.showInformationMessage('convertCSpec called. SpecType: ' + specType);
    if (specType !== 'C') return [];

    const levelBreak = ibmi.getCol(line,7, 8).trim();
    const indicators = ibmi.getCol(line,9, 11).trim();
    const factor1 = ibmi.getCol(line,12, 25).trim();
    let   opcode = ibmi.getColUpper(line,26, 35);
    const factor2 = ibmi.getCol(line,36, 49).trim();
    const factor2Ext = ibmi.getCol(line,36, 80).trim();
    const result = ibmi.getCol(line,50, 63).trim();
    const length = ibmi.getCol(line,64, 68).trim();
    const decimals = ibmi.getCol(line,69, 70).trim();
    const resInd1 = ibmi.getCol(line,71, 72).trim();
    const resInd2 = ibmi.getCol(line,73, 74).trim();
    const resInd3 = ibmi.getCol(line,75, 76).trim();
    let extFactor2 = ibmi.getCol(line, 36, 80).trim();



    // If 7–35 are blank, treat as a keyword line
    const preOpcode = ibmi.getCol(line,7, 35).trim();
    if (preOpcode === '') {
        return [ibmi.getCol(line,35).trim()];
    }

    let freeFormLine: string[] = [];

    if (isExtOpcode(opcode)) {
      if (lines.length > 1) {
        // Extract cols 36–80 (1-based) from each line starting with index 1
        extFactor2 = lines
          .map(line => ibmi.getCol(line, 36, 80))  // reuse your getCol helper
          .join(' ')
          .trim();
      }

      // e.g., IF extFactor2
      if (opcode.toLowerCase() === "eval") {
        opcode = "";  // EVAL is not needed in free-form
      }
      freeFormLine.push(`${opcode.toLowerCase()} ${extFactor2}`);
    } else {
        // Common 3-operand statement: result = factor1 opcode factor2;
        const enhValues: OpcodeEnhancement = enhanceOpcode(opcode, factor1, factor2, result, length, decimals, resInd1, resInd2, resInd3);
        const reformattedLine = reformatOpcode(
          opcode,
          factor1,
          factor2,
          result,
          length,
          decimals,
          resInd1,
          resInd2,
          resInd3
        );

      if (reformattedLine.length > 0) {
        freeFormLine.push(...reformattedLine);
      } else {
        freeFormLine.push(`${enhValues.opcode.toLowerCase()} ${enhValues.factor1} ${enhValues.factor2} ${enhValues.result};`);
      }
      if (length.trim() !== '') {
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
  resInd3: string
): string[] {

  const opCode = opcode.toUpperCase().replace(/\(.*\)$/, "");
  const newLines: string[] = [];

  switch (opCode.toUpperCase()) {
    case "Z-ADD":
      newLines.push(`${result} = ${factor2}`);
      break;
    case "Z-SUB":
        newLines.push(`${result} = 0`);
        newLines.push(`${result} -= ${factor2}`);
        break;
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
      case "CHAIN":
        if (resInd1) {
          newLines.push(`*IN${resInd1} = NOT %FOUND(${factor2});`);
        }
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
export function isValidOpcode(id: string): boolean {
    // List of valid opcodes (operation extenders not included)
    const rpgOpcodes = new Set([
      "ACQ", "BEGSR", "CALLP", "CHAIN", "CLEAR", "CLOSE", "COMMIT",
      "DATA-GEN", "DATA-INTO", "DEALLOC", "DELETE", "DOU", "DOW",
      "DSPLY", "DUMP", "ELSE", "ELSEIF", "ENDDO", "ENDFOR", "ENDIF",
      "ENDMON", "ENDSL", "ENDSR", "EVAL", "EVALR", "EVAL-CORR", "EXCEPT",
      "EXFMT", "EXSR", "FEOD", "FOR", "FOR-EACH", "FORCE", "IF", "IN",
      "ITER", "LEAVE", "LEAVESR", "MONITOR", "NEXT", "ON-ERROR", "ON-EXIT",
      "OPEN", "OTHER", "OUT", "POST", "READ", "READC", "READE", "READP",
      "READPE", "REL", "RESET", "RETURN", "ROLBK", "SELECT", "SETGT",
      "SETLL", "SORTA", "TEST", "UNLOCK", "UPDATE", "WHEN", "WRITE",
      "XML-INTO", "XML-SAX"
    ]);

    // Strip off operation extenders like "(EHMR)" from the ID
    const baseOpcode = id.replace(/\([A-Z]+\)$/i, "").toUpperCase();

    return rpgOpcodes.has(baseOpcode);
}
    // Is an OpCode that supports the Extended Factor 2 syntax?
    export function isExtOpcode(opcode: string): boolean {
        const extOpcodes = new Set([
          "CALLP",
          "CLEAR",
          "DATA-INTO",
          "DOU",
          "DOW",
          "EVAL",
          "EVALR",
          "EVAL-CORR",
          "FOR",
          "FOR-EACH",
          "IF",
          "ELSEIF",
          "WHEN",
          "MONITOR",
          "ON-ERROR",
          "RETURN",
          "ROLBK",
          "SORTA",
          "TEST",
          "XML-INTO",
          "XML-SAX"
        ]);
        const normalized = opcode.toUpperCase().replace(/\(.*\)$/, ""); // strip off Operation Extender (if any)
        return extOpcodes.has(opcode.toUpperCase());
}
