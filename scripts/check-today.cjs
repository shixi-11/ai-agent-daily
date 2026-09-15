#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { parseArgs } = require('./lib/io.cjs');
const { shanghaiParts, shanghaiDateIso } = require('./lib/locales.cjs');

const args = parseArgs();
const siteRoot = path.resolve(args['site-root'] || path.resolve(__dirname, '..'));
const deadlineHour = Number(args['deadline-hour'] || 22);
const now = shanghaiParts();
const today = shanghaiDateIso();
const yesterdayDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
const yesterday = shanghaiDateIso(yesterdayDate);
const required = now.hour >= deadlineHour ? today : yesterday;
const compact = required.replace(/-/g, '');
const sourceFile = path.join(siteRoot, 'content/zh', `${compact}_ALUX_AI智能体情报日报.html`);
const translationFile = path.join(siteRoot, 'content/en', `${compact}.body.html`);

function exists(file) {
  return fs.existsSync(file) && fs.statSync(file).isFile();
}

console.log(`watchdog shanghai=${today} ${String(now.hour).padStart(2, '0')}:${String(now.minute).padStart(2, '0')} required=${required}`);
if (!exists(sourceFile) || !exists(translationFile)) {
  console.error(`missing issue for ${required}`);
  console.error(`zh: ${exists(sourceFile) ? 'ok' : 'missing'}`);
  console.error(`en: ${exists(translationFile) ? 'ok' : 'missing'}`);
  process.exit(1);
}
console.log(`issue present: ${path.basename(sourceFile)}`);
