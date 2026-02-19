// Gold Sniper v2.2 Config
window.CONFIG = {
  TWELVEDATA_KEY: "",
  // Cloudflare Worker URL (no trailing slash)
  PROXY_URL: "https://gold-sniper-proxy.dvdndng.workers.dev",

  TREND_INTERVAL: "5min",
  TREND_LOOKBACK_BARS: 12,
  USD_PROXY_SYMBOL: "EUR/USD",
  GOLD_SYMBOL: "XAU/USD",

  LEVELS_H1_INTERVAL: "1h",
  LEVELS_M15_INTERVAL: "15min",

  // Session windows
  TZ_OFFSET_MINUTES: 180,          // set to 180 for Nairobi time windows
  LONDON_START: "08:00",
  LONDON_MINUTES: 180,
  NY_START: "13:30",
  NY_MINUTES: 180
,
  // Alerts + News guard defaults
  ALERTS_DEFAULT: "off",
  ALERT_COOLDOWN_SECONDS: 120,
  NEWS_PRE_MINUTES: 60,
  NEWS_POST_MINUTES: 60
};
