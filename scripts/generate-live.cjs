#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { writeUtf8, parseArgs } = require('./lib/io.cjs');
const { collectAll } = require('./lib/live-collect.cjs');
const { composeBriefing } = require('./lib/live-compose.cjs');
const { renderLiveHtml, renderTeaser, injectAllHomepages } = require('./lib/live-render.cjs');
const { shanghaiDateIso } = require('./lib/locales.cjs');

async function generateLive(siteRoot, options = {}) {
  const watchlist = JSON.parse(fs.readFileSync(path.join(siteRoot, 'collectors/watchlist.json'), 'utf8'));
  const collected = await collectAll(watchlist, options);
  const briefing = composeBriefing(collected, { now: options.now });
  const basePath = options.basePath || '/daily';
  const liveRoot = path.join(siteRoot, 'public', 'live');
  const dateIso = briefing.dateIso || shanghaiDateIso();
  const [year, month, day] = dateIso.split('-');

  writeUtf8(path.join(liveRoot, 'latest.json'), `${JSON.stringify(briefing, null, 2)}\n`);
  writeUtf8(path.join(liveRoot, 'teaser.json'), `${JSON.stringify({
    zh: renderTeaser(briefing, 'zh'),
    en: renderTeaser(briefing, 'en'),
  }, null, 2)}\n`);
  writeUtf8(path.join(liveRoot, `${dateIso}.json`), `${JSON.stringify(briefing, null, 2)}\n`);
  writeUtf8(path.join(liveRoot, 'index.html'), renderLiveHtml(briefing, 'zh', basePath));
  writeUtf8(path.join(liveRoot, 'en/index.html'), renderLiveHtml(briefing, 'en', basePath));
  writeUtf8(path.join(liveRoot, year, month, day, 'index.html'), renderLiveHtml(briefing, 'zh', basePath));
  writeUtf8(path.join(siteRoot, 'collectors/out', `${dateIso}.live.json`), `${JSON.stringify({ collectedAt: collected.collectedAt, counts: collected.counts, feedReports: collected.feedReports }, null, 2)}\n`);
  injectAllHomepages(path.join(siteRoot, 'public'), briefing, basePath);

  return { briefing, collected, liveRoot };
}

async function main() {
  const args = parseArgs();
  const siteRoot = path.resolve(args['site-root'] || path.resolve(__dirname, '..'));
  const result = await generateLive(siteRoot, { basePath: args['base-path'] || '/daily' });
  const { briefing, collected } = result;
  console.log(JSON.stringify({
    ok: true,
    date: briefing.dateIso,
    items: briefing.items.length,
    scanned: collected.counts,
    feeds: collected.feedReports.filter((row) => row.ok).map((row) => row.id),
    failed: collected.feedReports.filter((row) => !row.ok).map((row) => `${row.id}:${row.error}`),
  }, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}

module.exports = { generateLive };
