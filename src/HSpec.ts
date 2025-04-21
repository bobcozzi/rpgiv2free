
export function convertHSpec(lines: string[]): string[] {
    if (!Array.isArray(lines) || lines.length === 0) return [];

    const fullLine = lines.map(l => l.substring(6)).join('').trim(); // skip columns 1–6 (spec ID and optional *)

    if (!fullLine) return [];

    return [`ctl-opt ${fullLine};`];
}
