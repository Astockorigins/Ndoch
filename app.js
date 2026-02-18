(function(){
  const C = window.CONFIG;
  const b = {
    dxy: document.getElementById('dxy'),
    gold: document.getElementById('gold'),
    gbp: document.getElementById('gbp'),
    news: document.getElementById('news')
  };
  const scoreEl = document.getElementById('score');
  const decEl = document.getElementById('decision');
  const lastEl = document.getElementById('lastUpdate');

  function score(){
    const s = Object.values(b).reduce((n,x)=>n+(x.checked?1:0),0);
    scoreEl.textContent = s+" / 4";
    decEl.className="badge "+(s>=3?"ok":s==2?"mid":"no");
    decEl.textContent = s>=3?"✅ TRADE":s==2?"⚠️ SMALL LOT":"❌ NO TRADE";
  }

  async function fetchTS(sym){
    const u = new URL("https://api.twelvedata.com/time_series");
    u.searchParams.set("symbol", sym);
    u.searchParams.set("interval", C.INTERVAL);
    u.searchParams.set("outputsize", C.LOOKBACK_BARS);
    u.searchParams.set("apikey", C.TWELVEDATA_KEY);
    const r = await fetch(u);
    const j = await r.json();
    return j.values.map(v=>+v.close);
  }

  function delta(v){return v[0]-v[v.length-1];}

  async function refresh(){
    try{
      const [e,g,x]=await Promise.all([
        fetchTS("EUR/USD"),fetchTS("GBP/USD"),fetchTS("XAU/USD")
      ]);
      const usdStrong = delta(e)<0 && delta(g)<0;
      const usdWeak = delta(e)>0 && delta(g)>0;
      b.dxy.checked = usdStrong||usdWeak;
      b.gbp.checked = usdStrong?delta(g)<0:usdWeak?delta(g)>0:false;
      b.gold.checked = usdStrong?delta(x)<0:usdWeak?delta(x)>0:false;
      lastEl.textContent="Last update: "+new Date().toLocaleString();
      score();
    }catch(e){alert("Check API key or internet");}
  }

  document.getElementById("refresh").onclick=refresh;
  document.getElementById("reset").onclick=()=>{Object.values(b).forEach(x=>x.checked=false);score();};
  Object.values(b).forEach(x=>x.onchange=score);
  score();
})();