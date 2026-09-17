'use strict';

const fs = require('fs');
const path = require('path');
const { encodeHtml } = require('./io.cjs');
const { locales, localeUrl, localesById, utcDate, formatDate } = require('./locales.cjs');
const { languageMoreMarkup } = require('./chrome.cjs');

const liveChrome = JSON.parse(fs.readFileSync(path.join(__dirname, '../../locales/live-chrome.json'), 'utf8'));

function chromeOf(locale) {
  return liveChrome[locale] || liveChrome.en;
}

const PAGE_CSS = `
:root{--ink:#111827;--muted:#5b6575;--subtle:#7a8493;--bg:#f5f7fa;--panel:#fff;--line:#d9e0e7;--line-strong:#aeb9c6;--indigo:#22356f;--teal:#0f766e;--navy:#14213d;--soft:#e7edf2}
*{box-sizing:border-box} html{overflow-x:hidden}
body{margin:0;background:linear-gradient(180deg,#eef3f7 0%,#f8fafc 38%,#f3f6f8 100%);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",Arial,sans-serif;line-height:1.66}
a{color:var(--indigo);text-decoration:none;border-bottom:1px solid rgba(34,53,111,.26)} a:hover{border-bottom-color:var(--indigo)}
.page{max-width:1240px;margin:0 auto;padding:26px 22px 56px}
.live-banner{display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center;margin:8px 0 22px;color:var(--subtle);font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase}
.live-banner b{display:inline-flex;align-items:center;min-height:28px;padding:0 9px;border:1px solid #c6d9d1;background:#eef5f2;color:#0f5e55;letter-spacing:.08em}
.hero{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(320px,.95fr);gap:28px;align-items:stretch;border-bottom:1px solid var(--line-strong);padding:0 0 32px}
.hero h1{font-family:"Songti SC","Noto Serif CJK SC","SimSun",Georgia,serif;font-size:clamp(36px,5.4vw,64px);line-height:1.08;margin:10px 0 16px;color:#121722}
.title-en{display:block;font-family:Georgia,"Times New Roman",serif;color:#18264f}
.title-cn{display:block;margin-top:10px;font-size:clamp(24px,3.8vw,40px);line-height:1.25;color:#10201d}
.lead,.judgment{color:#374151}.lead{font-size:clamp(16px,1.6vw,19px);max-width:700px;margin:0}
.stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:24px 0 0}
.stat{border:1px solid var(--line);background:rgba(255,255,255,.72);padding:12px 14px;min-height:76px}
.stat b{display:block;font-size:22px;color:#18264f;font-variant-numeric:tabular-nums}
.stat span{display:block;margin-top:7px;color:var(--muted);font-size:12px}
.judgment{margin-top:18px;padding:18px 20px;background:#fff;border:1px solid var(--line-strong)}
.intel{background:#fff;border:1px solid var(--line-strong);padding:20px;display:grid;gap:14px}
.panel-head{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid var(--line);padding-bottom:12px}
.panel-head strong{font-size:18px;color:#13203a}
.panel-head span{font-size:12.5px;color:var(--muted);text-align:right}
.heat-list{display:grid}
.heat-row{display:grid;grid-template-columns:88px minmax(0,1fr);gap:10px;padding:12px 0;border-bottom:1px solid var(--line)}
.heat-row:last-child{border-bottom:0}
.heat-row strong{display:block;font-size:15px;color:#172033}
.heat-row p{margin:0;color:#3e4856;font-size:13px;line-height:1.45}
.filters{display:flex;flex-wrap:wrap;gap:8px;margin:22px 0 0;position:sticky;top:0;z-index:12;padding:10px 0;background:linear-gradient(#f5f7fa 70%,rgba(245,247,250,.92))}
.filters button{min-height:40px;padding:0 12px;border:1px solid var(--line-strong);background:#fff;color:#22356f;font-weight:700;font-size:13px;cursor:pointer}
.filters button[aria-pressed="true"]{background:var(--navy);color:#fff;border-color:var(--navy)}
.section{padding:36px 0;border-bottom:1px solid var(--line)}.section:last-child{border-bottom:0}
.section h2{font-family:"Songti SC","Noto Serif CJK SC","SimSun",Georgia,serif;font-size:clamp(24px,3vw,36px);margin:0 0 18px;color:#172033}
.radar{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.item,.signal{background:#fff;border:1px solid var(--line);padding:18px 20px;min-width:0}
.tag{display:inline-flex;align-items:center;font-size:12px;font-weight:800;color:#22356f;background:#e8edf8;padding:4px 9px;border-radius:999px}
.tag.green,.tag-new-site,.tag-open-source{color:#166049;background:#dcefe8}.tag.amber,.tag-research{color:#805711;background:#efe5ce}
.tag-agent,.tag-model-platform{color:#22356f;background:#e8edf8}.tag-product{color:#0f5e55;background:#edf4f2}
.item h3,.signal h3{font-size:19px;line-height:1.3;margin:12px 0 8px;color:#172033}
.signal-lead{border-left:4px solid #0f766e;background:linear-gradient(90deg,#f3faf7 0%,#fff 46%)}
.lead-kicker{display:inline-flex;align-items:center;min-height:24px;margin:0 0 8px;padding:0 8px;background:#0f766e;color:#fff;font-size:11px;font-weight:800;letter-spacing:.08em}
.stat:first-child{background:#14213d;border-color:#14213d}.stat:first-child b{color:#fff}.stat:first-child span{color:rgba(255,255,255,.76)}
.judgment{border-left:4px solid #0f766e}
.radar .item:first-child{border-color:#0f766e;background:#f4faf8}
.signals{display:grid;gap:12px}
.meta{font-size:12px;color:var(--muted);display:flex;flex-wrap:wrap;gap:7px 12px}
.meta a{border-bottom:0;color:#0f5e55;font-weight:750}
.side{border-top:1px solid var(--line);padding:14px 0 0;margin-top:14px;display:grid;grid-template-columns:max-content minmax(0,1fr);gap:6px 10px}
.side strong{color:#0f5e55;font-size:13px;white-space:nowrap}
.side p{margin:0;font-size:14px;color:#3e4856}
.note{background:#eef5f2;border:1px solid #c6d9d1;padding:18px 20px;color:#3e4856}
.sources{columns:2;column-gap:28px}.sources li{break-inside:avoid;margin:0 0 10px;color:#4b5563}
.status{margin:0;color:var(--muted);font-size:13px}
@media (max-width:920px){
  .page{padding:18px 14px 44px}
  .hero,.radar{grid-template-columns:1fr}
  .stats{grid-template-columns:repeat(2,1fr)}
  .sources{columns:1}
  .panel-head{flex-direction:column}
  .panel-head span{text-align:left}
}
@media (max-width:520px){
  .stats{grid-template-columns:1fr 1fr}
  .heat-row,.side{grid-template-columns:1fr}
  .signal{padding:16px}
  .report-sitebar{flex-wrap:wrap;width:calc(100% - 20px);gap:8px;min-height:0;padding:10px 0 12px;align-items:flex-start}
  .report-sitebrand-copy small{display:none}
  .report-sitebrand-copy > span{font-size:13px}
  .report-sitenav{flex:1 0 100%;flex-wrap:wrap;gap:6px 10px}
  .report-sitenav > a[href*="archive"]{display:none}
}
@media (max-width:760px){
  .report-sitebar{flex-wrap:wrap;width:calc(100% - 24px);gap:10px;min-height:0;padding:10px 0}
  .report-sitenav{flex:1 0 100%;flex-wrap:wrap}
}
`;

