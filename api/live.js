'use strict';

const fs = require('fs');
const path = require('path');

let cache = { at: 0, data: null };
const TTL = 12 * 60 * 1000;

async function fallbackBriefing() {
  const local = path.join(__dirname, '../public/live/latest.json');
  if (fs.existsSync(local)) return JSON.parse(fs.readFileSync(local, 'utf8'));
  const response = await fetch('https://alux-ai-agent-daily.vercel.app/live/latest.json', {
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) throw new Error(`fallback ${response.status}`);
  return response.json();
}

module.exports = async (req, res) => {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('access-control-allow-origin', '*');
  const now = Date.now();
  if (cache.data && now - cache.at < TTL) {
    res.setHeader('cache-control', 'public, s-maxage=300, stale-while-revalidate=1800');
    return res.status(200).end(JSON.stringify(cache.data));
  }
  try {
    const { collectAll } = require('../scripts/lib/live-collect.cjs');
    const { composeBriefing } = require('../scripts/lib/live-compose.cjs');
    const watchlist = JSON.parse(fs.readFileSync(path.join(__dirname, '../collectors/watchlist.json'), 'utf8'));
    const collected = await Promise.race([
      collectAll(watchlist, { fast: true }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
    ]);
    const briefing = composeBriefing(collected);
    cache = { at: now, data: briefing };
    res.setHeader('cache-control', 'public, s-maxage=300, stale-while-revalidate=1800');
    return res.status(200).end(JSON.stringify(briefing));
  } catch {
    try {
      const briefing = await fallbackBriefing();
      cache = { at: now, data: briefing };
      res.setHeader('cache-control', 'public, s-maxage=120, stale-while-revalidate=1800');
      return res.status(200).end(JSON.stringify(briefing));
    } catch {
      res.setHeader('cache-control', 'no-store');
      return res.status(503).end(JSON.stringify({ ok: false, error: 'live radar unavailable' }));
    }
  }
};
