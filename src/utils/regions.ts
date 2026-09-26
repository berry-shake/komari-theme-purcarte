import regionNames from "../assets/world-regions.json" with { type: "json" };

export function normalizeRegion(value: string): string | null {
  let code = value.trim().toUpperCase();
  const points = Array.from(code);
  if (points.length === 2 && points.every(p => {
    const cp = p.codePointAt(0)!;
    return cp >= 0x1f1e6 && cp <= 0x1f1ff;
  })) {
    code = points.map(p => String.fromCharCode(p.codePointAt(0)! - 0x1f1e6 + 65)).join("");
  }
  if (code === "UK") code = "GB";
  if (["CN-HK", "CN-MO", "CN-TW"].includes(code)) code = code.slice(3);
  return Object.hasOwn(regionNames, code) ? code : null;
}

export const regionName = (code: string) => regionNames[code as keyof typeof regionNames] || code;
export const regionFlag = (code: string) => Array.from(code).map(c => String.fromCodePoint(c.charCodeAt(0) + 0x1f1e6 - 65)).join("");

export interface RegionSummary { code: string; total: number; online: number }

export function summarizeRegions(nodes: { region: string; stats?: { online?: boolean } }[]): RegionSummary[] {
  const regions = new Map<string, RegionSummary>();
  for (const node of nodes) {
    const code = normalizeRegion(node.region || "");
    if (!code) continue;
    const summary = regions.get(code) ?? { code, total: 0, online: 0 };
    summary.total++;
    if (node.stats?.online) summary.online++;
    regions.set(code, summary);
  }
  const priority: Record<string, number> = { CN: 0, HK: 1, MO: 2, TW: 3 };
  return [...regions.values()].sort((a, b) =>
    (priority[a.code] ?? 4) - (priority[b.code] ?? 4) || b.total - a.total || a.code.localeCompare(b.code)
  );
}
