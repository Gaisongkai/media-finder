import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function pickReferer(target: URL): string {
  const host = target.host;
  if (host.includes("pinimg.com") || host.includes("pinterest"))
    return "https://www.pinterest.com/";
  if (host.includes("ytimg.com") || host.includes("youtube"))
    return "https://www.youtube.com/";
  if (host.includes("artstation"))
    return "https://www.artstation.com/";
  return `${target.protocol}//${target.host}/`;
}

function extOf(contentType: string): string {
  const lower = contentType.toLowerCase();
  if (lower.includes("png")) return "png";
  if (lower.includes("webp")) return "webp";
  if (lower.includes("gif")) return "gif";
  if (lower.includes("avif")) return "avif";
  if (lower.includes("svg")) return "svg";
  return "jpg";
}

function validateTarget(raw: string): URL | null {
  if (!raw || !/^https?:\/\//i.test(raw)) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

async function proxy(
  req: Request,
  res: Response,
  method: "GET" | "HEAD",
): Promise<void> {
  const target = validateTarget(String(req.query.url || ""));
  if (!target) {
    res.status(400).json({ error: "invalid url" });
    return;
  }

  const upstreamHeaders: Record<string, string> = {
    "User-Agent": BROWSER_UA,
    Accept:
      "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
    Referer: pickReferer(target),
  };
  // Forward Range header so downstream consumers (PureRef etc.) can do
  // partial downloads — this matches what i.pinimg.com supports.
  const rangeHeader = req.headers["range"];
  if (typeof rangeHeader === "string") upstreamHeaders["Range"] = rangeHeader;

  try {
    const upstream = await fetch(target.toString(), {
      method,
      redirect: "follow",
      headers: upstreamHeaders,
    });

    if (!upstream.ok && upstream.status !== 206) {
      req.log.warn(
        { status: upstream.status, url: target.toString() },
        "image proxy upstream failure",
      );
      res.status(upstream.status >= 400 ? upstream.status : 502).end();
      return;
    }

    const contentType =
      upstream.headers.get("content-type") || "image/jpeg";
    const contentLength = upstream.headers.get("content-length");
    const contentRange = upstream.headers.get("content-range");
    const acceptRanges = upstream.headers.get("accept-ranges") || "bytes";
    const etag = upstream.headers.get("etag");
    const lastModified = upstream.headers.get("last-modified");

    const nameHint = String(req.query.name || "media");
    const safeName =
      nameHint.replace(/[^\w\u4e00-\u9fa5\-]+/g, "_").slice(0, 60) || "media";
    const filename = `${safeName}.${extOf(contentType)}`;

    res.status(upstream.status);
    res.setHeader("Content-Type", contentType);
    if (contentLength) res.setHeader("Content-Length", contentLength);
    if (contentRange) res.setHeader("Content-Range", contentRange);
    res.setHeader("Accept-Ranges", acceptRanges);
    res.setHeader("Cache-Control", "public, max-age=86400, immutable");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader(
      "Access-Control-Expose-Headers",
      "Content-Length, Content-Range, Accept-Ranges, Content-Type",
    );
    if (etag) res.setHeader("ETag", etag);
    if (lastModified) res.setHeader("Last-Modified", lastModified);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(filename)}"`,
    );

    if (method === "HEAD" || !upstream.body) {
      res.end();
      return;
    }

    const reader = upstream.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) res.write(Buffer.from(value));
    }
    res.end();
  } catch (err) {
    req.log.error({ err, url: target.toString() }, "image proxy failed");
    if (!res.headersSent) res.status(502).end();
    else res.end();
  }
}

router.options("/image", (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Range");
  res.setHeader(
    "Access-Control-Expose-Headers",
    "Content-Length, Content-Range, Accept-Ranges, Content-Type",
  );
  res.status(204).end();
});

router.head("/image", (req, res) => {
  void proxy(req, res, "HEAD");
});

router.get("/image", (req, res) => {
  void proxy(req, res, "GET");
});

export default router;
