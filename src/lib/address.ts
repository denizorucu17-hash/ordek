export type Address =
  | { kind: "search"; query: string }
  | { kind: "read"; url: string; bang?: string };

function enc(value: string): string {
  return encodeURIComponent(value);
}

const BANGS: Record<string, (query: string) => string> = {
  w: (query) => `https://tr.wikipedia.org/wiki/Special:Search?search=${enc(query)}`,
  wiki: (query) => `https://tr.wikipedia.org/wiki/Special:Search?search=${enc(query)}`,
  enw: (query) => `https://en.wikipedia.org/wiki/Special:Search?search=${enc(query)}`,
  wikt: (query) => `https://tr.wiktionary.org/wiki/Special:Search?search=${enc(query)}`,
  yt: (query) => `https://www.youtube.com/results?search_query=${enc(query)}`,
  gh: (query) => `https://github.com/search?q=${enc(query)}&type=repositories`,
  so: (query) => `https://stackoverflow.com/search?q=${enc(query)}`,
  mdn: (query) => `https://developer.mozilla.org/en-US/search?q=${enc(query)}`,
  npm: (query) => `https://www.npmjs.com/search?q=${enc(query)}`,
  osm: (query) => `https://www.openstreetmap.org/search?query=${enc(query)}`,
  map: (query) => `https://www.openstreetmap.org/search?query=${enc(query)}`,
  r: (query) => `https://www.reddit.com/search/?q=${enc(query)}`,
};

export function resolveAddress(raw: string): Address | null {
  const text = raw.trim();
  if (!text || text.length > 2000) return null;

  const bang = text.match(/^!([a-z0-9]+)\s*(.*)$/i);
  if (bang) {
    const key = bang[1].toLowerCase();
    const rest = bang[2].trim();
    const build = BANGS[key];
    if (build) {
      if (!rest) return null;
      return { kind: "read", url: build(rest), bang: key };
    }
    return { kind: "search", query: rest || text };
  }

  if (/^https?:\/\//i.test(text)) return { kind: "read", url: text };

  if (/^[\w.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(text) && !/\s/.test(text)) {
    return { kind: "read", url: `https://${text}` };
  }

  return { kind: "search", query: text };
}

export function looksLikeUrl(raw: string): boolean {
  const text = raw.trim();
  if (!text || text.startsWith("!")) return false;
  const address = resolveAddress(text);
  return address?.kind === "read";
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function duckIcon(host: string): string {
  return `https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`;
}

const LIMITED = [
  "youtube.com",
  "youtu.be",
  "reddit.com",
  "instagram.com",
  "x.com",
  "twitter.com",
  "facebook.com",
  "tiktok.com",
  "duckduckgo.com",
];

export function isLimitedHost(url: string): boolean {
  const host = hostOf(url);
  return LIMITED.some((item) => host === item || host.endsWith(`.${item}`));
}
