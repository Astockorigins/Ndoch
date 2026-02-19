Gold Sniper Proxy (Cloudflare Worker)
==================================

This hides your Twelve Data API key so your GitHub Pages site stays public safely.

Deploy (quick)
1) Install Wrangler:
   npm i -g wrangler

2) Login:
   wrangler login

3) From cloudflare-worker folder:
   wrangler deploy

4) Add your Twelve Data key as a secret (Cloudflare encrypts it):
   wrangler secret put TWELVEDATA_KEY
   (Then run wrangler deploy again if prompted)

Lock origins (recommended)
- Edit wrangler.jsonc:
  "ALLOWED_ORIGINS": "https://YOURNAME.github.io"
  (You can keep "*" while testing)

Frontend
- In frontend/config.js set:
  PROXY_URL: "https://gold-sniper-proxy.YOURNAME.workers.dev"
- Then upload the frontend files to GitHub Pages (repo root).

Notes
- Cloudflare docs: secrets via wrangler secret put.
- Cloudflare example: CORS header proxy (for preflight + headers).
