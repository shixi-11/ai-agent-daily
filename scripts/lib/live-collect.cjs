'use strict';

const { decodeHtml } = require('./io.cjs');

const USER_AGENT = 'AgentDailyLive/1.0 (+https://shixilin.com/ai/agent-daily)';

function decodeEntities(value) {
  return decodeHtml(String(value || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'));
}

function stripHtml(value) {
  let text = String(value || '');
  for (let pass = 0; pass < 3; pass += 1) {
    text = decodeEntities(text)
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ');
  }
  return text.replace(/\s+/g, ' ').trim();
}

function pickTag(block, names) {
  for (const name of names) {
    const match = block.match(new RegExp(`<${name}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))</${name}>`, 'i'));
    if (match) return decodeEntities((match[1] || match[2] || '').trim());
  }
  return '';
}

function pickLink(block) {
  const href = block.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1]
    || block.match(/<link[^>]*>([^<]+)/i)?.[1]
    || block.match(/<id>(https?:[^<]+)<\/id>/i)?.[1]
    || '';
  return decodeEntities(href).trim();
}

function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseFeed(xml, limit = 12) {
  const blocks = [...String(xml).matchAll(/<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/gi)].slice(0, limit);
  return blocks.map((block) => {
    const title = stripHtml(pickTag(block[0], ['title']));
    const summary = stripHtml(pickTag(block[0], ['summary', 'description', 'content', 'content:encoded']));
    return {
      title,
      url: pickLink(block[0]),
      date: parseDate(pickTag(block[0], ['published', 'updated', 'pubDate', 'dc:date', 'issued'])),
      summary: summary.slice(0, 420),
    };
  }).filter((item) => item.title && item.url && /^https?:\/\//i.test(item.url));
}

async function mapLimit(items, limit, worker) {
  const out = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      out[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) || 1 }, run));
  return out;
}

