GOLD SNIPER v2.2 — Yesterday High/Low + London/NY ranges
==========================================================

NEW
- Adds Yesterday High/Low (from 15m bars).
- Adds London + NY range High/Low (from 15m bars) for today's date.
- All these levels are automatically included in the Key Levels engine.

Timezone
- Default assumes Twelve Data timestamps are UTC.
- If you want session windows in Nairobi time, set TZ_OFFSET_MINUTES: 180 in config.js.
- DST can shift session times in some months. Adjust LONDON_START / NY_START when needed.

Install on GitHub Pages
1) Paste API key in config.js
2) Replace your repo root files: index.html, app.js, config.js
3) Refresh GitHub Pages link
