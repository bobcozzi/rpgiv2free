
import * as ibmi from './IBMi.js';

export function expandCompoundRange(lines: string[], selectedIndex: number): number[] {
  const expanded: number[] = [];

  const selectedLine = lines[selectedIndex];
  const opcode = ibmi.getOpcode(selectedLine);

  if (!ibmi.isBooleanOpcode(selectedLine) && !ibmi.isCASEOpcode(selectedLine)) {
    expanded.push(selectedIndex);
    return expanded;
  }

  let start = selectedIndex;
  let end = selectedIndex + 1;

  if (ibmi.isCASEOpcode(selectedLine)) {
    // Expand upward to the first CASxx or CAS
    while (start > 0 && ibmi.isCASEOpcode(lines[start - 1])) {
      start--;
    }

    // Expand downward until ENDCS or non-CAS opcode
    while (end < lines. length) {
      const nextLine = lines[end];
      const nextOpcode = ibmi.getOpcode(nextLine);
      if (nextOpcode === 'ENDCS') {
        end++; // include ENDCS line
        break;
      } else if (ibmi.isCASEOpcode(nextLine)) {
        end++;
      } else {
        break;
      }
    }
  } else {
    // Boolean expression handling (IFxx, WHENxx, etc.)
    while (start > 0) {
      const prevLine = lines[start - 1];
      if (ibmi.isOpcodeANDxxORxx(prevLine)) {
        start--;
      } else if (ibmi.isOpcodeIFxx(prevLine) || ibmi.isOpcodeWHENxx(prevLine)) {
        start--;
        break;
      } else {
        break;
      }
    }

    while (end < lines.length) {
      const nextLine = lines[end];
      if (ibmi.isOpcodeANDxxORxx(nextLine)) {
        end++;
      } else if (ibmi.isOpcodeEnd(nextLine)) {
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
  const opcode = ibmi.getColUpper(selectedLine.padEnd(80, ' '), 26, 35);

  if (!ibmi.isBooleanOpcode(selectedLine)) {
    expanded.push(selectedIndex);
    return expanded;
  }

  // Expand upward
  let start = selectedIndex;
  while (start > 0) {
    const prevLine = lines[start - 1];
    if (ibmi.isOpcodeANDxxORxx(prevLine)) {
      start--;
    } else if (ibmi.isOpcodeIFxx(prevLine) || ibmi.isOpcodeWHENxx(prevLine)) {
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
    if (ibmi.isOpcodeANDxxORxx(nextLine)) {
      end++;
    } else if (ibmi.isOpcodeEnd(nextLine)) {
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