async function fetchText(url, headers = {}) {
  const response = await fetch(url, {
    headers: { 'user-agent': USER_AGENT, accept: '*/*', ...headers },
    redirect: 'follow',
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) {
    const err = new Error(`HTTP ${response.status}`);
    err.status = response.status;
    throw err;
  }
  return response.text();
}

async function fetchJson(url, headers = {}) {
  const response = await fetch(url, {
    headers: {
      'user-agent': USER_AGENT,
      accept: 'application/json',
      ...headers,
    },
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) {
    const err = new Error(`HTTP ${response.status}`);
    err.status = response.status;
    throw err;
  }
  return response.json();
}

async function collectRss(feed) {
  try {
    const xml = await fetchText(feed.url);
    return {
      id: feed.id,
      ok: true,
      items: parseFeed(xml).map((item) => ({
        ...item,
        sourceId: feed.id,
        sourceWeight: Number(feed.weight || 5),
        region: feed.region || '全球社区',
        kind: feed.kind || 'feed',
        origin: 'rss',
      })),
    };
  } catch (error) {
    return {
      id: feed.id,
      ok: false,
      optional: Boolean(feed.optional),
      error: String(error.message || error),
      items: [],
    };
  }
}

async function collectGithubAtoms(repos) {
  return mapLimit(repos, 4, async (repo) => {
    try {
      const xml = await fetchText(`https://github.com/${repo}/releases.atom`);
      return parseFeed(xml, 4).map((item) => {
        const versionLike = /^(?:release\s+)?v?\d[\w.-]*$/i.test(item.title) || /^v?\d+\.\d+/.test(item.title);
        const summary = String(item.summary || '')
          .replace(/^what's changed\s*/i, '')
          .slice(0, 280);
        return {
          ...item,
          title: versionLike ? `${repo} ${item.title}` : item.title,
          summary,
          sourceId: `github:${repo}`,
          sourceWeight: versionLike ? 5 : 8,
          region: '全球社区',
          kind: 'open-source',
          origin: 'github-release',
          repo,
          versionLike,
        };
      });
    } catch {
      return [];
    }
  }).then((groups) => groups.flat());
}

async function collectHuggingFace(orgs) {
  const results = await mapLimit(orgs, 3, async (org) => {
    try {
      const models = await fetchJson(`https://huggingface.co/api/models?author=${encodeURIComponent(org)}&sort=lastModified&direction=-1&limit=6`);
      return (models || []).map((item) => ({
        title: item.id || item.modelId,
        url: `https://huggingface.co/${item.id || item.modelId}`,
        date: parseDate(item.lastModified),
        summary: `Hugging Face 模型更新，likes ${item.likes ?? 0}，downloads ${item.downloads ?? 0}。`,
        sourceId: `hf:${org}`,
        sourceWeight: 7,
        region: '全球社区',
        kind: 'model-platform',
        origin: 'huggingface',
        likes: item.likes,
      }));
    } catch {
      return [];
    }
  });
  return results.flat();
}

async function collectHackerNews() {
  try {
    const data = await fetchJson('https://hn.algolia.com/api/v1/search_by_date?query=(AI%20OR%20LLM%20OR%20GPT%20OR%20Claude%20OR%20agent%20OR%20MCP)&tags=story&numericFilters=points%3E12&hitsPerPage=20');
    return (data.hits || []).map((hit) => ({
      title: hit.title,
      url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
      date: parseDate(hit.created_at),
      summary: hit.story_text ? stripHtml(hit.story_text).slice(0, 280) : `Hacker News ${hit.points || 0} 分，${hit.num_comments || 0} 条讨论。`,
      sourceId: 'hn',
      sourceWeight: 6,
      region: '全球社区',
      kind: 'community',
      origin: 'hacker-news',
      points: hit.points,
    })).filter((item) => item.title && item.url);
  } catch {
    return [];
  }
}

async function collectShowHn() {
  try {
    const data = await fetchJson('https://hn.algolia.com/api/v1/search_by_date?query=(AI%20OR%20LLM%20OR%20GPT%20OR%20Claude%20OR%20agent%20OR%20MCP%20OR%20open%20source)&tags=show_hn&hitsPerPage=16');
    return (data.hits || []).map((hit) => ({
      title: String(hit.title || '').replace(/^Show HN:\s*/i, ''),
      url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
      date: parseDate(hit.created_at),
      summary: hit.story_text ? stripHtml(hit.story_text).slice(0, 280) : `Show HN ${hit.points || 0} 分，${hit.num_comments || 0} 条讨论。`,
      sourceId: 'show-hn',
      sourceWeight: 8,
      region: '全球社区',
      kind: 'new-site',
      origin: 'show-hn',
      points: hit.points,
    })).filter((item) => item.title && item.url && /^https?:\/\//i.test(item.url));
  } catch {
    return [];
  }
}

async function collectGithubSearch(sinceIso, token) {
  const headers = token ? { authorization: `Bearer ${token}` } : {};
  const queries = [
    `created:>=${sinceIso} (agent OR llm OR mcp OR "ai tool") in:name,description stars:>8`,
    `created:>=${sinceIso} topic:ai-agents stars:>5`,
  ];
  const groups = await mapLimit(queries, 2, async (query) => {
    try {
      const data = await fetchJson(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=10`,
        headers,
      );
      return (data.items || []).map((repo) => ({
        title: `${repo.full_name}: ${repo.description || repo.name}`,
        url: repo.html_url,
        date: parseDate(repo.created_at),
        summary: repo.description || '',
        sourceId: 'github-search',
        sourceWeight: 7,
        region: '全球社区',
        kind: 'new-site',
        origin: 'github-repo',
        repo: repo.full_name,
        stars: repo.stargazers_count,
        license: repo.license?.spdx_id || '',
      }));
    } catch {
      return [];
    }
  });
  const seen = new Set();
  return groups.flat().filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

async function collectAll(watchlist, options = {}) {
  const token = options.token || process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
  const since = new Date(Date.now() - Number(watchlist.lookbackDays || 7) * 24 * 60 * 60 * 1000);
  const sinceIso = since.toISOString().slice(0, 10);
  const fast = Boolean(options.fast);
  const feeds = fast
    ? (watchlist.rssFeeds || []).filter((feed) => !feed.optional).slice(0, 8)
    : (watchlist.rssFeeds || []);
  const repos = fast ? (watchlist.githubRepos || []).slice(0, 6) : (watchlist.githubRepos || []);
  const orgs = fast ? [] : (watchlist.huggingfaceOrgs || []);

  const [rssResults, githubReleases, huggingface, hn, showHn, githubSearch] = await Promise.all([
    mapLimit(feeds, fast ? 8 : 6, collectRss),
    collectGithubAtoms(repos),
    collectHuggingFace(orgs),
    collectHackerNews(),
    collectShowHn(),
    collectGithubSearch(sinceIso, token),
  ]);

  const items = [
    ...rssResults.flatMap((result) => result.items || []),
    ...githubReleases,
    ...huggingface,
    ...hn,
    ...showHn,
    ...githubSearch,
  ];

  return {
    collectedAt: new Date().toISOString(),
    lookbackDays: Number(watchlist.lookbackDays || 7),
    since: sinceIso,
    feedReports: rssResults.map((result) => ({
      id: result.id,
      ok: result.ok,
      optional: result.optional,
      count: (result.items || []).length,
      error: result.error || '',
    })),
    counts: {
      rss: rssResults.reduce((sum, result) => sum + (result.items?.length || 0), 0),
      githubReleases: githubReleases.length,
      huggingface: huggingface.length,
      hn: hn.length,
      showHn: showHn.length,
      githubSearch: githubSearch.length,
      total: items.length,
    },
    items,
  };
}

module.exports = {
  collectAll,
  stripHtml,
  parseDate,
};
