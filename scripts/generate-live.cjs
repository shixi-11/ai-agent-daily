#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { writeUtf8, parseArgs } = require('./lib/io.cjs');
const { collectAll } = require('./lib/live-collect.cjs');
const {
  composeBriefing,
  decorateBriefing,
  hasCjk,
  shouldMintTitle,
  stripSourcePrefix,
  snippetSource,
  formatWhat,
  refreshRadarCopy,
} = require('./lib/live-compose.cjs');
const { renderLiveHtml, renderTeaser, injectAllHomepages } = require('./lib/live-render.cjs');
const { shanghaiDateIso, locales } = require('./lib/locales.cjs');
const { convertOpenCcHtml, translateSegments } = require('./lib/translate.cjs');

const MINT_LOCALES = ['ja', 'ko', 'es', 'fr', 'de', 'ar'];

async function translateOrWarn(siteRoot, locale, segments, label) {
  if (!segments.length) return [];
  try {
    return await translateSegments(siteRoot, locale, segments, { from: 'en' });
  } catch (error) {
    console.warn(`${locale} ${label} MinT skipped: ${error.message}`);
    return segments.map(() => '');
  }
}

async function localizeItems(siteRoot, briefing) {
  const items = briefing.items || [];
  items.forEach((item) => {
    if (item.origin === 'github-repo' && item.repo) {
      item.title = item.repo;
      item.titleEn = item.repo;
      item.titleZh = item.repo;
    } else if (item.repo && /==/.test(item.title || '')) {
      const next = `${item.repo} ${String(item.title).replace(/^[\w.-]+==/, '')}`;
      item.title = next;
      item.titleEn = next;
      item.titleZh = next;
    }
  });

  const titleNeed = items.filter((item) => shouldMintTitle(item.title));
  if (titleNeed.length) {
    const zhTitles = await translateOrWarn(siteRoot, 'zh', titleNeed.map((item) => item.title), 'title');
    titleNeed.forEach((item, index) => {
      if (zhTitles[index]) item.titleZh = zhTitles[index];
    });
  }
  items.forEach((item) => {
    if (!item.titleZh) item.titleZh = item.title;
  });

  const snippetNeed = items.filter((item) => {
    const snippet = snippetSource(item);
    return Boolean(snippet) && !hasCjk(snippet);
  });
  if (snippetNeed.length) {
    const sources = snippetNeed.map((item) => snippetSource(item));
    const zhSnippets = await translateOrWarn(siteRoot, 'zh', sources, 'snippet');
    snippetNeed.forEach((item, index) => {
      const snippet = zhSnippets[index];
      if (!snippet) return;
      item.whatZh = formatWhat(item.origin, item.repo, item.titleZh || item.title, snippet, 'zh').slice(0, 220);
    });
  }

  for (const item of items) {
    try {
      item.titleHant = convertOpenCcHtml(item.titleZh || item.title).trim();
      item.whatHant = convertOpenCcHtml(item.whatZh || '').trim();
      item.whyHant = convertOpenCcHtml(item.whyZh || '').trim();
      item.whoHant = convertOpenCcHtml(item.whoZh || '').trim();
      item.tryHant = convertOpenCcHtml(item.tryZh || '').trim();
      item.noteHant = convertOpenCcHtml(item.noteZh || '').trim();
    } catch {
      item.titleHant = item.titleZh;
      item.whatHant = item.whatZh;
      item.whyHant = item.whyZh;
      item.whoHant = item.whoZh;
      item.tryHant = item.tryZh;
      item.noteHant = item.noteZh;
    }
  }

  for (const id of MINT_LOCALES) {
    const slots = [];
    for (const item of items) {
      slots.push(shouldMintTitle(item.title) ? item.title : '');
      slots.push(snippetSource(item) || item.whatEn || '');
      slots.push(item.whyEn || '');
      slots.push(item.whoEn || '');
      slots.push(item.tryEn || '');
      slots.push(item.noteEn || '');
    }
    const nonempty = [];
    const map = [];
    slots.forEach((text, index) => {
      if (!text) return;
      map.push(index);
      nonempty.push(text);
    });
    const translated = nonempty.length
      ? await translateOrWarn(siteRoot, id, nonempty, 'item')
      : [];
    const filled = slots.slice();
    map.forEach((index, i) => {
      if (translated[i]) filled[index] = translated[i];
    });
    items.forEach((item, n) => {
      const base = n * 6;
      item.i18n = item.i18n || {};
      item.i18n[id] = {
        title: (slots[base] ? filled[base] : item.title) || item.title,
        what: filled[base + 1] || item.whatEn,
        why: filled[base + 2] || item.whyEn,
        who: filled[base + 3] || item.whoEn,
        try: filled[base + 4] || item.tryEn,
        note: filled[base + 5] || item.noteEn,
      };
    });
  }
}

async function localizeHero(siteRoot, briefing) {
  const hero = briefing.hero || {};
  const i18n = { ...(hero.i18n || {}) };
  try {
    i18n['zh-Hant'] = {
      subject: convertOpenCcHtml(hero.subjectZh || '').trim(),
      lead: convertOpenCcHtml(hero.leadZh || '').trim(),
      judgment: convertOpenCcHtml(hero.judgmentZh || '').trim(),
    };
  } catch (error) {
    console.warn(`zh-Hant hero OpenCC skipped: ${error.message}`);
    i18n['zh-Hant'] = i18n.zh || {
      subject: hero.subjectZh,
      lead: hero.leadZh,
      judgment: hero.judgmentZh,
    };
  }
  briefing.hero = { ...hero, i18n };
  return briefing;
}

function localizeLiveHtml(briefing, locale, basePath) {
  return renderLiveHtml(briefing, locale.id, basePath);
}

async function writeLivePages(siteRoot, briefing, basePath) {
  const liveRoot = path.join(siteRoot, 'public', 'live');
  const dateIso = briefing.dateIso || shanghaiDateIso();
  const [year, month, day] = dateIso.split('-');

  await localizeItems(siteRoot, briefing);
  await localizeHero(siteRoot, briefing);
  refreshRadarCopy(briefing);

  writeUtf8(path.join(liveRoot, 'latest.json'), `${JSON.stringify(briefing, null, 2)}\n`);
  writeUtf8(path.join(liveRoot, 'teaser.json'), `${JSON.stringify({
    zh: renderTeaser(briefing, 'zh'),
    en: renderTeaser(briefing, 'en'),
  }, null, 2)}\n`);
  writeUtf8(path.join(liveRoot, `${dateIso}.json`), `${JSON.stringify(briefing, null, 2)}\n`);

  for (const locale of locales) {
    const relative = locale.id === 'zh' ? 'index.html' : path.join(locale.id, 'index.html');
    const html = localizeLiveHtml(briefing, locale, basePath);
    writeUtf8(path.join(liveRoot, relative), html);
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

  const liveRoot = await writeLivePages(siteRoot, briefing, basePath);
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
    locales: locales.map((item) => item.id),
    scanned: collected?.counts || briefing.counts,
    feeds: collected ? collected.feedReports.filter((row) => row.ok).map((row) => row.id) : undefined,
    failed: collected ? collected.feedReports.filter((row) => !row.ok).map((row) => `${row.id}:${row.error}`) : undefined,
  }, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { generateLive, writeLivePages };
