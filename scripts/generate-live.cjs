#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { writeUtf8, parseArgs } = require('./lib/io.cjs');
const { collectAll } = require('./lib/live-collect.cjs');
const { composeBriefing, decorateBriefing } = require('./lib/live-compose.cjs');
const { renderLiveHtml, renderTeaser, injectAllHomepages } = require('./lib/live-render.cjs');
const { shanghaiDateIso, locales } = require('./lib/locales.cjs');

function writeLivePages(siteRoot, briefing, basePath) {
  const liveRoot = path.join(siteRoot, 'public', 'live');
  const dateIso = briefing.dateIso || shanghaiDateIso();
  const [year, month, day] = dateIso.split('-');

  writeUtf8(path.join(liveRoot, 'latest.json'), `${JSON.stringify(briefing, null, 2)}\n`);
  writeUtf8(path.join(liveRoot, 'teaser.json'), `${JSON.stringify({
    zh: renderTeaser(briefing, 'zh'),
    en: renderTeaser(briefing, 'en'),
  }, null, 2)}\n`);
  writeUtf8(path.join(liveRoot, `${dateIso}.json`), `${JSON.stringify(briefing, null, 2)}\n`);

  for (const locale of locales) {
    const relative = locale.id === 'zh' ? 'index.html' : path.join(locale.id, 'index.html');
    writeUtf8(path.join(liveRoot, relative), renderLiveHtml(briefing, locale.id, basePath));
  }
  writeUtf8(path.join(liveRoot, year, month, day, 'index.html'), renderLiveHtml(briefing, 'zh', basePath));
  injectAllHomepages(path.join(siteRoot, 'public'), briefing, basePath);
  return liveRoot;
}

async function generateLive(siteRoot, options = {}) {
  const basePath = options.basePath || '/daily';
  let briefing;
  let collected = null;

  if (options.fromJson) {
    const jsonPath = options.fromJson === true
      ? path.join(siteRoot, 'public/live/latest.json')
      : options.fromJson;
    briefing = decorateBriefing(JSON.parse(fs.readFileSync(jsonPath, 'utf8')));
  } else {
    const watchlist = JSON.parse(fs.readFileSync(path.join(siteRoot, 'collectors/watchlist.json'), 'utf8'));
    collected = await collectAll(watchlist, options);
    briefing = composeBriefing(collected, { now: options.now });
    writeUtf8(
      path.join(siteRoot, 'collectors/out', `${briefing.dateIso}.live.json`),
      `${JSON.stringify({ collectedAt: collected.collectedAt, counts: collected.counts, feedReports: collected.feedReports }, null, 2)}\n`,
    );
  }

  const liveRoot = writeLivePages(siteRoot, briefing, basePath);
  return { briefing, collected, liveRoot };
}

async function main() {
  const args = parseArgs();
  const siteRoot = path.resolve(args['site-root'] || path.resolve(__dirname, '..'));
  const fromJson = Object.prototype.hasOwnProperty.call(args, 'from-json')
    ? (args['from-json'] || true)
    : false;
  const result = await generateLive(siteRoot, {
    basePath: args['base-path'] || '/daily',
    fromJson,
  });
  const { briefing, collected } = result;
  console.log(JSON.stringify({
    ok: true,
    date: briefing.dateIso,
    items: briefing.items.length,
    layout: 'compact-v1',
    locales: locales.map((item) => item.id),
    scanned: collected?.counts || briefing.counts,
    feeds: collected ? collected.feedReports.filter((row) => row.ok).map((row) => row.id) : undefined,
    failed: collected ? collected.feedReports.filter((row) => !row.ok).map((row) => `${row.id}:${row.error}`) : undefined,
  }, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}

module.exports = { generateLive };
