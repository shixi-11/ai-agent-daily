'use strict';

const { encodeHtml } = require('./io.cjs');
const { locales, localeUrl, localesById } = require('./locales.cjs');
const { languageMoreMarkup } = require('./chrome.cjs');

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
.filters{display:flex;flex-wrap:wrap;gap:8px;margin:22px 0 0}
.filters button{min-height:40px;padding:0 12px;border:1px solid var(--line-strong);background:#fff;color:#22356f;font-weight:700;font-size:13px;cursor:pointer}
.filters button[aria-pressed="true"]{background:var(--navy);color:#fff;border-color:var(--navy)}
.section{padding:36px 0;border-bottom:1px solid var(--line)}.section:last-child{border-bottom:0}
.section h2{font-family:"Songti SC","Noto Serif CJK SC","SimSun",Georgia,serif;font-size:clamp(24px,3vw,36px);margin:0 0 18px;color:#172033}
.radar{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.item,.signal{background:#fff;border:1px solid var(--line);padding:18px 20px;min-width:0}
.tag{display:inline-flex;align-items:center;font-size:12px;font-weight:800;color:#22356f;background:#e8edf8;padding:4px 9px;border-radius:999px}
.tag.green{color:#166049;background:#dcefe8}.tag.amber{color:#805711;background:#efe5ce}
.item h3,.signal h3{font-size:19px;line-height:1.3;margin:12px 0 8px;color:#172033}
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

function navMarkup(locale, basePath) {
  const loc = localesById[locale] || localesById.zh;
  const home = locale === 'en' ? `${basePath}/en/` : localeUrl(loc, basePath, '/');
  const live = locale === 'en' ? `${basePath}/live/en/` : `${basePath}/live/`;
  const liveAlt = locale === 'en' ? `${basePath}/live/` : `${basePath}/live/en/`;
  const latest = locale === 'en' ? `${basePath}/en/latest/` : localeUrl(loc, basePath, '/latest/');
  const liveLabel = loc.ui.liveLabel;
  const latestLabel = loc.ui.latestLabel;
  const archiveLabel = loc.ui.archiveLabel;
  const paths = Object.fromEntries(locales.map((item) => {
    if (item.id === 'zh') return [item.id, `${basePath}/live/`];
    if (item.id === 'en') return [item.id, `${basePath}/live/en/`];
    return [item.id, localeUrl(item, basePath, '/')];
  }));
  const more = languageMoreMarkup(loc, paths, null, loc.ui);
  return `<header class="report-sitebar">
  <a class="report-sitebrand" href="${home}"><span class="report-sitebrand-mark" aria-hidden="true"><img src="${basePath}/assets/alux-mark.png" alt=""></span><span class="report-sitebrand-copy"><span>${encodeHtml(loc.ui.brand)}</span><small>LIVE PUBLIC RADAR</small></span></a>
  <nav class="report-sitenav" aria-label="${encodeHtml(archiveLabel)}">
    <a href="${live}" aria-current="page">${encodeHtml(liveLabel)}</a>
    <a href="${latest}">${encodeHtml(latestLabel)}</a>
    <a href="${home}#archive">${encodeHtml(archiveLabel)}</a>
    <span class="language-group">
    <span class="language-switch" aria-label="${encodeHtml(loc.ui.languageLabel)}">
      <a href="${basePath}/live/" lang="zh-CN"${locale === 'zh' ? ' aria-current="page"' : ''}>中</a>
      <a href="${liveAlt}" lang="en"${locale === 'en' ? ' aria-current="page"' : ''}>EN</a>
    </span>
    ${more}
    </span>
  </nav>
</header>`;
}

function cardMarkup(item, index, locale) {
  const isEn = locale === 'en';
  const cat = isEn ? item.categoryEn : item.categoryZh;
  const what = isEn ? item.whatEn : item.whatZh;
  const why = isEn ? item.whyEn : item.whyZh;
  const who = isEn ? item.whoEn : item.whoZh;
  const tryIt = isEn ? item.tryEn : item.tryZh;
  const note = isEn ? item.noteEn : item.noteZh;
  const happened = isEn ? 'What happened' : '发生了什么';
  const matters = isEn ? 'Why it matters' : '为什么值得关注';
  const care = isEn ? 'Who should care' : '适合谁看';
  const tryLabel = isEn ? 'Try it' : '试试看';
  const noteLabel = isEn ? 'Keep in mind' : '注意点';
  const stars = item.stars ? `<span>GitHub Stars ${item.stars}</span>` : '';
  const license = item.license ? `<span>${encodeHtml(item.license)}</span>` : '';
  return `<article class="signal" data-category="${encodeHtml(item.category)}">
  <div>
    <div class="meta"><span>${String(index + 1).padStart(2, '0')}</span><span>${encodeHtml(item.sourceLabel)}</span><span>${encodeHtml(item.region)}</span><span>${encodeHtml(item.publishedAt)} / ${encodeHtml(item.observedAt)}</span><span>${encodeHtml(cat)}</span>${stars}${license}<a href="${encodeHtml(item.url)}" target="_blank" rel="noopener">source</a></div>
    <h3>${encodeHtml(item.title)}</h3>
    <p><strong>${happened}：</strong>${encodeHtml(what)}</p>
    <p><strong>${matters}：</strong>${encodeHtml(why)}</p>
    <p><strong>${care}：</strong>${encodeHtml(who)}</p>
  </div>
  <aside class="side"><strong>${tryLabel}</strong><p>${encodeHtml(tryIt)}</p><strong>${noteLabel}</strong><p>${encodeHtml(note)}</p></aside>
</article>`;
}

function renderLiveHtml(briefing, locale = 'zh', basePath = '/daily') {
  const isEn = locale === 'en';
  const title = isEn
    ? `${briefing.dateIso} · Live Agent Radar`
    : `${briefing.dateIso}｜今日自动雷达`;
  const filters = [
    ['all', isEn ? 'All' : '全部'],
    ['new-site', isEn ? 'New sites' : '新站'],
    ['model-platform', isEn ? 'Models' : '模型'],
    ['open-source', isEn ? 'Open source' : '开源'],
    ['agent', isEn ? 'Agents' : '智能体'],
    ['research', isEn ? 'Research' : '研究'],
    ['product', isEn ? 'Products' : '产品'],
  ];
  const radar = (briefing.radar || []).map((card) => `<article class="item"><span class="tag">${encodeHtml(isEn ? card.tagEn : card.tagZh)}</span><h3>${encodeHtml(isEn ? card.titleEn : card.titleZh)}</h3><p>${encodeHtml(isEn ? card.bodyEn : card.bodyZh)}</p></article>`).join('');
  const features = briefing.items.filter((item) => item.isFeature);
  const rest = briefing.items.filter((item) => !item.isFeature);
  const sources = briefing.items.map((item) => `<li><a href="${encodeHtml(item.url)}" target="_blank" rel="noopener">${encodeHtml(item.sourceLabel)}：${encodeHtml(item.title)}</a></li>`).join('');
  const scanned = briefing.feedReports?.filter((row) => row.ok).length || 0;
  const failed = briefing.feedReports?.filter((row) => !row.ok && !row.optional).length || 0;

  return `<!doctype html>
<html lang="${isEn ? 'en' : 'zh-CN'}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${encodeHtml(title)}</title>
  <meta name="description" content="${encodeHtml(isEn ? briefing.hero.leadEn : briefing.hero.leadZh)}">
  <link rel="icon" type="image/png" href="${basePath}/assets/alux-favicon.png">
  <link rel="stylesheet" href="${basePath}/assets/report-site.css">
  <style>${PAGE_CSS}</style>
</head>
<body>
${navMarkup(locale, basePath)}
<main class="page" data-live-page>
  <div class="live-banner"><b>LIVE</b><span>${encodeHtml(briefing.dateIso)}</span><span>${isEn ? 'Public RSS / GitHub / Show HN' : '公开 RSS · GitHub · Show HN'}</span><span>${isEn ? 'Updated' : '更新'} ${encodeHtml(briefing.generatedAtShanghai)}</span></div>
  <section class="hero">
    <div>
      <h1><span class="title-en">Agent Daily</span><span class="title-cn">${encodeHtml(isEn ? briefing.hero.subjectEn : briefing.hero.subjectZh)}</span></h1>
      <p class="lead">${encodeHtml(isEn ? briefing.hero.leadEn : briefing.hero.leadZh)}</p>
      <div class="stats">
        <div class="stat"><b>${briefing.stats.watching}</b><span>${isEn ? 'Worth watching' : '值得关注'}</span></div>
        <div class="stat"><b>${briefing.stats.features}</b><span>${isEn ? 'Lead items' : '重点条目'}</span></div>
        <div class="stat"><b>${briefing.stats.openSource}</b><span>${isEn ? 'Open source' : '开源发现'}</span></div>
        <div class="stat"><b>${briefing.stats.regions}</b><span>${isEn ? 'Regions' : '覆盖区域'}</span></div>
      </div>
      <div class="judgment"><strong>${isEn ? 'How to read this page: ' : '如何阅读：'}</strong>${encodeHtml(isEn ? briefing.hero.judgmentEn : briefing.hero.judgmentZh)}</div>
    </div>
    <aside class="intel">
      <div class="panel-head"><strong>${isEn ? "Today's map" : '今日导航'}</strong><span>${isEn ? 'Auto-ranked public sources' : '按公开源自动排序'}</span></div>
      <p class="status">${isEn ? `Scanned ${scanned} feeds` : `已扫描 ${scanned} 路公共源`}${failed ? (isEn ? `, ${failed} required feeds missed` : `，${failed} 路必选源未取到`) : ''}.</p>
      <div class="heat-list">${(briefing.radar || []).map((card) => `<div class="heat-row"><div><strong>${encodeHtml(isEn ? card.tagEn : card.tagZh)}</strong></div><div><p>${encodeHtml(isEn ? card.bodyEn : card.bodyZh)}</p></div></div>`).join('')}</div>
    </aside>
  </section>
  <div class="filters" role="tablist">${filters.map(([id, label], index) => `<button type="button" data-filter="${id}" aria-pressed="${index === 0 ? 'true' : 'false'}">${encodeHtml(label)}</button>`).join('')}</div>
  <section class="section"><h2>${isEn ? 'Signal radar' : 'AI Agent雷达'}</h2><div class="radar">${radar}</div></section>
  <section class="section"><h2>${isEn ? 'Lead items' : '值得关注的新功能'}</h2><div class="signals">${features.map((item, index) => cardMarkup(item, index, locale)).join('')}</div></section>
  <section class="section"><h2>${isEn ? 'More public signals' : '更多公开信号'}</h2><div class="signals">${rest.map((item, index) => cardMarkup(item, index + features.length, locale)).join('')}</div>
    <div class="note">${isEn ? 'Editorial issues remain in the archive. This page never calls GPT, OpenClaw or a paid news API.' : '精编日报仍在历史归档里。本页不调用 GPT、OpenClaw，也不走付费新闻接口。'}</div>
  </section>
  <section class="section"><h2>${isEn ? 'Sources' : '来源'}</h2><ol class="sources">${sources}</ol></section>
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
    subject: locale === 'en' ? briefing.hero.subjectEn : briefing.hero.subjectZh,
    lead: locale === 'en' ? briefing.hero.leadEn : briefing.hero.leadZh,
    href: locale === 'en' ? '/daily/live/en/' : '/daily/live/',
    items: briefing.items.slice(0, 4).map((item) => ({
      title: item.title,
      source: item.sourceLabel,
      category: locale === 'en' ? item.categoryEn : item.categoryZh,
      url: item.url,
    })),
  };
}

function injectHomeLiveStrip(html, briefing, locale = 'zh', basePath = '/daily') {
  if (!html || !html.includes('data-live-list') || !briefing?.items?.length) return html;
  const isEn = locale === 'en';
  const href = isEn ? `${basePath}/live/en/` : `${basePath}/live/`;
  const more = isEn ? 'Open the live radar ↗' : '打开完整自动雷达 ↗';
  const items = briefing.items.slice(0, 4).map((item) => (
    `<a class="live-story" href="${encodeHtml(item.url)}" target="_blank" rel="noopener"><small>${encodeHtml(item.sourceLabel)}</small><strong>${encodeHtml(item.title)}</strong></a>`
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
    ['zh-Hant/index.html', 'zh'],
    ['ja/index.html', 'en'],
    ['ko/index.html', 'en'],
    ['es/index.html', 'en'],
    ['fr/index.html', 'en'],
    ['de/index.html', 'en'],
    ['ar/index.html', 'en'],
  ];
  for (const [relative, locale] of targets) {
    const file = path.join(publicRoot, relative);
    if (!fs.existsSync(file)) continue;
    writeUtf8(file, injectHomeLiveStrip(fs.readFileSync(file, 'utf8'), briefing, locale, basePath));
  }
}

module.exports = {
  renderLiveHtml,
  renderTeaser,
  injectHomeLiveStrip,
  injectAllHomepages,
  PAGE_CSS,
};
