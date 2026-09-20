#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { parseArgs, readUtf8 } = require('./lib/io.cjs');

const args = parseArgs();
const siteRoot = path.resolve(args['site-root'] || path.resolve(__dirname, '..'));
const noPush = Boolean(args['no-push']);

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, { cwd: siteRoot, encoding: 'utf8', ...options });
  if (options.allowFail) return result;
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim();
    throw new Error(`${command} ${commandArgs.join(' ')} 失败${detail ? `：${detail}` : ''}`);
  }
  return result;
}

// Fetch the shared authority first: a stale machine must not publish over it.
run('git', ['fetch', 'origin', 'main', '--quiet']);
if (run('git', ['merge-base', '--is-ancestor', 'origin/main', 'HEAD'], {allowFail:true}).status !== 0) {
  throw new Error('Local checkout is behind or diverges from origin/main. Synchronize before publishing; never force-push a daily issue.');
}
run(process.execPath, [path.join(__dirname, 'sync-reports.cjs'), '--site-root', siteRoot], { stdio: 'inherit' });
run(process.execPath, [path.join(__dirname, 'verify-site.cjs'), '--site-root', siteRoot], { stdio: 'inherit' });
run(process.execPath, [path.join(__dirname, 'verify-archive-history.cjs'), '--base-ref', 'origin/main'], {stdio:'inherit'});
run(process.execPath, [path.join(__dirname, 'render-check.cjs')], { stdio: 'inherit' });

const gitCheck = run('git', ['rev-parse', '--is-inside-work-tree'], { allowFail: true });
if (gitCheck.status !== 0) throw new Error('项目根目录还没有初始化为 Git 仓库。');
const remote = run('git', ['remote', 'get-url', 'origin']).stdout.trim();
if (!/^(?:https:\/\/github\.com\/|git@github\.com:)shixi-11\/(?:alux-)?ai-agent-daily(?:\.git)?$/.test(remote)) {
  throw new Error(`origin 不是 AI Agent Daily 正式仓库：${remote}`);
}
const branch = run('git', ['branch', '--show-current']).stdout.trim();
if (branch !== 'main') throw new Error(`日报只能从 main 分支发布；当前分支为 ${branch}。`);

const manifest = JSON.parse(readUtf8(path.join(siteRoot, 'public/archive.json')));
const releaseDate = String(manifest.latest.date);
const dateCompact = releaseDate.replace(/-/g, '');
const chineseRelative = `content/zh/${dateCompact}_ALUX_AI智能体情报日报.html`;
const englishRelative = `content/en/${dateCompact}.body.html`;
const translationManifestRelative = 'content/en/translation-manifest.json';
const requiredReleaseFiles = [chineseRelative, englishRelative, translationManifestRelative];
for (const relativePath of requiredReleaseFiles) {
  if (!fs.existsSync(path.join(siteRoot, relativePath))) throw new Error(`缺少当期正式发布文件：${relativePath}`);
}

run(process.execPath, [path.join(__dirname, 'verify-release-boundary.cjs'), releaseDate], { stdio: 'inherit' });

function allowed(name) {
  const normalized = name.replace(/\\/g, '/');
  return requiredReleaseFiles.includes(normalized) || normalized.startsWith('public/');
}

function gitNames(gitArgs) {
  return run('git', ['-c', 'core.quotepath=false', ...gitArgs]).stdout.split('\n').map((line) => line.trim()).filter(Boolean);
}

const changedNames = [...new Set([
  ...gitNames(['diff', '--name-only']),
  ...gitNames(['diff', '--cached', '--name-only']),
  ...gitNames(['ls-files', '--others', '--exclude-standard']),
])];
const unexpected = changedNames.filter((name) => !allowed(name));
if (unexpected.length) throw new Error(`检测到日报发布白名单之外的改动，已停止提交：${unexpected.join(', ')}`);

run('git', ['add', '--', ...requiredReleaseFiles, 'public']);
const staged = gitNames(['diff', '--cached', '--name-only']);
const unexpectedStaged = staged.filter((name) => !allowed(name));
if (unexpectedStaged.length) throw new Error(`暂存区包含非正式发布文件，已停止提交：${unexpectedStaged.join(', ')}`);

let commitMessage = '站点已经是最新状态';
const cached = run('git', ['diff', '--cached', '--quiet'], { allowFail: true });
if (cached.status !== 0) {
  commitMessage = `发布 ${releaseDate} 中英双语日报`;
  run('git', ['commit', '-m', commitMessage]);
} else {
  console.log(commitMessage);
}

function equivalentRemoteMain() {
  const fetch = run('git', ['fetch', 'origin', 'main', '--quiet'], { allowFail: true });
  if (fetch.status !== 0) return false;
  const localHead = run('git', ['rev-parse', 'HEAD']).stdout.trim();
  const remoteHeadResult = run('git', ['rev-parse', 'origin/main'], { allowFail: true });
  if (remoteHeadResult.status !== 0) return false;
  const remoteHead = remoteHeadResult.stdout.trim();
  if (localHead === remoteHead) return true;
  const localTree = run('git', ['rev-parse', 'HEAD^{tree}']).stdout.trim();
  const remoteTree = run('git', ['rev-parse', 'origin/main^{tree}']).stdout.trim();
  if (localTree !== remoteTree) return false;
  const rebase = run('git', ['rebase', 'origin/main', '--quiet'], { allowFail: true });
  if (rebase.status !== 0) {
    run('git', ['rebase', '--abort'], { allowFail: true });
    return false;
  }
  return run('git', ['rev-parse', 'HEAD']).stdout.trim() === remoteHead;
}

if (!noPush) {
  if (!equivalentRemoteMain()) {
    const push = run('git', ['push', 'origin', 'main'], { allowFail: true });
    if (push.status !== 0 && !equivalentRemoteMain()) {
      throw new Error('GitHub 推送失败，且远端 main 不是同一份发布内容。');
    }
  }
  console.log(`已直接提交并推送 main，无需 PR 或人工合并：${commitMessage}`);
  run(process.execPath, [path.join(__dirname, 'verify-official-deployment.cjs'), releaseDate], { stdio: 'inherit' });
  console.log('新主地址已部署，且中英首页、最新页、日期页、内容哈希与旧域名单次 308 兼容均已通过验收。');
}