function liveHref(localeId, basePath) {
  if (localeId === 'zh') return `${basePath}/live/`;
  return `${basePath}/live/${localeId}/`;
}

function navMarkup(locale, basePath) {
  const loc = localesById[locale] || localesById.zh;
  const home = localeUrl(loc, basePath, '/');
  const live = liveHref(locale, basePath);
  const latest = localeUrl(loc, basePath, '/latest/');
  const liveLabel = loc.ui.liveLabel;
  const latestLabel = loc.ui.latestLabel;
  const archiveLabel = loc.ui.archiveLabel;
  const paths = Object.fromEntries(locales.map((item) => [item.id, liveHref(item.id, basePath)]));
  const more = languageMoreMarkup(loc, paths, null, loc.ui);
  return `<header class="report-sitebar">
  <a class="report-sitebrand" href="${live}"><span class="report-sitebrand-mark" aria-hidden="true"><img src="${basePath}/assets/alux-mark.png" alt=""></span><span class="report-sitebrand-copy"><span>${encodeHtml(loc.ui.brand)}</span><small>LIVE PUBLIC RADAR</small></span></a>
  <nav class="report-sitenav" aria-label="${encodeHtml(archiveLabel)}">
    <a href="${live}" aria-current="page">${encodeHtml(liveLabel)}</a>
    <a href="${latest}">${encodeHtml(latestLabel)}</a>
    <a href="${home}#archive">${encodeHtml(archiveLabel)}</a>
    <span class="language-group">${more}</span>
  </nav>
</header>`;
}

