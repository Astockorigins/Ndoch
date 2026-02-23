// Gold Sniper v2.4.1 Config (GitHub Pages safe)
window.CONFIG = {
  PROXY_URL: "https://gold-sniper-proxy.dvdndng.workers.dev",
  USD_PROXY_SYMBOL: "EUR/USD",
  GOLD_SYMBOL: "XAU/USD",
  TREND_INTERVAL: "5min",
  TREND_LOOKBACK_BARS: 12,
  LEVELS_H1_INTERVAL: "1h",
  LEVELS_M15_INTERVAL: "15min",
  TZ_OFFSET_MINUTES: 180,
  LONDON_START: "08:00",
  LONDON_MINUTES: 180,
  NY_START: "13:30",
  NY_MINUTES: 180,
  ALERTS_DEFAULT: "off",
  ALERT_COOLDOWN_SECONDS: 120,
  NEWS_PRE_MINUTES: 60,
  NEWS_POST_MINUTES: 60,
  NEWS_AUTO_DEFAULT: "on",
  NEWS_AUTO_COUNT: 8
,
  // v2.4.3: LITE mode reduces API calls to avoid rate limits.
  LITE_MODE: true,

  // Compute gold 60m move from M15 bars (default 4 bars = ~60m)
  GOLD_TREND_FROM_M15_BARS: 4
,
  // v2.4.4 A+B defaults
  SOFT_ALERTS_DEFAULT: "on",
  SOFT_ALERT_COOLDOWN_SECONDS: 60,
  AUTO_LOCK_DEFAULT: "on",
  AUTO_LOCK_RULE: "signal" // "signal" or "bias"
,
  // v2.4.5 Smart Alerts
  SOFT_ALERT_MIN_SCORE: 4,
  SOFT_LEVEL_ALERTS_DEFAULT: "off"
,
  // v2.4.6 Smart Auto-lock
  AUTO_LOCK_MIN_SCORE: 4
,
  // v2.5.0 Sentiment + Ticket
  SENTIMENT_SYMBOL: "XAUUSD",
  SENTIMENT_REFRESH_SECONDS: 120,
  SENTIMENT_RULE_DEFAULT: "info", // "info" or "contrarian70"
  TICKET_RR: 2.0,
  TICKET_SL_BUFFER_PCT: 0.0008 // 0.08% buffer beyond level
};

CHART_M15_BARS: 8, // 4=1hr, 8=2hr, 12=3hr, 16=4hr

