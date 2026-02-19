// Gold Sniper v2.2 Config
window.CONFIG = {
  TWELVEDATA_KEY: 04ee01f1e42a4afe977f047fdc5678be,
  // Your Cloudflare Worker URL (no trailing slash), e.g. https://gold-sniper-proxy.yourname.workers.dev
  PROXY_URL: "PROXY_URL: "https://gold-sniper-proxy.dvdndng.workers.dev"
",

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
};
