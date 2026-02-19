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
    entry: $('entry'), sl: $('sl'), tp: $('tp'), rrHint: $('rrHint'),
    today: $('today'), refresh: $('refresh'), start: $('start'), end: $('end')
  };

  let sessionOn = false;
  let lockedDir = null;
  let autoTimer = null;

  function pill(el, cls){ el.classList.remove('green','red','blue','amber','gray'); if(cls) el.classList.add(cls); }
  function setConn(ok){ pill(ui.conn, ok ? 'blue' : 'red'); ui.conn.innerHTML = '<strong>' + (ok ? 'ONLINE' : 'OFFLINE') + '</strong>'; }

  function fmtPrice(x){ return (x===null || x===undefined || !isFinite(x)) ? '—' : x.toFixed(2); }
  function fmtPct(x){ return (!isFinite(x)) ? '—' : (x*100).toFixed(2) + '%'; }
  function pctMove(newest, oldest){ if(!oldest) return 0; return (newest - oldest) / oldest; }

  async function tdTimeSeries(symbol, interval, outputsize){
    // Uses Cloudflare Worker proxy if configured (recommended).
    const proxy = (C.PROXY_URL||'').trim();
    const key = (C.TWELVEDATA_KEY||'').trim();

    let url;
    if(proxy){
      url = new URL(proxy.replace(/\/$/,'') + '/time_series');
      url.searchParams.set('symbol', symbol);
      url.searchParams.set('interval', interval);
      url.searchParams.set('outputsize', String(outputsize));
    } else {
      if(!key || key.includes('PASTE_')) throw new Error('Missing PROXY_URL or Twelve Data key in config.js');
      url = new URL('https://api.twelvedata.com/time_series');
      url.searchParams.set('symbol', symbol);
      url.searchParams.set('interval', interval);
      url.searchParams.set('outputsize', String(outputsize));
      url.searchParams.set('apikey', key);
    }

    const res = await fetch(url.toString(), { cache: 'no-store' });
    const data = await res.json();
    if(data.status !== 'ok') throw new Error(data.message || 'Twelve Data error');
    return data.values.map(v => ({ datetime:v.datetime, open:+v.open, high:+v.high, low:+v.low, close:+v.close })); // newest-first
  }


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
    const arr = bars.slice().reverse();
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

  function computeRR(){
    const e = parseFloat(ui.entry.value), sl = parseFloat(ui.sl.value), tp = parseFloat(ui.tp.value);
    if([e,sl,tp].some(x=>Number.isNaN(x))) { ui.rrHint.textContent = 'RR: —'; return; }
    const risk = Math.abs(e - sl), reward = Math.abs(tp - e);
    if(risk === 0){ ui.rrHint.textContent = 'RR: —'; return; }
    ui.rrHint.textContent = 'RR: ' + (reward / risk).toFixed(2) + ' (target ≥ 2.00)';
  }

  function parseISOish(s){
    const t = (s||'').replace(' ', 'T');
    const d = new Date(t + (t.endsWith('Z') ? '' : 'Z'));
    return isNaN(d.getTime()) ? null : d;
  }
  function toTZ(d){ const off = Number(C.TZ_OFFSET_MINUTES||0); return new Date(d.getTime() + off*60000); }
  function timeToMinutes(hhmm){ const [h,m]=hhmm.split(':').map(n=>parseInt(n,10)); return h*60+m; }
  function dayKeyTZ(d){
    const z = toTZ(d);
    const y = z.getUTCFullYear();
    const m = String(z.getUTCMonth()+1).padStart(2,'0');
    const da = String(z.getUTCDate()).padStart(2,'0');
    return `${y}-${m}-${da}`;
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

  function setSessionUI(price, yHigh, yLow, lon, ny){
    const yHighDist = (yHigh===null) ? Infinity : (Math.abs(yHigh - price)/price);
    const yLowDist  = (yLow===null) ? Infinity : (Math.abs(price - yLow)/price);
    ui.yHigh.textContent = fmtPrice(yHigh);
    ui.yLow.textContent = fmtPrice(yLow);
    ui.yHighDist.textContent = 'Distance: ' + fmtPct(yHighDist);
    ui.yLowDist.textContent  = 'Distance: ' + fmtPct(yLowDist);

    ui.lonRange.textContent = (lon.hi && lon.lo) ? (fmtPrice(lon.hi) + ' / ' + fmtPrice(lon.lo)) : '—';
    ui.nyRange.textContent  = (ny.hi && ny.lo) ? (fmtPrice(ny.hi) + ' / ' + fmtPrice(ny.lo)) : '—';

    const lonMin = Math.min((lon.hi===null?Infinity:Math.abs(lon.hi-price)/price),(lon.lo===null?Infinity:Math.abs(price-lon.lo)/price));
    const nyMin  = Math.min((ny.hi===null?Infinity:Math.abs(ny.hi-price)/price),(ny.lo===null?Infinity:Math.abs(price-ny.lo)/price));
    ui.lonDist.textContent = 'Distance: ' + fmtPct(lonMin);
    ui.nyDist.textContent  = 'Distance: ' + fmtPct(nyMin);

    const off = Number(C.TZ_OFFSET_MINUTES||0);
    const sign = off>=0 ? '+' : '-';
    const hh = String(Math.floor(Math.abs(off)/60)).padStart(2,'0');
    const mm = String(Math.abs(off)%60).padStart(2,'0');
    ui.tzLabel.textContent = off===0 ? 'UTC' : ('UTC' + sign + hh + ':' + mm);
  }

  function save(){
    try{
      localStorage.setItem('gold_sniper_v22', JSON.stringify({
        sessionOn, lockedDir,
        threshold: ui.threshold.value,
        levelDistance: ui.levelDistance.value,
        autoRefresh: ui.autoRefresh.value,
        levelsLookback: ui.levelsLookback.value,
        entry: ui.entry.value, sl: ui.sl.value, tp: ui.tp.value
      }));
    }catch(e){}
  }
  function restore(){
    try{
      const s = JSON.parse(localStorage.getItem('gold_sniper_v22') || '{}');
      if(typeof s.sessionOn === 'boolean') sessionOn = s.sessionOn;
      if(s.lockedDir) lockedDir = s.lockedDir;
      if(s.threshold) ui.threshold.value = s.threshold;
      if(s.levelDistance) ui.levelDistance.value = s.levelDistance;
      if(s.autoRefresh) ui.autoRefresh.value = s.autoRefresh;
      if(s.levelsLookback) ui.levelsLookback.value = s.levelsLookback;
      if(typeof s.entry === 'string') ui.entry.value = s.entry;
      if(typeof s.sl === 'string') ui.sl.value = s.sl;
      if(typeof s.tp === 'string') ui.tp.value = s.tp;
    }catch(e){}
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
    const supDistPct = (sup===null) ? Infinity : (Math.abs(price - sup)/price);
    const resDistPct = (res===null) ? Infinity : (Math.abs(res - price)/price);
    ui.supDist.textContent = 'Distance: ' + fmtPct(supDistPct);
    ui.resDist.textContent = 'Distance: ' + fmtPct(resDistPct);
    const loc = locationStatus(price, sup, res, lvlPct);
    ui.locState.textContent = loc.loc;
    pill(ui.locPill, loc.cls);
    ui.levelState.textContent = loc.loc;
    pill(ui.levelPill, loc.cls);
    return loc;
  }

  async function refresh(){
    setConn(true);
    const th = parseFloat(ui.threshold.value || '0.0006');
    const lvlPct = parseFloat(ui.levelDistance.value || '0.0015');
    const h1Bars = parseInt(ui.levelsLookback.value || '72', 10);
    const m15Bars = 96;
    const yBars = 200;
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
        tdTimeSeries(C.GOLD_SYMBOL || 'XAU/USD', C.LEVELS_M15_INTERVAL || '15min', yBars),
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

      setSessionUI(price, y.yHigh, y.yLow, lon, ny);

      resistances = resistances.concat([y.yHigh, lon.hi, ny.hi].filter(v=>v!==null && isFinite(v)));
      supports    = supports.concat([y.yLow, lon.lo, ny.lo].filter(v=>v!==null && isFinite(v)));

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
      let reason = 'Waiting for clean story: USD pressure + gold confirm + at a key level.';
      if(!sessionOn) reason = 'Session is OFF. Tap “Start Session” when you are ready to trade.';
      else if(lockedDir && proposed && lockedDir !== proposed) reason = 'Direction is locked to ' + lockedDir + ' ONLY. Market bias disagrees. End session or wait.';
      else if(usd.state === 'UNCLEAR') reason = 'USD pressure is unclear (EURUSD not moving enough). Wait.';
      else if(!gold.ok) reason = 'Gold is not confirming USD bias (choppy). Wait for a clean push.';
      else if(loc.okDir === null) reason = 'Price is MID-RANGE (not at Support/Resistance). Wait for a key level touch.';
      else if(loc.okDir !== proposed) reason = 'Price is at ' + loc.loc + ', but direction doesn’t match. Wait (no counter-trend).';
      else { decision = proposed; reason = (proposed === 'BUY') ? 'USD weak + gold bullish + at SUPPORT. Look for BUY setups only.' : 'USD strong + gold bearish + at RESISTANCE. Look for SELL setups only.'; }

      setDecision(decision, reason, score);
      ui.lastUpdate.textContent = 'Last update: ' + new Date().toLocaleString();
      save();
    }catch(err){
      console.error(err);
      setConn(false);
      setDecision('NO', 'Refresh failed. Check API key, internet, or rate limits.', 0);
      ui.lastUpdate.textContent = 'Last update: —';
    }
  }

  function startSession(){ sessionOn = true; updateSessionUI(); save(); refresh(); }
  function endSession(){ sessionOn = false; lockedDir = null; updateSessionUI(); save(); }

  function setAuto(){
    const sec = parseInt(ui.autoRefresh.value || '0', 10);
    if(autoTimer) { clearInterval(autoTimer); autoTimer = null; }
    ui.autoLabel.textContent = sec ? (sec + 's') : 'Off';
    if(sec) autoTimer = setInterval(refresh, sec*1000);
    save();
  }

  ui.today.textContent = new Date().toLocaleDateString();
  restore();
  computeRR();
  updateSessionUI();
  setAuto();

  ui.refresh.addEventListener('click', refresh);
  ui.start.addEventListener('click', startSession);
  ui.end.addEventListener('click', endSession);
  ui.threshold.addEventListener('change', ()=>{ save(); refresh(); });
  ui.levelDistance.addEventListener('change', ()=>{ save(); refresh(); });
  ui.levelsLookback.addEventListener('change', ()=>{ save(); refresh(); });
  ui.autoRefresh.addEventListener('change', ()=>{ setAuto(); refresh(); });
  ui.entry.addEventListener('input', ()=>{ computeRR(); save(); });
  ui.sl.addEventListener('input', ()=>{ computeRR(); save(); });
  ui.tp.addEventListener('input', ()=>{ computeRR(); save(); });

  refresh();
})();