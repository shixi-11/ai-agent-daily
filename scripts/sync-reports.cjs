#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  readUtf8,
  writeUtf8,
  sha256File,
  encodeHtml,
  copyDirFile,
  parseArgs,
} = require('./lib/io.cjs');
const {
  locales,
  localesById,
  optionalLocales,
  localeUrl,
  localePublicFile,
  datedRelative,
  utcDate,
  formatDate,
  formatArchiveRange,
  shanghaiStamp,
  issueCountLabel,
  fallbackLocale,
} = require('./lib/locales.cjs');
const {
  convertToUtcDateTime,
  setHtmlTitle,
  setDocumentBody,
  extractTitleLead,
  extractEnglishTitleLead,
  assertTranslationBody,
  socialPreviewHead,
} = require('./lib/html.cjs');
const {
  addReportSiteChrome,
  languageMoreForHome,
  homeHreflangLinks,
  issuePaths,
} = require('./lib/chrome.cjs');

const args = parseArgs();
const siteRoot = path.resolve(args['site-root'] || path.resolve(__dirname, '..'));
const sourceRoot = path.resolve(args['source-root'] || path.join(siteRoot, 'content/zh'));
const translationRoot = path.resolve(args['translation-root'] || path.join(siteRoot, 'content/en'));
const baseUrl = String(args['base-url'] || 'https://ai.alux.network').replace(/\/$/, '');
const basePath = `/${String(args['base-path'] || '/daily').replace(/^\/|\/$/g, '')}`;
const publicRoot = path.join(siteRoot, 'public');
const templateRoot = path.join(siteRoot, 'templates');
const assetRoot = path.join(siteRoot, 'assets');
const manifestPath = path.join(translationRoot, 'translation-manifest.json');
const i18nManifestPath = path.join(siteRoot, 'content/i18n-manifest.json');
const reportNamePattern = /^(?<date>\d{8})_ALUX_AI智能体情报日报\.html$/;

for (const directory of [sourceRoot, templateRoot, assetRoot, translationRoot]) {
  if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
    throw new Error(`缺少必要目录：${directory}`);
  }
}
for (const file of [
  path.join(templateRoot, 'index.template.html'),
  path.join(templateRoot, 'index.en.template.html'),
  path.join(templateRoot, 'index.i18n.template.html'),
  path.join(templateRoot, '404.template.html'),
  path.join(assetRoot, 'report-site.css'),
  manifestPath,
]) {
  if (!fs.existsSync(file)) throw new Error(`缺少必要文件：${file}`);
}
fs.mkdirSync(publicRoot, { recursive: true });

const translationManifest = JSON.parse(readUtf8(manifestPath));
if (translationManifest.locale !== 'en-US') throw new Error('翻译清单 locale 必须是 en-US。');
const translationManifestByDate = new Map();
for (const entry of translationManifest.reports || []) {
  const date = String(entry.date);
  if (translationManifestByDate.has(date)) throw new Error(`翻译清单含重复日期：${date}`);
  translationManifestByDate.set(date, entry);
}

const i18nManifest = fs.existsSync(i18nManifestPath)
  ? JSON.parse(readUtf8(i18nManifestPath))
  : { schemaVersion: 1, reports: {} };

const sourceFiles = fs.readdirSync(sourceRoot)
  .filter((name) => reportNamePattern.test(name))
  .sort();
if (!sourceFiles.length) throw new Error(`没有找到符合命名规则的日报：${sourceRoot}`);
if (translationManifestByDate.size !== sourceFiles.length) {
  throw new Error(`翻译清单与中文日报数量不一致：清单 ${translationManifestByDate.size}，中文 ${sourceFiles.length}。`);
}

