/**
 * Cloudflare Worker patch for Gold Sniper (v2.5.0)
 * Add this route to your Worker that already proxies TwelveData.
 *
 * New endpoint:
 *   GET /sentiment?symbol=XAUUSD
 *
 * It fetches Myfxbook Community Outlook HTML and extracts long/short % and lots.
 * Source example: https://www.myfxbook.com/community/outlook/XAUUSD
 */
async function handleSentiment(request){
  const url = new URL(request.url);
  const symbol = (url.searchParams.get('symbol') || 'XAUUSD').toUpperCase();

  const target = `https://www.myfxbook.com/community/outlook/${encodeURIComponent(symbol)}`;
  const res = await fetch(target, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; GoldSniper/1.0)',
      'Accept': 'text/html'
    }
  });
  if(!res.ok){
    return new Response(JSON.stringify({status:'error', message:'Myfxbook fetch failed', code: res.status}), {
      headers: {'content-type':'application/json','access-control-allow-origin':'*'}
    });
  }
  const html = await res.text();

  function pick(action){
    const re = new RegExp(action + String.raw`\s*<\/td>\s*<td[^>]*>\s*([0-9]+)\s*%[\s\S]*?<td[^>]*>\s*([0-9.,]+)\s*lots`, 'i');
    const m = html.match(re);
    if(m) return { pct: Number(m[1]), lots: Number(String(m[2]).replace(/,/g,'')) };
    const re2 = new RegExp(action + String.raw`\s*([0-9]+)\s*%\s*([0-9.,]+)\s*lots`, 'i');
    const m2 = html.match(re2);
    if(m2) return { pct: Number(m2[1]), lots: Number(String(m2[2]).replace(/,/g,'')) };
    return { pct: null, lots: null };
  }

  const sh = pick('Short');
  const lo = pick('Long');

  return new Response(JSON.stringify({
    status: 'ok',
    symbol,
    longPct: lo.pct,
    shortPct: sh.pct,
    longLots: lo.lots,
    shortLots: sh.lots,
    updated: new Date().toISOString()
  }), { headers: {'content-type':'application/json','access-control-allow-origin':'*'} });
}

// In your main fetch router add:
// if (url.pathname === '/sentiment') return handleSentiment(request);
