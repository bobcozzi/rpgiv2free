import { getColUpper } from '../rpgedit';

/** A single named token range within a source line (1-based columns). */
export interface TokenRange {
  start: number;   // 1-based start column (inclusive)
  end: number;     // 1-based end column (inclusive)
  tokenType: string;
}

/**
 * Per-variant field maps.
 * Columns are 1-based, matching RPG IV column numbering.
 * Column 6 (spec type) is always tokenized as 'specType'.
 */
const VARIANT_FIELDS: Record<string, TokenRange[]> = {

  // ── H – Control Spec ─────────────────────────────────────────────────────
  H: [
    { start: 6, end: 6, tokenType: 'specType' },
    { start: 7, end: 80, tokenType: 'keyword' },
  ],

  // ── F – File Description ─────────────────────────────────────────────────
  F: [
    { start: 6,  end: 6,  tokenType: 'specType' },
    { start: 7,  end: 16, tokenType: 'fieldName' },   // File name
    { start: 17, end: 17, tokenType: 'indicator' },   // File type (I/O/U/C)
    { start: 18, end: 18, tokenType: 'indicator' },   // File designation
    { start: 19, end: 19, tokenType: 'indicator' },   // End of file
    { start: 20, end: 20, tokenType: 'indicator' },   // File addition
    { start: 21, end: 21, tokenType: 'indicator' },   // Sequence
    { start: 22, end: 22, tokenType: 'dataType' },    // File format (F/E)
    { start: 23, end: 27, tokenType: 'positions' },   // Record length
    { start: 28, end: 28, tokenType: 'dataType' },    // Limits processing
    { start: 29, end: 33, tokenType: 'positions' },   // Length of key / record address
    { start: 34, end: 35, tokenType: 'dataType' },    // Record address type
    { start: 36, end: 42, tokenType: 'dataType' },    // Device type
    { start: 44, end: 80, tokenType: 'keyword' },     // Keywords
  ],

  // ── D – Definition Spec (base; subtype overrides applied at runtime) ──────
  D: [
    { start: 6,  end: 6,  tokenType: 'specType' },
    { start: 7,  end: 21, tokenType: 'fieldName' },   // Name
    { start: 22, end: 22, tokenType: 'indicator' },   // Ext type (*EXT flag)
    { start: 23, end: 23, tokenType: 'indicator' },   // DS type
    { start: 24, end: 25, tokenType: 'dataType' },    // DCL type (DS/S/C/PR/PI)
    { start: 26, end: 32, tokenType: 'positions' },   // From position
    { start: 33, end: 39, tokenType: 'positions' },   // To pos / length
    { start: 40, end: 40, tokenType: 'dataType' },    // Data type
    { start: 41, end: 42, tokenType: 'positions' },   // Decimal positions
    { start: 44, end: 80, tokenType: 'keyword' },     // Keywords
  ],

  // D subtype: DS header (DS in cols 24-25, name in 7-21)
  'D:DS': [
    { start: 6,  end: 6,  tokenType: 'specType' },
    { start: 7,  end: 21, tokenType: 'fieldName' },
    { start: 22, end: 22, tokenType: 'indicator' },
    { start: 23, end: 23, tokenType: 'indicator' },
    { start: 24, end: 25, tokenType: 'dataType' },
    { start: 26, end: 39, tokenType: 'positions' },
    { start: 44, end: 80, tokenType: 'keyword' },
  ],

  // D subtype: subfield (blank in cols 24-25 inside a DS)
  'D:subfield': [
    { start: 6,  end: 6,  tokenType: 'specType' },
    { start: 7,  end: 21, tokenType: 'fieldName' },
    { start: 26, end: 32, tokenType: 'positions' },
    { start: 33, end: 39, tokenType: 'positions' },
    { start: 40, end: 40, tokenType: 'dataType' },
    { start: 41, end: 42, tokenType: 'positions' },
    { start: 44, end: 80, tokenType: 'keyword' },
  ],

  // D subtype: Standalone (S), Named constant (C)
  'D:S': [
    { start: 6,  end: 6,  tokenType: 'specType' },
    { start: 7,  end: 21, tokenType: 'fieldName' },
    { start: 24, end: 25, tokenType: 'dataType' },
    { start: 33, end: 39, tokenType: 'positions' },
    { start: 40, end: 40, tokenType: 'dataType' },
    { start: 41, end: 42, tokenType: 'positions' },
    { start: 44, end: 80, tokenType: 'keyword' },
  ],

  // D subtype: Prototype (PR) / Procedure Interface (PI)
  'D:PR': [
    { start: 6,  end: 6,  tokenType: 'specType' },
    { start: 7,  end: 21, tokenType: 'fieldName' },
    { start: 24, end: 25, tokenType: 'dataType' },
    { start: 33, end: 39, tokenType: 'positions' },
    { start: 40, end: 40, tokenType: 'dataType' },
    { start: 41, end: 42, tokenType: 'positions' },
    { start: 44, end: 80, tokenType: 'keyword' },
  ],

  // ── C – Calculation Spec (standard) ──────────────────────────────────────
  C: [
    { start: 6,  end: 6,  tokenType: 'specType' },
    { start: 7,  end: 8,  tokenType: 'indicator' },   // Control level
    { start: 9,  end: 11, tokenType: 'indicator' },   // Conditioning indicators
    { start: 12, end: 25, tokenType: 'factor1' },
    { start: 26, end: 35, tokenType: 'opcode' },
    { start: 36, end: 49, tokenType: 'factor2' },
    { start: 50, end: 63, tokenType: 'resultField' },
    { start: 64, end: 65, tokenType: 'positions' },   // Field length
    { start: 66, end: 67, tokenType: 'positions' },   // Decimal positions
    { start: 68, end: 68, tokenType: 'indicator' },   // Hi indicator
    { start: 69, end: 70, tokenType: 'indicator' },   // Lo indicator
    { start: 71, end: 72, tokenType: 'indicator' },   // Equal indicator
  ],

  // ── CX – Extended Factor 2 ────────────────────────────────────────────────
  CX: [
    { start: 6,  end: 6,  tokenType: 'specType' },
    { start: 7,  end: 8,  tokenType: 'indicator' },
    { start: 9,  end: 11, tokenType: 'indicator' },
    { start: 26, end: 35, tokenType: 'opcode' },
    { start: 36, end: 80, tokenType: 'factor2' },
  ],

  // ── I – Input Spec: Program-Described Record Identification ─────────────────
  // .....IFilename++SqNORiPos1+NCCPos2+NCCPos3+NCC..................................Comments+++++++++++++
  I: [
    { start: 6,  end: 6,  tokenType: 'specType' },
    { start: 7,  end: 16, tokenType: 'fieldName' },   // File name
    { start: 17, end: 18, tokenType: 'positions' },   // Sequence
    { start: 19, end: 19, tokenType: 'indicator' },   // Number (1/0)
    { start: 20, end: 20, tokenType: 'indicator' },   // Option (O/blank)
    { start: 21, end: 22, tokenType: 'indicator' },   // Record identifying indicator
    { start: 23, end: 27, tokenType: 'positions' },   // Position 1
    { start: 28, end: 28, tokenType: 'indicator' },   // Not 1
    { start: 29, end: 29, tokenType: 'dataType' },    // Compare type 1 (C/Z/N/P...)
    { start: 30, end: 30, tokenType: 'constant' },    // Compare char 1
    { start: 31, end: 35, tokenType: 'positions' },   // Position 2
    { start: 36, end: 36, tokenType: 'indicator' },   // Not 2
    { start: 37, end: 37, tokenType: 'dataType' },    // Compare type 2
    { start: 38, end: 38, tokenType: 'constant' },    // Compare char 2
    { start: 39, end: 43, tokenType: 'positions' },   // Position 3
    { start: 44, end: 44, tokenType: 'indicator' },   // Not 3
    { start: 45, end: 45, tokenType: 'dataType' },    // Compare type 3
    { start: 46, end: 46, tokenType: 'constant' },    // Compare char 3
  ],

  // ── IAnd – Input Spec: AND/OR Record Continuation ────────────────────────
  // .....I.........And..RiPos1+NCCPos2+NCCPos3+NCC..................................Comments++++++++++++
  IAnd: [
    { start: 6,  end: 6,  tokenType: 'specType' },
    { start: 16, end: 18, tokenType: 'keyword' },     // AND/OR connector
    { start: 21, end: 22, tokenType: 'indicator' },   // Record identifying indicator
    { start: 23, end: 27, tokenType: 'positions' },   // Position 1
    { start: 28, end: 28, tokenType: 'indicator' },   // Not 1
    { start: 29, end: 29, tokenType: 'dataType' },    // Compare type 1
    { start: 30, end: 30, tokenType: 'constant' },    // Compare char 1
    { start: 31, end: 35, tokenType: 'positions' },   // Position 2
    { start: 36, end: 36, tokenType: 'indicator' },   // Not 2
    { start: 37, end: 37, tokenType: 'dataType' },    // Compare type 2
    { start: 38, end: 38, tokenType: 'constant' },    // Compare char 2
    { start: 39, end: 43, tokenType: 'positions' },   // Position 3
    { start: 44, end: 44, tokenType: 'indicator' },   // Not 3
    { start: 45, end: 45, tokenType: 'dataType' },    // Compare type 3
    { start: 46, end: 46, tokenType: 'constant' },    // Compare char 3
  ],

  // ── IX – Input Spec: Program-Described Field ─────────────────────────────
  // .....I........................Fmt+SPFrom+To+++DcField+++++++++L1M1FrPlMnZr......Comments++++++++++++
  IX: [
    { start: 6,  end: 6,  tokenType: 'specType' },
    { start: 31, end: 34, tokenType: 'dataType' },    // Format / data type (Fmt+)
    { start: 35, end: 36, tokenType: 'indicator' },   // Date/time separator (SP)
    { start: 37, end: 41, tokenType: 'positions' },   // From position
    { start: 42, end: 46, tokenType: 'positions' },   // To position / length
    { start: 47, end: 48, tokenType: 'positions' },   // Decimal positions
    { start: 49, end: 62, tokenType: 'fieldName' },   // Field name
    { start: 63, end: 64, tokenType: 'indicator' },   // Control level (L1)
    { start: 65, end: 66, tokenType: 'indicator' },   // Matching fields (M1)
    { start: 67, end: 68, tokenType: 'indicator' },   // Field record relation (Fr)
    { start: 69, end: 70, tokenType: 'indicator' },   // Plus indicator
    { start: 71, end: 72, tokenType: 'indicator' },   // Minus indicator
    { start: 73, end: 74, tokenType: 'indicator' },   // Zero indicator
  ],

  // ── IER – Input Spec: Externally-Described Record ────────────────────────
  // .....IRcdname+++....Ri..........................................................Comments++++++++++++
  IER: [
    { start: 6,  end: 6,  tokenType: 'specType' },
    { start: 7,  end: 16, tokenType: 'fieldName' },   // Record name
    { start: 21, end: 22, tokenType: 'indicator' },   // Record identifying indicator
  ],

  // ── IEF – Input Spec: Externally-Described Field ─────────────────────────
  // .....I..............Ext-field+..................Field+++++++++L1M1..PlMnZr......Comments++++++++++++
  IEF: [
    { start: 6,  end: 6,  tokenType: 'specType' },
    { start: 21, end: 30, tokenType: 'fieldName' },   // External field name
    { start: 49, end: 62, tokenType: 'fieldName' },   // RPG field name
    { start: 63, end: 64, tokenType: 'indicator' },   // Control level
    { start: 65, end: 66, tokenType: 'indicator' },   // Matching fields
    { start: 69, end: 70, tokenType: 'indicator' },   // Plus indicator
    { start: 71, end: 72, tokenType: 'indicator' },   // Minus indicator
    { start: 73, end: 74, tokenType: 'indicator' },   // Zero indicator
  ],

  // ── O – Output Spec: Record Identification (prog.- and ext.-described) ─────
  //  .....OFilename++DF..N01N02N03Excnam++++B++A++Sb+Sa+  (prog-described)
  //  ....ORcdname+++DAddN01N02N03Excnam++++               (ext-described)
  O: [
    { start: 6,  end: 6,  tokenType: 'specType' },
    { start: 7,  end: 16, tokenType: 'fieldName' },   // File/Record name
    { start: 17, end: 17, tokenType: 'dataType' },    // Output type (H/D/T/E)
    { start: 18, end: 18, tokenType: 'indicator' },   // Fetch overflow / Add
    { start: 21, end: 23, tokenType: 'indicator' },   // Not + indicator 1
    { start: 24, end: 26, tokenType: 'indicator' },   // Not + indicator 2
    { start: 27, end: 29, tokenType: 'indicator' },   // Not + indicator 3
    { start: 30, end: 39, tokenType: 'fieldName' },   // EXCEPT name
    { start: 40, end: 42, tokenType: 'positions' },   // Space before
    { start: 43, end: 45, tokenType: 'positions' },   // Space after
    { start: 46, end: 48, tokenType: 'positions' },   // Skip before
    { start: 49, end: 51, tokenType: 'positions' },   // Skip after
  ],

  // ── OX – Output Spec: Program-Described Field ────────────────────────────
  //  .....O..............N01N02N03Field+++++++++YB.End++PConstant/editword/DTformat++
  OX: [
    { start: 6,  end: 6,  tokenType: 'specType' },
    { start: 21, end: 23, tokenType: 'indicator' },   // Not + indicator 1
    { start: 24, end: 26, tokenType: 'indicator' },   // Not + indicator 2
    { start: 27, end: 29, tokenType: 'indicator' },   // Not + indicator 3
    { start: 30, end: 43, tokenType: 'fieldName' },   // Field name (14 chars)
    { start: 44, end: 44, tokenType: 'dataType' },    // Edit code
    { start: 45, end: 45, tokenType: 'indicator' },   // Blank after
    { start: 47, end: 51, tokenType: 'positions' },   // End position
    { start: 52, end: 52, tokenType: 'dataType' },    // Data format
    { start: 53, end: 80, tokenType: 'constant' },    // Constant / edit word / format name
  ],

  // ── OAnd – Output Spec: AND/OR Continuation ──────────────────────────────
  //  .....O.........And..N01N02N03             (prog-described, no EXCEPT name)
  //  .....O.........And..N01N02N03Excnam++++   (ext-described, with EXCEPT name)
  OAnd: [
    { start: 6,  end: 6,  tokenType: 'specType' },
    { start: 16, end: 18, tokenType: 'keyword' },     // AND/OR connector
    { start: 21, end: 23, tokenType: 'indicator' },   // Not + indicator 1
    { start: 24, end: 26, tokenType: 'indicator' },   // Not + indicator 2
    { start: 27, end: 29, tokenType: 'indicator' },   // Not + indicator 3
    { start: 30, end: 39, tokenType: 'fieldName' },   // EXCEPT name (ext-described)
  ],

  // ── OFC – Output Spec: Field Constant Continuation ───────────────────────
  //  .....O..............................................Constant/editword-Continutio
  OFC: [
    { start: 6,  end: 6,  tokenType: 'specType' },
    { start: 53, end: 80, tokenType: 'constant' },    // Constant / edit word continuation
  ],

  // ── OEF – Output Spec: Externally-Described Field ────────────────────────
  //  .....O..............N01N02N03Field+++++++++.B
  OEF: [
    { start: 6,  end: 6,  tokenType: 'specType' },
    { start: 21, end: 23, tokenType: 'indicator' },   // Not + indicator 1
    { start: 24, end: 26, tokenType: 'indicator' },   // Not + indicator 2
    { start: 27, end: 29, tokenType: 'indicator' },   // Not + indicator 3
    { start: 30, end: 43, tokenType: 'fieldName' },   // Field name
    { start: 45, end: 45, tokenType: 'indicator' },   // Blank after
  ],

  // ── P – Procedure Spec ────────────────────────────────────────────────────
  P: [
    { start: 6,  end: 6,  tokenType: 'specType' },
    { start: 7,  end: 21, tokenType: 'fieldName' },   // Procedure name
    { start: 24, end: 25, tokenType: 'indicator' },   // Begin (B) / End (E)
    { start: 44, end: 80, tokenType: 'keyword' },     // Keywords
  ],
};

