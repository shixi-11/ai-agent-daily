#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { readUtf8, writeUtf8, sha256File, parseArgs } = require('./lib/io.cjs');
const { convertToUtcDateTime, assertTranslationBody } = require('./lib/html.cjs');

const args = parseArgs();
const siteRoot = path.resolve(args['site-root'] || path.resolve(__dirname, '..'));
const chineseRoot = path.join(siteRoot, 'content/zh');
const englishRoot = path.join(siteRoot, 'content/en');
const manifestPath = path.join(englishRoot, 'translation-manifest.json');
const reportPattern = /^(?<date>\d{8})_ALUX_AI智能体情报日报\.html$/;
const markReviewed = Boolean(args['mark-reviewed']);
const all = Boolean(args.all);
const dateArg = args.date || (args._ || [])[0];

if (!fs.existsSync(chineseRoot)) throw new Error(`中文母稿目录不存在：${chineseRoot}`);
fs.mkdirSync(englishRoot, { recursive: true });

const existingByDate = new Map();
if (fs.existsSync(manifestPath)) {
  const existing = JSON.parse(readUtf8(manifestPath));
  for (const entry of existing.reports || []) existingByDate.set(String(entry.date), entry);
}

let sourceFiles = fs.readdirSync(chineseRoot).filter((name) => reportPattern.test(name)).sort();
if (!all) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateArg || '')) throw new Error(`Date 必须使用 YYYY-MM-DD：${dateArg || ''}`);
  const dateToken = dateArg.replace(/-/g, '');
  sourceFiles = sourceFiles.filter((name) => name.startsWith(`${dateToken}_`));
  if (sourceFiles.length !== 1) throw new Error(`${dateArg} 对应的中文母稿数量不是 1。`);
}
if (!sourceFiles.length) throw new Error('没有可更新的中文母稿。');

const updatedDates = new Set();
for (const name of sourceFiles) {
  const dateToken = name.match(reportPattern).groups.date;
  const dateIso = `${dateToken.slice(0, 4)}-${dateToken.slice(4, 6)}-${dateToken.slice(6, 8)}`;
  const translationFile = path.join(englishRoot, `${dateToken}.body.html`);
  if (!fs.existsSync(translationFile)) throw new Error(`${dateIso} 缺少英文母稿：${translationFile}`);
  const sourcePath = path.join(chineseRoot, name);
  assertTranslationBody({
    bodyFragment: readUtf8(translationFile),
    sourceHtml: readUtf8(sourcePath),
    dateIso,
    localeId: 'en',
  });
  const sourceHash = sha256File(sourcePath);
  const translationHash = sha256File(translationFile);
  const old = existingByDate.get(dateIso);
  const status = markReviewed ? 'reviewed' : 'draft';
  let reviewedAt = null;
  if (markReviewed) {
    const sameReviewed = old && old.status === 'reviewed'
      && String(old.sourceSha256) === sourceHash
      && String(old.translationSha256) === translationHash;
    reviewedAt = sameReviewed ? convertToUtcDateTime(old.reviewedAt).toISOString() : new Date().toISOString();
    if (sameReviewed) reviewedAt = String(old.reviewedAt);
  }
  existingByDate.set(dateIso, {
    date: dateIso,
    sourceFile: name,
    translationFile: path.basename(translationFile),
    sourceSha256: sourceHash,
    translationSha256: translationHash,
    status,
    reviewedAt,
  });
  updatedDates.add(dateIso);
}

const reports = [...existingByDate.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, value]) => value);
writeUtf8(manifestPath, `${JSON.stringify({ schemaVersion: 1, locale: 'en-US', reports }, null, 2)}\n`);
console.log(`翻译清单已更新：${reports.length} 期，本次 ${updatedDates.size} 期，状态=${markReviewed ? 'reviewed' : 'draft'}`);
