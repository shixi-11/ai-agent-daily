#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { composeBriefing, cleanTitle, pickHero } = require('./lib/live-compose.cjs');

const now = new Date('2026-09-16T02:00:00Z');
const recent = new Date(now.getTime() - 6 * 3600 * 1000);

assert.equal(cleanTitle({ title: 'Release v0.60.0', repo: 'sst/opencode' }), 'sst/opencode v0.60.0');
assert.equal(cleanTitle({ title: 'Show HN: Local Agent Desk' }), 'Local Agent Desk');

const briefing = composeBriefing({
  collectedAt: now.toISOString(),
  lookbackDays: 7,
  counts: { total: 40, rss: 20, githubReleases: 4, huggingface: 4, hn: 4, showHn: 4, githubSearch: 4 },
  feedReports: [{ id: 'openai-news', ok: true, count: 4, error: '' }],
  items: [
    {
      title: 'google-gemini/gemini-cli v0.60.0',
      url: 'https://github.com/google-gemini/gemini-cli/releases/tag/v0.60.0',
      date: recent,
      summary: 'cli release',
      sourceWeight: 8,
      origin: 'github-release',
      repo: 'google-gemini/gemini-cli',
    },
    {
      title: 'Gemini adds a public agent runtime',
      url: 'https://blog.google/technology/ai/gemini-agent-runtime',
      date: recent,
      summary: 'Google published a public agent runtime with tool permissions and eval traces.',
      sourceWeight: 10,
      kind: 'official',
      origin: 'rss',
      region: '美国',
    },
    {
      title: 'alice/agent-garden: a tiny local agent OS',
      url: 'https://github.com/alice/agent-garden',
      date: recent,
      summary: 'A new local agent desktop with MCP tools.',
      sourceWeight: 7,
      origin: 'github-repo',
      kind: 'new-site',
      repo: 'alice/agent-garden',
      stars: 88,
    },
    {
      title: 'PaperBench for agent evals',
      url: 'https://arxiv.org/abs/2609.12345',
      date: recent,
      summary: 'A benchmark for checking whether agents can reproduce papers.',
      sourceWeight: 7,
      kind: 'research',
      origin: 'rss',
    },
  ],
}, { now });

assert.notEqual(briefing.hero.subjectEn, 'Release v0.60.0');
assert.match(briefing.hero.subjectEn, /Gemini/i);
assert.ok(briefing.items.some((item) => item.category === 'new-site'));
assert.equal(pickHero(briefing.items).title.includes('v0.60.0'), false);
assert.ok(briefing.items.length >= 3);
const { fallbackDailyPath } = require('./daily-public-presentation.cjs');
assert.equal(fallbackDailyPath('ja/latest'), 'en/latest/');
assert.equal(fallbackDailyPath('/ko/2026/09/14/'), 'en/2026/09/14/');
assert.equal(fallbackDailyPath('zh-Hant/latest/'), 'latest/');
assert.equal(fallbackDailyPath('en/latest'), null);
assert.equal(fallbackDailyPath('ja'), null);

const { liveArchiveRow, injectHomeLiveArchive, injectHomeLatestCard } = require('./lib/live-render.cjs');
const liveBriefing = {
  dateIso: '2026-09-16',
  hero: {
    subjectZh: '测试主题',
    subjectEn: 'Test Subject',
    leadZh: '中文导语',
    leadEn: 'English lead',
  },
};
const zhRow = liveArchiveRow(liveBriefing, 'zh');
assert.match(zhRow, /datetime="2026-09-16"/);
assert.match(zhRow, /class="report-row is-latest is-live"/);
assert.match(zhRow, /data-live-row/);
assert.match(zhRow, />今日</);
assert.match(zhRow, /href="\/daily\/live\/"/);
const enRow = liveArchiveRow(liveBriefing, 'en');
assert.match(enRow, /href="\/daily\/live\/en\/"/);
assert.match(enRow, />Today</);

const archiveHtml = `<div class="month-strip"><h3>2026年9月</h3><span>14期</span></div>
  <div class="report-list">
    <a class="report-row is-latest" href="/daily/2026/09/14/">
      <div class="report-copy"><span class="latest-pill">最新</span><strong>old</strong></div>
    </a>
  </div>`;
const injected = injectHomeLiveArchive(archiveHtml, liveBriefing, 'zh');
assert.match(injected, /data-live-row/);
assert.match(injected, /datetime="2026-09-16"/);
assert.match(injected, />15期</);
assert.equal((injected.match(/class="report-row/g) || []).length, 2);
assert.match(injected, /class="report-row" href="\/daily\/2026\/09\/14\/"/);
const again = injectHomeLiveArchive(injected, liveBriefing, 'zh');
assert.equal((again.match(/data-live-row/g) || []).length, 1);
assert.equal((again.match(/>15期</g) || []).length, 1);

const heroHtml = `<article class="latest">
          <div class="latest-kicker"><span>最新一期</span><time datetime="2026-09-14">2026年9月14日</time></div>
          <h2>Old title</h2>
          <p>Old lead</p>
          <a class="button" href="/daily/2026/09/14/">阅读最新一期 ↗</a>
        </article>`;
const hero = injectHomeLatestCard(heroHtml, liveBriefing, 'zh');
assert.match(hero, /datetime="2026-09-16"/);
assert.match(hero, /href="\/daily\/live\/"/);
assert.match(hero, /阅读今日雷达/);
assert.match(hero, /中文导语/);

const { renderLiveHtml } = require('./lib/live-render.cjs');
const page = renderLiveHtml(briefing, 'zh', '/daily');
assert.match(page, /LIVE PUBLIC RADAR/);
assert.match(page, /live-banner/);
assert.match(page, /如何阅读/);
assert.match(page, /今日导航/);
assert.match(page, /<span class="title-en">Agent Daily<\/span>/);
assert.match(page, /class="filters"/);
assert.match(page, /language-switch language-more/);
assert.match(page, /language-icon/);
assert.match(page, />简体中文</);
assert.match(page, /href="\/daily\/live\/ja\/"/);

const enPage = renderLiveHtml(briefing, 'en', '/daily');
assert.match(enPage, /How to read this page/);
assert.match(enPage, /Agent Daily/);

console.log(JSON.stringify({ ok: true, hero: briefing.hero.subjectEn, categories: briefing.items.map((item) => item.category) }));

