#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { readUtf8, sha256File, encodeHtml, walkFiles, parseArgs } = require('./lib/io.cjs');
const { locales, localesById, optionalLocales, localeUrl, formatArchiveRange, shanghaiStamp, utcDate } = require('./lib/locales.cjs');
const { convertToUtcDateTime, assertTranslationBody } = require('./lib/html.cjs');

const args = parseArgs();
const siteRoot = path.resolve(args['site-root'] || path.resolve(__dirname, '..'));
const chineseRoot = path.join(siteRoot, 'content/zh');
const englishRoot = path.join(siteRoot, 'content/en');
const publicRoot = path.join(siteRoot, 'public');
if (locales.map(locale => locale.id).join(',') !== 'zh,en') throw new Error('Only reviewed Chinese and English are supported.');
for (const retired of ['zh-Hant', 'ja', 'ko', 'es', 'fr', 'de', 'ar', 'live']) {
  if (fs.existsSync(path.join(publicRoot, retired))) throw new Error(`Retired generated content remains: ${retired}`);
}

const baseUrl = 'https://ai.alux.network';
const basePath = '/daily';
const legacyBaseUrl = 'https://ai-agent-daily.alux.network';
const reportPattern = /^\d{8}_ALUX_AI智能体情报日报\.html$/;

function runNode(script, extra = []) {
  const result = spawnSync(process.execPath, [path.join(__dirname, script), ...extra], {
    cwd: siteRoot,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`${script} 失败，退出码 ${result.status}`);
  }
}

runNode('verify-social-preview.cjs');
runNode('verify-report-master.cjs');

const requiredFiles = [
  'index.html',
  'en/index.html',
  'latest/index.html',
  'en/latest/index.html',
  'archive.json',
  'en/archive.json',
  'feed.xml',
  'en/feed.xml',
  'sitemap.xml',
  'robots.txt',
  '404.html',
  'assets/report-site.css',
  'assets/alux-mark.png',
  'assets/alux-favicon.png',
].map((relative) => path.join(publicRoot, relative));
requiredFiles.push(path.join(englishRoot, 'translation-manifest.json'), path.join(siteRoot, 'vercel.json'));
for (const locale of optionalLocales) {
  requiredFiles.push(path.join(publicRoot, locale.pathPrefix, 'index.html'));
  requiredFiles.push(path.join(publicRoot, locale.pathPrefix, 'archive.json'));
}
for (const file of requiredFiles) {
  if (!fs.existsSync(file)) throw new Error(`缺少站点文件：${file}`);
}

const chineseArchive = JSON.parse(readUtf8(path.join(publicRoot, 'archive.json')));
const englishArchive = JSON.parse(readUtf8(path.join(publicRoot, 'en/archive.json')));
const translationManifest = JSON.parse(readUtf8(path.join(englishRoot, 'translation-manifest.json')));
const latestIssueDate = String(chineseArchive.latest.date);
runNode('verify-freshness.cjs', [latestIssueDate]);
runNode('verify-locale-copy.cjs', [latestIssueDate]);

const chineseReports = chineseArchive.reports || [];
const englishReports = englishArchive.reports || [];
const translationEntries = translationManifest.reports || [];
const sourceFiles = fs.readdirSync(chineseRoot).filter((name) => reportPattern.test(name));
const translationFiles = fs.readdirSync(englishRoot).filter((name) => name.endsWith('.body.html'));
const uniqueCounts = new Set([sourceFiles.length, translationFiles.length, translationEntries.length, chineseReports.length, englishReports.length]);
if (uniqueCounts.size !== 1) {
  throw new Error(`中英内容数量不一致：中文=${sourceFiles.length} 英文=${translationFiles.length} 审核=${translationEntries.length} 中文归档=${chineseReports.length} 英文归档=${englishReports.length}`);
}