function itemPack(item, locale) {
  const pack = item.i18n && item.i18n[locale];
  if (locale === 'zh') {
    return {
      title: item.titleZh || item.title,
      what: item.whatZh,
      why: item.whyZh,
      who: item.whoZh,
      try: item.tryZh,
      note: item.noteZh,
      region: (item.regionI18n && item.regionI18n.zh) || item.regionZh || item.region,
      category: (item.categoryI18n && item.categoryI18n.zh) || item.categoryZh,
    };
  }
  if (locale === 'zh-Hant') {
    return {
      title: item.titleHant || item.titleZh || item.title,
      what: item.whatHant || item.whatZh,
      why: item.whyHant || item.whyZh,
      who: item.whoHant || item.whoZh,
      try: item.tryHant || item.tryZh,
      note: item.noteHant || item.noteZh,
      region: (item.regionI18n && item.regionI18n['zh-Hant']) || item.regionZh || item.region,
      category: (item.categoryI18n && item.categoryI18n['zh-Hant']) || item.categoryZh,
    };
  }
  if (locale === 'en') {
    return {
      title: item.titleEn || item.title,
      what: item.whatEn,
      why: item.whyEn,
      who: item.whoEn,
      try: item.tryEn,
      note: item.noteEn,
      region: (item.regionI18n && item.regionI18n.en) || item.regionEn || item.region,
      category: (item.categoryI18n && item.categoryI18n.en) || item.categoryEn,
    };
  }
  return {
    title: (pack && pack.title) || item.titleEn || item.title,
    what: (pack && pack.what) || item.whatEn,
    why: (pack && pack.why) || item.whyEn,
    who: (pack && pack.who) || item.whoEn,
    try: (pack && pack.try) || item.tryEn,
    note: (pack && pack.note) || item.noteEn,
    region: (item.regionI18n && item.regionI18n[locale]) || item.regionEn || item.region,
    category: (item.categoryI18n && item.categoryI18n[locale]) || item.categoryEn,
  };
}

