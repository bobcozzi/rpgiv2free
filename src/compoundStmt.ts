
import * as ibmi from './IBMi.js';

export function expandCompoundRange(lines: string[], selectedIndex: number): number[] {
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
