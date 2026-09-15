const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const AMP = String.fromCharCode(38);

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
}

function writeUtf8(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, String(content).replace(/\r\n/g, '\n'), 'utf8');
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function sha256Text(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function encodeHtml(value) {
  return String(value ?? '')
    .replace(new RegExp(AMP, 'g'), `${AMP}amp;`)
    .replace(/</g, `${AMP}lt;`)
    .replace(/>/g, `${AMP}gt;`)
    .replace(/"/g, `${AMP}quot;`);
}

function decodeHtml(value) {
  return String(value ?? '')
    .replace(new RegExp(`${AMP}nbsp;`, 'gi'), ' ')
    .replace(new RegExp(`${AMP}amp;`, 'gi'), AMP)
    .replace(new RegExp(`${AMP}lt;`, 'gi'), '<')
    .replace(new RegExp(`${AMP}gt;`, 'gi'), '>')
    .replace(new RegExp(`${AMP}quot;`, 'gi'), '"')
    .replace(new RegExp(`${AMP}#39;|${AMP}apos;`, 'gi'), "'");
}

function htmlText(html, pattern) {
  const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern, 'is');
  const match = regex.exec(html);
  if (!match || !match.groups || match.groups.value == null) return '';
  const value = match.groups.value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');
  return decodeHtml(value).trim();
}

function classCount(html, className) {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [...html.matchAll(new RegExp(`\\bclass\\s*=\\s*["'][^"']*\\b${escaped}\\b[^"']*["']`, 'gi'))].length;
}

function externalLinks(html) {
  return [...new Set(
    [...html.matchAll(/\bhref\s*=\s*["'](?<url>https?:\/\/[^"']+)["']/gi)]
      .map((match) => decodeHtml(match.groups.url)),
  )].sort();
}

function copyDirFile(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      (out._ || (out._ = [])).push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) out[key] = true;
    else {
      out[key] = next;
      index += 1;
    }
  }
  return out;
}

function walkFiles(root, predicate = () => true) {
  const results = [];
  if (!fs.existsSync(root)) return results;
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (predicate(full, entry.name)) results.push(full);
    }
  }
  return results;
}

module.exports = {
  readUtf8,
  writeUtf8,
  sha256File,
  sha256Text,
  encodeHtml,
  decodeHtml,
  htmlText,
  classCount,
  externalLinks,
  copyDirFile,
  parseArgs,
  walkFiles,
};