function cardMarkup(item, index, locale) {
  const ui = chromeOf(locale);
  const pack = itemPack(item, locale);
  const stars = item.stars ? `<span>GitHub Stars ${item.stars}</span>` : '';
  const license = item.license ? `<span>${encodeHtml(item.license)}</span>` : '';
  const lead = item.isFeature
    ? `<span class="lead-kicker">${encodeHtml(ui.leadKicker)}</span>`
    : '';
  return `<article class="signal${item.isFeature ? ' signal-lead' : ''}" data-category="${encodeHtml(item.category)}">
  <div>
    ${lead}
    <div class="meta"><span>${String(index + 1).padStart(2, '0')}</span><span>${encodeHtml(item.sourceLabel)}</span><span>${encodeHtml(pack.region)}</span><span>${encodeHtml(item.publishedAt)} / ${encodeHtml(item.observedAt)}</span><span>${encodeHtml(pack.category)}</span>${stars}${license}<a href="${encodeHtml(item.url)}" target="_blank" rel="noopener">${encodeHtml(ui.sourceLink)}</a></div>
    <h3>${encodeHtml(pack.title)}</h3>
    <p><strong>${encodeHtml(ui.happened)}${encodeHtml(ui.colon)}</strong>${encodeHtml(pack.what)}</p>
    <p><strong>${encodeHtml(ui.matters)}${encodeHtml(ui.colon)}</strong>${encodeHtml(pack.why)}</p>
    <p><strong>${encodeHtml(ui.care)}${encodeHtml(ui.colon)}</strong>${encodeHtml(pack.who)}</p>
  </div>
  <aside class="side"><strong>${encodeHtml(ui.try)}</strong><p>${encodeHtml(pack.try)}</p><strong>${encodeHtml(ui.note)}</strong><p>${encodeHtml(pack.note)}</p></aside>
</article>`;
}

function radarTitle(card, locale) {
  if (locale === 'zh') return card.titleZh;
  if (locale === 'en') return card.titleEn;
  if (card.titleI18n && card.titleI18n[locale]) return card.titleI18n[locale];
  if (locale === 'zh-Hant') return card.titleZh;
  return card.titleEn;
}

function radarBodyText(card, locale) {
  if (card.bodyI18n && card.bodyI18n[locale]) return card.bodyI18n[locale];
  if (locale === 'zh' || locale === 'zh-Hant') return card.bodyZh;
  return card.bodyEn;
}

function radarTag(card, locale) {
  if (card.tagI18n && card.tagI18n[locale]) return card.tagI18n[locale];
  if (locale === 'zh' || locale === 'zh-Hant') return card.tagZh;
  return card.tagEn;
}