/**
 * Map a D-spec line to its specific subtype variant key.
 * Returns 'D:DS', 'D:S', 'D:PR', 'D:PI', 'D:subfield', or 'D' as fallback.
 */
function getDSpecVariantKey(line: string): string {
  const dclType = getColUpper(line, 24, 25).trim().toUpperCase();
  switch (dclType) {
    case 'DS': return 'D:DS';
    case 'S':
    case 'C':  return 'D:S';
    case 'PR': return 'D:PR';
    case 'PI': return 'D:PR';  // Same column layout as PR
    case '':   return 'D:subfield';
    default:   return 'D';
  }
}

/**
 * Determine the Input spec line subtype from column content.
 *   I    – Program-described record identification (name + sequence in 7-18)
 *   IAnd – AND/OR continuation (AND/OR keyword at cols 16-18)
 *   IX   – Program-described field (cols 7-30 blank; data from col 31)
 *   IER  – Externally-described record (name in 7-16; cols 17-20 blank)
 *   IEF  – Externally-described field (ext-field name in cols 21-30)
 */
function getInputVariantKey(line: string): string {
  // AND/OR continuation: cols 7-15 blank, AND or OR keyword at cols 16-18
  if (!getColUpper(line, 7, 15).trim() &&
      ['AND', 'OR'].includes(getColUpper(line, 16, 18).trim())) {
    return 'IAnd';
  }
  // Record identification: name present in cols 7-16
  if (getColUpper(line, 7, 16).trim()) {
    // Prog-described has sequence in 17-18; ext-described has blank 17-20
    return getColUpper(line, 17, 20).trim() ? 'I' : 'IER';
  }
  // Ext-described field: external field name in cols 21-30
  if (getColUpper(line, 21, 30).trim()) return 'IEF';
  // Prog-described field: data in cols 31-74
  if (getColUpper(line, 31, 74).trim()) return 'IX';
  return 'I';
}

