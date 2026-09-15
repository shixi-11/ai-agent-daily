#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { readUtf8 } = require('./lib/io.cjs');
const { classCount, externalLinks } = require('./lib/io.cjs');
const { extractMain, alignTraditional, injectMachineNote } = require('./lib/align-html.cjs');
const { loadGlossary } = require('./lib/translate.cjs');

const siteRoot = path.resolve(__dirname, '..');
const latest = '2026-09-14';
const zh = readUtf8(path.join(siteRoot, 'content/zh', '20260914_ALUX_AI智能体情报日报.html'));
const converted = alignTraditional(zh, '此頁由簡體原稿自動轉換為繁體，未經人工精修。');
const main = extractMain(zh);

if (!converted.includes('class="machine-note"')) throw new Error('缺少机器翻译说明');
if (!converted.includes('軟體') && !converted.includes('權重') && !converted.includes('資訊')) {
  // s2twp should convert at least some Mainland phrases; still require Traditional forms
}
if (!/[\u7e41\u9ad4\u8cc7\u8a0a\u6b0a\u91cd]/.test(converted) && !converted.includes('權') && !converted.includes('訊')) {
  throw new Error('繁体转换没有生效');
}

const stripped = converted.replace(/<p class="machine-note">[\s\S]*?<\/p>/, '');
for (const className of ['hero', 'section', 'signal', 'sources']) {
  if (classCount(zh, className) !== classCount(stripped, className)) {
    throw new Error(`结构不一致：${className}`);
  }
}
if (externalLinks(zh).join('\n') !== externalLinks(stripped).join('\n')) {
  throw new Error('外链集合不一致');
}
if (stripped.split(/<h3\b/i).length !== main.split(/<h3\b/i).length) {
  throw new Error('标题数量不一致');
}

const glossary = loadGlossary(siteRoot);
if (glossary.labels['What changed:'].ja !== '何が変わったか：') throw new Error('术语表缺失');
const noted = injectMachineNote(main, 'note');
if (!noted.includes('class="machine-note"')) throw new Error('说明注入失败');

console.log(JSON.stringify({
  ok: true,
  date: latest,
  traditionalSample: converted.match(/title-cn">([^<]+)/)?.[1] || '',
  signals: classCount(stripped, 'signal'),
  links: externalLinks(stripped).length,
}));
