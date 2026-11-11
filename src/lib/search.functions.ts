import { createServerFn } from "@tanstack/react-start";
import { parseRegion } from "./regions";

function readQuery(input: unknown): { q: string; kl: ReturnType<typeof parseRegion> } {
  const record = input && typeof input === "object" ? (input as { q?: unknown; kl?: unknown }) : {};
  const q = typeof record.q === "string" ? record.q.trim().slice(0, 300) : "";
  if (!q) throw new Error("Arama boş.");
  return { q, kl: parseRegion(record.kl) };
}

export const searchWeb = createServerFn({ method: "POST" })
  .validator(readQuery)
  .handler(async ({ data }) => {
    const { searchDuck } = await import("./duck");
    return searchDuck(data.q, data.kl);
  });

export const suggestWeb = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const record = input && typeof input === "object" ? (input as { q?: unknown }) : {};
    const q = typeof record.q === "string" ? record.q.trim().slice(0, 200) : "";
    return { q };
  })
  .handler(async ({ data }) => {
    if (!data.q) return [] as string[];
    const { suggestDuck } = await import("./duck");
    return suggestDuck(data.q);
  });

export const readPage = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const record = input && typeof input === "object" ? (input as { url?: unknown }) : {};
    const url = typeof record.url === "string" ? record.url.trim() : "";
    if (!/^https?:\/\//i.test(url) || url.length > 2000) throw new Error("Adres geçersiz.");
    return { url };
  })
  .handler(async ({ data }) => {
    const { readArticle } = await import("./duck");
    return readArticle(data.url);
  });
