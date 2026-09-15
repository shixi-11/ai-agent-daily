#!/usr/bin/env node
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { rewriteDailyText, fallbackDailyPath } = require('./daily-public-presentation.cjs');
const { generateLive } = require('./generate-live.cjs');
const { renderLiveHtml } = require('./lib/live-render.cjs');

const siteRoot = path.resolve(__dirname, '..');
const publicRoot = path.join(siteRoot, 'public');
const port = Number(process.env.PORT || 8080);
const REFRESH_MS = 15 * 60 * 1000;
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

let liveBriefing = null;
let liveRefreshing = false;
let lastLiveError = '';

function loadCachedBriefing() {
  const latest = path.join(publicRoot, 'live/latest.json');
  if (!fs.existsSync(latest)) return null;
  try {
    return JSON.parse(fs.readFileSync(latest, 'utf8'));
  } catch {
    return null;
  }
}

liveBriefing = loadCachedBriefing();

async function refreshLive(force = false) {
  if (liveRefreshing) return liveBriefing;
  liveRefreshing = true;
  try {
    const result = await generateLive(siteRoot, { basePath: '/daily' });
    liveBriefing = result.briefing;
    lastLiveError = '';
    return liveBriefing;
  } catch (error) {
    lastLiveError = String(error.message || error);
    console.error('live refresh failed:', lastLiveError);
    if (!liveBriefing) liveBriefing = loadCachedBriefing();
    if (force) throw error;
    return liveBriefing;
  } finally {
    liveRefreshing = false;
  }
}

function resolvePublic(urlPath) {
  let clean = decodeURIComponent((urlPath || '/').split('?')[0]);
  if (clean === '/') return path.join(publicRoot, 'index.html');
  if (clean === '/daily' || clean === '/daily/') return path.join(publicRoot, 'index.html');
  if (clean === '/ai/agent-daily' || clean === '/ai/agent-daily/') return path.join(publicRoot, 'index.html');
  if (clean.startsWith('/daily/')) clean = clean.slice('/daily'.length);
  else if (clean.startsWith('/ai/agent-daily/')) clean = clean.slice('/ai/agent-daily'.length);
  const relative = clean.replace(/^\/+/, '');
  let candidate = path.resolve(publicRoot, relative);
  if (!candidate.startsWith(publicRoot)) return null;
  if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
    candidate = path.join(candidate, 'index.html');
  } else if (!path.extname(candidate)) {
    const htmlCandidate = `${candidate}.html`;
    const indexCandidate = path.join(candidate, 'index.html');
    if (fs.existsSync(htmlCandidate)) candidate = htmlCandidate;
    else if (fs.existsSync(indexCandidate)) candidate = indexCandidate;
  }
  return fs.existsSync(candidate) && fs.statSync(candidate).isFile() ? candidate : null;
}

function fallbackLocation(urlPath) {
  let clean = decodeURIComponent((urlPath || '/').split('?')[0]);
  let prefix = '/';
  if (clean.startsWith('/ai/agent-daily/')) {
    prefix = '/ai/agent-daily/';
    clean = clean.slice('/ai/agent-daily'.length);
  } else if (clean.startsWith('/daily/')) {
    prefix = '/daily/';
    clean = clean.slice('/daily'.length);
  }
  const fallback = fallbackDailyPath(clean.replace(/^\/+/, ''));
  return fallback ? `${prefix}${fallback}`.replace(/\/{2,}/g, '/') : null;
}

function injectHomeLive(html, urlPath) {
  if (!liveBriefing || !liveBriefing.items || !html.includes('data-live-list')) return html;
  const english = /\/en(\/|$)/.test(urlPath);
  const items = liveBriefing.items.slice(0, 4).map((item) => (
    `<a class="live-story" href="${escapeHtml(item.url)}" target="_blank" rel="noopener"><small>${escapeHtml(item.sourceLabel)}</small><strong>${escapeHtml(item.title)}</strong></a>`
  )).join('');
  const href = english ? '/daily/live/en/' : '/daily/live/';
  const fallback = `<a class="live-strip-fallback" href="${href}">${english ? 'Open the live radar ↗' : '打开完整自动雷达 ↗'}</a>`;
  return html.replace(/<div class="live-strip-list"[^>]*>[\s\S]*?<\/div>/, `<div class="live-strip-list" data-live-list>${items}${fallback}</div>`);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"');
}

const server = http.createServer((req, res) => {
  const urlPath = req.url || '/';
  const pathOnly = urlPath.split('?')[0];

  if (pathOnly === '/api/live.json' || pathOnly === '/daily/api/live.json') {
    const payload = liveBriefing || { ok: false, refreshing: liveRefreshing, error: lastLiveError };
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify(payload));
    if (urlPath.includes('refresh=1')) refreshLive().catch(() => {});
    return;
  }

  if (pathOnly === '/live' || pathOnly === '/live/' || pathOnly === '/daily/live' || pathOnly === '/daily/live/' || pathOnly === '/ai/agent-daily/live' || pathOnly === '/ai/agent-daily/live/') {
    const html = liveBriefing ? renderLiveHtml(liveBriefing, 'zh', '/daily') : (resolvePublic('/live/') ? fs.readFileSync(resolvePublic('/live/')) : Buffer.from('雷达正在采集公开源…'));
    res.writeHead(200, { 'content-type': mimeTypes['.html'], 'cache-control': 'no-store' });
    res.end(typeof html === 'string' ? html : html);
    return;
  }
  if (pathOnly === '/live/en' || pathOnly === '/live/en/' || pathOnly === '/daily/live/en' || pathOnly === '/daily/live/en/' || pathOnly === '/ai/agent-daily/live/en' || pathOnly === '/ai/agent-daily/live/en/') {
    const html = liveBriefing ? renderLiveHtml(liveBriefing, 'en', '/daily') : 'Live radar is collecting public sources…';
    res.writeHead(200, { 'content-type': mimeTypes['.html'], 'cache-control': 'no-store' });
    res.end(html);
    return;
  }

  const filePath = resolvePublic(urlPath);
  if (!filePath) {
    const fallback = fallbackLocation(pathOnly);
    if (fallback) {
      res.writeHead(302, { location: fallback, 'cache-control': 'no-store' });
      res.end();
      return;
    }
    const notFound = path.join(publicRoot, '404.html');
    res.writeHead(404, { 'content-type': mimeTypes['.html'] });
    res.end(fs.existsSync(notFound) ? fs.readFileSync(notFound) : 'Not found');
    return;
  }
  const mime = mimeTypes[path.extname(filePath)] || 'application/octet-stream';
  let body = fs.readFileSync(filePath);
  if (mime.startsWith('text/html')) {
    let html = body.toString('utf8');
    if (filePath.endsWith(`${path.sep}index.html`) && (pathOnly === '/' || pathOnly === '/daily/' || pathOnly === '/daily' || pathOnly.endsWith('/en/') || pathOnly === '/en/' || pathOnly.includes('/ai/agent-daily'))) {
      html = injectHomeLive(html, pathOnly);
    }
    if (pathOnly.startsWith('/ai/agent-daily')) html = rewriteDailyText(html);
    body = Buffer.from(html);
  }
  res.writeHead(200, { 'content-type': mime, 'cache-control': 'no-store' });
  res.end(body);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`agent-daily preview on 0.0.0.0:${port}`);
  refreshLive().catch((error) => console.error(error));
  setInterval(() => {
    refreshLive().catch((error) => console.error(error));
  }, REFRESH_MS).unref();
});
