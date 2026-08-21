#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const contractFile = path.join(root, 'templates', 'report-master.json');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function fail(message) {
  console.error(`report master verification failed: ${message}`);
  process.exit(1);
}

function classCount(html, className) {
  let count = 0;
  for (const match of html.matchAll(/class\s*=\s*["']([^"']*)["']/gi)) {
    if (match[1].split(/\s+/).includes(className)) count += 1;
  }
  return count;
}

let contract;
try {
  contract = JSON.parse(fs.readFileSync(contractFile, 'utf8'));
} catch (error) {
  fail(`cannot read ${path.relative(root, contractFile)}: ${error.message}`);
}

if (contract.masterVersion !== '2026-08-21-compact-v1') {
  fail(`unexpected masterVersion: ${contract.masterVersion || 'missing'}`);
}
if (contract.layoutVersion !== 'compact-v1') {
  fail(`unexpected layoutVersion: ${contract.layoutVersion || 'missing'}`);
}

const sourceFile = path.resolve(root, contract.sourceFile || '');
if (!sourceFile.startsWith(`${root}${path.sep}`) || !fs.existsSync(sourceFile)) {
  fail(`sourceFile is missing or outside the repository: ${contract.sourceFile || 'missing'}`);
}

const html = fs.readFileSync(sourceFile, 'utf8');
const style = html.match(/<style>([\s\S]*?)<\/style>/i)?.[1]?.trim() || '';

if (sha256(html) !== contract.sourceSha256) {
  fail('sourceSha256 does not match the pinned 2026-08-21 report');
}
if (!style || sha256(style) !== contract.styleSha256) {
  fail('styleSha256 does not match the pinned 2026-08-21 report');
}
if (!/<main\b[^>]*\bdata-layout-version=["']compact-v1["']/i.test(html)) {
  fail('pinned report is not marked data-layout-version="compact-v1"');
}

const effectivePrefix = String(contract.effectiveFrom || '').replace(/-/g, '');
const chineseRoot = path.join(root, 'content', 'zh');
const governedReports = fs.readdirSync(chineseRoot)
  .filter((name) => /^\d{8}_ALUX_AI智能体情报日报\.html$/.test(name) && name.slice(0, 8) >= effectivePrefix)
  .sort();

for (const name of governedReports) {
  const report = fs.readFileSync(path.join(chineseRoot, name), 'utf8');
  const reportStyle = report.match(/<style>([\s\S]*?)<\/style>/i)?.[1]?.trim() || '';
  if (reportStyle !== style) fail(`${name} CSS differs from the pinned master`);
  if (!/<main\b[^>]*\bdata-layout-version=["']compact-v1["']/i.test(report)) {
    fail(`${name} is not marked data-layout-version="compact-v1"`);
  }
  const requiredCounts = {
    stat: 4,
    'heat-row': 4,
    'risc-primer-card': 4,
    radar: 1,
    item: 3,
    matrix: 1
  };
  for (const [className, expected] of Object.entries(requiredCounts)) {
    const actual = classCount(report, className);
    if (actual !== expected) fail(`${name} must contain ${expected} .${className} element(s); found ${actual}`);
  }
  const signals = classCount(report, 'signal');
  const utilityFooters = classCount(report, 'side');
  if (signals < 6 || signals > 10 || utilityFooters !== signals) {
    fail(`${name} must contain 6-10 signal cards and exactly one compact utility footer per signal`);
  }
}

console.log(`report master verified: ${contract.masterVersion} -> ${contract.sourceFile}; governed reports: ${governedReports.length}`);
