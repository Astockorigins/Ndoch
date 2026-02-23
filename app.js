/* Gold Sniper v2.6.2+ (App.js) — FULL FILE (Copy/Paste)
   Includes: LITE logic, News lock, A+B, Sentiment + IG donut, Ticket, Theme/Install/Fix,
   + Gold Strength Line Chart (REAL M15 closes, no extra API calls)

   IMPORTANT:
   - This file assumes your HTML has these IDs (must exist or will safely no-op):
     goldChart, chartPill, chartTrend, chartNowVal, chartChgVal
   - Keep your config.js loaded BEFORE app.js
*/

(function(){
  try{
    const C = window.CONFIG || {};
    const $ = (id)=>document.getElementById(id);

    function on(el, ev, fn){
      if(!el) return;
      el.addEventListener(ev, fn);
    }

    const ui = {
      conn: $('conn'), lastUpdate: $('lastUpdate'),
      decisionText: $('decisionText'), decisionReason: $('decisionReason'),
      usdState: $('usdState'), usdDetail: $('usdDetail'),
      goldState: $('goldState'), goldDetail: $('goldDetail'),
      sessionState: $('sessionState'), dirState: $('dirState'), levelState: $('levelState'),
      sessionPill: $('sessionPill'), dirPill: $('dirPill'), levelPill: $('levelPill'),
      scoreVal: $('scoreVal'), scorePill: $('scorePill'),
      priceNow: $('priceNow'), resLevel: $('resLevel'), supLevel: $('supLevel'),
      resDist: $('resDist'), supDist: $('supDist'),
      locState: $('locState'), locPill: $('locPill'),
      tzLabel: $('tzLabel'),

      yHigh: $('yHigh'), yLow: $('yLow'), yHighDist: $('yHighDist'), yLowDist: $('yLowDist'),
      lonRange: $('lonRange'), nyRange: $('nyRange'), lonDist: $('lonDist'), nyDist: $('nyDist'),

      autoLabel: $('autoLabel'),
      threshold: $('threshold'), levelDistance: $('levelDistance'), autoRefresh: $('autoRefresh'), levelsLookback: $('levelsLookback'),
      today: $('today'), refresh: $('refresh'), start: $('start'), end: $('end'),
      toast: $('toast'),

      // Gold Strength Chart (M15)
      goldChart: $('goldChart'),
      chartPill: $('chartPill'),
      chartTrend: $('chartTrend'),
      chartNowVal: $('chartNowVal'),
      chartChgVal: $('chartChgVal'),

      // Sentiment + Ticket
      sentimentPill: $('sentimentPill'),
      sentimentState: $('sentimentState'),
      sentLong: $('sentLong'),
      sentShort: $('sentShort'),
      sentLongLots: $('sentLongLots'),
      sentShortLots: $('sentShortLots'),
      sentClients: $('sentClients'),
      sentRule: $('sentRule'),
      sentRulePill: $('sentRulePill'),
      sentRuleText: $('sentRuleText'),
      sentHint: $('sentHint'),

      ticketPill: $('ticketPill'),
      ticketState: $('ticketState'),
      tDir: $('tDir'),
      tEntry: $('tEntry'),
      tSL: $('tSL'),
      tTP: $('tTP'),
      tRisk: $('tRisk'),
      copyTicket: $('copyTicket'),
      openXM: $('openXM'),
      ticketHint: $('ticketHint'),

      themeBtn: $('themeBtn'),
      installBtn: $('installBtn'),
      resetBtn: $('resetBtn'),
      themeColorMeta: $('themeColorMeta'),

      // A+B
      softAlerts: $('softAlerts'),
      softCooldown: $('softCooldown'),
      autoLock: $('autoLock'),
      lockRule: $('lockRule'),
      lockPill: $('lockPill'),
      lockModeText: $('lockModeText'),
      abHint: $('abHint'),
      minScore: $('minScore'),
      levelAlerts: $('levelAlerts'),
      lockMinScore: $('lockMinScore'),
      lockStateText: $('lockStateText'),

      // alerts
      alertsToggle: $('alertsToggle'),
      alertCooldown: $('alertCooldown'),
      alertStatus: $('alertStatus'),
      alertStatusPill: $('alertStatusPill'),

      // news
      newsPre: $('newsPre'),
      newsPost: $('newsPost'),
      newsEvent: $('newsEvent'),
      newsLabel: $('newsLabel'),
      saveNews: $('saveNews'),
      clearNews: $('clearNews'),
      newsHint: $('newsHint'),
      newsPill: $('newsPill'),
      newsLockState: $('newsLockState'),
      newsAuto: $('newsAuto'),
      newsUpcoming: $('newsUpcoming'),
      loadNews: $('loadNews'),
    };

    function bindLateUI(){
      // Sentiment
      ui.sentimentPill ||= $('sentimentPill');
      ui.sentimentState ||= $('sentimentState');
      ui.sentLong ||= $('sentLong');
      ui.sentShort ||= $('sentShort');
      ui.sentLongLots ||= $('sentLongLots');
      ui.sentShortLots ||= $('sentShortLots');
      ui.sentClients ||= $('sentClients');
      ui.sentRule ||= $('sentRule');
      ui.sentRulePill ||= $('sentRulePill');
      ui.sentRuleText ||= $('sentRuleText');

      // Ticket
      ui.ticketPill ||= $('ticketPill');
      ui.ticketState ||= $('ticketState');
      ui.tDir ||= $('tDir');
      ui.tEntry ||= $('tEntry');
      ui.tSL ||= $('tSL');
      ui.tTP ||= $('tTP');
      ui.tRisk ||= $('tRisk');
      ui.copyTicket ||= $('copyTicket');
      ui.openXM ||= $('openXM');

      // Chart (if injected later)
      ui.goldChart ||= $('goldChart');
      ui.chartPill ||= $('chartPill');
      ui.chartTrend ||= $('chartTrend');
      ui.chartNowVal ||= $('chartNowVal');
      ui.chartChgVal ||= $('chartChgVal');
    }

    // -------- state --------
    let sessionOn = false;
    let lockedDir = null;
    let autoTimer = null;

    let alertsOn = (C.ALERTS_DEFAULT || 'off') === 'on';
    let alertCooldownSec = Number(C.ALERT_COOLDOWN_SECONDS || 120);
    let lastAlertAt = 0;
    let lastDecision = 'NO';
    let lastLoc = '';

    let news = {
      dtLocal: null,
      label: '',
      pre: Number(C.NEWS_PRE_MINUTES || 60),
      post: Number(C.NEWS_POST_MINUTES || 60),
    };
    let newsAuto = (C.NEWS_AUTO_DEFAULT || 'on') === 'on';
    let upcomingUsd = [];

    // Sentiment (Myfxbook via Worker)
    let sentiment = { longPct:null, shortPct:null, longLots:null, shortLots:null, clients:null, updated:null };
    let sentimentRule = (C.SENTIMENT_RULE_DEFAULT || 'info');
    let sentimentTimer = null;

    // Theme + Install
    let themeMode = localStorage.getItem('GS_THEME') || 'dark';
    let deferredInstallPrompt = null;

    // A) Soft alerts
    let softAlertsOn = (C.SOFT_ALERTS_DEFAULT || 'on') === 'on';
    let softCooldownSec = Number(C.SOFT_ALERT_COOLDOWN_SECONDS || 60);
    let lastSoftAt = 0;
    let lastSoftDecision = 'NO';
    let softMinScore = Number(C.SOFT_ALERT_MIN_SCORE || 4);
    let levelAlertsOn = (C.SOFT_LEVEL_ALERTS_DEFAULT || 'off') === 'on';
    let lastLevelLoc = '';

    // B) Session auto-lock
    let autoLockOn = (C.AUTO_LOCK_DEFAULT || 'on') === 'on';
    let lockRule = (C.AUTO_LOCK_RULE || 'signal'); // "signal" or "bias"
    let lockMinScore = Number(C.AUTO_LOCK_MIN_SCORE || 4);

    // -------- ui helpers --------
    function pill(el, cls){
      if(!el) return;
      el.classList.remove('green','red','blue','amber','gray');
      if(cls) el.classList.add(cls);
    }

    function setConn(ok){
      pill(ui.conn, ok ? 'blue' : 'red');
      if(ui.conn) ui.conn.innerHTML = '<strong>' + (ok ? 'ONLINE' : 'OFFLINE') + '</strong>';
    }

    function toast(msg){
      if(!ui.toast) return;
      ui.toast.textContent = msg;
      ui.toast.style.opacity = '1';
      clearTimeout(toast._t);
      toast._t = setTimeout(()=>{ ui.toast.style.opacity = '0'; }, 1800);
    }

    async function notify(title, body){
      try{
        if(!('Notification' in window)) return;
        if(Notification.permission !== 'granted') return;
        new Notification(title, { body });
        if(navigator.vibrate) navigator.vibrate(60);
      }catch(e){}
    }

    async function ensureNotificationPermission(){
      if(!('Notification' in window)) { toast('Notifications not supported'); return; }
      if(Notification.permission === 'granted') return;
      if(Notification.permission === 'denied'){ toast('Notifications blocked in browser settings'); return; }
      const p = await Notification.requestPermission();
      if(p === 'granted') toast('Alerts enabled ✅');
      else toast('Alerts not allowed');
    }

    function fmtPrice(x){ return (x===null || x===undefined || !isFinite(x)) ? '—' : x.toFixed(2); }
    function fmtPct(x){ return (!isFinite(x)) ? '—' : (x*100).toFixed(2) + '%'; }
    function pctMove(newest, oldest){ if(!oldest) return 0; return (newest - oldest) / oldest; }

    // -------- data fetch --------
    async function api(path, params){
      const base = (C.PROXY_URL || '').trim().replace(/\/$/,'');
      if(!base) throw new Error('Missing PROXY_URL in config.js');
      const u = new URL(base + path);
      Object.entries(params || {}).forEach(([k,v])=> u.searchParams.set(k, String(v)));
      const res = await fetch(u.toString(), { cache:'no-store' });
      if(!res.ok) throw new Error('API error: ' + res.status);
      return await res.json();
    }

    async function tdTimeSeries(symbol, interval, outputsize){
      const data = await api('/time_series', { symbol, interval, outputsize });
      if(data.status !== 'ok') throw new Error(data.message || 'Twelve Data error');
      return data.values.map(v => ({ datetime:v.datetime, open:+v.open, high:+v.high, low:+v.low, close:+v.close }));
    }

    async function fetchUsdHighEvents(){
      const count = Number(C.NEWS_AUTO_COUNT || 8);
      const data = await api('/usd_events', { next: count });
      if(!data || !Array.isArray(data.events)) return [];
      return data.events;
    }

    async function fetchSentiment(){
      try{
        const sym = (C.SENTIMENT_SYMBOL || 'XAUUSD');
        const data = await api('/sentiment', { symbol: sym });
        if(!data || data.status !== 'ok') throw new Error('bad sentiment');

        sentiment = {
          longPct: Number(data.longPct),
          shortPct: Number(data.shortPct),
          longLots: Number(data.longLots),
          shortLots: Number(data.shortLots),
          clients: (
            data.clients ??
            data.clientCount ??
            data.clientsCount ??
            data.traders ??
            data.traderCount ??
            data.accounts ??
            null
          ),
          updated: data.updated || null
        };

        updateSentimentUI(true);
      }catch(e){
        updateSentimentUI(false);
      }
    }

    function updateSentimentUI(ok){
      bindLateUI();
      if(!ui.sentimentState) return;

      ui.sentimentState.textContent = ok ? 'OK' : 'OFF';
      pill(ui.sentimentPill, ok ? 'blue' : 'red');

      if(ok){
        // Normalize % from lots when possible (fixes 100% / 100% bug from bad API)
        const longLots = isFinite(sentiment.longLots) ? sentiment.longLots : 0;
        const shortLots = isFinite(sentiment.shortLots) ? sentiment.shortLots : 0;
        const totalLots = longLots + shortLots;

        let longPct, shortPct;
        if(totalLots > 0){
          longPct = (longLots / totalLots) * 100;
          shortPct = (shortLots / totalLots) * 100;
        }else{
          longPct = isFinite(sentiment.longPct) ? sentiment.longPct : NaN;
          shortPct = isFinite(sentiment.shortPct) ? sentiment.shortPct : NaN;
        }

        if(ui.sentLong) ui.sentLong.textContent  = isFinite(longPct)  ? (longPct.toFixed(0) + '%')  : '—';
        if(ui.sentShort) ui.sentShort.textContent = isFinite(shortPct) ? (shortPct.toFixed(0) + '%') : '—';

        if(ui.sentLongLots) ui.sentLongLots.textContent  = 'Lots: ' + (isFinite(sentiment.longLots) ? sentiment.longLots.toFixed(2) : '—');
        if(ui.sentShortLots) ui.sentShortLots.textContent = 'Lots: ' + (isFinite(sentiment.shortLots) ? sentiment.shortLots.toFixed(2) : '—');

        const clientsVal =
          (sentiment.clients !== null && sentiment.clients !== undefined && sentiment.clients !== '')
            ? String(sentiment.clients)
            : '—';
        if(ui.sentClients) ui.sentClients.textContent = clientsVal;

        // Update IG donut immediately (if those IDs exist in HTML)
        try{ applySentimentIG(longPct, shortPct, clientsVal); }catch(e){}

        if(ui.sentRule){
          ui.sentRule.value = sentimentRule;
          if(ui.sentRuleText) ui.sentRuleText.textContent = (sentimentRule === 'contrarian70') ? 'Contrarian ≥70%' : 'Info only';
          pill(ui.sentRulePill, sentimentRule === 'contrarian70' ? 'amber' : 'gray');
        }
      }else{
        if(ui.sentLong) ui.sentLong.textContent = '—';
        if(ui.sentShort) ui.sentShort.textContent = '—';
        if(ui.sentLongLots) ui.sentLongLots.textContent = 'Lots: —';
        if(ui.sentShortLots) ui.sentShortLots.textContent = 'Lots: —';
        if(ui.sentClients) ui.sentClients.textContent = '—';
      }
    }

    function sentimentAllows(direction){
      if(sentimentRule !== 'contrarian70') return true;

      // Use the computed % from lots if possible
      const longLots = isFinite(sentiment.longLots) ? sentiment.longLots : NaN;
      const shortLots = isFinite(sentiment.shortLots) ? sentiment.shortLots : NaN;
      const totalLots = (isFinite(longLots) && isFinite(shortLots)) ? (longLots + shortLots) : NaN;
      let lp = sentiment.longPct, sp = sentiment.shortPct;

      if(isFinite(totalLots) && totalLots > 0){
        lp = (longLots / totalLots) * 100;
        sp = (shortLots / totalLots) * 100;
      }

      if(!isFinite(lp) || !isFinite(sp)) return true;
      if(lp >= 70) return direction === 'SELL';
      if(sp >= 70) return direction === 'BUY';
      return true;
    }

    function buildTicket(decision, entry, sup, res){
      const rr = Number(C.TICKET_RR || 2.0);
      const bufPct = Number(C.TICKET_SL_BUFFER_PCT || 0.0008);
      const buf = entry * bufPct;

      let sl = null, tp = null, risk = null;
      if(decision === 'BUY'){
        sl = (isFinite(sup) ? (sup - buf) : (entry - entry*0.002));
        risk = entry - sl;
        tp = entry + rr * risk;
      } else if(decision === 'SELL'){
        sl = (isFinite(res) ? (res + buf) : (entry + entry*0.002));
        risk = sl - entry;
        tp = entry - rr * risk;
      } else {
        return null;
      }
      return { decision, entry, sl, tp, rr, risk };
    }

    function setTicketUI(ticket){
      bindLateUI();
      if(!ui.ticketState) return;

      if(!ticket){
        ui.ticketState.textContent = '—';
        pill(ui.ticketPill, 'gray');
        if(ui.tDir) ui.tDir.textContent = '—';
        if(ui.tEntry) ui.tEntry.textContent = '—';
        if(ui.tSL) ui.tSL.textContent = '—';
        if(ui.tTP) ui.tTP.textContent = '—';
        if(ui.tRisk) ui.tRisk.textContent = 'Risk: —';
        return;
      }

      ui.ticketState.textContent = 'READY';
      pill(ui.ticketPill, 'green');
      if(ui.tDir) ui.tDir.textContent = ticket.decision;
      if(ui.tEntry) ui.tEntry.textContent = ticket.entry.toFixed(2);
      if(ui.tSL) ui.tSL.textContent = ticket.sl.toFixed(2);
      if(ui.tTP) ui.tTP.textContent = ticket.tp.toFixed(2);
      if(ui.tRisk) ui.tRisk.textContent = 'Risk: ' + ticket.risk.toFixed(2) + ' (RR 1:' + (ticket.rr||2) + ')';
    }

    function ticketText(ticket){
      if(!ticket) return '';
      const sym = (C.GOLD_SYMBOL || 'XAU/USD').replace('/','');
      return [
        'GOLD SNIPER TRADE TICKET',
        'Symbol: ' + sym,
        'Direction: ' + ticket.decision,
        'Entry: ' + ticket.entry.toFixed(2),
        'SL: ' + ticket.sl.toFixed(2),
        'TP: ' + ticket.tp.toFixed(2),
        'RR: 1:' + (ticket.rr || 2),
        'Note: Manual confirm. Adjust for spread.'
      ].join('\n');
    }

    function applyTheme(mode){
      themeMode = (mode === 'light') ? 'light' : 'dark';
      document.body.classList.toggle('light', themeMode === 'light');
      localStorage.setItem('GS_THEME', themeMode);

      if(ui.themeBtn){
        ui.themeBtn.textContent = (themeMode === 'light') ? '🌙 Dark' : '☀️ Light';
      }
      const meta = ui.themeColorMeta;
      if(meta){
        meta.setAttribute('content', themeMode === 'light' ? '#F8FAFC' : '#0B0F19');
      }
    }

    function setupInstall(){
      if(!ui.installBtn) return;

      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredInstallPrompt = e;
        ui.installBtn.style.display = 'inline-flex';
      });

      window.addEventListener('appinstalled', () => {
        deferredInstallPrompt = null;
        ui.installBtn.style.display = 'none';
        toast('Installed ✅');
      });

      ui.installBtn.addEventListener('click', async () => {
        if(deferredInstallPrompt){
          deferredInstallPrompt.prompt();
          await deferredInstallPrompt.userChoice;
          return;
        }
        toast('iPhone: Share → Add to Home Screen');
      });
    }

    function registerSW(){
      if('serviceWorker' in navigator){
        navigator.serviceWorker.register('./sw.js').then(reg=>{
          reg.update().catch(()=>{});
        }).catch(()=>{});
        let reloaded = false;
        navigator.serviceWorker.addEventListener('controllerchange', ()=>{
          if(reloaded) return;
          reloaded = true;
          location.reload();
        });
      }
    }

    async function nukeCachesAndSW(){
      try{
        if('serviceWorker' in navigator){
          const regs = await navigator.serviceWorker.getRegistrations();
          for(const r of regs){ try{ await r.unregister(); }catch(e){} }
        }
        if('caches' in window){
          const keys = await caches.keys();
          for(const k of keys){ try{ await caches.delete(k); }catch(e){} }
        }
        try{
          localStorage.removeItem('gold_sniper_v241');
          localStorage.removeItem('GS_THEME');
        }catch(e){}
        toast('Cache cleared ✅ reloading…');
        setTimeout(()=> location.replace(location.pathname + '?v=262'), 600);
      }catch(e){
        toast('Fix failed');
      }
    }

    // -------- logic --------
    function classifyUSD(eurPct, th){
      if(eurPct <= -th) return { state:'STRONG', dir:'SELL' };
      if(eurPct >=  th) return { state:'WEAK', dir:'BUY' };
      return { state:'UNCLEAR', dir:null };
    }

    function classifyGold(goldPct, dir, th){
      if(!dir) return { state:'UNCLEAR', ok:false };
      if(dir === 'SELL') return { state:(goldPct <= -th ? 'BEARISH' : 'CHOPPY'), ok: goldPct <= -th };
      if(dir === 'BUY')  return { state:(goldPct >=  th ? 'BULLISH' : 'CHOPPY'), ok: goldPct >=  th };
      return { state:'UNCLEAR', ok:false };
    }

    function findSwings(bars, leftRight){
      const arr = bars.slice().reverse(); // oldest-first
      const swingsHigh = [], swingsLow = [];
      for(let i=leftRight; i<arr.length-leftRight; i++){
        const h = arr[i].high, l = arr[i].low;
        let isHigh = true, isLow = true;
        for(let j=1; j<=leftRight; j++){
          if(arr[i-j].high >= h || arr[i+j].high >= h) isHigh = false;
          if(arr[i-j].low  <= l || arr[i+j].low  <= l) isLow = false;
          if(!isHigh && !isLow) break;
        }
        if(isHigh) swingsHigh.push(h);
        if(isLow) swingsLow.push(l);
      }
      return { swingsHigh, swingsLow };
    }

    function clusterLevels(levels, price, pctBand){
      if(!levels.length) return [];
      const sorted = levels.slice().sort((a,b)=>a-b);
      const clusters = [];
      let cur = [sorted[0]];
      for(let i=1;i<sorted.length;i++){
        const prev = cur[cur.length-1], x = sorted[i];
        const band = price * pctBand;
        if(Math.abs(x - prev) <= band) cur.push(x);
        else { clusters.push(cur); cur = [x]; }
      }
      clusters.push(cur);
      return clusters.map(c => c.reduce((s,v)=>s+v,0)/c.length);
    }

    function pickNearest(price, supports, resistances){
      let sup=null,res=null,supDist=Infinity,resDist=Infinity;
      supports.forEach(lvl=>{ if(lvl<=price){ const d=price-lvl; if(d<supDist){supDist=d; sup=lvl;} } });
      resistances.forEach(lvl=>{ if(lvl>=price){ const d=lvl-price; if(d<resDist){resDist=d; res=lvl;} } });
      if(sup===null && supports.length){
        supports.forEach(lvl=>{ const d=Math.abs(price-lvl); if(d<supDist){supDist=d; sup=lvl;} });
      }
      if(res===null && resistances.length){
        resistances.forEach(lvl=>{ const d=Math.abs(lvl-price); if(d<resDist){resDist=d; res=lvl;} });
      }
      return { sup, res };
    }

    function locationStatus(price, sup, res, levelPct){
      const band = price * levelPct;
      const atSup = (sup!==null) && (Math.abs(price - sup) <= band);
      const atRes = (res!==null) && (Math.abs(price - res) <= band);
      if(atSup && !atRes) return { loc:'AT SUPPORT', okDir:'BUY', cls:'green' };
      if(atRes && !atSup) return { loc:'AT RESISTANCE', okDir:'SELL', cls:'red' };
      if(atSup && atRes)  return { loc:'AT BOTH (RANGE)', okDir:null, cls:'amber' };
      return { loc:'MID-RANGE', okDir:null, cls:'gray' };
    }

    function parseISOish(s){
      const t = (s||'').replace(' ', 'T');
      const d = new Date(t + 'Z');
      return isNaN(d.getTime()) ? null : d;
    }

    function toTZ(d){
      const off = Number(C.TZ_OFFSET_MINUTES||180);
      return new Date(d.getTime() + off*60000);
    }

    function dayKeyTZ(d){
      const z = toTZ(d);
      const y = z.getUTCFullYear();
      const m = String(z.getUTCMonth()+1).padStart(2,'0');
      const da = String(z.getUTCDate()).padStart(2,'0');
      return `${y}-${m}-${da}`;
    }

    function timeToMinutes(hhmm){
      const [h,m]=hhmm.split(':').map(n=>parseInt(n,10));
      return h*60+m;
    }

    function computeYesterdayHighLow(bars){
      const map = new Map();
      for(const b of bars){
        const d = parseISOish(b.datetime); if(!d) continue;
        const k = dayKeyTZ(d);
        const cur = map.get(k) || { high:-Infinity, low:Infinity };
        cur.high = Math.max(cur.high, b.high);
        cur.low = Math.min(cur.low, b.low);
        map.set(k, cur);
      }
      const days = Array.from(map.keys()).sort();
      if(days.length < 2) return { yHigh:null, yLow:null, day:null };
      const yday = days[days.length-2];
      const v = map.get(yday);
      return { yHigh:v.high, yLow:v.low, day:yday };
    }

    function computeSessionRange(bars, day, startHHMM, minutesLen){
      const startMin = timeToMinutes(startHHMM);
      const endMin = startMin + minutesLen;
      let hi=-Infinity, lo=Infinity, found=false;
      for(const b of bars){
        const d = parseISOish(b.datetime); if(!d) continue;
        if(dayKeyTZ(d) !== day) continue;
        const z = toTZ(d);
        const tmin = z.getUTCHours()*60 + z.getUTCMinutes();
        if(tmin >= startMin && tmin < endMin){
          hi = Math.max(hi, b.high);
          lo = Math.min(lo, b.low);
          found = true;
        }
      }
      return found ? { hi, lo } : { hi:null, lo:null };
    }

    function setSessionLevelsUI(price, yHigh, yLow, lon, ny){
      if(ui.yHigh) ui.yHigh.textContent = fmtPrice(yHigh);
      if(ui.yLow) ui.yLow.textContent = fmtPrice(yLow);

      if(ui.yHighDist) ui.yHighDist.textContent = 'Distance: ' + fmtPct(yHigh===null?Infinity:Math.abs(yHigh-price)/price);
      if(ui.yLowDist) ui.yLowDist.textContent  = 'Distance: ' + fmtPct(yLow===null?Infinity:Math.abs(price-yLow)/price);

      if(ui.lonRange) ui.lonRange.textContent = (lon.hi && lon.lo) ? (fmtPrice(lon.hi) + ' / ' + fmtPrice(lon.lo)) : '—';
      // ✅ FIXED: ny.lo (not ny.hi twice)
      if(ui.nyRange) ui.nyRange.textContent  = (ny.hi && ny.lo) ? (fmtPrice(ny.hi) + ' / ' + fmtPrice(ny.lo)) : '—';

      const lonMin = Math.min(
        (lon.hi===null?Infinity:Math.abs(lon.hi-price)/price),
        (lon.lo===null?Infinity:Math.abs(price-lon.lo)/price)
      );
      const nyMin  = Math.min(
        (ny.hi===null?Infinity:Math.abs(ny.hi-price)/price),
        (ny.lo===null?Infinity:Math.abs(price-ny.lo)/price)
      );
      if(ui.lonDist) ui.lonDist.textContent = 'Distance: ' + fmtPct(lonMin);
      if(ui.nyDist) ui.nyDist.textContent  = 'Distance: ' + fmtPct(nyMin);
    }

    function updateSessionUI(){
      if(ui.sessionState) ui.sessionState.textContent = sessionOn ? 'ON' : 'OFF';
      if(ui.dirState) ui.dirState.textContent = lockedDir ? (lockedDir + ' ONLY 🔒') : '—';

      pill(ui.sessionPill, sessionOn ? 'green' : 'amber');
      pill(ui.dirPill, lockedDir ? (lockedDir === 'BUY' ? 'green' : 'red') : 'amber');

      if(ui.start) ui.start.disabled = sessionOn;
      if(ui.end) ui.end.disabled = !sessionOn;
    }

    function setDecision(type, reason, score){
      if(!ui.decisionText || !ui.decisionReason) return;

      if(type === 'BUY'){ ui.decisionText.textContent = '✅ BUY GOLD'; ui.decisionText.style.color = '#34D399'; }
      else if(type === 'SELL'){ ui.decisionText.textContent = '✅ SELL GOLD'; ui.decisionText.style.color = '#FCA5A5'; }
      else { ui.decisionText.textContent = '⛔ NO TRADE'; ui.decisionText.style.color = '#E5E7EB'; }

      ui.decisionReason.textContent = reason;

      if(ui.scoreVal) ui.scoreVal.textContent = score + '/4';
      pill(ui.scorePill, score >= 4 ? 'green' : score === 3 ? 'amber' : 'red');
    }

    function setLevelUI(price, sup, res, lvlPct){
      if(ui.priceNow) ui.priceNow.textContent = fmtPrice(price);
      if(ui.supLevel) ui.supLevel.textContent = fmtPrice(sup);
      if(ui.resLevel) ui.resLevel.textContent = fmtPrice(res);

      if(ui.supDist) ui.supDist.textContent = 'Distance: ' + fmtPct(sup===null?Infinity:Math.abs(price-sup)/price);
      if(ui.resDist) ui.resDist.textContent = 'Distance: ' + fmtPct(res===null?Infinity:Math.abs(res-price)/price);

      const loc = locationStatus(price, sup, res, lvlPct);

      if(ui.locState) ui.locState.textContent = loc.loc;
      pill(ui.locPill, loc.cls);

      if(ui.levelState) ui.levelState.textContent = loc.loc;
      pill(ui.levelPill, loc.cls);

      return loc;
    }

    function updateAlertsUI(){
      if(!ui.alertsToggle) return;
      ui.alertsToggle.value = alertsOn ? 'on' : 'off';
      if(ui.alertCooldown) ui.alertCooldown.value = String(alertCooldownSec);
      if(ui.alertStatus) ui.alertStatus.textContent = alertsOn ? 'On' : 'Off';
      pill(ui.alertStatusPill, alertsOn ? 'green' : 'amber');
    }

    function isNewsLockedNow(){
      if(!news.dtLocal) return false;
      const dt = new Date(news.dtLocal);
      if(isNaN(dt.getTime())) return false;
      const now = new Date();
      const preMs = (Number(news.pre)||60) * 60000;
      const postMs = (Number(news.post)||60) * 60000;
      return now.getTime() >= (dt.getTime() - preMs) && now.getTime() <= (dt.getTime() + postMs);
    }

    function updateABUI(){
      if(ui.softAlerts){
        ui.softAlerts.value = softAlertsOn ? 'on' : 'off';
      }
      if(ui.softCooldown){
        ui.softCooldown.value = String(softCooldownSec);
      }

      if(ui.autoLock){
        ui.autoLock.value = autoLockOn ? 'on' : 'off';
      }
      if(ui.lockRule){
        ui.lockRule.value = lockRule;
      }
      if(ui.lockModeText) ui.lockModeText.textContent = autoLockOn ? 'On' : 'Off';
      pill(ui.lockPill, autoLockOn ? 'green' : 'amber');

      if(ui.minScore){
        ui.minScore.value = String(softMinScore);
      }
      if(ui.levelAlerts){
        ui.levelAlerts.value = levelAlertsOn ? 'on' : 'off';
      }

      if(ui.lockMinScore){
        ui.lockMinScore.value = String(lockMinScore);
      }
      if(ui.lockStateText) ui.lockStateText.textContent = lockedDir ? ('Yes ('+lockedDir+')') : 'No';

      if(ui.abHint){
        ui.abHint.textContent = autoLockOn
          ? 'Tip: Start Session → wait for first clean signal → direction locks.'
          : 'Auto-lock is OFF. You can flip direction, but be careful.';
      }
    }

    function updateNewsUI(){
      if(!ui.newsPre) return;

      ui.newsPre.value = String(news.pre||60);
      ui.newsPost.value = String(news.post||60);
      ui.newsLabel.value = news.label || '';
      ui.newsEvent.value = news.dtLocal || '';
      ui.newsAuto.value = newsAuto ? 'on' : 'off';

      const locked = isNewsLockedNow();
      if(ui.newsLockState) ui.newsLockState.textContent = locked ? 'ON' : 'OFF';
      pill(ui.newsPill, locked ? 'red' : 'green');

      if(ui.newsHint){
        ui.newsHint.textContent = news.dtLocal
          ? ('Saved: ' + (news.label||'Event') + ' @ ' + news.dtLocal.replace('T',' ') + ' (KE).')
          : 'No event saved.';
      }
    }

    function updateUpcomingDropdown(){
      if(!ui.newsUpcoming) return;
      ui.newsUpcoming.innerHTML = '';

      if(!upcomingUsd.length){
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'No events found';
        ui.newsUpcoming.appendChild(opt);
        return;
      }

      upcomingUsd.forEach((ev, i)=>{
        const opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = `${ev.title} • ${String(ev.nairobi||'').replace('T',' ')} (KE)`;
        ui.newsUpcoming.appendChild(opt);
      });
    }

    function applyEvent(ev){
      if(!ev) return;
      news.dtLocal = ev.nairobi || null;
      news.label = String(ev.title || 'USD High').slice(0,24);
      updateNewsUI();
      save();
    }

    async function autoLoadNews(force=false){
      if(!newsAuto && !force) return;
      try{
        const events = await fetchUsdHighEvents();
        upcomingUsd = events;
        updateUpcomingDropdown();
        if(events[0]) applyEvent(events[0]);
        toast('Loaded USD news ✅');
      }catch(e){
        toast('Auto-load failed (calendar)');
      }
    }

    function softAlert(decision, reason, score, locText, newsLocked){
      if(!softAlertsOn) return;
      if(!sessionOn) return;
      if(newsLocked) return;
      if(score < softMinScore) return;

      const now = Date.now();
      if(now - lastSoftAt < softCooldownSec*1000) return;

      const actionable = (decision === 'BUY' || decision === 'SELL');
      const changed = decision !== lastSoftDecision;

      if(actionable && changed){
        lastSoftAt = now;
        lastSoftDecision = decision;
        toast('🔥 ' + decision + ' • ' + reason);
        if(navigator.vibrate) navigator.vibrate([50,70,50]);
        return;
      }

      if(levelAlertsOn && locText && locText !== 'MID-RANGE' && locText !== lastLevelLoc){
        lastLevelLoc = locText;
        lastSoftAt = now;
        toast('🧱 LEVEL: ' + locText + ' • wait for setup');
        if(navigator.vibrate) navigator.vibrate([40,60,40]);
      }

      if(decision === 'NO') lastSoftDecision = 'NO';
    }

    function maybeAlert(decision, locText, price){
      if(!alertsOn) return;
      const now = Date.now();
      if(now - lastAlertAt < alertCooldownSec*1000) return;

      const flip = decision !== 'NO' && decision !== lastDecision;
      const levelHit = (locText && locText !== 'MID-RANGE' && locText !== lastLoc);

      if(flip || levelHit){
        lastAlertAt = now;
        const msg = flip
          ? ('Signal: ' + decision + ' (price ' + price.toFixed(2) + ')')
          : ('Level hit: ' + locText + ' (price ' + price.toFixed(2) + ')');
        toast(msg);
        notify('Gold Sniper', msg);
      }
      lastDecision = decision;
      lastLoc = locText;
    }

    function save(){
      try{
        localStorage.setItem('gold_sniper_v241', JSON.stringify({
          sessionOn, lockedDir,
          threshold: ui.threshold?.value,
          levelDistance: ui.levelDistance?.value,
          autoRefresh: ui.autoRefresh?.value,
          levelsLookback: ui.levelsLookback?.value,
          alertsOn, alertCooldownSec,
          news, newsAuto,
          sentimentRule,
          softAlertsOn, softCooldownSec,
          autoLockOn, lockRule,
          softMinScore, levelAlertsOn,
          lockMinScore
        }));
      }catch(e){}
    }

    function restore(){
      try{
        const s = JSON.parse(localStorage.getItem('gold_sniper_v241') || '{}');
        if(typeof s.sessionOn === 'boolean') sessionOn = s.sessionOn;
        if(s.lockedDir) lockedDir = s.lockedDir;

        if(s.threshold && ui.threshold) ui.threshold.value = s.threshold;
        if(s.levelDistance && ui.levelDistance) ui.levelDistance.value = s.levelDistance;
        if(s.autoRefresh && ui.autoRefresh) ui.autoRefresh.value = s.autoRefresh;
        if(s.levelsLookback && ui.levelsLookback) ui.levelsLookback.value = s.levelsLookback;

        if(typeof s.alertsOn === 'boolean') alertsOn = s.alertsOn;
        if(typeof s.alertCooldownSec === 'number') alertCooldownSec = s.alertCooldownSec;

        if(s.news) news = Object.assign(news, s.news);
        if(typeof s.newsAuto === 'boolean') newsAuto = s.newsAuto;

        if(typeof s.sentimentRule === 'string') sentimentRule = s.sentimentRule;

        if(typeof s.softAlertsOn === 'boolean') softAlertsOn = s.softAlertsOn;
        if(typeof s.softCooldownSec === 'number') softCooldownSec = s.softCooldownSec;

        if(typeof s.autoLockOn === 'boolean') autoLockOn = s.autoLockOn;
        if(typeof s.lockRule === 'string') lockRule = s.lockRule;

        if(typeof s.softMinScore === 'number') softMinScore = s.softMinScore;
        if(typeof s.levelAlertsOn === 'boolean') levelAlertsOn = s.levelAlertsOn;

        if(typeof s.lockMinScore === 'number') lockMinScore = s.lockMinScore;
      }catch(e){}
    }

    function setAuto(){
      const sec = parseInt(ui.autoRefresh?.value || '0', 10);
      if(autoTimer) { clearInterval(autoTimer); autoTimer = null; }
      if(ui.autoLabel) ui.autoLabel.textContent = sec ? (sec + 's') : 'Off';
      if(sec) autoTimer = setInterval(refresh, sec*1000);
      save();
    }

    // =========================
    // GOLD STRENGTH CHART (REAL M15 CLOSES)
    // =========================
    function getChartSeriesFromM15(m15Bars){
      // goldM15Long is newest-first in this app. We draw oldest→newest.
      const bars = (m15Bars || []).slice().reverse();

      // Default 8 bars = 2 hours. Config override: CHART_M15_BARS (4..24)
      const nRaw = parseInt((C.CHART_M15_BARS || 8), 10);
      const n = Math.max(4, Math.min(24, isFinite(nRaw) ? nRaw : 8));

      const slice = bars.slice(Math.max(0, bars.length - n));
      return slice.map(b => ({ t: b.datetime, v: Number(b.close) }));
    }

    function drawLineChart(canvas, series){
      bindLateUI();
      if(!canvas) return;

      const ctx = canvas.getContext('2d');
      if(!ctx) return;

      const rect = canvas.getBoundingClientRect();
      const cssW = rect.width || 320;
      const cssH = rect.height || 120;

      const dpr = window.devicePixelRatio || 1;
      canvas.width  = Math.floor(cssW * dpr);
      canvas.height = Math.floor(cssH * dpr);
      ctx.setTransform(dpr,0,0,dpr,0,0);

      ctx.clearRect(0,0,cssW,cssH);

      if(!series || series.length < 2) return;

      const vals = series.map(p => p.v).filter(v => isFinite(v));
      if(vals.length < 2) return;

      const minV = Math.min(...vals);
      const maxV = Math.max(...vals);
      const pad = (maxV - minV) * 0.15 || 1;

      const min = minV - pad;
      const max = maxV + pad;

      const W = cssW;
      const H = cssH;

      const x = (i)=> (i/(series.length-1)) * W;
      const y = (v)=> H - ((v - min)/(max - min)) * H;

      const first = series[0].v;
      const last  = series[series.length-1].v;
      const up = last > first;

      // Soft grid
      ctx.globalAlpha = 0.18;
      ctx.lineWidth = 1;
      ctx.strokeStyle = (themeMode === 'light') ? '#CBD5E1' : '#334155';
      for(let i=1;i<=3;i++){
        const yy = (H/4)*i;
        ctx.beginPath();
        ctx.moveTo(0, yy);
        ctx.lineTo(W, yy);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Line
      ctx.beginPath();
      for(let i=0;i<series.length;i++){
        const xi = x(i);
        const yi = y(series[i].v);
        if(i===0) ctx.moveTo(xi, yi);
        else ctx.lineTo(xi, yi);
      }
      ctx.lineWidth = 3;
      ctx.strokeStyle = up ? '#10B981' : '#EF4444';
      ctx.stroke();

      // Fill
      ctx.lineTo(W, H);
      ctx.lineTo(0, H);
      ctx.closePath();
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = up ? '#10B981' : '#EF4444';
      ctx.fill();
      ctx.globalAlpha = 1;

      // Labels
      const chgPct = ((last - first) / first) * 100;
      if(ui.chartTrend) ui.chartTrend.textContent = up ? 'UP' : 'DOWN';
      if(ui.chartNowVal) ui.chartNowVal.textContent = isFinite(last) ? last.toFixed(2) : '—';
      if(ui.chartChgVal) ui.chartChgVal.textContent = isFinite(chgPct) ? (chgPct.toFixed(2) + '%') : '—';
      if(ui.chartPill) pill(ui.chartPill, up ? 'green' : 'red');
    }

    function renderGoldStrengthFromM15(m15Bars){
      const series = getChartSeriesFromM15(m15Bars);
      drawLineChart(ui.goldChart, series);
    }

    // -------- refresh (ONE clean function) --------
    async function refresh(){
      setConn(true);

      const th = parseFloat(ui.threshold?.value || '0.0006');
      const lvlPct = parseFloat(ui.levelDistance?.value || '0.0015');
      const goldM15BarsCount = 220;

      try{
        const [eurTrend, goldM15Long] = await Promise.all([
          tdTimeSeries(C.USD_PROXY_SYMBOL || 'EUR/USD', C.TREND_INTERVAL || '5min', C.TREND_LOOKBACK_BARS || 12),
          tdTimeSeries(C.GOLD_SYMBOL || 'XAU/USD', C.LEVELS_M15_INTERVAL || '15min', goldM15BarsCount),
        ]);

        const eurPct = pctMove(eurTrend[0].close, eurTrend[eurTrend.length-1].close);

        const n = Math.min(parseInt(C.GOLD_TREND_FROM_M15_BARS || 4, 10), goldM15Long.length - 1);
        const goldNewest = goldM15Long[0].close;
        const goldOldest = goldM15Long[n].close;
        const goldPct = pctMove(goldNewest, goldOldest);

        // Chart
        window.__LAST_M15 = goldM15Long;
        renderGoldStrengthFromM15(goldM15Long);

        const usd = classifyUSD(eurPct, th);
        const gold = classifyGold(goldPct, usd.dir, th);

        if(ui.usdState) ui.usdState.textContent = usd.state;
        if(ui.usdDetail) ui.usdDetail.textContent = 'EURUSD (60m): ' + fmtPct(eurPct);

        if(ui.goldState) ui.goldState.textContent = gold.state;
        if(ui.goldDetail) ui.goldDetail.textContent = 'XAUUSD (60m): ' + fmtPct(goldPct);

        const price = goldNewest;

        // Levels
        const swM15 = findSwings(goldM15Long.slice(0, 160), 3);
        const highs = swM15.swingsHigh;
        const lows  = swM15.swingsLow;

        const clusterBand = 0.0010;
        let resistances = clusterLevels(highs, price, clusterBand);
        let supports    = clusterLevels(lows,  price, clusterBand);

        const y = computeYesterdayHighLow(goldM15Long);

        const dNow = parseISOish(goldM15Long[0].datetime);
        const todayKey = dNow ? dayKeyTZ(dNow) : null;

        const lon = todayKey
          ? computeSessionRange(goldM15Long, todayKey, C.LONDON_START || "08:00", Number(C.LONDON_MINUTES||180))
          : {hi:null,lo:null};

        const ny  = todayKey
          ? computeSessionRange(goldM15Long, todayKey, C.NY_START || "13:30", Number(C.NY_MINUTES||180))
          : {hi:null,lo:null};

        setSessionLevelsUI(price, y.yHigh, y.yLow, lon, ny);

        if(isFinite(y.yHigh)) resistances.push(y.yHigh);
        if(isFinite(lon.hi))  resistances.push(lon.hi);
        if(isFinite(ny.hi))   resistances.push(ny.hi);

        if(isFinite(y.yLow)) supports.push(y.yLow);
        if(isFinite(lon.lo)) supports.push(lon.lo);
        if(isFinite(ny.lo))  supports.push(ny.lo);

        const near = pickNearest(price, supports, resistances);
        const loc = setLevelUI(price, near.sup, near.res, lvlPct);

        // Score
        let score = 0;
        if(usd.state !== 'UNCLEAR') score++;
        if(gold.ok) score++;
        if(loc.okDir !== null) score++;

        const proposed = usd.dir; // BUY/SELL from USD proxy
        const sessionOk = sessionOn && (lockedDir ? lockedDir === proposed : true);
        if(sessionOk) score++;

        // Auto-lock on bias
        if(sessionOn && autoLockOn && !lockedDir && lockRule === 'bias' && proposed){
          if(score >= lockMinScore && usd.state !== 'UNCLEAR'){
            lockedDir = proposed;
            updateSessionUI();
            updateABUI();
            toast('🔒 Direction locked: ' + lockedDir);
          }
        }

        // Decision
        let decision = 'NO';
        let reason = 'Waiting for clean story: USD + gold confirm + at a key level.';

        const newsLocked = isNewsLockedNow();

        if(!sessionOn){
          reason = 'Session is OFF. Tap “Start Session” when you are ready to trade.';
        } else if(newsLocked){
          decision = 'NO';
          reason = 'NEWS LOCK is ON (' + (news.label||'High-impact USD news') + '). Wait until the block window ends.';
        } else if(lockedDir && proposed && lockedDir !== proposed){
          reason = 'Direction locked to ' + lockedDir + ' ONLY. Market bias disagrees. End session or wait.';
        } else if(usd.state === 'UNCLEAR'){
          reason = 'USD pressure unclear (EURUSD not moving enough). Wait.';
        } else if(!gold.ok){
          reason = 'Gold not confirming USD bias (choppy). Wait for a clean push.';
        } else if(loc.okDir === null){
          reason = 'Price is MID-RANGE (not at Support/Resistance). Wait.';
        } else if(loc.okDir !== proposed){
          reason = 'At ' + loc.loc + ', but direction doesn’t match. No counter-trend.';
        } else {
          decision = proposed;
          reason = (proposed === 'BUY')
            ? 'USD weak + gold bullish + at SUPPORT. Look for BUY setups only.'
            : 'USD strong + gold bearish + at RESISTANCE. Look for SELL setups only.';
        }

        // Auto-lock on first clean signal
        if(sessionOn && autoLockOn && !lockedDir && lockRule === 'signal'){
          if(score >= lockMinScore && (decision === 'BUY' || decision === 'SELL')){
            lockedDir = decision;
            updateSessionUI();
            updateABUI();
            toast('🔒 Direction locked: ' + lockedDir);
          }
        }

        // Sentiment filter
        if(decision === 'BUY' || decision === 'SELL'){
          if(!sentimentAllows(decision)){
            decision = 'NO';
            reason = 'Sentiment filter blocked this direction (crowded side).';
          }
        }

        // Ticket only when 4/4 & actionable
        let ticket = null;
        if((decision === 'BUY' || decision === 'SELL') && score >= 4){
          ticket = buildTicket(decision, price, near.sup, near.res);
        }
        window.__LAST_TICKET = ticket;
        setTicketUI(ticket);

        setDecision(decision, reason, score);

        // Alerts
        maybeAlert(decision, loc.loc, price);
        softAlert(decision, reason, score, loc.loc, newsLocked);

        if(ui.lastUpdate) ui.lastUpdate.textContent = 'Last update: ' + new Date().toLocaleString();
        save();
      }catch(err){
        console.error(err);
        setConn(false);
        setDecision('NO', 'Refresh failed. Check internet, Worker, or rate limits.', 0);
        if(ui.lastUpdate) ui.lastUpdate.textContent = 'Last update: —';
      }
    }

    function startSession(){
      sessionOn = true;
      lockedDir = null;
      updateSessionUI();
      save();
      refresh();
    }

    function endSession(){
      sessionOn = false;
      lockedDir = null;
      updateSessionUI();
      save();
    }

    // ---------- init ----------
    if(ui.today) ui.today.textContent = new Date().toLocaleDateString();
    const jsStatus = $('jsStatus'); if(jsStatus) jsStatus.textContent = 'JS: loaded ✅';

    restore();
    updateSessionUI();
    updateAlertsUI();
    updateNewsUI();
    updateABUI();
    setAuto();

    applyTheme(themeMode);
    on(ui.themeBtn,'click', ()=> {
      applyTheme(themeMode === 'light' ? 'dark' : 'light');
      try{ renderGoldStrengthFromM15(window.__LAST_M15 || []); }catch(e){}
    });

    setupInstall();
    registerSW();
    on(ui.resetBtn,'click', ()=> nukeCachesAndSW());

    // If you ever get stuck on an older version, open ?reset=1
    try{
      const u = new URL(location.href);
      if(u.searchParams.get('reset') === '1'){
        nukeCachesAndSW();
        return;
      }
    }catch(e){}

    on(ui.refresh,'click',refresh);
    on(ui.start,'click',startSession);
    on(ui.end,'click',endSession);

    on(ui.threshold,'change',()=>{ save(); refresh(); });
    on(ui.levelDistance,'change',()=>{ save(); refresh(); });
    on(ui.levelsLookback,'change',()=>{ save(); refresh(); });
    on(ui.autoRefresh,'change',()=>{ setAuto(); refresh(); });

    // A+B controls
    on(ui.softAlerts,'change', ()=>{
      softAlertsOn = ui.softAlerts.value === 'on';
      updateABUI(); save();
    });
    on(ui.softCooldown,'change', ()=>{
      softCooldownSec = parseInt(ui.softCooldown.value||'60',10);
      updateABUI(); save();
    });
    on(ui.autoLock,'change', ()=>{
      autoLockOn = ui.autoLock.value === 'on';
      if(!autoLockOn){ lockedDir = null; updateSessionUI(); }
      updateABUI(); save();
    });
    on(ui.lockRule,'change', ()=>{
      lockRule = ui.lockRule.value || 'signal';
      updateABUI(); save();
    });
    on(ui.lockMinScore,'change', ()=>{
      lockMinScore = parseInt(ui.lockMinScore.value||'4',10);
      updateABUI(); save();
    });
    on(ui.minScore,'change', ()=>{
      softMinScore = parseInt(ui.minScore.value||'4',10);
      updateABUI(); save();
    });
    on(ui.levelAlerts,'change', ()=>{
      levelAlertsOn = ui.levelAlerts.value === 'on';
      updateABUI(); save();
    });

    // Alerts
    on(ui.alertsToggle,'change', async ()=>{
      alertsOn = ui.alertsToggle.value === 'on';
      if(alertsOn) await ensureNotificationPermission();
      updateAlertsUI(); save();
    });
    on(ui.alertCooldown,'change', ()=>{
      alertCooldownSec = parseInt(ui.alertCooldown.value||'120',10);
      updateAlertsUI(); save();
    });

    // News
    on(ui.newsPre,'change', ()=>{ news.pre = parseInt(ui.newsPre.value||'60',10); updateNewsUI(); save(); });
    on(ui.newsPost,'change', ()=>{ news.post = parseInt(ui.newsPost.value||'60',10); updateNewsUI(); save(); });

    on(ui.saveNews,'click', ()=>{
      news.dtLocal = ui.newsEvent.value || null;
      news.label = (ui.newsLabel.value||'').trim();
      updateNewsUI(); save(); toast('News event saved');
    });
    on(ui.clearNews,'click', ()=>{
      news.dtLocal = null; news.label='';
      ui.newsEvent.value=''; ui.newsLabel.value='';
      updateNewsUI(); save(); toast('News event cleared');
    });

    on(ui.newsAuto,'change', ()=>{
      newsAuto = ui.newsAuto.value === 'on';
      updateNewsUI(); save();
      if(newsAuto) autoLoadNews(true);
    });
    on(ui.loadNews,'click', ()=> autoLoadNews(true));
    on(ui.newsUpcoming,'change', ()=>{
      const i = parseInt(ui.newsUpcoming.value||'0',10);
      if(upcomingUsd[i]) applyEvent(upcomingUsd[i]);
    });

    // Resize chart
    window.addEventListener('resize', ()=> {
      try{ renderGoldStrengthFromM15(window.__LAST_M15 || []); }catch(e){}
    });

    autoLoadNews(false);
    bindLateUI();

    // Sentiment
    fetchSentiment();
    const ssec = parseInt(C.SENTIMENT_REFRESH_SECONDS || 120, 10);
    if(ssec){
      if(sentimentTimer) clearInterval(sentimentTimer);
      sentimentTimer = setInterval(fetchSentiment, ssec*1000);
    }

    on(ui.sentRule,'change', ()=>{
      sentimentRule = ui.sentRule.value || 'info';
      updateSentimentUI(true);
      save();
      refresh();
    });

    on(ui.copyTicket,'click', async ()=>{
      try{
        const t = window.__LAST_TICKET || null;
        if(!t){ toast('No ticket yet'); return; }
        await navigator.clipboard.writeText(ticketText(t));
        toast('Ticket copied ✅');
      }catch(e){ toast('Copy failed'); }
    });

    on(ui.openXM,'click', ()=>{
      window.open('https://www.xm.com/', '_blank');
    });

    // First refresh
    refresh();
  }catch(e){
    console.error(e);
    const s=document.getElementById('jsStatus'); if(s) s.textContent='JS error ❌';
  }
})();


