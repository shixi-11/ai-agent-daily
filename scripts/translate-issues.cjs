#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { readUtf8, writeUtf8, sha256File, sha256Text, parseArgs } = require('./lib/io.cjs');
const { optionalLocales, localesById } = require('./lib/locales.cjs');
const { assertTranslationBody } = require('./lib/html.cjs');
const { alignFromEnglish, alignTraditional, extractMain } = require('./lib/align-html.cjs');

function loadJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(readUtf8(file));
}

function listChineseDates(siteRoot) {
  return fs.readdirSync(path.join(siteRoot, 'content/zh'))
    .map((name) => name.match(/^(\d{8})_/))
    .filter(Boolean)
    .map((match) => `${match[1].slice(0, 4)}-${match[1].slice(4, 6)}-${match[1].slice(6, 8)}`)
    .sort();
}

function chinesePath(siteRoot, dateIso) {
  const token = dateIso.replace(/-/g, '');
  return path.join(siteRoot, 'content/zh', `${token}_ALUX_AI智能体情报日报.html`);
}

function englishPath(siteRoot, dateIso) {
  return path.join(siteRoot, 'content/en', `${dateIso.replace(/-/g, '')}.body.html`);
}

function localeBodyPath(siteRoot, localeId, dateIso) {
  return path.join(siteRoot, 'content', localeId, `${dateIso.replace(/-/g, '')}.body.html`);
}

function upsertManifest(manifest, dateIso, localeId, record) {
  manifest.reports = manifest.reports || {};
  manifest.reports[dateIso] = manifest.reports[dateIso] || {};
  manifest.reports[dateIso][localeId] = record;
}

async function translateOne(siteRoot, dateIso, locale, options) {
  const sourceZh = chinesePath(siteRoot, dateIso);
  const sourceEn = englishPath(siteRoot, dateIso);
  if (!fs.existsSync(sourceZh) || !fs.existsSync(sourceEn)) {
    throw new Error(`${dateIso} 缺少中文或英文母稿`);
  }
  const dest = localeBodyPath(siteRoot, locale.id, dateIso);
  const zhHtml = readUtf8(sourceZh);
  const enBody = readUtf8(sourceEn);
  const sourceSha = locale.id === 'zh-Hant' ? sha256File(sourceZh) : sha256File(sourceEn);
  const existing = options.manifest.reports?.[dateIso]?.[locale.id];
  if (!options.force && existing && existing.status && existing.sourceSha256 === sourceSha && fs.existsSync(dest)) {
    return { dateIso, locale: locale.id, skipped: true };
  }

  const note = locale.ui.machineNote;
  const body = locale.id === 'zh-Hant'
    ? alignTraditional(zhHtml, note)
    : await alignFromEnglish(siteRoot, locale.id, enBody, note);

  assertTranslationBody({
    bodyFragment: body.replace(/<p class="machine-note">[\s\S]*?<\/p>/, ''),
    sourceHtml: zhHtml,
    dateIso,
    localeId: locale.id,
  });

  writeUtf8(dest, `${body.replace(/\s+$/, '')}\n`);
  upsertManifest(options.manifest, dateIso, locale.id, {
    status: 'generated',
    engine: locale.id === 'zh-Hant' ? 'opencc-s2twp' : 'wikimedia-mint',
    source: locale.id === 'zh-Hant' ? 'zh' : 'en',
    translationFile: `${dateIso.replace(/-/g, '')}.body.html`,
    translationSha256: sha256File(dest),
    sourceSha256: sourceSha,
    generatedAt: new Date().toISOString(),
  });
  return { dateIso, locale: locale.id, bytes: Buffer.byteLength(body) };
}

async function main() {
  const args = parseArgs();
  const siteRoot = path.resolve(args['site-root'] || path.resolve(__dirname, '..'));
  const dates = listChineseDates(siteRoot);
  if (!dates.length) throw new Error('没有中文日报');
  const latest = dates[dates.length - 1];
  const backfill = Math.max(1, Number(args.backfill || (args.latest ? 1 : 1)));
  const mintDates = args.date ? [String(args.date)] : dates.slice(-backfill);
  let selectedDates = args['hant-all'] ? dates : mintDates;
  if (args.date && !args['hant-all']) selectedDates = mintDates;

  let locales = optionalLocales;
  if (args.locales) {
    const wanted = String(args.locales).split(',').map((item) => item.trim()).filter(Boolean);
    locales = wanted.map((id) => {
      const locale = localesById[id];
      if (!locale || locale.kind !== 'optional-translation') throw new Error(`不是可选语种：${id}`);
      return locale;
    });
  } else if (args['hant-all'] && !args.latest && !args.date && !args.backfill) {
    locales = [localesById['zh-Hant']];
  }

  const manifestPath = path.join(siteRoot, 'content/i18n-manifest.json');
  const manifest = loadJson(manifestPath, { schemaVersion: 1, reports: {} });
  const results = [];
  for (const dateIso of selectedDates) {
    for (const locale of locales) {
      if (locale.id !== 'zh-Hant' && !mintDates.includes(dateIso)) continue;
      if (args['hant-all'] && !args.backfill && !args.latest && !args.date && locale.id !== 'zh-Hant') continue;
      try {
        const row = await translateOne(siteRoot, dateIso, locale, {
          manifest,
          force: Boolean(args.force),
        });
        results.push(row);
        console.log(JSON.stringify(row));
      } catch (error) {
        console.error(`${dateIso} ${locale.id}: ${error.message}`);
        if (!args.continue) throw error;
      }
    }
  }
  writeUtf8(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({
    ok: true,
    latest,
    written: results.filter((row) => !row.skipped).length,
    skipped: results.filter((row) => row.skipped).length,
  }));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}

module.exports = { translateOne, extractMain };
