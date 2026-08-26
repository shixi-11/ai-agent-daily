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

if (contract.masterVersion !== '2026-08-26-editorial-v3.1') {
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
  fail('sourceSha256 does not match the pinned 2026-08-26 report');
}
if (!style || sha256(style) !== contract.styleSha256) {
  fail('styleSha256 does not match the pinned 2026-08-26 report');
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
  if (signals < 6 || signals > 9 || utilityFooters !== signals) {
    fail(`${name} must contain 6-9 signal cards and exactly one compact utility footer per signal`);
  }
  const statBlock = report.match(/<div\s+class=["']stats["'][^>]*>([\s\S]*?)<\/div>\s*<div\s+class=["']judgment["']/i)?.[1] || '';
  const statLabels = Array.from(statBlock.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)).map((match) => match[1].replace(/<[^>]+>/g, '').trim());
  const expectedStatLabels = ['值得关注', '可动手试', '开源发现', '覆盖区域'];
  if (statLabels.length !== 4 || expectedStatLabels.some((label, index) => statLabels[index] !== label)) {
    fail(`${name} hero statistics must be: ${expectedStatLabels.join(' / ')}`);
  }
  const compactLength = (value) => Array.from(String(value || '').replace(/<[^>]+>/g, '').replace(/\s+/g, '')).length;
  const lead = report.match(/<p\s+class=["']lead["'][^>]*>([\s\S]*?)<\/p>/i)?.[1] || '';
  const judgment = report.match(/<div\s+class=["']judgment["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || '';
  if (compactLength(lead) > 70) fail(`${name} hero lead exceeds 70 Chinese characters`);
  if (compactLength(judgment) > 100) fail(`${name} hero judgment exceeds 100 Chinese characters`);
}

console.log(`report master verified: ${contract.masterVersion} -> ${contract.sourceFile}; governed reports: ${governedReports.length}`);
