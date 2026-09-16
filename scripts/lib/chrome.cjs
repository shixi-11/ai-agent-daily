const { encodeHtml } = require('./io.cjs');
const { locales, localeUrl, datedRelative } = require('./locales.cjs');
const {
  setHtmlLanguage,
  setHtmlDir,
  removeSiteInjection,
  socialPreviewHead,
  stripSocialMeta,
} = require('./html.cjs');

function hreflangLinks(baseUrl, pathsByLocale, availableIds, xDefaultId = 'zh') {
  const base = baseUrl.replace(/\/$/, '');
  const lines = [];
  for (const locale of locales) {
    if (!availableIds.has(locale.id)) continue;
    const href = `${base}${pathsByLocale[locale.id]}`;
    lines.push(`<link rel="alternate" hreflang="${locale.hreflang}" href="${encodeHtml(href)}">`);
  }
  const defaultPath = pathsByLocale[xDefaultId] || pathsByLocale.zh;
  lines.push(`<link rel="alternate" hreflang="x-default" href="${encodeHtml(base + defaultPath)}">`);
  return lines.join('\n');
}

function languageMoreMarkup(locale, pathsByLocale, availableIds, ui) {
  const currentExtra = locale.id !== 'zh' && locale.id !== 'en';
  const mark = currentExtra ? locale.shortLabel : (locale.id === 'en' ? 'More' : '更多');
  const currentAttr = currentExtra ? ' data-current="true"' : '';
  const summaryCurrent = currentExtra ? ' aria-current="true"' : '';
  const label = currentExtra ? `${ui.languageLabel} · ${locale.nativeLabel}` : ui.moreLanguagesLabel;
  const links = locales.map((item) => {
    const href = pathsByLocale[item.id] || localeUrl(item, '/daily', '/');
    const current = locale.id === item.id ? ' aria-current="page"' : '';
    return `      <a href="${encodeHtml(href)}" lang="${item.hreflang}" hreflang="${item.hreflang}"${current}><span class="language-code">${encodeHtml(item.shortLabel)}</span><span class="language-name">${encodeHtml(item.nativeLabel)}</span></a>`;
  }).join('\n');
  return `<details class="language-more"${currentAttr}>
      <summary aria-label="${encodeHtml(label)}"${summaryCurrent}><span class="language-mark">${encodeHtml(mark)}</span><span class="language-caret" aria-hidden="true"></span></summary>
      <div class="language-more-menu">
${links}
      </div>
    </details>`;
}

function languageMoreForHome(locale, basePath) {
  const pathsByLocale = Object.fromEntries(locales.map((item) => [item.id, localeUrl(item, basePath, '/')]));
  return languageMoreMarkup(locale, pathsByLocale, null, locale.ui);
}

function homeHreflangLinks(baseUrl, basePath) {
  const paths = Object.fromEntries(locales.map((locale) => [locale.id, localeUrl(locale, basePath, '/')]));
  return hreflangLinks(baseUrl, paths, new Set(locales.map((locale) => locale.id)));
}

