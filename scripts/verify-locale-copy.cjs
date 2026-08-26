#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const effectiveFrom = '2026-08-26';
const root = path.resolve(__dirname, '..');

function decodeEntities(value) {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ');
}

function textContent(value) {
  return decodeEntities(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function tagBodies(html, tag) {
  return [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi'))].map((match) => match[1]);
}

function words(value) {
  return value.match(/[A-Za-z0-9][A-Za-z0-9'’+.-]*/g) || [];
}

function chineseVisualUnits(value) {
  let units = 0;
  for (const char of value.replace(/\s+/g, '')) units += /[\u3400-\u9fff]/u.test(char) ? 1 : 0.55;
  return units;
}

function sectionHtml(html, titlePattern) {
  const headings = [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)];
  const heading = headings.find((match) => titlePattern.test(textContent(match[1])));
  if (!heading) return '';
  const start = heading.index;
  const end = html.indexOf('</section>', start);
  return end >= 0 ? html.slice(start, end + 10) : '';
}

function validateCopyPair({ date, zhHtml, enHtml }) {
  const errors = [];
  if (date < effectiveFrom) return errors;

  const proseTags = ['h1', 'h2', 'h3', 'p'];
  for (const [locale, html] of [['zh', zhHtml], ['en', enHtml]]) {
    for (const tag of proseTags) {
      for (const body of tagBodies(html, tag)) {
        if (/<br\b/i.test(body)) errors.push(`${locale} ${tag} contains a manual <br> line break`);
        if (/&nbsp;/i.test(body)) errors.push(`${locale} ${tag} contains a non-breaking-space layout patch`);
      }
    }
  }

  const zhHeadings = tagBodies(zhHtml, 'h3').map(textContent);
  const enHeadings = tagBodies(enHtml, 'h3').map(textContent);
  if (zhHeadings.length !== enHeadings.length) errors.push(`h3 count mismatch: zh=${zhHeadings.length}, en=${enHeadings.length}`);

  const zhRadar = tagBodies(sectionHtml(zhHtml, /^AI Agent雷达$/), 'h3').map(textContent);
  const enRadar = tagBodies(sectionHtml(enHtml, /^AI Agent Radar$/i), 'h3').map(textContent);
  if (zhRadar.length !== 3 || enRadar.length !== 3) errors.push(`radar must contain three headings in each locale: zh=${zhRadar.length}, en=${enRadar.length}`);
  zhRadar.forEach((heading, index) => {
    if (chineseVisualUnits(heading) > 20) errors.push(`zh radar heading ${index + 1} exceeds 20 visual units: ${heading}`);
  });

  const danglingEnglish = /\b(?:a|an|and|as|at|by|for|from|in|of|on|or|the|to|with)$/i;
  enHeadings.forEach((heading, index) => {
    const count = words(heading).length;
    if (count < 3 || count > 16) errors.push(`en h3 ${index + 1} must contain 3-16 words: ${heading}`);
    if (danglingEnglish.test(heading)) errors.push(`en h3 ${index + 1} ends with a dangling function word: ${heading}`);
    if (/[，。；：]/u.test(heading)) errors.push(`en h3 ${index + 1} contains Chinese full-width punctuation: ${heading}`);
  });

  const englishParagraphs = tagBodies(enHtml, 'p').map(textContent);
  for (const [paragraphIndex, paragraph] of englishParagraphs.entries()) {
    const sentences = paragraph.split(/(?<=[.!?])\s+/u).filter(Boolean);
    for (const sentence of sentences) {
      if (words(sentence).length > 58) {
        errors.push(`en paragraph ${paragraphIndex + 1} contains a sentence longer than 58 words`);
      }
    }
  }

  const chineseParagraphs = tagBodies(zhHtml, 'p').map(textContent);
  for (const [paragraphIndex, paragraph] of chineseParagraphs.entries()) {
    const sentences = paragraph.split(/[。！？]/u).filter(Boolean);
    for (const sentence of sentences) {
      const cjkCount = [...sentence].filter((char) => /[\u3400-\u9fff]/u.test(char)).length;
      if (cjkCount > 92) errors.push(`zh paragraph ${paragraphIndex + 1} contains a sentence longer than 92 Chinese characters`);
    }
  }

  return errors;
}

function main() {
  const date = process.argv[2];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw new Error('usage: verify-locale-copy.cjs YYYY-MM-DD');
  const compact = date.replace(/-/g, '');
  const zhFile = path.join(root, 'content', 'zh', `${compact}_ALUX_AI智能体情报日报.html`);
  const enFile = path.join(root, 'content', 'en', `${compact}.body.html`);
  if (!fs.existsSync(zhFile) || !fs.existsSync(enFile)) throw new Error(`missing bilingual source files for ${date}`);
  const errors = validateCopyPair({
    date,
    zhHtml: fs.readFileSync(zhFile, 'utf8'),
    enHtml: fs.readFileSync(enFile, 'utf8'),
  });
  if (errors.length) throw new Error(errors.join('\n'));
  process.stdout.write(`locale copy verified: ${date}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { validateCopyPair, chineseVisualUnits };
