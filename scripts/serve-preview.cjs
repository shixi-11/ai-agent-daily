#!/usr/bin/env node
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { rewriteDailyText, fallbackDailyPath } = require('./daily-public-presentation.cjs');

const siteRoot = path.resolve(__dirname, '..');
const publicRoot = path.join(siteRoot, 'public');
const port = Number(process.env.PORT || 8080);
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

const server = http.createServer((req, res) => {
  const urlPath = req.url || '/';
  const pathOnly = urlPath.split('?')[0];

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
    if (pathOnly.startsWith('/ai/agent-daily')) html = rewriteDailyText(html);
    body = Buffer.from(html);
  }
  res.writeHead(200, { 'content-type': mime, 'cache-control': 'no-store' });
  res.end(body);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`agent-daily preview on 0.0.0.0:${port}`);
});
