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
console.log(JSON.stringify({ ok: true, hero: briefing.hero.subjectEn, categories: briefing.items.map((item) => item.category) }));