// =====================================================
// Sentiment IG-style (visual only) — SAFE if IDs missing
// =====================================================
function _pct(n){
  const x = Number(n);
  if(!isFinite(x)) return 0;
  return Math.max(0, Math.min(100, x));
}
function _crowdLabel(longPct){
  const lp = _pct(longPct);
  const sp = 100 - lp;
  if(lp >= 70) return {text:'LONG HEAVY', tone:'amber'};
  if(sp >= 70) return {text:'SHORT HEAVY', tone:'amber'};
  if(lp >= 60 || sp >= 60) return {text:'SLIGHT CROWD', tone:'gray'};
  return {text:'BALANCED', tone:'gray'};
}
function applySentimentIG(longPct, shortPct, clients){
  const donut = document.getElementById('sentDonut');
  const dom = document.getElementById('sentDominant');
  const domLbl = document.getElementById('sentDominantLabel');
  const crowdPill = document.getElementById('sentCrowdPill');
  const crowdText = document.getElementById('sentCrowdText');
  const clientsEl = document.getElementById('sentClients');

  const lp = _pct(longPct);
  const sp = _pct(shortPct);
  const deg = (lp/100)*360;

  if(donut){
    donut.style.background =
      `conic-gradient(#60A5FA 0deg, #60A5FA ${deg}deg, #F87171 ${deg}deg, #F87171 360deg)`;
  }
  if(dom) dom.textContent = (lp >= sp) ? `${lp.toFixed(0)}%` : `${sp.toFixed(0)}%`;
  if(domLbl) domLbl.textContent = (lp >= sp) ? 'LONG' : 'SHORT';

  const c = _crowdLabel(lp);
  if(crowdText) crowdText.textContent = c.text;
  if(crowdPill){
    crowdPill.classList.remove('amber','gray','red','blue','green');
    crowdPill.classList.add(c.tone);
  }
  if(clientsEl){
    clientsEl.textContent = (clients != null && clients !== '') ? String(clients) : (clientsEl.textContent || '—');
  }
}

// Fallback mirror: reads your sentLong/sentShort text
function applySentimentIGFallback(){
  try{
    const L = document.getElementById('sentLong')?.textContent || '';
    const S = document.getElementById('sentShort')?.textContent || '';
    const lp = parseFloat(L.replace('%',''));
    const sp = parseFloat(S.replace('%',''));
    const c  = document.getElementById('sentClients')?.textContent || '—';
    if(isFinite(lp) && isFinite(sp)){
      applySentimentIG(lp, sp, c);
    }
  }catch(e){}
}
setInterval(applySentimentIGFallback, 1500);