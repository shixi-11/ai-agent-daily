#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');
const { parseArgs } = require('./lib/io.cjs');
const { shanghaiParts, shanghaiDateIso } = require('./lib/locales.cjs');
const args = parseArgs();
const root = path.resolve(args['site-root'] || path.resolve(__dirname, '..'));
const now = shanghaiParts();
const today = shanghaiDateIso();
const required = now.hour >= Number(args['deadline-hour'] || 22)
  ? today : shanghaiDateIso(new Date(Date.now() - 86400000));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'content/en/translation-manifest.json'), 'utf8'));
const report = manifest.reports.filter(r => r.date >= required && r.date <= today).sort((a,b) => b.date.localeCompare(a.date))[0];
function matches(dir, file, hash) {
  if (!file || !hash) return false;
  const absolute = path.join(root, 'content', dir, file);
  return fs.existsSync(absolute) && fs.statSync(absolute).size > 0 &&
    createHash('sha256').update(fs.readFileSync(absolute)).digest('hex') === hash;
}
if (!report || report.status !== 'reviewed' ||
    !matches('zh', report.sourceFile, report.sourceSha256) ||
    !matches('en', report.translationFile, report.translationSha256)) {
  console.error(`Missing verified bilingual issue: required=${required}, today=${today}`);
  process.exit(1);
}
console.log(`Verified bilingual issue: ${report.date}; required=${required}`);
