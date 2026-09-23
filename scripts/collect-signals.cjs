#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { writeUtf8, parseArgs } = require('./lib/io.cjs');
const { shanghaiDateIso } = require('./lib/locales.cjs');

const args = parseArgs();
const siteRoot = path.resolve(args['site-root'] || path.resolve(__dirname, '..'));
const watchlist = JSON.parse(fs.readFileSync(path.join(siteRoot, 'collectors/watchlist.json'), 'utf8'));
const lookbackDays = Number(watchlist.lookbackDays || 14);
const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const outDir = path.join(siteRoot, 'collectors/out');
const requestTimeoutMs = Number(process.env.COLLECTOR_TIMEOUT_MS || 15000);
const requestAttempts = Number(process.env.COLLECTOR_ATTEMPTS || 3);
const collectorConcurrency = Number(process.env.COLLECTOR_CONCURRENCY || 6);

function classifyError(message = '') {
  const value = String(message).toLowerCase();
  if (/\b429\b|rate.?limit/.test(value)) return 'rate_limited';
  if (/timeout|timed out|abort/.test(value)) return 'timeout';
  if (/parse|json|xml|unexpected token/.test(value)) return 'parse_error';
  if (/\b(?:401|403)\b/.test(value)) return 'access_denied';
  if (/\b5\d\d\b/.test(value)) return 'upstream_error';
  if (/\b4\d\d\b/.test(value)) return 'http_error';
  return 'request_error';
}

function sourceOutcome(type, item, durationMs, previousLastSuccessAt, observedAt) {
  const id = type === 'github' ? item.repo : type === 'huggingface' ? item.org : item.id;
  const errors = [];
  let itemCount = 0;
  let optional = false;
  if (type === 'github') {
    if (item.releases?.error) errors.push(item.releases.error);
    else if (Array.isArray(item.releases)) itemCount += item.releases.length;
    if (item.commits?.error) errors.push(item.commits.error);
    else if (Array.isArray(item.commits)) itemCount += item.commits.length;
  } else if (type === 'huggingface') {
    if (item.error) errors.push(item.error);
    else if (Array.isArray(item.models)) itemCount = item.models.length;
  } else {
    optional = item.optional === true;
    if (item.error) errors.push(item.error);
    else if (item.skipped) errors.push(`HTTP ${item.skipped}`);
    else if (Array.isArray(item.items)) itemCount = item.items.length;
  }
  const expectedParts = type === 'github' ? 2 : 1;
  let status = errors.length === expectedParts ? 'failed'
    : errors.length ? 'partial'
      : itemCount === 0 ? 'empty' : 'success';
  if (optional && errors.length) status = 'skipped';
  const succeeded = status === 'success' || status === 'partial';
  return {
    type,
    id,
    status,
    itemCount,
    durationMs,
    lastSuccessAt: succeeded ? observedAt : (previousLastSuccessAt || null),
    ...(optional ? { optional: true } : {}),
    ...(errors.length ? { errorType: classifyError(errors.join(' | ')), error: errors.join(' | ').slice(0, 500) } : {}),
  };
}

function buildCollectorHealth({ github, huggingface, rss, durations = {}, previous = {} }, observedAt) {
  const sources = [
    ...github.map((item) => sourceOutcome('github', item, durations[`github:${item.repo}`] ?? null, previous[`github:${item.repo}`], observedAt)),
    ...huggingface.map((item) => sourceOutcome('huggingface', item, durations[`huggingface:${item.org}`] ?? null, previous[`huggingface:${item.org}`], observedAt)),
    ...rss.map((item) => sourceOutcome('rss', item, durations[`rss:${item.id}`] ?? null, previous[`rss:${item.id}`], observedAt)),
  ];
  const counts = Object.fromEntries(['success', 'partial', 'empty', 'failed', 'skipped'].map((status) => [
    status,
    sources.filter((source) => source.status === status).length,
  ]));
  const actionable = sources.filter((source) => source.status !== 'skipped');
  const usable = actionable.filter((source) => source.status === 'success' || (source.status === 'partial' && source.itemCount > 0));
  const status = actionable.length > 0 && usable.length === 0 ? 'failed'
    : counts.partial || counts.empty || counts.failed ? 'degraded' : 'healthy';
  return { schemaVersion: 1, observedAt, status, counts, sources };
}

function loadPreviousSuccesses(directory) {
  try {
    const files = fs.readdirSync(directory).filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name)).sort().reverse();
    const result = {};
    for (const name of files.slice(0, 30)) {
      const payload = JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));
      for (const source of payload.sourceHealth?.sources || []) {
        const key = `${source.type}:${source.id}`;
        if (!result[key] && source.lastSuccessAt) result[key] = source.lastSuccessAt;
      }
    }
    return result;
  } catch {
    return {};
  }
}

async function measured(key, durations, operation) {
  const startedAt = Date.now();
  const value = await operation();
  durations[key] = Date.now() - startedAt;
  return value;
}