/**
 * Determine the Output spec line subtype.
 * Record/Control lines have the file name in cols 7-16.
 * Field description lines have col 7-16 blank and field name in cols 30-43.
 */
function getOutputVariantKey(line: string): string {
  // AND continuation: cols 7-15 blank, AND keyword at cols 16-18
  if (!getColUpper(line, 7, 15).trim() && getColUpper(line, 16, 18).trim() === 'AND') {
    return 'OAnd';
  }
  // Record identification: file/record name present in cols 7-16
  if (getColUpper(line, 7, 16).trim()) {
    return 'O';
  }
  // Field constant continuation: cols 7-52 all blank
  if (!getColUpper(line, 7, 52).trim()) {
    return 'OFC';
  }
  // Program-described field: has end position in cols 47-51
  if (getColUpper(line, 47, 51).trim()) {
    return 'OX';
  }
  // Externally-described field
  return 'OEF';
}

/**
 * Returns the list of token ranges for a given line and its resolved variant.
 * The variant is already determined by getStmtVariant() in the provider.
 * For 'D' and 'O' variants we do a further subtype lookup here.
 */
export function getTokenRangesForLine(line: string, variant: string): TokenRange[] {
  const keyUpper = variant.toUpperCase();

  if (keyUpper === 'D') {
    return VARIANT_FIELDS[getDSpecVariantKey(line)] ?? [];
  }
  if (keyUpper === 'I') {
    return VARIANT_FIELDS[getInputVariantKey(line)] ?? [];
  }
  if (keyUpper === 'O') {
    return VARIANT_FIELDS[getOutputVariantKey(line)] ?? [];
  }
  // Direct lookup — variant names are canonical (OAnd, OX, OFC, OEF, etc.)
  return VARIANT_FIELDS[variant] ?? VARIANT_FIELDS[keyUpper] ?? [];
}
