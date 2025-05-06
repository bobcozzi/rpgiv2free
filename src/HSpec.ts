
export function convertHSpec(lines: string[]): string[] {
  if (!Array.isArray(lines) || lines.length === 0) return [];

  const ctlOpts = lines
    .map(line => {
      // Ignore comments: column 7 is at index 6
      if (line.length >= 7 && line[6] === '*') return null;
      // Get columns 7–80 (index 6 to 80)
      return line.length > 6 ? line.substring(6, 80).trim() : null;
    })
    .filter(part => part); // remove nulls and empty lines

  if (ctlOpts.length === 0) return [];

  return [`ctl-opt ${ctlOpts.join(' ')};`];
}