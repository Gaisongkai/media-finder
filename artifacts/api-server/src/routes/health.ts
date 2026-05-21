import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/nettest", async (_req, res) => {
  const targets = [
    { name: "bing", url: "https://www.bing.com/images/async?q=test&count=1" },
    { name: "duckduckgo", url: "https://duckduckgo.com/" },
  ];
  const results: Record<string, string> = {};
  await Promise.all(
    targets.map(async ({ name, url }) => {
      try {
        const r = await fetch(url, {
          signal: AbortSignal.timeout(5000),
          headers: { "User-Agent": "Mozilla/5.0" },
        });
        results[name] = `ok:${r.status}`;
      } catch (e) {
        results[name] = `fail:${(e as Error).message}`;
      }
    }),
  );
  res.json(results);
});

export default router;
