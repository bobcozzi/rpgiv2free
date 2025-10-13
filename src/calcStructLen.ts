
/**
 * Minimal symbol types used for struct size calculation.
 * These mirror the common shape produced by the RPGLE language server cache.
 */
export interface KeywordMap {
  [key: string]: string | number | undefined;
}

export interface RPGSymbolSubItem {
  keyword?: KeywordMap;
  subItems?: RPGSymbolSubItem[];
}

export interface RPGSymbolStruct {
  name: string;
  subItems?: RPGSymbolSubItem[];
}

export interface RPGSymbols {
  structs?: RPGSymbolStruct[];
}

/**
 * Return information for a struct by name.
 * @param symbols Symbols cache (must include a `structs` array).
 * @param structName Struct name to resolve (case-insensitive).
 * @returns `{ type: 'STRUCT', length }` if found; otherwise `null`.
 */
export function getStructTypeInfo(
  symbols: RPGSymbols,
  structName: string
): { type: 'STRUCT'; length: number } | null {
  if (!symbols || !Array.isArray(symbols.structs)) return null;
  if (!structName || structName.trim() === '') return null;

  const needle = structName.trim().toUpperCase();
  const struct = symbols.structs.find(s => s?.name && s.name.toUpperCase() === needle);
  if (!struct) return null;

  const length = calcStructByteLength(struct);
  return { type: 'STRUCT', length };
}

/**
 * Calculate the total byte length of a struct (sum of its subItems).
 * @param struct Struct definition with subItems.
 */
export function calcStructByteLength(struct: RPGSymbolStruct): number {
  if (!Array.isArray(struct?.subItems)) return 0;
  return safeSum(struct.subItems.map(si => calcSubItemByteLength(si)));
}

/**
 * Calculate the byte length of a single subItem (recursively for nested structs).
 * Supports: CHAR, VARCHAR, GRAPH, VARGRAPH, UCS2, VARUCS2, PACKED, ZONED, IND, INT, UNS,
 * DATE/TIME/TIMESTAMP (as character sizes), and nested subItems.
 * @param subItem The subItem to measure.
 */
export function calcSubItemByteLength(subItem: RPGSymbolSubItem): number {
  return calcSubItemByteLengthImpl(subItem);
}

/* ------------------------- Internal helpers below ------------------------- */

function calcSubItemByteLengthImpl(subItem: RPGSymbolSubItem): number {
  const meta = subItem?.keyword || {};

  // VARCHAR / CHAR
  {
    const { len: vLen, prefix: vPfx } = parseLenAndPrefix(getKeyword(meta, 'VARCHAR'));
    if (vLen !== undefined) {
      const pfxBytes = resolveVaryingPrefix(vLen, vPfx, getKeyword(meta, 'VARYING'));
      return vLen + pfxBytes;
    }
    const charLen = toNum(getKeyword(meta, 'CHAR'));
    if (charLen !== undefined) {
      return charLen;
    }
  }

  // VARGRAPH / GRAPH (2 bytes per char)
  {
    const { len: vgLen, prefix: vgPfx } = parseLenAndPrefix(getKeyword(meta, 'VARGRAPH'));
    if (vgLen !== undefined) {
      const pfxBytes = resolveVaryingPrefix(vgLen, vgPfx, getKeyword(meta, 'VARYING'));
      return vgLen * 2 + pfxBytes;
    }
    const graphLen = toNum(getKeyword(meta, 'GRAPH'));
    if (graphLen !== undefined) {
      return graphLen * 2;
    }
  }

  // VARUCS2 / UCS2 (2 bytes per char)
  {
    const { len: vuLen, prefix: vuPfx } = parseLenAndPrefix(getKeyword(meta, 'VARUCS2'));
    if (vuLen !== undefined) {
      const pfxBytes = resolveVaryingPrefix(vuLen, vuPfx, getKeyword(meta, 'VARYING'));
      return vuLen * 2 + pfxBytes;
    }
    const ucs2Len = toNum(getKeyword(meta, 'UCS2'));
    if (ucs2Len !== undefined) {
      return ucs2Len * 2;
    }
  }

  // PACKED: ceil((precision + 1) / 2) bytes
  {
    const packed = getKeyword(meta, 'PACKED');
    const precision = firstNum(packed);
    if (precision !== undefined) {
      return Math.floor((precision + 2) / 2);
    }
  }

  // ZONED: precision bytes
  {
    const zoned = getKeyword(meta, 'ZONED');
    const precision = firstNum(zoned);
    if (precision !== undefined) {
      return precision;
    }
  }

  // IND: 1 byte
  if (getKeyword(meta, 'IND') !== undefined) {
    return 1;
  }

  // INT / UNS: map digits to byte width (3→1, 5→2, 10→4, 20→8)
  {
    const digits = toNum(getKeyword(meta, 'INT', 'UNS'));
    if (digits !== undefined) {
      const bytes = intBytes(digits);
      if (bytes !== undefined) return bytes;
    }
  }

  // DATE/TIME/TIMESTAMP (approximate character widths, honoring DATFMT when provided)
  if (getKeyword(meta, 'DATE') !== undefined) {
    const datfmt = String(getKeyword(meta, 'DATFMT') || '').toUpperCase();
    let base = 10, sepCount = 2;
    if (startsWithAny(datfmt, '*MDY', '*YMD', '*DMY')) {
      base = 8; sepCount = 2;
    } else if (datfmt.startsWith('*JUL')) {
      base = 6; sepCount = 1;
    } else if (startsWithAny(datfmt, '*LONGJUL', '*JOBRUN')) {
      base = 8; sepCount = 1;
    }
    if (datfmt.endsWith('0')) base -= sepCount;
    return base;
  }
  if (getKeyword(meta, 'TIME') !== undefined) return 8;
  if (getKeyword(meta, 'TIMESTAMP') !== undefined) return 26;

  // Nested structs: sum children
  if (Array.isArray(subItem?.subItems) && subItem.subItems.length > 0) {
    return safeSum(subItem.subItems.map(child => calcSubItemByteLengthImpl(child)));
  }

  // Unknown/untyped -> 0 bytes
  return 0;
}

