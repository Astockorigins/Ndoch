GOLD SNIPER (UI v2) — GitHub Pages ready
=========================================

1) Paste your Twelve Data key into config.js
2) Upload index.html, app.js, config.js to your GitHub repo root
3) Enable GitHub Pages: Settings -> Pages -> main / root
4) Open the link and Add to Home Screen

How it decides
- Uses EURUSD move over last 60 minutes as USD pressure proxy:
  EURUSD down => USD strong => SELL gold bias
  EURUSD up   => USD weak   => BUY gold bias
- Confirms with gold move (XAUUSD) in the same direction as the bias
- Session + direction lock prevents revenge trading

Security
- Public hosting exposes your API key. If you want, we can hide it with a free proxy.