function renderLiveHtml(briefing, locale = 'zh', basePath = '/daily') {
  const loc = localesById[locale] || localesById.zh;
  const ui = chromeOf(locale);
  const copy = heroCopy(briefing, locale);
  const title = `${briefing.dateIso}${locale === 'en' ? ' · ' : '｜'}${ui.pageTitle}`;
  const filters = Object.entries(ui.filters);
  const radar = (briefing.radar || []).map((card, index) => `<article class="item"><span class="tag tag-${encodeHtml(card.category || '')}${index === 0 ? ' green' : ''}">${encodeHtml(radarTag(card, locale))}</span><h3>${encodeHtml(radarTitle(card, locale))}</h3><p>${encodeHtml(radarBodyText(card, locale))}</p></article>`).join('');
  const features = briefing.items.filter((item) => item.isFeature);
  const rest = briefing.items.filter((item) => !item.isFeature);
  const sources = briefing.items.map((item) => `<li><a href="${encodeHtml(item.url)}" target="_blank" rel="noopener">${encodeHtml(item.sourceLabel)}${ui.colon}${encodeHtml(itemPack(item, locale).title)}</a></li>`).join('');
  const scanned = briefing.feedReports?.filter((row) => row.ok).length || 0;
  const failed = briefing.feedReports?.filter((row) => !row.ok && !row.optional).length || 0;
  const note = (locale !== 'zh' && locale !== 'en' && loc.ui.machineNote)
    ? `<p class="machine-note">${encodeHtml(loc.ui.machineNote)}</p>`
    : '';

  return `<!doctype html>
<html lang="${loc.htmlLang}"${loc.dir === 'rtl' ? ' dir="rtl"' : ''}>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${encodeHtml(title)}</title>
  <meta name="description" content="${encodeHtml(copy.lead)}">
  <link rel="icon" type="image/png" href="${basePath}/assets/alux-favicon.png">
  <link rel="stylesheet" href="${basePath}/assets/report-site.css">
  <style>${PAGE_CSS}</style>
</head>
<body>
${navMarkup(locale, basePath)}
<main class="page" data-live-page>
  <div class="live-banner"><b>LIVE</b><span>${encodeHtml(briefing.dateIso)}</span><span>${encodeHtml(ui.banner)}</span><span>${encodeHtml(ui.updated)} ${encodeHtml(briefing.generatedAtShanghai)}</span></div>
  <section class="hero">
    <div>
      <h1><span class="title-en">Agent Daily</span><span class="title-cn">${encodeHtml(copy.subject)}</span></h1>
      <p class="lead">${encodeHtml(copy.lead)}</p>
      ${note}
      <div class="stats">
        <div class="stat"><b>${briefing.stats.watching}</b><span>${encodeHtml(ui.watching)}</span></div>
        <div class="stat"><b>${briefing.stats.features}</b><span>${encodeHtml(ui.leadItems)}</span></div>
        <div class="stat"><b>${briefing.stats.openSource}</b><span>${encodeHtml(ui.openSource)}</span></div>
        <div class="stat"><b>${briefing.stats.regions}</b><span>${encodeHtml(ui.regions)}</span></div>
      </div>
      <div class="judgment"><strong>${encodeHtml(ui.howToRead)}</strong>${encodeHtml(copy.judgment)}</div>
    </div>
    <aside class="intel">
      <div class="panel-head"><strong>${encodeHtml(ui.todayMap)}</strong><span>${encodeHtml(ui.mapHint)}</span></div>
      <p class="status">${encodeHtml(ui.scanned.replace('{n}', String(scanned)))}${failed ? encodeHtml(ui.missed.replace('{n}', String(failed))) : ''}.</p>
      <div class="heat-list">${(briefing.radar || []).map((card) => `<div class="heat-row"><div><strong>${encodeHtml(radarTag(card, locale))}</strong></div><div><p>${encodeHtml(radarBodyText(card, locale))}</p></div></div>`).join('')}</div>
    </aside>
  </section>
  <div class="filters" role="tablist">${filters.map(([id, label], index) => `<button type="button" data-filter="${id}" aria-pressed="${index === 0 ? 'true' : 'false'}">${encodeHtml(label)}</button>`).join('')}</div>
  <section class="section"><h2>${encodeHtml(ui.radar)}</h2><div class="radar">${radar}</div></section>
  <section class="section"><h2>${encodeHtml(ui.leadSection)}</h2><div class="signals">${features.map((item, index) => cardMarkup(item, index, locale)).join('')}</div></section>
  <section class="section"><h2>${encodeHtml(ui.moreSection)}</h2><div class="signals">${rest.map((item, index) => cardMarkup(item, index + features.length, locale)).join('')}</div>
    <div class="note">${encodeHtml(ui.editorial)}</div>
  </section>
  <section class="section"><h2>${encodeHtml(ui.sources)}</h2><ol class="sources">${sources}</ol></section>
</main>
<script>
(() => {
  const buttons = [...document.querySelectorAll('[data-filter]')];
  const cards = [...document.querySelectorAll('.signal')];
  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.getAttribute('data-filter');
      buttons.forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
      cards.forEach((card) => {
        card.hidden = id !== 'all' && card.getAttribute('data-category') !== id;
      });
    });
  });
  const hydrate = async () => {
    const urls = ['${basePath}/live/latest.json', '${basePath}/api/live.json', '/api/live.json'];
    for (const url of urls) {
      try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) continue;
        const data = await response.json();
        if (data && data.generatedAt && data.generatedAt !== '${briefing.generatedAt}') {
          location.reload();
        }
        return;
      } catch {}
    }
  };
  hydrate();
})();
</script>
</body></html>`;
}

