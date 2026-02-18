(function(){
  const C = window.CONFIG || {};
  const $ = (id)=>document.getElementById(id);

  const ui = {
    conn: $('conn'),
    lastUpdate: $('lastUpdate'),
    decisionText: $('decisionText'),
    decisionReason: $('decisionReason'),
    usdState: $('usdState'),
    usdDetail: $('usdDetail'),
    goldState: $('goldState'),
    goldDetail: $('goldDetail'),
    sessionState: $('sessionState'),
    dirState: $('dirState'),
    sessionPill: $('sessionPill'),
    dirPill: $('dirPill'),
    scoreVal: $('scoreVal'),
    scorePill: $('scorePill'),
    autoLabel: $('autoLabel'),
    threshold: $('threshold'),
    autoRefresh: $('autoRefresh'),
    entry: $('entry'),
    sl: $('sl'),
    tp: $('tp'),
    rrHint: $('rrHint'),
    today: $('today'),
    refresh: $('refresh'),
    start: $('start'),
    end: $('end')
  };

  let sessionOn = false;
  let lockedDir = null; // 'BUY' | 'SELL'
  let autoTimer = null;

  function pill(el, cls){
    el.classList.remove('green','red','blue','amber');
    if(cls) el.classList.add(cls);
  }

  function setConn(ok){
    pill(ui.conn, ok ? 'blue' : 'red');
    ui.conn.innerHTML = '<strong>' + (ok ? 'ONLINE' : 'OFFLINE') + '</strong>';
  }

  function pctMove(newest, oldest){
    if(!oldest) return 0;
    return (newest - oldest) / oldest;
  }

  async function tdTimeSeries(symbol){
    const key = (C.TWELVEDATA_KEY||'').trim();
    if(!key || key.includes('PASTE_')) throw new Error('Missing Twelve Data key in config.js');
    const url = new URL('https://api.twelvedata.com/time_series');
    url.searchParams.set('symbol', symbol);
    url.searchParams.set('interval', C.INTERVAL || '5min');
    url.searchParams.set('outputsize', String(C.LOOKBACK_BARS || 12));
    url.searchParams.set('apikey', key);
    const res = await fetch(url.toString(), { cache: 'no-store' });
    const data = await res.json();
    if(data.status !== 'ok') throw new Error(data.message || 'Twelve Data error');
    return data.values.map(v => Number(v.close)); // newest-first
  }

  function classifyUSD(eurPct, th){
    if(eurPct <= -th) return { state:'STRONG', dir:'SELL' };
    if(eurPct >=  th) return { state:'WEAK', dir:'BUY' };
    return { state:'UNCLEAR', dir:null };
  }

  function classifyGold(goldPct, usdDir, th){
    if(!usdDir) return { state:'UNCLEAR', ok:false };
    if(usdDir === 'SELL') return { state: (goldPct <= -th ? 'BEARISH' : 'CHOPPY'), ok: goldPct <= -th };
    if(usdDir === 'BUY')  return { state: (goldPct >=  th ? 'BULLISH' : 'CHOPPY'), ok: goldPct >=  th };
    return { state:'UNCLEAR', ok:false };
  }

  function computeRR(){
    const e = parseFloat(ui.entry.value);
    const sl = parseFloat(ui.sl.value);
    const tp = parseFloat(ui.tp.value);
    if([e,sl,tp].some(x=>Number.isNaN(x))) { ui.rrHint.textContent = 'RR: —'; return; }
    const risk = Math.abs(e - sl);
    const reward = Math.abs(tp - e);
    if(risk === 0){ ui.rrHint.textContent = 'RR: —'; return; }
    ui.rrHint.textContent = 'RR: ' + (reward / risk).toFixed(2) + ' (target ≥ 2.00)';
  }

  function save(){
    try{
      localStorage.setItem('gold_sniper_v2', JSON.stringify({
        sessionOn, lockedDir,
        threshold: ui.threshold.value,
        autoRefresh: ui.autoRefresh.value,
        entry: ui.entry.value, sl: ui.sl.value, tp: ui.tp.value
      }));
    }catch(e){}
  }

  function restore(){
    try{
      const s = JSON.parse(localStorage.getItem('gold_sniper_v2') || '{}');
      if(typeof s.sessionOn === 'boolean') sessionOn = s.sessionOn;
      if(s.lockedDir) lockedDir = s.lockedDir;
      if(s.threshold) ui.threshold.value = s.threshold;
      if(s.autoRefresh) ui.autoRefresh.value = s.autoRefresh;
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
    if(type === 'BUY'){
      ui.decisionText.textContent = '✅ BUY GOLD';
      ui.decisionText.style.color = '#34D399';
    } else if(type === 'SELL'){
      ui.decisionText.textContent = '✅ SELL GOLD';
      ui.decisionText.style.color = '#FCA5A5';
    } else {
      ui.decisionText.textContent = '⛔ NO TRADE';
      ui.decisionText.style.color = '#E5E7EB';
    }
    ui.decisionReason.textContent = reason;
    ui.scoreVal.textContent = score + '/3';
    pill(ui.scorePill, score >= 3 ? 'green' : score === 2 ? 'amber' : 'red');
  }

  async function refresh(){
    setConn(true);
    const th = parseFloat(ui.threshold.value || '0.0006');

    try{
      const [eurCloses, goldCloses] = await Promise.all([
        tdTimeSeries(C.USD_PROXY_SYMBOL || 'EUR/USD'),
        tdTimeSeries(C.GOLD_SYMBOL || 'XAU/USD')
      ]);

      const eurPct = pctMove(eurCloses[0], eurCloses[eurCloses.length-1]);
      const goldPct = pctMove(goldCloses[0], goldCloses[goldCloses.length-1]);

      const usd = classifyUSD(eurPct, th);
      const gold = classifyGold(goldPct, usd.dir, th);

      ui.usdState.textContent = usd.state;
      ui.usdDetail.textContent = 'EURUSD (60m): ' + (eurPct*100).toFixed(2) + '%';

      ui.goldState.textContent = gold.state;
      ui.goldDetail.textContent = 'XAUUSD (60m): ' + (goldPct*100).toFixed(2) + '%';

      let score = 0;
      if(usd.state !== 'UNCLEAR') score++;
      if(gold.ok) score++;
      const proposed = usd.dir; // BUY or SELL
      const sessionOk = sessionOn && (lockedDir ? lockedDir === proposed : true);
      if(sessionOk) score++;

      if(sessionOn && !lockedDir && proposed && score >= 2){
        lockedDir = proposed;
        updateSessionUI();
      }

      let decision = 'NO';
      let reason = 'Waiting for clear USD pressure + gold confirmation.';

      if(!sessionOn){
        reason = 'Session is OFF. Tap “Start Session” when you are ready to trade.';
      } else if(lockedDir && proposed && lockedDir !== proposed){
        reason = 'Direction is locked to ' + lockedDir + ' ONLY. Market bias disagrees. End session or wait.';
      } else if(usd.state === 'UNCLEAR'){
        reason = 'USD pressure is unclear (EURUSD not moving enough). Wait.';
      } else if(!gold.ok){
        reason = 'Gold is not confirming the USD bias (choppy). Wait for a clean push.';
      } else {
        decision = proposed;
        reason = (proposed === 'BUY')
          ? 'USD is weak and gold is bullish. Look for BUY setups only.'
          : 'USD is strong and gold is bearish. Look for SELL setups only.';
      }

      setDecision(decision, reason, score);
      ui.lastUpdate.textContent = 'Last update: ' + new Date().toLocaleString();
      save();
    }catch(err){
      console.error(err);
      setConn(false);
      setDecision('NO', 'Auto refresh failed. Check API key, internet, or rate limits.', 0);
    }
  }

  function startSession(){
    sessionOn = true;
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
  ui.autoRefresh.addEventListener('change', ()=>{ setAuto(); refresh(); });
  ui.entry.addEventListener('input', ()=>{ computeRR(); save(); });
  ui.sl.addEventListener('input', ()=>{ computeRR(); save(); });
  ui.tp.addEventListener('input', ()=>{ computeRR(); save(); });

  refresh();
})();