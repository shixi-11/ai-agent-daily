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

async function fetchJson(url, headers = {}) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'ai-agent-daily-collector',
      accept: 'application/json',
      ...headers,
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${response.status} ${url}: ${body.slice(0, 180)}`);
  }
  return response.json();
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
    const response = await fetch(feed.url, { headers: { 'user-agent': 'ai-agent-daily-collector' } });
    if (!response.ok) {
      if (feed.optional) return { id: feed.id, optional: true, skipped: response.status };
      throw new Error(`HTTP ${response.status}`);
    }
    const xml = await response.text();
    return { id: feed.id, url: feed.url, items: parseFeed(xml) };
  } catch (error) {
    if (feed.optional) return { id: feed.id, optional: true, error: String(error.message) };
    return { id: feed.id, url: feed.url, error: String(error.message) };
  }
}

async function main() {
  const github = [];
  for (const repo of watchlist.githubRepos || []) {
    github.push(await collectGithubRepo(repo));
  }
  const huggingface = [];
  for (const org of watchlist.huggingfaceOrgs || []) {
    huggingface.push(await collectHuggingFace(org));
  }
  const rss = [];
  for (const feed of watchlist.rssFeeds || []) {
    rss.push(await collectRss(feed));
  }
  const payload = {
    collectedAt: new Date().toISOString(),
    shanghaiDate: shanghaiDateIso(),
    lookbackDays,
    since,
    github,
    huggingface,
    rss,
    persistentWatch: watchlist.persistentWatch || [],
  };
  const outFile = path.join(outDir, `${payload.shanghaiDate}.json`);
  writeUtf8(outFile, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`signals written: ${path.relative(siteRoot, outFile)}`);
  console.log(`github=${github.length} huggingface=${huggingface.length} rss=${rss.length}`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
