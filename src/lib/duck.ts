import { parseHTML } from "linkedom";
import { wikiLangs, type RegionId } from "./regions";
import type { Hit, ReaderPayload, SearchPayload } from "./search-types";

const API_UA = "Ordek/1.0 (DuckDuckGo instant answer client)";
const PAGE_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

type DdgTopic = {
  Text?: string;
  FirstURL?: string;
  Topics?: DdgTopic[];
};

type DdgPayload = {
  Abstract?: string;
  AbstractSource?: string;
  AbstractURL?: string;
  Answer?: string;
  Heading?: string;
  Image?: string;
  Redirect?: string;
  Infobox?: { content?: { label?: string; value?: unknown }[] } | "";
  RelatedTopics?: DdgTopic[];
  Results?: DdgTopic[];
};

const searchCache = new Map<string, { at: number; data: SearchPayload }>();

function strip(value: string): string {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/\u0026amp;/g, "&")
    .replace(/\u0026quot;/g, '"')
    .replace(/\u0026#39;/g, "'")
    .replace(/\u0026lt;/g, "<")
    .replace(/\u0026gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function boxValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return strip(String(value)).slice(0, 180);
  if (Array.isArray(value)) {
    return value.map(boxValue).filter(Boolean).join(", ").slice(0, 180);
  }
  if (value && typeof value === "object" && "value" in value) {
    return boxValue((value as { value: unknown }).value);
  }
  return "";
}

function imageUrl(image: string | undefined): string | null {
  if (!image) return null;
  if (image.startsWith("//")) return `https:${image}`;
  if (image.startsWith("/")) return `https://duckduckgo.com${image}`;
  if (image.startsWith("http://") || image.startsWith("https://")) return image;
  return null;
}

function splitText(text: string): { title: string; snippet: string } {
  const clean = strip(text);
  const idx = clean.indexOf(" - ");
  if (idx > 0 && idx < 100) {
    return { title: clean.slice(0, idx), snippet: clean.slice(idx + 3) };
  }
  return { title: clean.slice(0, 110), snippet: clean };
}

function hostFrom(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function flatten(items: DdgTopic[] | undefined, into: { text: string; url: string }[]) {
  for (const item of items ?? []) {
    if (item.Topics) flatten(item.Topics, into);
    else if (item.Text && item.FirstURL) into.push({ text: item.Text, url: item.FirstURL });
  }
}

function safeMath(query: string): string | null {
  const source = query.trim().replace(/,/g, ".").replace(/%/g, "/100");
  if (!/^[\d\s+\-*/().]+$/.test(source) || !/\d/.test(source) || source.length > 80) return null;
  let index = 0;
  const peek = () => source[index] ?? "";
  const eat = () => source[index++] ?? "";
  const skip = () => {
    while (peek() === " ") eat();
  };
  function parseExpr(): number {
    let value = parseTerm();
    skip();
    while (peek() === "+" || peek() === "-") {
      const op = eat();
      const right = parseTerm();
      value = op === "+" ? value + right : value - right;
      skip();
    }
    return value;
  }
  function parseTerm(): number {
    let value = parseFactor();
    skip();
    while (peek() === "*" || peek() === "/") {
      const op = eat();
      const right = parseFactor();
      value = op === "*" ? value * right : value / right;
      skip();
    }
    return value;
  }
  function parseFactor(): number {
    skip();
    if (peek() === "+" || peek() === "-") {
      const sign = eat() === "-" ? -1 : 1;
      return sign * parseFactor();
    }
    if (peek() === "(") {
      eat();
      const value = parseExpr();
      skip();
      if (peek() !== ")") throw new Error("paren");
      eat();
      return value;
    }
    let num = "";
    while (/[\d.]/.test(peek())) num += eat();
    if (!num) throw new Error("num");
    const value = Number(num);
    if (!Number.isFinite(value)) throw new Error("nan");
    return value;
  }
  try {
    const value = parseExpr();
    skip();
    if (index !== source.length || !Number.isFinite(value)) return null;
    return String(Math.round(value * 1e8) / 1e8);
  } catch {
    return null;
  }
}

function weatherPlace(query: string): string | null {
  const folded = query.toLocaleLowerCase("tr-TR");
  if (!/(hava|weather|sıcaklık|sicaklik)/.test(folded)) return null;
  const cleaned = query
    .replace(/hava\s*durumu/gi, " ")
    .replace(/hava\s*nasıl/gi, " ")
    .replace(/\b(hava|weather|bugün|bugun|nasıl|nasil|sıcaklık|sicaklik|derece)\b/gi, " ")
    .replace(/[?!.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (cleaned || "İstanbul").slice(0, 60);
}

async function fetchJson<T>(url: string, timeout = 6000): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": API_UA },
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as T;
}

async function fetchWeather(query: string): Promise<SearchPayload["weather"]> {
  const placeQuery = weatherPlace(query);
  if (!placeQuery) return null;
  const url = `https://wttr.in/${encodeURIComponent(placeQuery)}?format=j1&lang=tr`;
  const response = await fetch(url, {
    headers: { "User-Agent": "curl/8.0", Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as {
    current_condition?: {
      temp_C?: string;
      weatherDesc?: { value?: string }[];
      lang_tr?: { value?: string }[];
      windspeedKmph?: string;
    }[];
    nearest_area?: { country?: { value?: string }[] }[];
    weather?: { date?: string; maxtempC?: string; mintempC?: string; hourly?: { lang_tr?: { value?: string }[] }[] }[];
  };
  const current = data.current_condition?.[0];
  if (!current || current.temp_C == null) return null;
  const days = (data.weather ?? []).slice(0, 3).map((day) => ({
    date: day.date || "",
    max: Math.round(Number(day.maxtempC ?? current.temp_C)),
    min: Math.round(Number(day.mintempC ?? current.temp_C)),
    label: day.hourly?.[4]?.lang_tr?.[0]?.value || day.hourly?.[0]?.lang_tr?.[0]?.value || current.lang_tr?.[0]?.value || "Değişken",
  }));
  const country = data.nearest_area?.[0]?.country?.[0]?.value;
  return {
    place: country ? `${placeQuery}, ${country}` : placeQuery,
    temp: Math.round(Number(current.temp_C)),
    label: current.lang_tr?.[0]?.value || current.weatherDesc?.[0]?.value || "Değişken",
    wind: Math.round(Number(current.windspeedKmph ?? 0)),
    days,
  };
}

async function fetchWiki(query: string, langs: string[]): Promise<Hit[]> {
  const hits: Hit[] = [];
  for (const lang of langs) {
    if (hits.length >= 8) break;
    const url = new URL(`https://${lang}.wikipedia.org/w/api.php`);
    url.searchParams.set("action", "query");
    url.searchParams.set("generator", "search");
    url.searchParams.set("gsrsearch", query);
    url.searchParams.set("gsrlimit", "6");
    url.searchParams.set("gsrnamespace", "0");
    url.searchParams.set("prop", "extracts|info");
    url.searchParams.set("inprop", "url");
    url.searchParams.set("exintro", "1");
    url.searchParams.set("explaintext", "1");
    url.searchParams.set("exchars", "220");
    url.searchParams.set("format", "json");
    const data = await fetchJson<{
      query?: { pages?: Record<string, { index?: number; title?: string; extract?: string; fullurl?: string }> };
    }>(url.toString());
    const pages = Object.values(data.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    for (const page of pages) {
      if (!page.title || !page.fullurl) continue;
      hits.push({
        title: page.title,
        url: page.fullurl,
        snippet: strip(page.extract || "").slice(0, 220),
        host: hostFrom(page.fullurl),
        via: "wikipedia",
      });
    }
  }
  return hits;
}

async function fetchInstant(query: string, region: RegionId): Promise<DdgPayload | null> {
  const url = new URL("https://api.duckduckgo.com/");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("no_html", "1");
  url.searchParams.set("no_redirect", "1");
  url.searchParams.set("skip_disambig", "1");
  if (region !== "tr-tr") url.searchParams.set("kl", region);
  url.searchParams.set("t", "ordek");
  try {
    return await fetchJson<DdgPayload>(url.toString());
  } catch {
    return null;
  }
}

export async function searchDuck(query: string, region: RegionId): Promise<SearchPayload> {
  const key = `${region}::${query.toLocaleLowerCase("tr-TR")}`;
  const cached = searchCache.get(key);
  if (cached && Date.now() - cached.at < 5 * 60 * 1000) return cached.data;

  const mathOnly = /^[\d\s+\-*/().,%]+$/.test(query.trim()) && safeMath(query) !== null;
  const [instant, wiki, weather] = await Promise.all([
    fetchInstant(query, region),
    mathOnly ? Promise.resolve([] as Hit[]) : fetchWiki(query, wikiLangs(region)).catch(() => [] as Hit[]),
    fetchWeather(query).catch(() => null),
  ]);

  const topics: string[] = [];
  const hits: Hit[] = [];
  const seen = new Set<string>();

  const pushHit = (hit: Hit) => {
    if (!hit.url || !hit.title || seen.has(hit.url)) return;
    seen.add(hit.url);
    hits.push(hit);
  };

  const related: { text: string; url: string }[] = [];
  flatten(instant?.Results, related);
  flatten(instant?.RelatedTopics, related);
  for (const item of related) {
    let parsed: URL;
    try {
      parsed = new URL(item.url);
    } catch {
      continue;
    }
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "duckduckgo.com") {
      const label = decodeURIComponent(parsed.pathname.replace(/^\//, "")).replace(/_/g, " ").trim();
      if (label && !topics.includes(label) && topics.length < 8) topics.push(label);
      continue;
    }
    const parts = splitText(item.text);
    pushHit({ ...parts, url: parsed.href, host, via: "duckduckgo" });
  }

  for (const hit of wiki) pushHit(hit);

  const answer = strip(instant?.Answer || "") || safeMath(query);
  const abstract = strip(instant?.Abstract || "").slice(0, 700) || null;
  const infobox = (instant?.Infobox && typeof instant.Infobox === "object" ? instant.Infobox.content ?? [] : [])
    .map((row) => ({ label: strip(row.label || ""), value: boxValue(row.value) }))
    .filter((row) => row.label && row.value && row.label.toLowerCase() !== "image")
    .slice(0, 6);

  const redirect =
    typeof instant?.Redirect === "string" && /^https?:\/\//.test(instant.Redirect) ? instant.Redirect : null;

  if (!answer && !abstract && hits.length === 0 && !weather && !redirect) {
    throw new Error("DuckDuckGo bu aramaya yanıt vermedi.");
  }

  const data: SearchPayload = {
    query,
    answer,
    abstract,
    abstractSource: instant?.AbstractSource || null,
    abstractUrl: instant?.AbstractURL || null,
    heading: instant?.Heading || null,
    image: imageUrl(instant?.Image),
    infobox,
    redirect,
    topics,
    hits: hits.slice(0, 10),
    weather,
  };
  if (!(weatherPlace(query) && !weather)) {
    searchCache.set(key, { at: Date.now(), data });
  }
  return data;
}

export async function suggestDuck(query: string): Promise<string[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const url = new URL("https://duckduckgo.com/ac/");
  url.searchParams.set("q", trimmed);
  url.searchParams.set("type", "list");
  try {
    const data = await fetchJson<unknown>(url.toString(), 4000);
    if (Array.isArray(data) && Array.isArray(data[1])) {
      return data[1].filter((item): item is string => typeof item === "string").slice(0, 8);
    }
  } catch {
    return [];
  }
  return [];
}

function isPrivateIp(ip: string): boolean {
  const value = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (value === "::1" || value === "0.0.0.0") return true;
  if (value.startsWith("fe80:") || value.startsWith("fc") || value.startsWith("fd")) return true;
  const mapped = value.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIp(mapped[1]);
  if (value.includes(":")) return false;
  const parts = value.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

async function assertPublic(url: URL) {
  if (url.username || url.password) throw new Error("Bu adres açılamaz.");
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Sadece web adresleri açılır.");
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    !host ||
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal"
  ) {
    throw new Error("Bu adres açılamaz.");
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(":")) {
    if (isPrivateIp(host)) throw new Error("Bu adres açılamaz.");
    return;
  }
  const dns = await import("node:dns/promises");
  const addresses = await dns.lookup(host, { all: true });
  if (addresses.length === 0 || addresses.some((item) => isPrivateIp(item.address))) {
    throw new Error("Bu adres açılamaz.");
  }
}

async function fetchPublic(url: URL, hops = 0): Promise<{ response: Response; url: URL }> {
  if (hops > 4) throw new Error("Çok fazla yönlendirme.");
  await assertPublic(url);
  const response = await fetch(url, {
    redirect: "manual",
    headers: {
      Accept: "text/html,application/xhtml+xml,image/*;q=0.8",
      "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.6",
      "User-Agent": PAGE_UA,
    },
    signal: AbortSignal.timeout(9000),
  });
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (!location) throw new Error("Yönlendirme boş.");
    return fetchPublic(new URL(location, url), hops + 1);
  }
  return { response, url };
}

function escapeText(value: string): string {
  return value.replace(/&/g, "\u0026amp;").replace(/</g, "\u0026lt;").replace(/>/g, "\u0026gt;");
}

function escapeAttr(value: string): string {
  return escapeText(value).replace(/"/g, "\u0026quot;");
}

const DROP = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "IFRAME",
  "SVG",
  "CANVAS",
  "FORM",
  "BUTTON",
  "INPUT",
  "TEXTAREA",
  "SELECT",
  "NAV",
  "FOOTER",
  "ASIDE",
  "TEMPLATE",
]);

const KEEP = new Set([
  "P",
  "H1",
  "H2",
  "H3",
  "H4",
  "UL",
  "OL",
  "LI",
  "BLOCKQUOTE",
  "PRE",
  "CODE",
  "A",
  "IMG",
  "FIGURE",
  "FIGCAPTION",
  "STRONG",
  "EM",
  "B",
  "I",
  "BR",
  "HR",
  "TABLE",
  "THEAD",
  "TBODY",
  "TR",
  "TH",
  "TD",
  "SUP",
  "SUB",
]);

function renderNode(node: Node, base: URL, images: { n: number }): string {
  if (node.nodeType === 3) return escapeText(node.textContent || "");
  if (node.nodeType !== 1) return "";
  const el = node as Element;
  const tag = el.tagName.toUpperCase();
  if (DROP.has(tag)) return "";
  const inner = () => Array.from(el.childNodes).map((child) => renderNode(child, base, images)).join("");
  if (!KEEP.has(tag)) return inner();
  if (tag === "BR") return "<br />";
  if (tag === "HR") return "<hr />";
  if (tag === "IMG") {
    if (images.n >= 6) return "";
    const raw = el.getAttribute("src") || el.getAttribute("data-src") || "";
    let abs: URL;
    try {
      abs = new URL(raw, base);
    } catch {
      return "";
    }
    if (abs.protocol !== "https:" || abs.username) return "";
    images.n += 1;
    const alt = escapeAttr(el.getAttribute("alt") || "");
    return `<img src="${escapeAttr(abs.href)}" alt="${alt}" loading="lazy" referrerpolicy="no-referrer" />`;
  }
  const children = inner();
  if (!children.trim()) return "";
  if (tag === "A") {
    const raw = el.getAttribute("href") || "";
    let abs: URL;
    try {
      abs = new URL(raw, base);
    } catch {
      return children;
    }
    if ((abs.protocol !== "http:" && abs.protocol !== "https:") || abs.username) return children;
    return `<a href="${escapeAttr(abs.href)}">${children}</a>`;
  }
  const name = tag.toLowerCase();
  return `<${name}>${children}</${name}>`;
}

export async function readArticle(rawUrl: string): Promise<ReaderPayload> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Adres geçersiz.");
  }
  const { response, url: finalUrl } = await fetchPublic(url);
  if (response.status >= 400) throw new Error(`Sayfa açılmadı (${response.status}).`);
  const type = (response.headers.get("content-type") || "").toLowerCase();
  const titleFallback = finalUrl.hostname.replace(/^www\./, "");
  if (type.startsWith("image/")) {
    return {
      url: finalUrl.href,
      title: titleFallback,
      html: `<img src="${escapeAttr(finalUrl.href)}" alt="" referrerpolicy="no-referrer" />`,
      thin: false,
      words: 0,
    };
  }
  if (!type.includes("html") && !type.includes("xml") && !type.includes("text/plain") && type) {
    return {
      url: finalUrl.href,
      title: titleFallback,
      html: "",
      thin: true,
      words: 0,
    };
  }
  const charset = type.match(/charset=([^;]+)/i)?.[1]?.trim() || "utf-8";
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Sayfa boş geldi.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  const max = 1_200_000;
  while (total < max) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    const room = max - total;
    const slice = value.byteLength > room ? value.subarray(0, room) : value;
    chunks.push(slice);
    total += slice.byteLength;
  }
  await reader.cancel().catch(() => undefined);
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let html = "";
  try {
    html = new TextDecoder(charset).decode(bytes);
  } catch {
    html = new TextDecoder("utf-8").decode(bytes);
  }
  const { document } = parseHTML(html);
  document
    .querySelectorAll(
      "script,style,noscript,iframe,svg,canvas,form,nav,footer,aside,.mw-editsection,.reflist,.navbox,#toc,.mw-references-wrap,.noprint,sup.reference",
    )
    .forEach((node) => node.remove());
  const root =
    document.querySelector("article") ||
    document.querySelector("#mw-content-text") ||
    document.querySelector("main") ||
    document.body;
  const title = (document.querySelector("title")?.textContent || titleFallback).replace(/\s+/g, " ").trim().slice(0, 180);
  let rendered = root ? renderNode(root, finalUrl, { n: 0 }) : "";
  if (rendered.length > 70_000) rendered = `${rendered.slice(0, 70_000)}<p>…</p>`;
  const words = rendered.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return {
    url: finalUrl.href,
    title: title || titleFallback,
    html: rendered,
    thin: words.length < 120,
    words: words ? words.split(" ").length : 0,
  };
}
