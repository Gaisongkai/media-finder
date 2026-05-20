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

router.get("/image", async (req: Request, res: Response) => {
  const raw = String(req.query.url || "");
  if (!raw || !/^https?:\/\//i.test(raw)) {
    res.status(400).json({ error: "invalid url" });
    return;
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    res.status(400).json({ error: "invalid url" });
    return;
  }

  // Only allow http/https
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    res.status(400).json({ error: "invalid protocol" });
    return;
  }

  try {
    const upstream = await fetch(target.toString(), {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": BROWSER_UA,
        Accept:
          "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
        Referer: pickReferer(target),
      },
    });

    if (!upstream.ok || !upstream.body) {
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

    // Suggested filename — used by browsers / PureRef when saving the file.
    const nameHint = String(req.query.name || "media");
    const safeName = nameHint
      .replace(/[^\w\u4e00-\u9fa5\-]+/g, "_")
      .slice(0, 60) || "media";
    const filename = `${safeName}.${extOf(contentType)}`;

    res.setHeader("Content-Type", contentType);
    if (contentLength) res.setHeader("Content-Length", contentLength);
    res.setHeader("Cache-Control", "public, max-age=86400, immutable");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(filename)}"`,
    );

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
});

export default router;