async function fetchWithPolicy(url, options = {}, policy = {}) {
  const fetchImpl = policy.fetchImpl || fetch;
  const sleep = policy.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const timeoutMs = policy.timeoutMs ?? requestTimeoutMs;
  const attempts = policy.attempts ?? requestAttempts;
  const parse = policy.parse || (async (response) => response.text());
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, { ...options, signal: controller.signal });
      if (!response.ok) {
        const body = await response.text();
        const error = new Error(`HTTP ${response.status} ${url}: ${body.slice(0, 180)}`);
        error.status = response.status;
        throw error;
      }
      return await parse(response);
    } catch (error) {
      lastError = error;
      const retryable = error?.name === 'AbortError' || error?.status === 429 || Number(error?.status) >= 500 || !error?.status;
      if (!retryable || attempt === attempts) break;
      await sleep(attempt * 500);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

async function mapConcurrent(items, limit, worker) {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('collector concurrency must be a positive integer');
  const output = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      output[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return output;
}

async function fetchJson(url, headers = {}) {
  return fetchWithPolicy(url, {
    headers: {
      'user-agent': 'ai-agent-daily-collector',
      accept: 'application/json',
      ...headers,
    },
  }, {
    parse: async (response) => {
      const body = await response.text();
      if (!body.trim()) throw new Error(`empty JSON response ${url}`);
      try {
        return JSON.parse(body);
      } catch (error) {
        throw new Error(`JSON parse error ${url}: ${error.message}`);
      }
    },
  });
}

async function collectGithubRepo(repo) {
  const headers = token ? { authorization: `Bearer ${token}` } : {};
  const [releases, commits] = await Promise.all([
    fetchJson(`https://api.github.com/repos/${repo}/releases?per_page=5`, headers).catch((error) => ({ error: String(error.message) })),
    fetchJson(`https://api.github.com/repos/${repo}/commits?since=${encodeURIComponent(since)}&per_page=8`, headers).catch((error) => ({ error: String(error.message) })),
  ]);
  return {
    repo,
    releases: Array.isArray(releases)
      ? releases.map((item) => ({
        tag: item.tag_name,
        name: item.name,
        publishedAt: item.published_at,
        url: item.html_url,
        prerelease: item.prerelease,
      }))
      : releases,
    commits: Array.isArray(commits)
      ? commits.map((item) => ({
        sha: item.sha?.slice(0, 8),
        message: String(item.commit?.message || '').split('\n')[0],
        date: item.commit?.author?.date,
        url: item.html_url,
      }))
      : commits,
  };
}

async function collectHuggingFace(org) {
  try {
    const models = await fetchJson(`https://huggingface.co/api/models?author=${encodeURIComponent(org)}&sort=lastModified&direction=-1&limit=8`);
    return {
      org,
      models: (models || []).map((item) => ({
        id: item.id || item.modelId,
        lastModified: item.lastModified,
        likes: item.likes,
        downloads: item.downloads,
        url: `https://huggingface.co/${item.id || item.modelId}`,
      })),
    };
  } catch (error) {
    return { org, error: String(error.message) };
  }
}

function parseFeed(xml, limit = 8) {
  const blocks = [...xml.matchAll(/<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/gi)].slice(0, limit);
  return blocks.map((block) => {
    const pick = (names) => {
      for (const name of names) {
        const match = block[0].match(new RegExp(`<${name}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([^<]*))`, 'i'));
        if (match) return (match[1] || match[2] || '').trim();
      }
      return '';
    };
    const href = block[0].match(/<link[^>]+href=["']([^"']+)["']/i)?.[1]
      || block[0].match(/<link[^>]*>([^<]+)/i)?.[1]
      || '';
    return {
      title: pick(['title']),
      url: href.trim(),
      date: pick(['published', 'updated', 'pubDate', 'dc:date']),
    };
  });
}

async function collectRss(feed) {
  try {
    const xml = await fetchWithPolicy(feed.url, { headers: { 'user-agent': 'ai-agent-daily-collector' } });
    return { id: feed.id, url: feed.url, items: parseFeed(xml) };
  } catch (error) {
    if (feed.optional) return { id: feed.id, optional: true, skipped: error.status || null, error: String(error.message) };
    return { id: feed.id, url: feed.url, error: String(error.message) };
  }
}

async function main() {
  const durations = {};
  const github = await mapConcurrent(watchlist.githubRepos || [], collectorConcurrency,
    (repo) => measured(`github:${repo}`, durations, () => collectGithubRepo(repo)));
  const huggingface = await mapConcurrent(watchlist.huggingfaceOrgs || [], collectorConcurrency,
    (org) => measured(`huggingface:${org}`, durations, () => collectHuggingFace(org)));
  const rss = await mapConcurrent(watchlist.rssFeeds || [], collectorConcurrency,
    (feed) => measured(`rss:${feed.id}`, durations, () => collectRss(feed)));
  const collectedAt = new Date().toISOString();
  const sourceHealth = buildCollectorHealth({
    github,
    huggingface,
    rss,
    durations,
    previous: loadPreviousSuccesses(outDir),
  }, collectedAt);
  const payload = {
    collectedAt,
    shanghaiDate: shanghaiDateIso(),
    lookbackDays,
    since,
    github,
    huggingface,
    rss,
    sourceHealth,
    persistentWatch: watchlist.persistentWatch || [],
  };
  const outFile = path.join(outDir, `${payload.shanghaiDate}.json`);
  writeUtf8(outFile, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`signals written: ${path.relative(siteRoot, outFile)}`);
  console.log(`github=${github.length} huggingface=${huggingface.length} rss=${rss.length}`);
  console.log(`source-health=${sourceHealth.status} success=${sourceHealth.counts.success} partial=${sourceHealth.counts.partial} empty=${sourceHealth.counts.empty} failed=${sourceHealth.counts.failed} skipped=${sourceHealth.counts.skipped}`);
}

module.exports = { buildCollectorHealth, classifyError, fetchWithPolicy, mapConcurrent, sourceOutcome };

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}
