
import * as rpgiv from './rpgedit'

export function expandCompoundRange(lines: string[], selectedIndex: number): number[] {
  const expanded: number[] = [];

  const selectedLine = lines[selectedIndex];
  const opcode = rpgiv.getOpcode(selectedLine);

  if (!rpgiv.isBooleanOpcode(selectedLine) && !rpgiv.isCASEOpcode(selectedLine)) {
    expanded.push(selectedIndex);
    return expanded;
  }

  let start = selectedIndex;
  let end = selectedIndex + 1;

  if (rpgiv.isCASEOpcode(selectedLine)) {
    // Expand upward to the first CASxx or CAS
    while (start > 0 && rpgiv.isCASEOpcode(lines[start - 1])) {
      start--;
    }

    // Expand downward until ENDCS or non-CAS opcode
    while (end < lines.length) {
      const nextLine = lines[end];
      const nextOpcode = rpgiv.getOpcode(nextLine);
      if (nextOpcode === 'ENDCS' || nextOpcode === 'END') {
        end++; // include ENDCS line
        break;
      } else if (rpgiv.isCASEOpcode(nextLine)) {
        end++;
      } else {
        break;
      }
    }
  } else {
    // Boolean expression handling (IFxx, WHENxx, etc.)
    while (start > 0) {
      const prevLine = lines[start - 1];
      if (rpgiv.isOpcodeANDxxORxx(prevLine)) {
        start--;
      } else if (rpgiv.isOpcodeIFxx(prevLine) || rpgiv.isOpcodeWHENxx(prevLine)) {
        start--;
        break;
      } else {
        break;
      }
    }

    while (end < lines.length) {
      const nextLine = lines[end];
      if (rpgiv.isOpcodeANDxxORxx(nextLine)) {
        end++;
      } else if (rpgiv.isOpcodeEnd(nextLine)) {
        end++;
        break;
      } else {
        break;
      }
    }
  }

  for (let i = start; i < end; i++) {
    expanded.push(i);
  }

  return expanded;
}

export function expandRange(lines: string[], selectedIndex: number): number[] {
  const expanded: number[] = [];

  const selectedLine = lines[selectedIndex];
  const opcode = rpgiv.getColUpper(selectedLine.padEnd(80, ' '), 26, 35);

  if (!rpgiv.isBooleanOpcode(selectedLine)) {
    expanded.push(selectedIndex);
    return expanded;
  }

  // Expand upward
  let start = selectedIndex;
  while (start > 0) {
    const prevLine = lines[start - 1];
    if (rpgiv.isOpcodeANDxxORxx(prevLine)) {
      start--;
    } else if (rpgiv.isOpcodeIFxx(prevLine) || rpgiv.isOpcodeWHENxx(prevLine)) {
      start--;
      break;
    } else {
      break;
    }
  }

  // Expand downward
  let end = selectedIndex + 1;
  while (end < lines.length) {
    const nextLine = lines[end];
    if (rpgiv.isOpcodeANDxxORxx(nextLine)) {
      end++;
    } else if (rpgiv.isOpcodeEnd(nextLine)) {
      end++;
      break;
    } else {
      break;
    }
  }

  for (let i = start; i < end; i++) {
    expanded.push(i);
  }

  return expanded;
}