for (const archive of [chineseArchive, englishArchive]) {
  if (Number(archive.schemaVersion) !== 3 || String(archive.baseUrl) !== baseUrl) {
    throw new Error('归档清单必须使用 schemaVersion 3，并以新站 origin 作为 baseUrl。');
  }
  if (!String(archive.publicationPath).startsWith(basePath)) {
    throw new Error('归档清单 publicationPath 未迁移到 /daily。');
  }
}

if (String(chineseArchive.generatedAt) !== String(englishArchive.generatedAt)) {
  throw new Error('中英归档的原子发布时间不一致。');
}

const latestReviewedAt = translationEntries.map((entry) => {
  if (entry.status !== 'reviewed' || !String(entry.reviewedAt || '').trim()) {
    throw new Error(`${entry.date} 缺少有效的 reviewedAt。`);
  }
  return convertToUtcDateTime(entry.reviewedAt);
}).sort((a, b) => b - a)[0];
const archiveGeneratedAt = convertToUtcDateTime(chineseArchive.generatedAt);
if (archiveGeneratedAt.getTime() !== latestReviewedAt.getTime()) {
  throw new Error('首页、归档的最近更新时间没有与最新审核状态一起更新。');
}

const englishByDate = new Map();
const translationByDate = new Map();
for (const entry of englishReports) {
  if (englishByDate.has(String(entry.date))) throw new Error(`英文归档日期重复：${entry.date}`);
  englishByDate.set(String(entry.date), entry);
}
for (const entry of translationEntries) {
  if (translationByDate.has(String(entry.date))) throw new Error(`翻译清单日期重复：${entry.date}`);
  translationByDate.set(String(entry.date), entry);
}

const chineseIndex = readUtf8(path.join(publicRoot, 'index.html'));
const englishIndex = readUtf8(path.join(publicRoot, 'en/index.html'));
const sitemap = readUtf8(path.join(publicRoot, 'sitemap.xml'));
const robots = readUtf8(path.join(publicRoot, 'robots.txt'));
const notFound = readUtf8(path.join(publicRoot, '404.html'));
const generatedAtStamp = shanghaiStamp(archiveGeneratedAt);
if (!chineseIndex.includes(generatedAtStamp) || !englishIndex.includes(generatedAtStamp)) {
  throw new Error('中英首页的最近更新时间没有与翻译审核清单同步。');
}
if (!/<title>Agent Daily · AI智能体日报<\/title>/.test(chineseIndex)) throw new Error('中文首页站名不正确。');
if (!/<title>Agent Daily · AI智能体日报<\/title>/.test(englishIndex)) throw new Error('英文首页站名不正确。');

const archiveDates = chineseReports.map((report) => utcDate(String(report.date))).sort((a, b) => a - b);
const expectedChineseDateRange = formatArchiveRange(archiveDates[0], archiveDates.at(-1), localesById.zh);
const expectedEnglishDateRange = formatArchiveRange(archiveDates[0], archiveDates.at(-1), localesById.en);
if (!chineseIndex.includes(`<b>${encodeHtml(expectedChineseDateRange)}</b><span>归档时间范围</span>`)) {
  throw new Error(`中文首页归档时间范围缺少年份或格式错误：应为 ${expectedChineseDateRange}`);
}
if (!englishIndex.includes(`<b>${encodeHtml(expectedEnglishDateRange)}</b><span>Archive Range</span>`)) {
  throw new Error(`英文首页归档时间范围缺少年份或格式错误：应为 ${expectedEnglishDateRange}`);
}

for (const homeCheck of [
  { html: chineseIndex, url: `${baseUrl}${basePath}/` },
  { html: englishIndex, url: `${baseUrl}${basePath}/en/` },
]) {
  if (!homeCheck.html.includes(`rel="canonical" href="${homeCheck.url}"`) || !homeCheck.html.includes(`property="og:url" content="${homeCheck.url}"`)) {
    throw new Error(`首页 canonical 或 og:url 不正确：${homeCheck.url}`);
  }
}
for (const indexCheck of [
  { html: chineseIndex, required: ['href="/daily/en/"', 'hreflang="en"', '/daily/assets/alux-mark.png', '/daily/assets/alux-favicon.png'] },
  { html: englishIndex, required: ['href="/daily/"', 'hreflang="zh-CN"', '/daily/assets/alux-mark.png', '/daily/assets/alux-favicon.png'] },
]) {
  for (const required of indexCheck.required) {
    if (!indexCheck.html.toLowerCase().includes(required.toLowerCase())) {
      throw new Error(`首页缺少双语或品牌元素：${required}`);
    }
  }
}

