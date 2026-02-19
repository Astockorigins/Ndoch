/**
 * Gold Sniper TwelveData Proxy (Cloudflare Worker)
 *
 * Endpoints:
 *   GET /time_series?symbol=XAU/USD&interval=15min&outputsize=96
 *
 * Store your Twelve Data key as a secret:
 *   wrangler secret put TWELVEDATA_KEY
 */

const TWELVEDATA_BASE = "https://api.twelvedata.com";

function corsHeaders(request, allowedOrigins) {
  const origin = request.headers.get("Origin") || "";
  const allow =
    allowedOrigins.length === 0 ||
    allowedOrigins.includes(origin) ||
    allowedOrigins.includes("*");

  return {
    "Access-Control-Allow-Origin": allow ? (allowedOrigins.includes("*") ? "*" : origin) : "null",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const allowedOrigins = (env.ALLOWED_ORIGINS || "*")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request, allowedOrigins) });
    }

    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders(request, allowedOrigins) });
    }

    if (url.pathname !== "/time_series") {
      return new Response("Not found", { status: 404, headers: corsHeaders(request, allowedOrigins) });
    }

    const apiKey = env.TWELVEDATA_KEY;
    if (!apiKey) {
      return new Response("Missing TWELVEDATA_KEY secret", { status: 500, headers: corsHeaders(request, allowedOrigins) });
    }

    const symbol = url.searchParams.get("symbol") || "";
    const interval = url.searchParams.get("interval") || "";
    const outputsize = url.searchParams.get("outputsize") || "96";

    if (!symbol || !interval) {
      return new Response("Missing symbol/interval", { status: 400, headers: corsHeaders(request, allowedOrigins) });
    }

    const upstream = new URL(TWELVEDATA_BASE + "/time_series");
    upstream.searchParams.set("symbol", symbol);
    upstream.searchParams.set("interval", interval);
    upstream.searchParams.set("outputsize", outputsize);
    upstream.searchParams.set("apikey", apiKey);

    const upstreamRes = await fetch(upstream.toString(), {
      headers: { "Accept": "application/json" },
      cf: { cacheTtl: 10, cacheEverything: false },
    });

    const body = await upstreamRes.text();
    const headers = corsHeaders(request, allowedOrigins);
    headers["Content-Type"] = "application/json; charset=utf-8";

    return new Response(body, { status: upstreamRes.status, headers });
  },
};
