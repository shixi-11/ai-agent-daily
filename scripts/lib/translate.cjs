'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { readUtf8, writeUtf8 } = require('./io.cjs');

const MINT_ENDPOINT = 'https://cxserver.wikimedia.org/v2/translate';
const USER_AGENT = 'AgentDaily/1.0 (https://shixilin.com/ai/agent-daily; alignment-preserving archive translation)';
const TARGETS = {
  ja: 'ja',
  ko: 'ko',
  es: 'es',
  fr: 'fr',
  de: 'de',
  ar: 'ar',
};

function glossaryPath(siteRoot) {
  return path.join(siteRoot, 'locales/glossary.json');
}

function cacheDir(siteRoot) {
  return path.join(siteRoot, 'content/_mt-cache');
}

function loadGlossary(siteRoot) {
  return JSON.parse(readUtf8(glossaryPath(siteRoot)));
}

function cacheKey(locale, text) {
  return crypto.createHash('sha256').update(`${locale}\n${text}`).digest('hex');
}

function readCache(siteRoot, locale, text) {
  const file = path.join(cacheDir(siteRoot), locale, `${cacheKey(locale, text)}.txt`);
  return fs.existsSync(file) ? readUtf8(file) : null;
}

function writeCache(siteRoot, locale, text, translated) {
  writeUtf8(path.join(cacheDir(siteRoot), locale, `${cacheKey(locale, text)}.txt`), translated);
}

function convertOpenCcHtml(html) {
  const script = path.join(__dirname, 'opencc_html.py');
  const result = spawnSync('python3', [script], {
    input: html,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`OpenCC 失败：${result.stderr || result.error}`);
  }
  return result.stdout;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mintTranslate(html, from, to) {
  const url = `${MINT_ENDPOINT}/${from}/${to}/MinT`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ html }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`MinT ${from}->${to} ${response.status}: ${body.slice(0, 240)}`);
  }
  const payload = await response.json();
  if (!payload || typeof payload.contents !== 'string') {
    throw new Error(`MinT ${from}->${to} 返回空内容`);
  }
  return payload.contents;
}

function encodeWrap(text) {
  return String(text)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>');
}

function decodeWrap(text) {
  return String(text)
    .replace(/<[^>]+>/g, '')
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/&#39;|'/g, "'")
    .trim();
}

async function translateSegments(siteRoot, locale, segments, options = {}) {
  const from = options.from || 'en';
  const to = TARGETS[locale];
  if (!to) throw new Error(`不支持的语种：${locale}`);
  const pending = [];
  const output = segments.map((text) => {
    const cached = readCache(siteRoot, locale, text);
    if (cached != null) return cached;
    pending.push(text);
    return null;
  });
  const unique = [...new Set(pending)];
  const batches = [];
  let current = [];
  let size = 0;
  for (const text of unique) {
    const next = text.length + 40;
    if (current.length && size + next > 2200) {
      batches.push(current);
      current = [];
      size = 0;
    }
    current.push(text);
    size += next;
  }
  if (current.length) batches.push(current);

  const translated = new Map();
  for (const batch of batches) {
    const wrapped = `<div>${batch.map((text, index) => `<p id="s${index}">${encodeWrap(text)}</p>`).join('')}</div>`;
    let resultHtml;
    let lastError;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        resultHtml = await mintTranslate(wrapped, from, to);
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        await delay(800 * (attempt + 1));
      }
    }
    if (lastError) throw lastError;
    batch.forEach((text, index) => {
      const match = resultHtml.match(new RegExp(`<p id="s${index}"[^>]*>([\\s\\S]*?)</p>`, 'i'));
      const value = match ? decodeWrap(match[1]) : '';
      if (!value) throw new Error(`MinT 丢了片段：${text.slice(0, 80)}`);
      translated.set(text, value);
      writeCache(siteRoot, locale, text, value);
    });
    await delay(160);
  }

  return output.map((value, index) => value ?? translated.get(segments[index]));
}

module.exports = {
  TARGETS,
  loadGlossary,
  convertOpenCcHtml,
  translateSegments,
  readCache,
  writeCache,
};
