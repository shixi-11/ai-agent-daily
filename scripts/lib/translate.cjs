'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { readUtf8, writeUtf8 } = require('./io.cjs');

const MINT_ENDPOINT = 'https://cxserver.wikimedia.org/v2/translate';
const USER_AGENT = 'AgentDaily/1.0 (https://shixilin.com/ai/agent-daily; alignment-preserving archive translation)';
const TARGETS = {
  zh: 'zh',
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
  return crypto.createHash('sha256').update(`v4\n${locale}\n${text}`).digest('hex');
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

const AMP = String.fromCharCode(38);

function encodeWrap(text) {
  return String(text)
    .replace(new RegExp(AMP, 'g'), `${AMP}amp;`)
    .replace(/</g, `${AMP}lt;`)
    .replace(/>/g, `${AMP}gt;`);
}

function decodeWrap(text) {
  return String(text)
    .replace(/<[^>]+>/g, '')
    .replace(new RegExp(`${AMP}amp;`, 'g'), AMP)
    .replace(new RegExp(`${AMP}lt;`, 'g'), '<')
    .replace(new RegExp(`${AMP}gt;`, 'g'), '>')
    .replace(new RegExp(`${AMP}quot;`, 'g'), '"')
    .replace(new RegExp(`${AMP}#39;|${AMP}apos;`, 'g'), "'")
    .trim();
}

function tidyTranslation(locale, text) {
  let next = String(text || '')
    .replace(/\u2047/g, '')
    .replace(/([A-Za-z0-9])。(com|org|io|ai|dev|net|blog|co)\b/gi, '.$2')
    .replace(/。(\s*)(com|org|io|ai|dev|net|blog)\b/gi, '.$2')
    .replace(/(\d)。(\d)/g, '$1.$2');
  if (locale === 'ja' || locale === 'zh') {
    next = next.replace(/([\u3400-\u9fff\u3040-\u30ff])\s+(?=[\u3400-\u9fff\u3040-\u30ff])/g, '$1');
  }
  if (locale === 'ja') {
    next = next.replace(/\s+([はがをにのとでもへやか])/g, '$1').replace(/([はがをにのとでもへやか])\s+/g, '$1');
  }
  return next.replace(/[ \t]+/g, ' ').trim();
}

function extraLocks(text) {
  const hosts = String(text).match(/\b[\w.-]+\.(?:com|org|io|ai|dev|net|blog|co)\b/gi) || [];
  const repos = String(text).match(/\b[\w.-]+\/[\w.-]+\b/g) || [];
  return [...hosts, ...repos];
}

function lockSegment(text, locks) {
  const terms = [...new Set([...(locks || []), ...extraLocks(text)])]
    .filter((term) => term && String(term).length >= 2)
    .sort((a, b) => b.length - a.length);
  const found = [];
  let next = String(text);
  for (const term of terms) {
    if (!next.includes(term)) continue;
    const token = `ZX${found.length}Q`;
    next = next.split(term).join(token);
    found.push(term);
  }
  return { text: next, found };
}

function unlockSegment(text, found) {
  let next = String(text);
  found.forEach((term, index) => {
    next = next.replace(new RegExp(`ZX\\s*${index}\\s*Q`, 'gi'), term);
  });
  return next
    .replace(/副驾驶/g, 'Copilot')
    .replace(/コピロット/g, 'Copilot')
    .replace(/코피로트/g, 'Copilot')
    .replace(/\bCopilote\b/g, 'Copilot')
    .replace(/Shofox/g, 'Shopify')
    .replace(/克劳德代码/g, 'Claude Code')
    .replace(/クロッドコード/g, 'Claude Code');
}

function applyPrephrases(text, prephrases) {
  let next = String(text);
  for (const [pattern, replacement] of prephrases || []) {
    next = next.replace(new RegExp(pattern, 'gi'), replacement);
  }
  return next;
}

async function translateSegments(siteRoot, locale, segments, options = {}) {
  const from = options.from || 'en';
  const to = TARGETS[locale];
  if (!to) throw new Error(`不支持的语种：${locale}`);
  let glossary;
  try {
    glossary = loadGlossary(siteRoot);
  } catch {
    glossary = { lock: [], prephrases: [] };
  }
  const pending = [];
  const output = segments.map((text) => {
    const cached = readCache(siteRoot, locale, text);
    if (cached != null) return tidyTranslation(locale, cached);
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
    const locked = batch.map((text) => lockSegment(applyPrephrases(text, glossary.prephrases), glossary.lock));
    const wrapped = `<div>${locked.map((item, index) => `<p id="s${index}">${encodeWrap(item.text)}</p>`).join('')}</div>`;
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
      const raw = match ? decodeWrap(match[1]) : '';
      const value = tidyTranslation(locale, unlockSegment(raw, locked[index].found));
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
  tidyTranslation,
  readCache,
  writeCache,
};