function renderTeaser(briefing, locale = 'zh') {
  return {
    dateIso: briefing.dateIso,
    generatedAt: briefing.generatedAt,
    generatedAtShanghai: briefing.generatedAtShanghai,
    locale,
    watching: briefing.stats.watching,
    subject: heroCopy(briefing, locale).subject,
    lead: heroCopy(briefing, locale).lead,
    href: liveHref(locale, '/daily'),
    items: briefing.items.slice(0, 4).map((item) => ({
      title: itemPack(item, locale).title,
      source: item.sourceLabel,
      category: itemPack(item, locale).category,
      url: item.url,
    })),
  };
}

function heroCopy(briefing, localeId) {
  const pack = briefing.hero?.i18n?.[localeId];
  if (pack?.subject) {
    return {
      subject: pack.subject,
      lead: pack.lead,
      judgment: pack.judgment || briefing.hero.judgmentZh || briefing.hero.judgmentEn,
    };
  }
  if (localeId === 'zh' || localeId === 'zh-Hant') {
    return { subject: briefing.hero.subjectZh, lead: briefing.hero.leadZh, judgment: briefing.hero.judgmentZh };
  }
  return { subject: briefing.hero.subjectEn, lead: briefing.hero.leadEn, judgment: briefing.hero.judgmentEn };
}

function liveArchiveRow(briefing, localeId, basePath = '/daily') {
  const locale = localesById[localeId] || localesById.en;
  const isZh = locale.id === 'zh' || locale.id === 'zh-Hant';
  const date = utcDate(briefing.dateIso);
  const href = liveHref(locale.id, basePath);
  const copy = heroCopy(briefing, locale.id);
  const title = isZh ? `AI Agent${copy.subject}` : `AI Agent ${copy.subject}`;
  const lead = copy.lead;
  const pill = locale.ui.todayPill || (isZh ? '今日' : 'Today');
  const monthShort = formatDate(date, locale, 'monthShort');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `<a class="report-row is-latest is-live" data-live-row href="${encodeHtml(href)}">
      <time datetime="${briefing.dateIso}"><b>${day}</b><span>${encodeHtml(monthShort)}</span></time>
      <div class="report-copy"><span class="latest-pill">${encodeHtml(pill)}</span><strong>${encodeHtml(title)}</strong><p>${encodeHtml(lead)}</p></div>
      <span class="report-arrow" aria-hidden="true">↗</span>
    </a>`;
}

