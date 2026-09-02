#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { validateCopyPair, validateHomepageCopy } = require('./verify-locale-copy.cjs');

const zhRadar = ['系统开始保存任务状态', '权限进入默认工作流', '本地工具补齐观察能力'];
const enRadar = ['Systems preserve task state', 'Permissions enter default workflows', 'Local tools expose operational evidence'];
const zhSignals = Array.from({ length: 7 }, (_, index) => `<article><h3>项目${index + 1}带来一项具体变化</h3><p>这是一句清楚、紧凑且便于阅读的中文说明。</p></article>`).join('');
const enSignals = Array.from({ length: 7 }, (_, index) => `<article><h3>Project ${index + 1} ships a concrete workflow change</h3><p>This is a concise sentence written for an English-language technology reader.</p></article>`).join('');
const valid = {
  date: '2026-08-27',
  zhHtml: `<section><h2>AI Agent雷达</h2>${zhRadar.map((title) => `<h3>${title}</h3>`).join('')}</section><section>${zhSignals}</section>`,
  enHtml: `<section><h2>AI Agent Radar</h2>${enRadar.map((title) => `<h3>${title}</h3>`).join('')}</section><section>${enSignals}</section>`,
};

assert.deepEqual(validateCopyPair(valid), []);
assert(validateCopyPair({ ...valid, enHtml: valid.enHtml.replace('Systems preserve task state', 'Systems preserve<br>task state') }).some((error) => error.includes('manual <br>')));
assert(validateCopyPair({ ...valid, zhHtml: valid.zhHtml.replace('系统开始保存任务状态', '这是一个明显超过二十个中文字量并且会在多个屏幕宽度产生难看断行的雷达标题') }).some((error) => error.includes('20 visual units')));
assert(validateCopyPair({ ...valid, enHtml: valid.enHtml.replace('Systems preserve task state', 'Systems preserve task state with') }).some((error) => error.includes('dangling function word')));

const home = {
  zhHtml: fs.readFileSync(path.join(__dirname, '../templates/index.template.html'), 'utf8'),
  enHtml: fs.readFileSync(path.join(__dirname, '../templates/index.en.template.html'), 'utf8'),
};
assert.deepEqual(validateHomepageCopy(home), []);
for (const [zh, en] of [
  ['AI智能体情报日报</small>', 'AI Agent Intelligence Daily</small>'],
  ['ALUX情报', 'ALUX Intelligence'],
  ['日报归档', 'Daily Archive'],
  ['全球AI、智能体与开源', 'Global AI, Agents &amp; Open Source'],
  ['最新一期</span>', 'Latest Report</span>'],
  ['最新在前 · 固定链接', 'Newest First · Permanent URLs'],
]) {
  assert(home.zhHtml.includes(zh));
  assert(validateHomepageCopy({ ...home, zhHtml: home.zhHtml.replace(zh, en) })
    .some((error) => error.includes('untranslated UI copy')), `must reject untranslated label: ${en}`);
}
assert(validateHomepageCopy({ ...home, enHtml: home.enHtml.replace('Global AI, Agents &amp; Open Source', '全球AI、智能体与开源') })
  .some((error) => error.includes('en homepage')));
assert.deepEqual(validateHomepageCopy({ ...home, zhHtml: home.zhHtml + '<!-- Global AI, Agents &amp; Open Source --><script>const title = "Daily Archive";</script>' }), []);

process.stdout.write('Locale copy gate tests passed\n');