function reviewedOptional(dateIso, localeId) {
  const entry = i18nManifest.reports?.[dateIso]?.[localeId];
  if (!entry || entry.status !== 'reviewed') return null;
  const file = path.join(siteRoot, 'content', localeId, `${dateIso.replace(/-/g, '')}.body.html`);
  if (!fs.existsSync(file)) return null;
  const hash = sha256File(file);
  if (entry.translationSha256 && entry.translationSha256 !== hash) return null;
  return { file, html: readUtf8(file), hash, entry };
}

const reports = [];
const seenDates = new Set();

for (const name of sourceFiles) {
  const dateToken = name.match(reportNamePattern).groups.date;
  const dateIso = `${dateToken.slice(0, 4)}-${dateToken.slice(4, 6)}-${dateToken.slice(6, 8)}`;
  if (seenDates.has(dateIso)) throw new Error(`同一日期出现多份日报：${dateIso}`);
  seenDates.add(dateIso);
  const date = utcDate(dateIso);
  const sourcePath = path.join(sourceRoot, name);
  const html = readUtf8(sourcePath);
  for (const required of ['<!doctype html', '<html', '<meta', '<title>', '<h1']) {
    if (!html.toLowerCase().includes(required)) throw new Error(`${name} 缺少必要 HTML 结构：${required}`);
  }
  if (!/<meta[^>]+name\s*=\s*["']viewport["']/i.test(html)) throw new Error(`${name} 缺少移动端 viewport。`);
  if (/(?:src|href)\s*=\s*["'](?:file:|[a-z]:[\\/])/i.test(html)) {
    throw new Error(`${name} 含有本地文件引用，无法安全部署。`);
  }

  const translationPath = path.join(translationRoot, `${dateToken}.body.html`);
  if (!fs.existsSync(translationPath)) throw new Error(`${dateIso} 缺少英文母稿：${translationPath}`);
  const englishBody = readUtf8(translationPath);
  assertTranslationBody({ bodyFragment: englishBody, sourceHtml: html, dateIso, localeId: 'en' });

  const sourceHash = sha256File(sourcePath);
  const translationHash = sha256File(translationPath);
  if (!translationManifestByDate.has(dateIso)) throw new Error(`${dateIso} 未进入翻译审核清单。`);
  const translationEntry = translationManifestByDate.get(dateIso);
  if (translationEntry.status !== 'reviewed') {
    throw new Error(`${dateIso} 英文母稿未通过审核：status=${translationEntry.status}`);
  }
  if (String(translationEntry.sourceSha256) !== sourceHash) {
    throw new Error(`${dateIso} 中文源文已改动，英文翻译需重新审核。`);
  }
  if (String(translationEntry.translationSha256) !== translationHash) {
    throw new Error(`${dateIso} 英文母稿已改动，请重新标记 reviewed。`);
  }
  if (!String(translationEntry.reviewedAt || '').trim()) {
    throw new Error(`${dateIso} 英文母稿缺少 reviewedAt，不能确定原子发布时间。`);
  }
  const reviewedAtUtc = convertToUtcDateTime(translationEntry.reviewedAt);

  const zhMeta = extractTitleLead(html);
  const enMeta = extractEnglishTitleLead(englishBody, dateIso);
  const relative = datedRelative(dateIso);
  const optionals = {};
  for (const locale of optionalLocales) {
    const loaded = reviewedOptional(dateIso, locale.id);
    if (!loaded) continue;
    assertTranslationBody({
      bodyFragment: loaded.html,
      sourceHtml: html,
      dateIso,
      localeId: locale.id,
    });
    const titleLead = extractEnglishTitleLead(loaded.html, `${dateIso}/${locale.id}`);
    optionals[locale.id] = { ...loaded, ...titleLead };
  }

  reports.push({
    date,
    dateIso,
    dateToken,
    sourceFile: name,
    translationFile: `${dateToken}.body.html`,
    sourceHtml: html,
    englishBody,
    sourceSha256: sourceHash,
    translationSha256: translationHash,
    reviewedAtUtc,
    reviewedAt: String(translationEntry.reviewedAt),
    titleMain: zhMeta.titleEn,
    titleSubject: zhMeta.titleCn,
    title: zhMeta.displayTitle,
    lead: zhMeta.lead,
    titleEn: enMeta.displayTitle,
    leadEn: enMeta.lead,
    url: `${basePath}/${relative}`,
    englishUrl: `${basePath}/en/${relative}`,
    publicPath: `${relative}index.html`,
    englishPublicPath: `en/${relative}index.html`,
    optionals,
    availableIds: new Set(['zh', 'en', ...Object.keys(optionals)]),
  });
}

reports.sort((a, b) => a.dateIso.localeCompare(b.dateIso));

for (let index = 0; index < reports.length; index += 1) {
  const report = reports[index];
  const previous = reports[index - 1];
  const next = reports[index + 1];
  const pathsByLocale = issuePaths(basePath, report.dateIso, report.availableIds);

  const chinesePage = addReportSiteChrome({
    html: report.sourceHtml,
    locale: localesById.zh,
    baseUrl,
    basePath,
    dateIso: report.dateIso,
    pathsByLocale,
    availableIds: report.availableIds,
    previousPath: previous ? previous.url : '',
    nextPath: next ? next.url : '',
  });
  const englishPage = addReportSiteChrome({
    html: setHtmlTitle(
      setDocumentBody(report.sourceHtml, report.englishBody),
      `${report.dateIso} ALUX AI Agent Intelligence Daily`,
    ),
    locale: localesById.en,
    baseUrl,
    basePath,
    dateIso: report.dateIso,
    pathsByLocale,
    availableIds: report.availableIds,
    previousPath: previous ? previous.englishUrl : '',
    nextPath: next ? next.englishUrl : '',
  });

  const chineseDestination = path.join(publicRoot, report.publicPath);
  const englishDestination = path.join(publicRoot, report.englishPublicPath);
  writeUtf8(chineseDestination, chinesePage);
  writeUtf8(englishDestination, englishPage);
  report.publicSha256 = sha256File(chineseDestination);
  report.englishPublicSha256 = sha256File(englishDestination);

  for (const [localeId, optional] of Object.entries(report.optionals)) {
    const locale = localesById[localeId];
    const page = addReportSiteChrome({
      html: setHtmlTitle(
        setDocumentBody(report.sourceHtml, optional.html),
        `${report.dateIso} ${locale.ui.issueTitleSuffix}`,
      ),
      locale,
      baseUrl,
      basePath,
      dateIso: report.dateIso,
      pathsByLocale,
      availableIds: report.availableIds,
      previousPath: previous && previous.availableIds.has(localeId)
        ? issuePaths(basePath, previous.dateIso, previous.availableIds)[localeId]
        : '',
      nextPath: next && next.availableIds.has(localeId)
        ? issuePaths(basePath, next.dateIso, next.availableIds)[localeId]
        : '',
    });
    const dest = path.join(publicRoot, localePublicFile(locale, `${datedRelative(report.dateIso)}index.html`));
    writeUtf8(dest, page);
    optional.publicPath = localePublicFile(locale, `${datedRelative(report.dateIso)}index.html`);
    optional.publicSha256 = sha256File(dest);
    optional.url = pathsByLocale[localeId];
  }
}

const reportsDescending = [...reports].sort((a, b) => b.dateIso.localeCompare(a.dateIso));
const latest = reportsDescending[0];
const earliest = reports[0];
const generatedAtRaw = reportsDescending
  .map((report) => ({ at: report.reviewedAtUtc.getTime(), raw: report.reviewedAt }))
  .sort((a, b) => b.at - a.at)[0];
const generatedAtUtc = new Date(generatedAtRaw.at);
const generatedAtStamp = shanghaiStamp(generatedAtUtc);
const monthCount = new Set(reports.map((report) => report.dateIso.slice(0, 7))).size;

writeUtf8(path.join(publicRoot, 'latest/index.html'), readUtf8(path.join(publicRoot, latest.publicPath)));
writeUtf8(path.join(publicRoot, 'en/latest/index.html'), readUtf8(path.join(publicRoot, latest.englishPublicPath)));
for (const locale of optionalLocales) {
  const translated = reportsDescending.find((report) => report.optionals[locale.id]);
  if (!translated) continue;
  const from = path.join(publicRoot, translated.optionals[locale.id].publicPath);
  writeUtf8(path.join(publicRoot, localePublicFile(locale, 'latest/index.html')), readUtf8(from));
}

const publicAssetRoot = path.join(publicRoot, 'assets');
fs.mkdirSync(publicAssetRoot, { recursive: true });
for (const asset of ['agent-daily-social-v1.png', 'report-site.css', 'alux-mark.png', 'alux-favicon.png']) {
  copyDirFile(path.join(assetRoot, asset), path.join(publicAssetRoot, asset));
}

function archiveMarkup(items, locale, latestDateIso) {
  const groups = new Map();
  for (const report of items) {
    const key = report.dateIso.slice(0, 7);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(report);
  }
  const monthKeys = [...groups.keys()].sort().reverse();
  const lines = [];
  for (const key of monthKeys) {
    const group = groups.get(key);
    const monthDate = utcDate(`${key}-01`);
    const monthLabel = formatDate(monthDate, locale, 'month');
    lines.push(`<section class="archive-group" aria-labelledby="month-${locale.htmlLang}-${key}">`);
    lines.push('  <div class="month-strip">');
    lines.push(`    <h3 id="month-${locale.htmlLang}-${key}">${encodeHtml(monthLabel)}</h3>`);
    lines.push(`    <span>${encodeHtml(issueCountLabel(locale, group.length))}</span>`);
    lines.push('  </div>');
    lines.push('  <div class="report-list">');
    for (const report of group) {
      const isLatest = report.dateIso === latestDateIso;
      const latestClass = isLatest ? ' is-latest' : '';
      const latestLabel = isLatest ? `<span class="latest-pill">${encodeHtml(locale.ui.latestPill)}</span>` : '';
      const translated = locale.id === 'zh' || locale.id === 'en' || Boolean(report.optionals[locale.id]);
      const url = locale.id === 'zh'
        ? report.url
        : locale.id === 'en'
          ? report.englishUrl
          : translated
            ? report.optionals[locale.id].url
            : (fallbackLocale(locale).id === 'zh' ? report.url : report.englishUrl);
      const title = locale.id === 'zh'
        ? report.title
        : locale.id === 'en'
          ? report.titleEn
          : translated
            ? report.optionals[locale.id].displayTitle
            : report.titleEn;
      const lead = locale.id === 'zh'
        ? report.lead
        : locale.id === 'en'
          ? report.leadEn
          : translated
            ? report.optionals[locale.id].lead
            : report.leadEn;
      const monthShort = formatDate(report.date, locale, 'monthShort');
      lines.push(`    <a class="report-row${latestClass}" href="${encodeHtml(url)}">`);
      lines.push(`      <time datetime="${report.dateIso}"><b>${String(report.date.getUTCDate()).padStart(2, '0')}</b><span>${encodeHtml(monthShort)}</span></time>`);
      lines.push(`      <div class="report-copy">${latestLabel}<strong>${encodeHtml(title)}</strong><p>${encodeHtml(lead)}</p></div>`);
      lines.push('      <span class="report-arrow" aria-hidden="true">↗</span>');
      lines.push('    </a>');
    }
    lines.push('  </div>');
    lines.push('</section>');
  }
  return lines.join('\n').trim();
}

function fillTemplate(template, map) {
  let html = template;
  for (const [key, value] of Object.entries(map)) {
    html = html.split(key).join(String(value));
  }
  return html;
}

function rssXml(locale, items) {
  const home = `${baseUrl}${localeUrl(locale, basePath, '/')}`;
  const entries = items.slice(0, 30).map((report) => {
    const translated = locale.id === 'zh' || locale.id === 'en' || Boolean(report.optionals[locale.id]);
    if (!translated && locale.id !== 'zh' && locale.id !== 'en') return '';
    const url = locale.id === 'zh'
      ? `${baseUrl}${report.url}`
      : locale.id === 'en'
        ? `${baseUrl}${report.englishUrl}`
        : `${baseUrl}${report.optionals[locale.id].url}`;
    const title = locale.id === 'zh'
      ? report.title
      : locale.id === 'en'
        ? report.titleEn
        : report.optionals[locale.id].displayTitle;
    const lead = locale.id === 'zh'
      ? report.lead
      : locale.id === 'en'
        ? report.leadEn
        : report.optionals[locale.id].lead;
    const pubDate = new Date(`${report.dateIso}T00:00:00+08:00`).toUTCString();
    return `    <item>
      <title>${encodeHtml(`${report.dateIso} ${title}`)}</title>
      <link>${encodeHtml(url)}</link>
      <guid>${encodeHtml(url)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${encodeHtml(lead)}</description>
    </item>`;
  }).filter(Boolean).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${encodeHtml(locale.ui.socialTitle)}</title>
    <link>${encodeHtml(home)}</link>
    <description>${encodeHtml(locale.ui.socialDescription)}</description>
    <language>${locale.hreflang}</language>
${entries}
  </channel>
</rss>
`;
}

const chineseArchiveMarkup = archiveMarkup(reportsDescending, localesById.zh, latest.dateIso);
const englishArchiveMarkup = archiveMarkup(reportsDescending, localesById.en, latest.dateIso);
const chineseDateRange = formatArchiveRange(earliest.date, latest.date, localesById.zh);
const englishDateRange = formatArchiveRange(earliest.date, latest.date, localesById.en);
const socialHead = socialPreviewHead(baseUrl, basePath);
const hreflangHome = homeHreflangLinks(baseUrl, basePath);

const chineseIndex = fillTemplate(readUtf8(path.join(templateRoot, 'index.template.html')), {
  '{{HREFLANG_LINKS}}': hreflangHome,
  '{{LANGUAGE_MORE}}': languageMoreForHome(localesById.zh, basePath),
  '{{SOCIAL_PREVIEW_HEAD}}': socialHead,
  '{{BASE_URL}}': baseUrl,
  '{{BASE_PATH}}': basePath,
  '{{LATEST_DATE_ISO}}': latest.dateIso,
  '{{LATEST_DATE_ZH}}': formatDate(latest.date, localesById.zh),
  '{{LATEST_URL}}': latest.url,
  '{{LATEST_TITLE_MAIN}}': encodeHtml(latest.titleMain),
  '{{LATEST_TITLE_SUBJECT}}': encodeHtml(latest.titleSubject),
  '{{LATEST_LEAD}}': encodeHtml(latest.lead),
  '{{REPORT_COUNT}}': String(reports.length),
  '{{DATE_RANGE}}': encodeHtml(chineseDateRange),
  '{{MONTH_COUNT}}': String(monthCount),
  '{{ARCHIVE_GROUPS}}': chineseArchiveMarkup,
  '{{GENERATED_AT}}': generatedAtStamp,
});
writeUtf8(path.join(publicRoot, 'index.html'), chineseIndex);

const englishIndex = fillTemplate(readUtf8(path.join(templateRoot, 'index.en.template.html')), {
  '{{HREFLANG_LINKS}}': hreflangHome,
  '{{LANGUAGE_MORE}}': languageMoreForHome(localesById.en, basePath),
  '{{SOCIAL_PREVIEW_HEAD}}': socialHead,
  '{{BASE_URL}}': baseUrl,
  '{{BASE_PATH}}': basePath,
  '{{LATEST_DATE_ISO}}': latest.dateIso,
  '{{LATEST_DATE_EN}}': formatDate(latest.date, localesById.en),
  '{{LATEST_URL}}': latest.englishUrl,
  '{{LATEST_TITLE}}': encodeHtml(latest.titleEn),
  '{{LATEST_LEAD}}': encodeHtml(latest.leadEn),
  '{{REPORT_COUNT}}': String(reports.length),
  '{{DATE_RANGE}}': encodeHtml(englishDateRange),
  '{{MONTH_COUNT}}': String(monthCount),
  '{{ARCHIVE_GROUPS}}': englishArchiveMarkup,
  '{{GENERATED_AT}}': generatedAtStamp,
});
writeUtf8(path.join(publicRoot, 'en/index.html'), englishIndex);

const i18nTemplate = readUtf8(path.join(templateRoot, 'index.i18n.template.html'));
for (const locale of optionalLocales) {
  const ui = locale.ui;
  const translatedLatest = reportsDescending.find((report) => report.optionals[locale.id]);
  const fallback = fallbackLocale(locale);
  const fallbackLatestPath = localeUrl(fallback, basePath, '/latest/');
  const fallbackIssuePath = fallback.id === 'zh' ? latest.url : latest.englishUrl;
  const latestTitle = translatedLatest ? translatedLatest.optionals[locale.id].displayTitle : latest.titleEn;
  const latestLead = translatedLatest ? translatedLatest.optionals[locale.id].lead : latest.leadEn;
  const latestUrl = translatedLatest ? translatedLatest.optionals[locale.id].url : fallbackIssuePath;
  const latestHref = translatedLatest ? localeUrl(locale, basePath, '/latest/') : fallbackLatestPath;
  const untranslatedNote = translatedLatest
    ? ''
    : `<p class="intro untranslated-note">${encodeHtml(ui.untranslated)}</p>`;
  const intro2 = ui.intro2 ? `<p class="intro">${encodeHtml(ui.intro2)}</p>` : '';
  const dirAttr = locale.dir === 'rtl' ? ' dir="rtl"' : '';
  const html = fillTemplate(i18nTemplate, {
    '{{HTML_LANG}}': locale.htmlLang,
    '{{DIR_ATTR}}': dirAttr,
    '{{OG_LOCALE}}': locale.ogLocale,
    '{{BRAND}}': encodeHtml(ui.brand),
    '{{BRAND_TAGLINE}}': encodeHtml(ui.brandTagline),
    '{{HOME_TITLE_HTML}}': ui.homeTitleHtml,
    '{{HOME_SUBTITLE}}': encodeHtml(ui.homeSubtitle),
    '{{INTRO1}}': encodeHtml(ui.intro1),
    '{{INTRO2_BLOCK}}': intro2,
    '{{UNTRANSLATED_BLOCK}}': untranslatedNote,
    '{{LATEST_LABEL}}': encodeHtml(ui.latestLabel),
    '{{ARCHIVE_LABEL}}': encodeHtml(ui.archiveLabel),
    '{{LANGUAGE_LABEL}}': encodeHtml(ui.languageLabel),
    '{{OWNER_NAV}}': encodeHtml(ui.ownerNav),
    '{{FACT_ISSUES}}': encodeHtml(ui.factIssues),
    '{{FACT_MONTHS}}': encodeHtml(ui.factMonths),
    '{{FACT_RANGE}}': encodeHtml(ui.factRange),
    '{{READ_LATEST}}': encodeHtml(ui.readLatest),
    '{{LATEST_PERMALINK}}': encodeHtml(ui.latestPermalink),
    '{{ARCHIVE_TITLE}}': encodeHtml(ui.archiveTitle),
    '{{ARCHIVE_BLURB}}': encodeHtml(ui.archiveBlurb),
    '{{ARCHIVE_NOTE}}': encodeHtml(ui.archiveNote),
    '{{LAST_UPDATED}}': encodeHtml(ui.lastUpdated),
    '{{ARCHIVE_MANIFEST}}': encodeHtml(ui.archiveManifest),
    '{{SUPPORT_LABEL}}': encodeHtml(ui.supportLabel),
    '{{SUPPORT_URL}}': encodeHtml(ui.supportUrl),
    '{{SOCIAL_TITLE}}': encodeHtml(ui.socialTitle),
    '{{SOCIAL_DESCRIPTION}}': encodeHtml(ui.socialDescription),
    '{{HOME_HREF}}': localeUrl(locale, basePath, '/'),
    '{{LATEST_HREF}}': latestHref,
    '{{ARCHIVE_JSON_HREF}}': localeUrl(locale, basePath, '/').replace(/\/$/, '/archive.json'),
    '{{HREFLANG_LINKS}}': hreflangHome,
    '{{LANGUAGE_MORE}}': languageMoreForHome(locale, basePath),
    '{{SOCIAL_PREVIEW_HEAD}}': socialHead,
    '{{BASE_URL}}': baseUrl,
    '{{BASE_PATH}}': basePath,
    '{{CANONICAL}}': `${baseUrl}${localeUrl(locale, basePath, '/')}`,
    '{{LATEST_DATE_ISO}}': latest.dateIso,
    '{{LATEST_DATE_LOCAL}}': encodeHtml(formatDate(latest.date, locale)),
    '{{LATEST_URL}}': latestUrl,
    '{{LATEST_TITLE}}': encodeHtml(latestTitle),
    '{{LATEST_LEAD}}': encodeHtml(latestLead),
    '{{REPORT_COUNT}}': String(reports.length),
    '{{DATE_RANGE}}': encodeHtml(formatArchiveRange(earliest.date, latest.date, locale)),
    '{{MONTH_COUNT}}': String(monthCount),
    '{{ARCHIVE_GROUPS}}': archiveMarkup(reportsDescending, locale, latest.dateIso),
    '{{GENERATED_AT}}': generatedAtStamp,
  });
  writeUtf8(path.join(publicRoot, localePublicFile(locale, 'index.html')), html);

  const payload = {
    schemaVersion: 3,
    locale: locale.bcp47,
    generatedAt: generatedAtRaw.raw,
    baseUrl,
    publicationPath: locale.pathPrefix ? `${basePath}/${locale.pathPrefix}` : basePath,
    publicationUrl: `${baseUrl}${localeUrl(locale, basePath, '/')}`,
    latest: {
      date: latest.dateIso,
      url: latestUrl,
      latestUrl: translatedLatest ? localeUrl(locale, basePath, '/latest/') : fallbackLatestPath,
      alternateUrl: latest.url,
    },
    reports: reportsDescending.map((report) => {
      const translated = Boolean(report.optionals[locale.id]);
      return {
        date: report.dateIso,
        title: translated ? report.optionals[locale.id].displayTitle : report.titleEn,
        lead: translated ? report.optionals[locale.id].lead : report.leadEn,
        url: translated
          ? report.optionals[locale.id].url
          : (fallbackLocale(locale).id === 'zh' ? report.url : report.englishUrl),
        alternateUrl: report.url,
        publicPath: translated ? report.optionals[locale.id].publicPath : null,
        translated,
      };
    }),
  };
  writeUtf8(path.join(publicRoot, localePublicFile(locale, 'archive.json')), `${JSON.stringify(payload, null, 2)}\n`);
  writeUtf8(path.join(publicRoot, localePublicFile(locale, 'feed.xml')), rssXml(locale, reportsDescending));
}

const chineseArchivePayload = {
  schemaVersion: 3,
  locale: 'zh-CN',
  generatedAt: generatedAtRaw.raw,
  baseUrl,
  publicationPath: basePath,
  publicationUrl: `${baseUrl}${basePath}/`,
  latest: {
    date: latest.dateIso,
    url: latest.url,
    latestUrl: `${basePath}/latest/`,
    alternateUrl: latest.englishUrl,
  },
  reports: reportsDescending.map((report) => ({
    date: report.dateIso,
    title: report.title,
    lead: report.lead,
    url: report.url,
    alternateUrl: report.englishUrl,
    publicPath: report.publicPath,
    sourceFile: report.sourceFile,
    sha256: report.sourceSha256,
    publicSha256: report.publicSha256,
  })),
};
writeUtf8(path.join(publicRoot, 'archive.json'), `${JSON.stringify(chineseArchivePayload, null, 2)}\n`);

const englishArchivePayload = {
  schemaVersion: 3,
  locale: 'en-US',
  generatedAt: generatedAtRaw.raw,
  baseUrl,
  publicationPath: `${basePath}/en`,
  publicationUrl: `${baseUrl}${basePath}/en/`,
  latest: {
    date: latest.dateIso,
    url: latest.englishUrl,
    latestUrl: `${basePath}/en/latest/`,
    alternateUrl: latest.url,
  },
  reports: reportsDescending.map((report) => ({
    date: report.dateIso,
    title: report.titleEn,
    lead: report.leadEn,
    url: report.englishUrl,
    alternateUrl: report.url,
    publicPath: report.englishPublicPath,
    sourceFile: report.translationFile,
    sha256: report.translationSha256,
    publicSha256: report.englishPublicSha256,
  })),
};
writeUtf8(path.join(publicRoot, 'en/archive.json'), `${JSON.stringify(englishArchivePayload, null, 2)}\n`);
writeUtf8(path.join(publicRoot, 'feed.xml'), rssXml(localesById.zh, reportsDescending));
writeUtf8(path.join(publicRoot, 'en/feed.xml'), rssXml(localesById.en, reportsDescending));

const sitemapPairs = [{ zh: `${baseUrl}${basePath}/`, en: `${baseUrl}${basePath}/en/` }];
for (const locale of optionalLocales) {
  sitemapPairs[0][locale.id] = `${baseUrl}${localeUrl(locale, basePath, '/')}`;
}
for (const report of reportsDescending) {
  const pair = { zh: `${baseUrl}${report.url}`, en: `${baseUrl}${report.englishUrl}` };
  for (const locale of optionalLocales) {
    if (report.optionals[locale.id]) pair[locale.id] = `${baseUrl}${report.optionals[locale.id].url}`;
  }
  sitemapPairs.push(pair);
}
const sitemapItems = [];
for (const pair of sitemapPairs) {
  const ids = Object.keys(pair);
  for (const id of ids) {
    sitemapItems.push('  <url>');
    sitemapItems.push(`    <loc>${encodeHtml(pair[id])}</loc>`);
    for (const locale of locales) {
      if (!pair[locale.id]) continue;
      sitemapItems.push(`    <xhtml:link rel="alternate" hreflang="${locale.hreflang}" href="${encodeHtml(pair[locale.id])}" />`);
    }
    sitemapItems.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${encodeHtml(pair.zh)}" />`);
    sitemapItems.push('  </url>');
  }
}
const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  ...sitemapItems,
  '</urlset>',
].join('\n');
writeUtf8(path.join(publicRoot, 'sitemap.xml'), sitemap);
writeUtf8(path.join(publicRoot, 'robots.txt'), `User-agent: *\nAllow: ${basePath}/\nSitemap: ${baseUrl}${basePath}/sitemap.xml\n`);

const notFoundTemplate = readUtf8(path.join(templateRoot, '404.template.html')).replaceAll('{{BASE_PATH}}', basePath);
writeUtf8(path.join(publicRoot, '404.html'), notFoundTemplate);

const optionalCount = reports.reduce((sum, report) => sum + Object.keys(report.optionals).length, 0);
console.log(`已同步 ${reports.length} 期中英双语日报：${earliest.dateIso} 至 ${latest.dateIso}`);
console.log(`可选语种已发布日期页 ${optionalCount} 篇；9 个语种首页已生成。`);
console.log(`最新固定归档：${latest.url} / ${latest.englishUrl}`);
console.log(`最新入口：${basePath}/latest/ / ${basePath}/en/latest/`);
