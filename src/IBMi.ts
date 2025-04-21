


// Extracts the specified columns data from the line input string.
  // const opcode = getcol(line, 25, 35).trim().toUpperCase();

  export function getCol(line: string | null | undefined, from: number, to: number): string {
    if (!line || from < 1) return '';
    const end = to ?? from; // default 'to' to 'from' if not provided
    if (end < from) return '';
    return line.substring(from - 1, end).trim();
  }
  export function getColUpper(line: string | null | undefined, from: number, to?: number): string {
    if (!line || from < 1) return '';
    const end = to ?? from; // default 'to' to 'from' if not provided
    if (end < from) return '';
    return line.substring(from - 1, end).trim().toUpperCase();
  }
  export function getColLower(line: string | null | undefined, from: number, to?: number): string {
    if (!line || from < 1) return '';
    const end = to ?? from; // default 'to' to 'from' if not provided
    if (end < from) return '';
    return line.substring(from - 1, end).trim().toLowerCase();
  }

  export function getSpecType(line: string): string {
    return line.length >= 6 ? line[5].toLowerCase() : '';
}
export function getDclType(line: string): string {
  return getColUpper(line, 24, 25);
}