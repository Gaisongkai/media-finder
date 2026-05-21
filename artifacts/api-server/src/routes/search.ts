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
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

type BingImageItem = {
  murl?: string;
  turl?: string;
  purl?: string;
  t?: string;
  w?: number;
  h?: number;
};

async function bingImageSearch(query: string): Promise<BingImageItem[]> {
  const url = new URL("https://www.bing.com/images/async");
  url.searchParams.set("q", query);
  url.searchParams.set("first", "0");
  url.searchParams.set("count", "40");
  url.searchParams.set("adlt", "moderate");
  url.searchParams.set("qft", "");

  const resp = await fetch(url.toString(), {
    headers: {
      ...COMMON_HEADERS,
      Referer: `https://www.bing.com/images/search?q=${encodeURIComponent(query)}`,
    },
  });
  if (!resp.ok) return [];
  const html = await resp.text();

  const results: BingImageItem[] = [];
  const re = /\{&quot;[^{}]*murl&quot;[^{}]*\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    try {
      const raw = match[0].replace(/&quot;/g, '"').replace(/&amp;/g, "&");
      const obj = JSON.parse(raw) as BingImageItem;
      if (obj.murl) results.push(obj);
    } catch {
      // skip malformed entries
    }
  }
  return results;
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

async function searchForSource(
  query: string,
  source: Source,
): Promise<ResultItem[]> {
  let q = query;
  if (source === "pinterest") q = `${query} site:pinterest.com`;
  if (source === "youtube") q = `${query} site:youtube.com`;
  if (source === "artstation") q = `${query} site:artstation.com`;

  const raw = await bingImageSearch(q);
  const items: ResultItem[] = [];

  for (let i = 0; i < raw.length; i++) {
    const r = raw[i];
    if (!r?.murl) continue;
    const imageUrl = r.murl;
    const thumbnailUrl = r.turl || r.murl;
    const sourceUrl = r.purl || imageUrl;
    const host = hostOf(sourceUrl);

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

    items.push({
      id: `${source}-${i}-${Buffer.from(imageUrl).toString("base64").slice(0, 24)}`,
      source,
      title: r.t || "",
      thumbnailUrl,
      imageUrl,
      sourceUrl,
      width: r.w,
      height: r.h,
      host,
    });
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