function injectHomeLiveArchive(html, briefing, localeId, basePath = '/daily') {
  if (!html || !briefing?.dateIso || !html.includes('class="report-list"')) return html;
  const row = liveArchiveRow(briefing, localeId, basePath);
  if (html.includes('data-live-row')) {
    return html.replace(/<a class="report-row[^>]*data-live-row[\s\S]*?<\/a>/, row);
  }
  let next = html.replace(/<a class="report-row is-latest"/, '<a class="report-row"');
  next = next.replace(/<div class="report-copy"><span class="latest-pill">[\s\S]*?<\/span>/, '<div class="report-copy">');
  next = next.replace('<div class="report-list">', `<div class="report-list">\n    ${row}`);
  next = next.replace(
    /(<div class="month-strip">[\s\S]*?<span>)(\d+)([^<]*<\/span>)/,
    (_, prefix, count, suffix) => `${prefix}${Number(count) + 1}${suffix}`,
  );
  return next;
}

function injectHomeLatestCard(html, briefing, localeId, basePath = '/daily') {
  if (!html || !briefing?.dateIso || !html.includes('class="latest"')) return html;
  const locale = localesById[localeId] || localesById.en;
  const isZh = locale.id === 'zh' || locale.id === 'zh-Hant';
  const copy = heroCopy(briefing, locale.id);
  const href = liveHref(locale.id, basePath);
  const date = utcDate(briefing.dateIso);
  const dateLabel = formatDate(date, locale);
  const kicker = locale.ui.todayKicker || locale.ui.liveLabel;
  const lead = copy.lead;
  const read = locale.ui.readToday || locale.ui.liveOpen;
  const fullTitle = isZh ? `AI Agent${copy.subject}` : `AI Agent ${copy.subject}`;
  let next = html.replace(
    /(<div class="latest-kicker"><span>)[^<]*(<\/span><time datetime=")[^"]*("[^>]*>)[^<]*(<\/time>)/,
    `$1${encodeHtml(kicker)}$2${briefing.dateIso}$3${encodeHtml(dateLabel)}$4`,
  );
  if (next.includes('latest-title-subject')) {
    next = next.replace(
      /(<h2[^>]*aria-label=")[^"]*(")/,
      `$1${encodeHtml(`AI Agent · ${copy.subject}`)}$2`,
    );
    next = next.replace(
      /(<span class="latest-title-subject">)[\s\S]*?(<\/span>)/,
      `$1${encodeHtml(copy.subject)}$2`,
    );
  } else {
    next = next.replace(/(<article class="latest">[\s\S]*?<h2[^>]*>)[\s\S]*?(<\/h2>)/, `$1${encodeHtml(fullTitle)}$2`);
  }
  next = next.replace(/(<article class="latest">[\s\S]*?<p>)[\s\S]*?(<\/p>)/, `$1${encodeHtml(lead)}$2`);
  next = next.replace(/(<article class="latest">[\s\S]*?<a class="button" href=")[^"]+/, `$1${href}`);
  next = next.replace(/(<article class="latest">[\s\S]*?<a class="button" href="[^"]+">)[\s\S]*?(<\/a>)/, `$1${encodeHtml(read)}$2`);
  return next;
}

function injectHomeLiveStrip(html, briefing, locale = 'zh', basePath = '/daily') {
  if (!html || !html.includes('data-live-list') || !briefing?.items?.length) return html;
  const isEn = locale === 'en';
  const href = isEn ? `${basePath}/live/en/` : `${basePath}/live/`;
  const more = isEn ? 'Open the live radar ↗' : '打开完整自动雷达 ↗';
  const items = briefing.items.slice(0, 4).map((item) => (
    `<a class="live-story" href="${encodeHtml(item.url)}" target="_blank" rel="noopener"><small>${encodeHtml(item.sourceLabel)}${item.categoryZh || item.categoryEn ? ` · ${encodeHtml(locale === 'en' ? item.categoryEn : item.categoryZh)}` : ''}</small><strong>${encodeHtml(item.title)}</strong></a>`
  )).join('');
  const markup = `<div class="live-strip-list" data-live-list>${items}<a class="live-strip-fallback" href="${href}">${more}</a></div>`;
  return html.replace(/<div class="live-strip-list"[^>]*>[\s\S]*?<\/div>/, markup);
}

function injectAllHomepages(publicRoot, briefing, basePath = '/daily') {
  const fs = require('fs');
  const path = require('path');
  const { writeUtf8 } = require('./io.cjs');
  const targets = [
    ['index.html', 'zh'],
    ['en/index.html', 'en'],
    ['zh-Hant/index.html', 'zh-Hant'],
    ['ja/index.html', 'ja'],
    ['ko/index.html', 'ko'],
    ['es/index.html', 'es'],
    ['fr/index.html', 'fr'],
    ['de/index.html', 'de'],
    ['ar/index.html', 'ar'],
  ];
  for (const [relative, locale] of targets) {
    const file = path.join(publicRoot, relative);
    if (!fs.existsSync(file)) continue;
    let html = fs.readFileSync(file, 'utf8');
    html = injectHomeLiveArchive(html, briefing, locale, basePath);
    html = injectHomeLatestCard(html, briefing, locale, basePath);
    writeUtf8(file, html);
  }
}

module.exports = {
  renderLiveHtml,
  renderTeaser,
  liveArchiveRow,
  liveHref,
  injectHomeLiveArchive,
  injectHomeLatestCard,
  injectHomeLiveStrip,
  injectAllHomepages,
  PAGE_CSS,
};
