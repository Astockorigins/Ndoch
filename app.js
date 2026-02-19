(function(){
  const C = window.CONFIG || {};
  const $ = (id)=>document.getElementById(id);

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

  function timeToMinutes(hhmm){ const [h,m]=hhmm.split(':').map(n=>parseInt(n,10)); return h*60+m; }

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
    ui.yHigh.textContent = fmtPrice(yHigh);
    ui.yLow.textContent = fmtPrice(yLow);
    ui.yHighDist.textContent = 'Distance: ' + fmtPct(yHigh===null?Infinity:Math.abs(yHigh-price)/price);
    ui.yLowDist.textContent  = 'Distance: ' + fmtPct(yLow===null?Infinity:Math.abs(price-yLow)/price);

    ui.lonRange.textContent = (lon.hi && lon.lo) ? (fmtPrice(lon.hi) + ' / ' + fmtPrice(lon.lo)) : '—';
    ui.nyRange.textContent  = (ny.hi && ny.lo) ? (fmtPrice(ny.hi) + ' / ' + fmtPrice(ny.lo)) : '—';

    const lonMin = Math.min((lon.hi===null?Infinity:Math.abs(lon.hi-price)/price),(lon.lo===null?Infinity:Math.abs(price-lon.lo)/price));
    const nyMin  = Math.min((ny.hi===null?Infinity:Math.abs(ny.hi-price)/price),(ny.lo===null?Infinity:Math.abs(price-ny.lo)/price));
    ui.lonDist.textContent = 'Distance: ' + fmtPct(lonMin);
    ui.nyDist.textContent  = 'Distance: ' + fmtPct(nyMin);
  }

  function updateSessionUI(){
    ui.sessionState.textContent = sessionOn ? 'ON' : 'OFF';
    ui.dirState.textContent = lockedDir ? (lockedDir + ' ONLY 🔒') : '—';
    pill(ui.sessionPill, sessionOn ? 'green' : 'amber');
    pill(ui.dirPill, lockedDir ? (lockedDir === 'BUY' ? 'green' : 'red') : 'amber');
    ui.start.disabled = sessionOn;
    ui.end.disabled = !sessionOn;
  }

  function setDecision(type, reason, score){
    if(type === 'BUY'){ ui.decisionText.textContent = '✅ BUY GOLD'; ui.decisionText.style.color = '#34D399'; }
    else if(type === 'SELL'){ ui.decisionText.textContent = '✅ SELL GOLD'; ui.decisionText.style.color = '#FCA5A5'; }
    else { ui.decisionText.textContent = '⛔ NO TRADE'; ui.decisionText.style.color = '#E5E7EB'; }
    ui.decisionReason.textContent = reason;
    ui.scoreVal.textContent = score + '/4';
    pill(ui.scorePill, score >= 4 ? 'green' : score === 3 ? 'amber' : 'red');
  }

  function setLevelUI(price, sup, res, lvlPct){
    ui.priceNow.textContent = fmtPrice(price);
    ui.supLevel.textContent = fmtPrice(sup);
    ui.resLevel.textContent = fmtPrice(res);
    ui.supDist.textContent = 'Distance: ' + fmtPct(sup===null?Infinity:Math.abs(price-sup)/price);
    ui.resDist.textContent = 'Distance: ' + fmtPct(res===null?Infinity:Math.abs(res-price)/price);
    const loc = locationStatus(price, sup, res, lvlPct);
    ui.locState.textContent = loc.loc;
    pill(ui.locPill, loc.cls);
    ui.levelState.textContent = loc.loc;
    pill(ui.levelPill, loc.cls);
    return loc;
  }

  function updateAlertsUI(){
    ui.alertsToggle.value = alertsOn ? 'on' : 'off';
    ui.alertCooldown.value = String(alertCooldownSec);
    ui.alertStatus.textContent = alertsOn ? 'On' : 'Off';
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

  function updateNewsUI(){
    ui.newsPre.value = String(news.pre||60);
    ui.newsPost.value = String(news.post||60);
    ui.newsLabel.value = news.label || '';
    ui.newsEvent.value = news.dtLocal || '';
    ui.newsAuto.value = newsAuto ? 'on' : 'off';

    const locked = isNewsLockedNow();
    ui.newsLockState.textContent = locked ? 'ON' : 'OFF';
    pill(ui.newsPill, locked ? 'red' : 'green');
    ui.newsHint.textContent = news.dtLocal ? ('Saved: ' + (news.label||'Event') + ' @ ' + news.dtLocal.replace('T',' ') + ' (KE).') : 'No event saved.';
  }

  function updateUpcomingDropdown(){
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
        threshold: ui.threshold.value,
        levelDistance: ui.levelDistance.value,
        autoRefresh: ui.autoRefresh.value,
        levelsLookback: ui.levelsLookback.value,
        alertsOn, alertCooldownSec,
        news, newsAuto
      }));
    }catch(e){}
  }

  function restore(){
    try{
      const s = JSON.parse(localStorage.getItem('gold_sniper_v241') || '{}');
      if(typeof s.sessionOn === 'boolean') sessionOn = s.sessionOn;
      if(s.lockedDir) lockedDir = s.lockedDir;

      if(s.threshold) ui.threshold.value = s.threshold;
      if(s.levelDistance) ui.levelDistance.value = s.levelDistance;
      if(s.autoRefresh) ui.autoRefresh.value = s.autoRefresh;
      if(s.levelsLookback) ui.levelsLookback.value = s.levelsLookback;

      if(typeof s.alertsOn === 'boolean') alertsOn = s.alertsOn;
      if(typeof s.alertCooldownSec === 'number') alertCooldownSec = s.alertCooldownSec;

      if(s.news) news = Object.assign(news, s.news);
      if(typeof s.newsAuto === 'boolean') newsAuto = s.newsAuto;
    }catch(e){}
  }

  function setAuto(){
    const sec = parseInt(ui.autoRefresh.value || '0', 10);
    if(autoTimer) { clearInterval(autoTimer); autoTimer = null; }
    ui.autoLabel.textContent = sec ? (sec + 's') : 'Off';
    if(sec) autoTimer = setInterval(refresh, sec*1000);
    save();
  }

  async function refresh(){
    setConn(true);
    const th = parseFloat(ui.threshold.value || '0.0006');
    const lvlPct = parseFloat(ui.levelDistance.value || '0.0015');
    const h1Bars = parseInt(ui.levelsLookback.value || '72', 10);
    const m15Bars = 96;
    const m15LongBars = 220;

    try{
      const [eurTrend, goldTrend] = await Promise.all([
        tdTimeSeries(C.USD_PROXY_SYMBOL || 'EUR/USD', C.TREND_INTERVAL || '5min', C.TREND_LOOKBACK_BARS || 12),
        tdTimeSeries(C.GOLD_SYMBOL || 'XAU/USD', C.TREND_INTERVAL || '5min', C.TREND_LOOKBACK_BARS || 12),
      ]);

      const eurPct = pctMove(eurTrend[0].close, eurTrend[eurTrend.length-1].close);
      const goldPct = pctMove(goldTrend[0].close, goldTrend[goldTrend.length-1].close);
      const usd = classifyUSD(eurPct, th);
      const gold = classifyGold(goldPct, usd.dir, th);

      ui.usdState.textContent = usd.state;
      ui.usdDetail.textContent = 'EURUSD (60m): ' + fmtPct(eurPct);
      ui.goldState.textContent = gold.state;
      ui.goldDetail.textContent = 'XAUUSD (60m): ' + fmtPct(goldPct);

      const price = goldTrend[0].close;

      const [h1, m15, m15Long] = await Promise.all([
        tdTimeSeries(C.GOLD_SYMBOL || 'XAU/USD', C.LEVELS_H1_INTERVAL || '1h', h1Bars),
        tdTimeSeries(C.GOLD_SYMBOL || 'XAU/USD', C.LEVELS_M15_INTERVAL || '15min', m15Bars),
        tdTimeSeries(C.GOLD_SYMBOL || 'XAU/USD', C.LEVELS_M15_INTERVAL || '15min', m15LongBars),
      ]);

      const swH1 = findSwings(h1, 2);
      const swM15 = findSwings(m15, 3);

      const highs = swH1.swingsHigh.concat(swM15.swingsHigh);
      const lows  = swH1.swingsLow.concat(swM15.swingsLow);

      const clusterBand = 0.0010;
      let resistances = clusterLevels(highs, price, clusterBand);
      let supports    = clusterLevels(lows,  price, clusterBand);

      const y = computeYesterdayHighLow(m15Long);
      const dNow = parseISOish(m15Long[0].datetime);
      const todayKey = dNow ? dayKeyTZ(dNow) : null;

      const lon = todayKey ? computeSessionRange(m15Long, todayKey, C.LONDON_START || "08:00", Number(C.LONDON_MINUTES||180)) : {hi:null,lo:null};
      const ny  = todayKey ? computeSessionRange(m15Long, todayKey, C.NY_START || "13:30", Number(C.NY_MINUTES||180)) : {hi:null,lo:null};

      setSessionLevelsUI(price, y.yHigh, y.yLow, lon, ny);

      if(isFinite(y.yHigh)) resistances.push(y.yHigh);
      if(isFinite(lon.hi))  resistances.push(lon.hi);
      if(isFinite(ny.hi))   resistances.push(ny.hi);

      if(isFinite(y.yLow)) supports.push(y.yLow);
      if(isFinite(lon.lo)) supports.push(lon.lo);
      if(isFinite(ny.lo))  supports.push(ny.lo);

      const near = pickNearest(price, supports, resistances);
      const loc = setLevelUI(price, near.sup, near.res, lvlPct);

      let score = 0;
      if(usd.state !== 'UNCLEAR') score++;
      if(gold.ok) score++;
      const atLevelOk = (loc.okDir !== null);
      if(atLevelOk) score++;
      const proposed = usd.dir;
      const sessionOk = sessionOn && (lockedDir ? lockedDir === proposed : true);
      if(sessionOk) score++;

      if(sessionOn && !lockedDir && proposed){
        const lockReady = (usd.state !== 'UNCLEAR') && (gold.ok || atLevelOk);
        if(lockReady){ lockedDir = proposed; updateSessionUI(); }
      }

      let decision = 'NO';
      let reason = 'Waiting for clean story: USD + gold confirm + at a key level.';

      if(!sessionOn){
        reason = 'Session is OFF. Tap “Start Session” when you are ready to trade.';
      } else if(isNewsLockedNow()){
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

      setDecision(decision, reason, score);
      maybeAlert(decision, loc.loc, price);

      ui.lastUpdate.textContent = 'Last update: ' + new Date().toLocaleString();
      save();
    }catch(err){
      console.error(err);
      setConn(false);
      setDecision('NO', 'Refresh failed. Check internet, Worker, or rate limits.', 0);
      ui.lastUpdate.textContent = 'Last update: —';
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

  ui.today.textContent = new Date().toLocaleDateString();
  restore();
  updateSessionUI();
  updateAlertsUI();
  updateNewsUI();
  setAuto();

  ui.refresh.addEventListener('click', refresh);
  ui.start.addEventListener('click', startSession);
  ui.end.addEventListener('click', endSession);

  ui.threshold.addEventListener('change', ()=>{ save(); refresh(); });
  ui.levelDistance.addEventListener('change', ()=>{ save(); refresh(); });
  ui.levelsLookback.addEventListener('change', ()=>{ save(); refresh(); });
  ui.autoRefresh.addEventListener('change', ()=>{ setAuto(); refresh(); });

  ui.alertsToggle.addEventListener('change', async ()=>{
    alertsOn = ui.alertsToggle.value === 'on';
    if(alertsOn) await ensureNotificationPermission();
    updateAlertsUI(); save();
  });
  ui.alertCooldown.addEventListener('change', ()=>{
    alertCooldownSec = parseInt(ui.alertCooldown.value||'120',10);
    updateAlertsUI(); save();
  });

  ui.newsPre.addEventListener('change', ()=>{ news.pre = parseInt(ui.newsPre.value||'60',10); updateNewsUI(); save(); });
  ui.newsPost.addEventListener('change', ()=>{ news.post = parseInt(ui.newsPost.value||'60',10); updateNewsUI(); save(); });

  ui.saveNews.addEventListener('click', ()=>{
    news.dtLocal = ui.newsEvent.value || null;
    news.label = (ui.newsLabel.value||'').trim();
    updateNewsUI(); save(); toast('News event saved');
  });
  ui.clearNews.addEventListener('click', ()=>{
    news.dtLocal = null; news.label='';
    ui.newsEvent.value=''; ui.newsLabel.value='';
    updateNewsUI(); save(); toast('News event cleared');
  });

  ui.newsAuto.addEventListener('change', ()=>{
    newsAuto = ui.newsAuto.value === 'on';
    updateNewsUI(); save();
    if(newsAuto) autoLoadNews(true);
  });
  ui.loadNews.addEventListener('click', ()=> autoLoadNews(true));
  ui.newsUpcoming.addEventListener('change', ()=>{
    const i = parseInt(ui.newsUpcoming.value||'0',10);
    if(upcomingUsd[i]) applyEvent(upcomingUsd[i]);
  });

  autoLoadNews(false);
  refresh();
})();