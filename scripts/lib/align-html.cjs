'use strict';

const { encodeHtml } = require('./io.cjs');
const { loadGlossary, convertOpenCcHtml, translateSegments, tidyTranslation } = require('./translate.cjs');

const TAG_SPLIT = /(<[^>]+>)/;
const SKIP = /^(?:[\d\s.,:+\-/%#]+|v?\d[\w.+-]*|GitHub Stars \d+|License(?: not declared)?|许可证(?:未声明)?)$/i;

function extractMain(html) {
  const match = String(html).match(/<main\b[\s\S]*<\/main>/i);
  if (!match) throw new Error('找不到 <main> 片段。');
  return match[0].trim();
}

function injectMachineNote(body, note) {
  if (!note || body.includes('class="machine-note"')) return body;
  const noteHtml = `<p class="machine-note">${encodeHtml(note)}</p>`;
  if (/<p class="lead"[\s\S]*?<\/p>/.test(body)) {
    return body.replace(/(<p class="lead"[\s\S]*?<\/p>)/, `$1${noteHtml}`);
  }
  return body.replace(/<main\b[^>]*>/i, (open) => `${open}${noteHtml}`);
}

function shouldSkip(text) {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (SKIP.test(trimmed)) return true;
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return true;
  if (/^0\d$/.test(trimmed)) return true;
  if (!/[\p{L}]/u.test(trimmed)) return true;
  return false;
}

function applyLabels(text, locale, labels) {
  let next = text;
  const keys = Object.keys(labels).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    const mapped = labels[key]?.[locale];
    if (!mapped) continue;
    next = next.split(key).join(mapped);
  }
  return next;
}

function applyPrephrases(text, prephrases) {
  let next = text;
  for (const [pattern, replacement] of prephrases || []) {
    next = next.replace(new RegExp(pattern, 'gi'), replacement);
  }
  return next;
}

function lockPattern(locks) {
  const terms = [...locks].filter(Boolean).sort((a, b) => b.length - a.length)
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!terms.length) return null;
  return new RegExp(`(${terms.join('|')})`, 'g');
}

function splitLocks(text, locks) {
  const pattern = lockPattern(locks);
  if (!pattern || !pattern.test(text)) return [{ type: 'text', value: text }];
  pattern.lastIndex = 0;
  const parts = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) parts.push({ type: 'text', value: text.slice(last, match.index) });
    parts.push({ type: 'lock', value: match[0] });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) });
  return parts.length ? parts : [{ type: 'text', value: text }];
}

function splitHtml(html) {
  return html.split(TAG_SPLIT);
}

async function alignFromEnglish(siteRoot, locale, englishBody, note) {
  const glossary = loadGlossary(siteRoot);
  const parts = splitHtml(englishBody);
  const jobs = [];
  parts.forEach((part, index) => {
    if (part.startsWith('<') || shouldSkip(part)) return;
    const labelled = applyLabels(part, locale, glossary.labels);
    if (labelled !== part && !/[A-Za-z]{6,}/.test(labelled)) {
      parts[index] = labelled;
      return;
    }
    const prepared = applyPrephrases(labelled, glossary.prephrases);
    const pieces = splitLocks(prepared, glossary.lock);
    const textPieces = pieces.filter((piece) => piece.type === 'text' && !shouldSkip(piece.value) && /[\p{L}]/u.test(piece.value));
    if (!textPieces.length) {
      parts[index] = prepared;
      return;
    }
    jobs.push({ index, pieces, textPieces });
  });

  const unique = [];
  const seen = new Map();
  for (const job of jobs) {
    for (const piece of job.textPieces) {
      if (!seen.has(piece.value)) {
        seen.set(piece.value, unique.length);
        unique.push(piece.value);
      }
      piece.uid = seen.get(piece.value);
    }
  }
  const translated = unique.length
    ? await translateSegments(siteRoot, locale, unique)
    : [];
  for (const job of jobs) {
    let previous = '';
    parts[job.index] = job.pieces.map((piece) => {
      let value = piece.type === 'lock' ? piece.value : (piece.uid == null ? piece.value : translated[piece.uid]);
      if (previous && /[A-Za-z0-9]$/.test(previous) && /^[A-Za-z0-9]/.test(value)) {
        value = ` ${value}`;
      }
      previous = value;
      return value;
    }).join('');
  }
  const body = tidyTranslation(locale, injectMachineNote(parts.join(''), note).replace(/\u2047/g, ''));
  if (/[¤⟦]|\[\[L\d+/.test(body)) throw new Error(`${locale} 译文残留占位符`);
  return body;
}

function alignTraditional(chineseHtml, note) {
  const main = extractMain(chineseHtml);
  return injectMachineNote(convertOpenCcHtml(main), note);
}

module.exports = {
  extractMain,
  injectMachineNote,
  alignFromEnglish,
  alignTraditional,
};