function assertBilingualSwitch(html, label) {
  const switches = [...html.matchAll(/<span class="language-switch"[^>]*>([\s\S]*?)<\/span>/g)];
  if (switches.length !== 1) throw new Error(`${label}: expected one bilingual switch`);
  const links = switches[0][1].match(/<a\b/g) || [];
  if (links.length !== 2 || !switches[0][1].includes('>中</a>') || !switches[0][1].includes('>EN</a>')) throw new Error(`${label}: expected 中 / EN`);
  if ((switches[0][1].match(/aria-current="page"/g) || []).length !== 1) throw new Error(`${label}: current language missing`);
}
assertBilingualSwitch(chineseIndex, 'Chinese home');
assertBilingualSwitch(englishIndex, 'English home');

for (const locale of optionalLocales) {
  const home = readUtf8(path.join(publicRoot, locale.pathPrefix, 'index.html'));
  if (!home.includes(`lang="${locale.htmlLang}"`)) throw new Error(`${locale.id} 首页 html lang 不正确。`);
  if (!home.includes('language-switch') || !home.includes('>文A<')) {
    throw new Error(`${locale.id} 首页必须使用语种下拉。`);
  }
  if (!home.includes(`>${locale.nativeLabel}<`)) {
    throw new Error(`${locale.id} 首页语言切换缺少 ${locale.nativeLabel}。`);
  }
  if (!home.includes('aria-current="page"') || !home.includes('aria-current="true"')) {
    throw new Error(`${locale.id} 首页当前语言未在切换器上标出。`);
  }
  if (!home.includes(`hreflang="${locale.hreflang}"`)) throw new Error(`${locale.id} 首页缺少自身 hreflang。`);
  if (locale.dir === 'rtl' && !/\sdir="rtl"/.test(home)) throw new Error(`${locale.id} 首页缺少 RTL。`);
}

