
import * as rpgiv from './rpgedit'

export function expandCompoundRange(lines: string[], selectedIndex: number): number[] {
  const expanded: number[] = [];

  const selectedLine = lines[selectedIndex];
  const lineCount = lines.length;
  const opcode = rpgiv.getRawOpcode(selectedLine);

  if (!rpgiv.isBooleanOpcode(selectedLine) && !rpgiv.isCASEOpcode(selectedLine)) {
    expanded.push(selectedIndex);
    return expanded;
  }
  let bIsSelect = false;
  let bIsWhen = false;

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
      const nextOpcode = rpgiv.getRawOpcode(nextLine);
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
    // read backwards to find the IFxx or SELECT/WHENxx block starting statement
    while (start > 0) {
      const prevLine = lines[start - 1];
      if (rpgiv.isOpcodeANDxxORxx(prevLine)) { // boolean continuator/conjunction opcode?
        start--;
      } else if (rpgiv.isOpcodeIFxx(prevLine)) {
        start--;  // IFxx opcode?
        break;
      }
      else if (rpgiv.isOpcodeWHENxx(prevLine)) {
        bIsWhen = true;
        start--;  // IFxx or WHENxx opcode?
        if (!bIsSelect) break;
      }
      else if (rpgiv.isOpcodeSELECT(prevLine)) {
        bIsSelect = true;  // fixed-format SELECT opcode?
        start--;
        break;
      }
      break;
    }
    end = start + 1;

    while (end < lines.length) {
      const nextLine = lines[end];
      if (!(rpgiv.isOpcodeANDxxORxx(nextLine) ||
        ((bIsSelect || bIsWhen) && rpgiv.isOpcodeWHENxx(nextLine)))) {
        break;
      }
      end++;
    }

  }

  for (let i = start; i < end; i++) {
    const line = lines[i];
    if (rpgiv.isNotSkipStmt(line) && line.trim() !== '') {
      expanded.push(i);
    }
  }

  return expanded;
}
