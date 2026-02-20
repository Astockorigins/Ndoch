GOLD SNIPER v2.4.1 — FIXED FRONTEND (Auto News)
==================================================

Upload to GitHub repo ROOT (replace existing):
- index.html
- app.js
- config.js

Worker URL already set:
- https://gold-sniper-proxy.dvdndng.workers.dev

Tip:
- After upload, open in Incognito or clear site data to avoid cache.


HOTFIX v2.4.2:
- Prevents crashes if some elements are missing/cached
- Adds 'JS: loaded' indicator


v2.4.3 LITE:
- Reduced API calls per refresh from ~5 to 2 to avoid Twelve Data rate limits.
- Uses M15 data to compute 60m gold move and key levels.


v2.4.4 (A+B):
- A) Soft Alerts: banner + vibration when BUY/SELL appears (no Notification permission)
- B) Auto-lock: locks direction after first valid signal (or bias mode)


v2.4.5 (Smart Alerts):
- Soft Alerts only fire when Session ON + not in News Lock + score >= min score (default 4/4)
- Optional Level Alerts (Support/Resistance hit)


v2.4.6 (Smart Auto-lock):
- Auto-lock now respects toggle and requires score >= lockMinScore (default 4/4)
- Bias rule locks on first clear USD bias (score threshold)
- Signal rule locks on first BUY/SELL (score threshold)


v2.4.7 HOTFIX:
- Fixes JS syntax error that stopped the app from running (buttons + data load)


v2.5.0:
- Added Myfxbook sentiment (via Worker /sentiment)
- Added Trade Ticket (manual confirm + copy)

Worker change REQUIRED:
- Add /sentiment route (see WORKER_PATCH_SENTIMENT.js)


v2.5.1 HOTFIX:
- Fixes Sentiment/Ticket stuck on Loading when the cards load after JS (late DOM binding)