function addReportSiteChrome({
  html,
  locale,
  baseUrl,
  basePath,
  dateIso,
  pathsByLocale,
  availableIds,
  previousPath = '',
  nextPath = '',
}) {
  let page = removeSiteInjection(html);
  page = setHtmlLanguage(page, locale.htmlLang);
  page = setHtmlDir(page, locale.dir);
  const base = baseUrl.replace(/\/$/, '');
  const sitePath = `/${basePath.replace(/^\/|\/$/g, '')}`;
  const canonicalPath = pathsByLocale[locale.id];
  const canonicalUrl = `${base}${canonicalPath}`;
  const socialHead = socialPreviewHead(baseUrl, basePath);
  const ui = locale.ui;
  const socialTitle = `${ui.socialTitle} | ${dateIso}`;
  const socialDescription = ui.socialDescription;
  page = stripSocialMeta(page);

  const available = availableIds || new Set(['zh', 'en']);
  const head = `<!-- site:i18n-head:start -->
<meta property="og:type" content="article">
<meta property="og:title" content="${encodeHtml(socialTitle)}">
<meta property="og:description" content="${encodeHtml(socialDescription)}">
${socialHead}
<link rel="canonical" href="${encodeHtml(canonicalUrl)}">
${hreflangLinks(baseUrl, pathsByLocale, available)}
<meta property="og:locale" content="${locale.ogLocale}">
<meta property="og:url" content="${encodeHtml(canonicalUrl)}">
<link rel="icon" type="image/png" href="${sitePath}/assets/alux-favicon.png">
<link rel="apple-touch-icon" href="${sitePath}/assets/alux-favicon.png">
<link rel="stylesheet" href="${sitePath}/assets/report-site.css">
<!-- site:i18n-head:end -->
`;
  if (!/<\/head>/i.test(page)) throw new Error(`${dateIso} 报告缺少 </head>。`);
  page = page.replace(/<\/head>/i, `${head}\n</head>`);

  const homePath = localeUrl(locale, sitePath, '/');
  const latestPath = localeUrl(locale, sitePath, '/latest/');
  const chinesePath = pathsByLocale.zh;
  const englishPath = pathsByLocale.en;
  const chineseCurrent = locale.id === 'zh' ? ' aria-current="page"' : '';
  const englishCurrent = locale.id === 'en' ? ' aria-current="page"' : '';
  const more = languageMoreMarkup(locale, { ...pathsByLocale, _basePath: sitePath }, new Set([
    'zh',
    'en',
    ...[...available].filter((id) => id !== 'zh' && id !== 'en'),
  ]), ui);

  const nav = `<!-- site:i18n-nav:start -->
<header class="report-sitebar">
  <a class="report-sitebrand" href="${homePath}"><span class="report-sitebrand-mark" aria-hidden="true"><img src="${sitePath}/assets/alux-mark.png" alt=""></span><span class="report-sitebrand-copy"><span>${encodeHtml(ui.brand)}</span><small>${encodeHtml(ui.brandTagline)}</small></span></a>
  <nav class="report-sitenav" aria-label="${encodeHtml(ui.archiveLabel)}">
    <a href="${latestPath}">${encodeHtml(ui.latestLabel)}</a>
    <a href="${homePath}#archive">${encodeHtml(ui.archiveLabel)}</a>
    <span class="language-group">
    <span class="language-switch" aria-label="${encodeHtml(ui.languageLabel)}">
      <a href="${chinesePath}" lang="zh-CN"${chineseCurrent}>中文</a>
      <a href="${englishPath}" lang="en"${englishCurrent}>EN</a>
    </span>
    ${more}
    </span>
  </nav>
</header>
<!-- site:i18n-nav:end -->
`;
  if (!/<body\b[^>]*>/i.test(page)) throw new Error(`${dateIso} 报告缺少 body。`);
  page = page.replace(/<body\b[^>]*>/i, (open) => `${open}\n${nav}`);

  const previousMarkup = previousPath
    ? `<a rel="prev" href="${encodeHtml(previousPath)}">${encodeHtml(ui.previousLabel)}</a>`
    : `<span>${encodeHtml(ui.previousLabel)}</span>`;
  const nextMarkup = nextPath
    ? `<a rel="next" href="${encodeHtml(nextPath)}">${encodeHtml(ui.nextLabel)}</a>`
    : `<span>${encodeHtml(ui.nextLabel)}</span>`;
  const footerCreditMarkup = dateIso >= '2026-09-06'
    ? `<p class="report-credit">${ui.publisherCredit}</p>`
    : `<a href="${homePath}">${encodeHtml(ui.brand)} · ${dateIso}</a>`;
  const footer = `<!-- site:issue-footer:start -->
<footer class="report-sitefooter">
  <div class="report-support"><a href="${encodeHtml(ui.supportUrl)}">${encodeHtml(ui.supportLabel)}</a></div>
  <nav class="issue-nav" aria-label="${encodeHtml(ui.archiveLabel)}">${previousMarkup}${nextMarkup}</nav>
  ${footerCreditMarkup}
</footer>
<!-- site:issue-footer:end -->
`;
  if (!/<\/body>/i.test(page)) throw new Error(`${dateIso} 报告缺少 </body>。`);
  return page.replace(/<\/body>/i, `${footer}\n</body>`);
}

function issuePaths(basePath, dateIso, availableIds) {
  const relative = datedRelative(dateIso);
  const paths = {};
  for (const locale of locales) {
    const hasPage = locale.id === 'zh' || locale.id === 'en' || availableIds.has(locale.id);
    paths[locale.id] = hasPage
      ? localeUrl(locale, basePath, `/${relative}`)
      : localeUrl(locale, basePath, '/');
  }
  return paths;
}

module.exports = {
  hreflangLinks,
  languageMoreMarkup,
  languageMoreForHome,
  homeHreflangLinks,
  addReportSiteChrome,
  issuePaths,
};