function getKeyword(meta: KeywordMap, ...keys: string[]): unknown {
  if (!meta || typeof meta !== 'object') return undefined;
  // Try exact match first
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(meta, k)) return meta[k];
  }
  // Fallback: case-insensitive lookup
  const upper = Object.keys(meta).reduce<Record<string, string>>((m, k) => {
    m[k.toUpperCase()] = k;
    return m;
  }, {});
  for (const k of keys) {
    const actual = upper[k.toUpperCase()];
    if (actual) return meta[actual];
  }
  return undefined;
}

/**
 * Parse a "LEN[:PREFIX]" shape from keyword values like "10:4".
 */
function parseLenAndPrefix(val: unknown): { len?: number; prefix?: number } {
  if (typeof val === 'number') return { len: val, prefix: undefined };
  if (typeof val !== 'string') return {};
  const [lenStr, pfxStr] = val.split(':', 2);
  const len = toNum(lenStr);
  const pfxRaw = toNum(pfxStr);
  const prefix = pfxRaw === 2 || pfxRaw === 4 ? pfxRaw : undefined;
  return { len, prefix };
}

/**
 * Resolve 2- or 4-byte varying prefix per IBM spec:
 * - If a second parameter (2/4) is specified on the type keyword, use it.
 * - Else if VARYING(2|4) is specified, use it.
 * - Else default to 2 bytes if length is 1..65535; otherwise 4 bytes.
 */
function resolveVaryingPrefix(
  declaredLen?: number,
  explicitPrefix?: number,
  varyingParam?: unknown
): number {
  if (explicitPrefix === 2 || explicitPrefix === 4) return explicitPrefix;
  const v = toNum(varyingParam);
  if (v === 2 || v === 4) return v;
  if (declaredLen !== undefined) {
    return declaredLen >= 1 && declaredLen <= 65535 ? 2 : 4;
  }
  return 2;
}

/** Map RPG INT/UNS digit counts to storage bytes. */
function intBytes(digits: number): number | undefined {
  switch (digits) {
    case 3: return 1;  // 8-bit
    case 5: return 2;  // 16-bit
    case 10: return 4; // 32-bit
    case 20: return 8; // 64-bit
    default: return undefined;
  }
}

function firstNum(val: unknown): number | undefined {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string') {
    const [a] = val.split(':', 1);
    const n = Number(a);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function toNum(val: unknown): number | undefined {
  const n = Number(val);
  return Number.isFinite(n) ? n : undefined;
}

function safeSum(nums: number[]): number {
  let total = 0;
  for (const n of nums) {
    total += Number.isFinite(n) ? n : 0;
  }
  return total;
}

function startsWithAny(s: string, ...prefixes: string[]): boolean {
  return prefixes.some(p => s.startsWith(p));
}