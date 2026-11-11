export const REGIONS = [
  { id: "tr-tr", label: "Türkiye" },
  { id: "us-en", label: "English" },
  { id: "de-de", label: "Deutsch" },
  { id: "fr-fr", label: "Français" },
  { id: "wt-wt", label: "Dünya" },
] as const;

export type RegionId = (typeof REGIONS)[number]["id"];

export function parseRegion(value: unknown): RegionId {
  return REGIONS.some((region) => region.id === value) ? (value as RegionId) : "tr-tr";
}

export function wikiLangs(region: RegionId): string[] {
  if (region.startsWith("tr")) return ["tr", "en"];
  if (region.startsWith("de")) return ["de", "en"];
  if (region.startsWith("fr")) return ["fr", "en"];
  if (region.startsWith("us") || region.startsWith("uk")) return ["en", "tr"];
  return ["tr", "en"];
}