const seenDates = new Set();
let totalBytes = 0;
for (const chineseReport of chineseReports) {
  const dateIso = String(chineseReport.date);
  if (seenDates.has(dateIso)) throw new Error(`中文归档日期重复：${dateIso}`);
  seenDates.add(dateIso);
  if (!englishByDate.has(dateIso) || !translationByDate.has(dateIso)) {
    throw new Error(`${dateIso} 缺少英文归档或翻译审核记录。`);
  }
  const englishReport = englishByDate.get(dateIso);
  const translationEntry = translationByDate.get(dateIso);
  if (translationEntry.status !== 'reviewed') throw new Error(`${dateIso} 英文状态不是 reviewed。`);

  const sourcePath = path.join(chineseRoot, String(chineseReport.sourceFile));
  const translationPath = path.join(englishRoot, String(translationEntry.translationFile));
  const chinesePublicPath = path.join(publicRoot, String(chineseReport.publicPath));
  const englishPublicPath = path.join(publicRoot, String(englishReport.publicPath));
  for (const file of [sourcePath, translationPath, chinesePublicPath, englishPublicPath]) {
    if (!fs.existsSync(file)) throw new Error(`${dateIso} 缺少文件：${file}`);
  }

  const sourceHash = sha256File(sourcePath);
  const translationHash = sha256File(translationPath);
  const chinesePublicHash = sha256File(chinesePublicPath);
  const englishPublicHash = sha256File(englishPublicPath);
  if (sourceHash !== String(translationEntry.sourceSha256) || sourceHash !== String(chineseReport.sha256)) {
    throw new Error(`${dateIso} 中文母稿哈希与审核清单或归档不一致。`);
  }
  if (translationHash !== String(translationEntry.translationSha256) || translationHash !== String(englishReport.sha256)) {
    throw new Error(`${dateIso} 英文母稿哈希与审核清单或归档不一致。`);
  }
  if (chinesePublicHash !== String(chineseReport.publicSha256) || englishPublicHash !== String(englishReport.publicSha256)) {
    throw new Error(`${dateIso} 公开页哈希与归档清单不一致。`);
  }

  const sourceHtml = readUtf8(sourcePath);
  const translationBody = readUtf8(translationPath);
  assertTranslationBody({ bodyFragment: translationBody, sourceHtml, dateIso, localeId: 'en' });
  const chineseHtml = readUtf8(chinesePublicPath);
  const englishHtml = readUtf8(englishPublicPath);
  for (const html of [chineseHtml, englishHtml]) {
    if (/(?:src|href)\s*=\s*["'](?:file:|[a-z]:[\\/])/i.test(html)) throw new Error(`${dateIso} 公开页含本地引用。`);
    for (const required of ['site:i18n-head:start', 'site:i18n-nav:start', 'site:issue-footer:start', '/daily/assets/alux-mark.png', '/daily/assets/alux-favicon.png']) {
      if (!html.toLowerCase().includes(required.toLowerCase())) throw new Error(`${dateIso} 公开页缺少：${required}`);
    }
    if (html.toLowerCase().includes(legacyBaseUrl.toLowerCase())) throw new Error(`${dateIso} 公开页仍把旧域名作为页面地址。`);
  }
  if (!/lang="zh-CN"/i.test(chineseHtml) || !/lang="en-US"/i.test(englishHtml)) {
    throw new Error(`${dateIso} html lang 不正确。`);
  }
  const expectedZhUrl = baseUrl + String(chineseReport.url);
  const expectedEnUrl = baseUrl + String(englishReport.url);
  if (!chineseHtml.toLowerCase().includes(`rel="canonical" href="${expectedZhUrl}"`.toLowerCase())) throw new Error(`${dateIso} canonical 不正确。`);
  if (!englishHtml.toLowerCase().includes(`rel="canonical" href="${expectedEnUrl}"`.toLowerCase())) throw new Error(`${dateIso} canonical 不正确。`);
  if (!chineseHtml.includes(`href="${englishReport.url}"`) || !englishHtml.includes(`href="${chineseReport.url}"`)) {
    throw new Error(`${dateIso} 语言切换未指向同一期。`);
  }
  const englishWithoutSwitcherLabel = englishHtml.replace(/<span class="language-switch"[^>]*>[\s\S]*?<\/span>/g, '');
  if (/[\u3400-\u9fff]/.test(englishWithoutSwitcherLabel)) throw new Error(`${dateIso} 公开英文页含非切换器中文。`);
  assertBilingualSwitch(chineseHtml, `${dateIso} Chinese`);
  assertBilingualSwitch(englishHtml, `${dateIso} English`);

  if (!chineseIndex.includes(String(chineseReport.url)) || !englishIndex.includes(String(englishReport.url))) {
    throw new Error(`${dateIso} 中英首页缺少日期链接。`);
  }
  if (!sitemap.includes(expectedZhUrl) || !sitemap.includes(expectedEnUrl)) {
    throw new Error(`${dateIso} sitemap 缺少中英 URL。`);
  }
  totalBytes += fs.statSync(chinesePublicPath).size + fs.statSync(englishPublicPath).size;
}

if (chineseArchive.latest.date !== englishArchive.latest.date) throw new Error('中英 latest 日期不一致。');
const latestZh = chineseReports.find((report) => report.date === latestIssueDate);
const latestEn = englishReports.find((report) => report.date === latestIssueDate);
if (!latestZh || !latestEn) throw new Error(`latest 日期不在归档中：${latestIssueDate}`);
if (sha256File(path.join(publicRoot, 'latest/index.html')) !== String(latestZh.publicSha256)
  || sha256File(path.join(publicRoot, 'en/latest/index.html')) !== String(latestEn.publicSha256)) {
  throw new Error('中英 latest 与最新日期页不一致。');
}

for (const assetName of ['alux-mark.png', 'alux-favicon.png']) {
  if (sha256File(path.join(siteRoot, 'assets', assetName)) !== sha256File(path.join(publicRoot, 'assets', assetName))) {
    throw new Error(`ALUX 品牌资产源文件与公开资产不一致：${assetName}`);
  }
}

if (sitemap.toLowerCase().includes(`${baseUrl}${basePath}/latest/`)) {
  throw new Error('sitemap 不应收录 canonical 指向日期页的 latest 别名。');
}
if (!robots.toLowerCase().includes(`sitemap: ${baseUrl}${basePath}/sitemap.xml`.toLowerCase())
  || !notFound.toLowerCase().includes(`href="${basePath}/"`)) {
  throw new Error('robots 或 404 尚未迁移到 /daily 主路径。');
}

const publicTextFiles = walkFiles(publicRoot, (file) => /\.(html|json|xml|txt|css)$/i.test(file));
for (const file of publicTextFiles) {
  const text = readUtf8(file);
  if (text.toLowerCase().includes(legacyBaseUrl.toLowerCase())) {
    throw new Error(`公开成品仍含旧域名：${file}`);
  }
  if (file.endsWith('.html') && text.includes('{{BASE_PATH}}')) {
    throw new Error(`公开成品仍含未替换的 BASE_PATH：${file}`);
  }
}

const vercelConfig = JSON.parse(readUtf8(path.join(siteRoot, 'vercel.json')));
if (vercelConfig.outputDirectory !== 'public' || vercelConfig.framework != null) {
  throw new Error('Vercel 配置必须以 public 为输出目录，并使用 Other（framework: null）。');
}
const presentationSite = 'https://shixilin.com/ai/agent-daily';
for (const legacyHost of ['ai.alux.network', 'ai-agent-daily.alux.network']) {
  const redirectSpecs = [
    { source: '/', destination: presentationSite },
    { source: '/daily', destination: presentationSite },
    { source: '/daily/', destination: presentationSite },
    { source: '/daily/(.*)', destination: `${presentationSite}/$1` },
  ];
  if (legacyHost === 'ai-agent-daily.alux.network') {
    redirectSpecs.push({ source: '/(.*)', destination: `${presentationSite}/$1` });
  }
  for (const spec of redirectSpecs) {
    const matches = (vercelConfig.redirects || []).filter((redirect) => (
      redirect.source === spec.source
      && redirect.destination === spec.destination
      && redirect.permanent === true
      && (redirect.has || []).filter((rule) => rule.type === 'host' && rule.value === legacyHost).length === 1
    ));
    if (matches.length !== 1) throw new Error(`Vercel 缺少个人域名兼容规则：${legacyHost}${spec.source}`);
  }
}
for (const redirect of vercelConfig.redirects || []) {
  const hostRules = (redirect.has || []).filter((rule) => rule.type === 'host');
  if (hostRules.length !== 1 || !['ai.alux.network', 'ai-agent-daily.alux.network'].includes(hostRules[0].value)) {
    throw new Error('Vercel 重定向必须仅匹配两个兼容域名，不能重定向稳定源站。');
  }
}
if (!(vercelConfig.rewrites || []).some((rule) => rule.source === '/daily/(.*)' && rule.destination === '/$1')) {
  throw new Error('Vercel 缺少 /daily 内部映射：/daily/(.*)');
}

console.log(`验证通过：${chineseReports.length} 期中英双语日报，${totalBytes} 字节，latest=${latestIssueDate}`);
console.log(`另有 ${optionalLocales.length} 个可选语种首页；中 / EN 切换已核对。`);
