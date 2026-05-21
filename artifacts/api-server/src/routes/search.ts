import { Router, type IRouter, type Request } from "express";
import { SearchMediaQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

type Source = "google" | "pinterest" | "youtube" | "artstation";

type ResultItem = {
  id: string;
  source: Source;
  title: string;
  thumbnailUrl: string;
  imageUrl: string;
  sourceUrl: string;
  width?: number;
  height?: number;
  host?: string;
};

const COMMON_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

async function getVqd(query: string): Promise<string | null> {
  const resp = await fetch("https://duckduckgo.com/", {
    method: "POST",
    headers: {
      ...COMMON_HEADERS,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ q: query }).toString(),
  });
  if (!resp.ok) return null;
  const html = await resp.text();
  const patterns = [
    /vqd=([\d-]+)&/,
    /vqd='([\d-]+)'/,
    /vqd="([\d-]+)"/,
    /vqd=([\d-]+)/,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return m[1] ?? null;
  }
  return null;
}

type DdgImageResult = {
  title?: string;
  image?: string;
  thumbnail?: string;
  url?: string;
  source?: string;
  width?: number;
  height?: number;
};

async function ddgImageSearch(query: string): Promise<DdgImageResult[]> {
  const vqd = await getVqd(query);
  if (!vqd) return [];
  const url = new URL("https://duckduckgo.com/i.js");
  url.searchParams.set("l", "us-en");
  url.searchParams.set("o", "json");
  url.searchParams.set("q", query);
  url.searchParams.set("vqd", vqd);
  url.searchParams.set("f", ",,,,,");
  url.searchParams.set("p", "1");
  url.searchParams.set("v7exp", "a");
  const resp = await fetch(url.toString(), {
    headers: {
      ...COMMON_HEADERS,
      Referer: `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`,
      "X-Requested-With": "XMLHttpRequest",
    },
  });
  if (!resp.ok) return [];
  const data = (await resp.json()) as { results?: DdgImageResult[] };
  return Array.isArray(data.results) ? data.results : [];
}

function hostOf(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

function detectSource(host: string): Source | "other" {
  if (host.includes("pinterest")) return "pinterest";
  if (host.includes("youtube.com") || host.includes("youtu.be"))
    return "youtube";
  if (host.includes("artstation.com")) return "artstation";
  return "other";
}

function toItem(
  r: DdgImageResult,
  source: Source,
  idx: number,
): ResultItem | null {
  const imageUrl = r.image;
  const thumbnailUrl = r.thumbnail || r.image;
  if (!imageUrl || !thumbnailUrl) return null;
  const sourceUrl = r.url || imageUrl;
  return {
    id: `${source}-${idx}-${Buffer.from(imageUrl).toString("base64").slice(0, 24)}`,
    source,
    title: r.title || r.source || "",
    thumbnailUrl,
    imageUrl,
    sourceUrl,
    width: r.width,
    height: r.height,
    host: hostOf(r.url),
  };
}

async function searchForSource(
  query: string,
  source: Source,
): Promise<ResultItem[]> {
  let q = query;
  if (source === "pinterest") q = `${query} site:pinterest.com`;
  if (source === "youtube") q = `${query} site:youtube.com`;
  if (source === "artstation") q = `${query} site:artstation.com`;

  const raw = await ddgImageSearch(q);
  const items: ResultItem[] = [];

  for (let i = 0; i < raw.length; i++) {
    const r = raw[i];
    if (!r) continue;
    const host = hostOf(r.url);
    if (source === "pinterest" && !host.includes("pinterest")) continue;
    if (
      source === "youtube" &&
      !(host.includes("youtube.com") || host.includes("youtu.be"))
    )
      continue;
    if (source === "artstation" && !host.includes("artstation.com")) continue;
    if (source === "google") {
      const detected = detectSource(host);
      if (detected !== "other") continue;
    }
    const item = toItem(r, source, i);
    if (item) items.push(item);
  }

  return items;
}

router.get("/search", async (req: Request, res) => {
  const parsed = SearchMediaQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query parameters" });
    return;
  }
  const { q, sources } = parsed.data;
  const trimmed = q.trim();
  if (!trimmed) {
    res.status(400).json({ error: "Query must not be empty" });
    return;
  }

  const allSources: Source[] = ["google", "pinterest", "youtube", "artstation"];
  const requested = sources
    ? sources
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter((s): s is Source => allSources.includes(s as Source))
    : allSources;
  const enabled = requested.length > 0 ? requested : allSources;

  try {
    const settled = await Promise.allSettled(
      enabled.map((s) => searchForSource(trimmed, s)),
    );

    const merged: ResultItem[] = [];
    const counts: Record<Source, number> = {
      google: 0,
      pinterest: 0,
      youtube: 0,
      artstation: 0,
    };

    settled.forEach((r, idx) => {
      const source = enabled[idx];
      if (!source) return;
      if (r.status === "fulfilled") {
        counts[source] = r.value.length;
        merged.push(...r.value);
      } else {
        req.log.warn({ err: r.reason, source }, "source search failed");
      }
    });

    const grouped: Record<Source, ResultItem[]> = {
      google: [],
      pinterest: [],
      youtube: [],
      artstation: [],
    };
    for (const it of merged) grouped[it.source].push(it);
    const interleaved: ResultItem[] = [];
    let added = true;
    while (added) {
      added = false;
      for (const s of enabled) {
        const next = grouped[s].shift();
        if (next) {
          interleaved.push(next);
          added = true;
        }
      }
    }

    res.json({
      query: trimmed,
      results: interleaved,
      counts,
    });
  } catch (err) {
    req.log.error({ err }, "search failed");
    res.status(500).json({ error: "Search failed" });
  }
});

export default router;
