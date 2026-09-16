'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { encodeHtml } = require('./io.cjs');
const { locales, localeUrl, localesById, utcDate, formatDate } = require('./locales.cjs');
const { languageMoreMarkup } = require('./chrome.cjs');
const { socialPreviewHead } = require('./html.cjs');
const { decorateBriefing } = require('./live-compose.cjs');

const MASTER_FILE = path.join(__dirname, '../../content/zh/20260826_ALUX_AI智能体情报日报.html');
const OPENCC_FILE = path.join(__dirname, 'opencc_html.py');
const BASE_URL = 'https://ai.alux.network';

function loadMasterCss() {
  const html = fs.readFileSync(MASTER_FILE, 'utf8');
  const match = html.match(/<style>([\s\S]*?)<\/style>/);
  if (!match) throw new Error('日报母版缺少 style。');
  return match[1];
}

const PAGE_CSS = loadMasterCss();

function liveHref(localeId, basePath) {
  if (localeId === 'zh') return `${basePath}/live/`;
  return `${basePath}/live/${localeId}/`;
}

function toHant(html) {
  const result = spawnSync('python3', [OPENCC_FILE], {
    input: html,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.status !== 0 || !result.stdout) return html;
  return result.stdout;
}

const COPY = {
  zh: {
    eyebrowBrief: 'Global AI Brief',
    eyebrowLive: '公开源自动',
    statWatching: '值得关注',
    statTry: '可动手试',
    statOpen: '开源发现',
    statRegions: '覆盖区域',
    judgmentLabel: '今日总判断：',
    navTitle: '今日AI导航',
    navSub: '公开源·开源·模型·研究',
    priorityLabel: '今天最值得顺手试试',
    riscTitle: 'RISC机器说明',
    riscEq: 'RISC = 生产级 Agent / 机器人身体的四个系统',
    riscP: '一个真正能上生产的 Agent，不能只有大脑。它还要持续行动、扛住故障、抵御越权，并进入真实组织协作。',
    riscLine: '行业已经交付了一颗出色的大脑，但生产级 Agent 还需要机体、免疫和社会。',
    riscClose: 'ALUX 构建的，就是这台完整机器。',
    riscR: 'R｜强韧 / 机体',
    riscRbody: '持久执行、容错、恢复与水平扩展。身体站不住，一次故障就会把工作清空。',
    riscI: 'I｜智能 / 大脑',
    riscIbody: '模型循环、记忆、工具与编排。它决定 Agent 如何思考、调用和完成复杂工作。',
    riscS: 'S｜安全 / 免疫',
    riscSbody: '能力对象、策略审批、回滚与审计。没有免疫，恢复与连接会扩大失控半径。',
    riscC: 'C｜连接 / 社会',
    riscCbody: '跨公司授权、中立基底、会话类型与生态连接。没有社会接口，Agent 只能停在单一产品里。',
    radarTitle: 'AI Agent雷达',
    featuresTitle: '值得关注的新功能',
    githubTitle: 'GitHub开源发现',
    githubNote: 'Stars为成稿时的关注度快照，不代表质量排名。开放权重条目另按随模型附带的许可证准确标注。',
    worldTitle: '全球技术与市场观察',
    insightLabel: '本期观察：',
    sourcesTitle: '来源',
    what: '发生了什么',
    why: '为什么值得关注',
    who: '适合谁看',
    tryLabel: '试试看',
    noteLabel: '注意点',
    published: '发布',
    observed: '观察',
    stars: 'GitHub Stars',
    licenseUnknown: '许可证未声明',
    itemUnit: '项',
  },
  en: {
    eyebrowBrief: 'Global AI Brief',
    eyebrowLive: 'Public sources',
    statWatching: 'Worth watching',
    statTry: 'Ready to explore',
    statOpen: 'Open-source finds',
    statRegions: 'Coverage areas',
    judgmentLabel: 'The big picture: ',
    navTitle: 'Today’s AI Guide',
    navSub: 'Models · Systems · Applications',
    priorityLabel: 'A small experiment to try',
    riscTitle: 'RISC Machine Primer',
    riscEq: 'RISC = the four systems that make an agent production-ready',
    riscP: 'A production-grade agent needs more than a brain. It must keep operating, survive failure, resist overreach, and participate in real organizational workflows.',
    riscLine: 'The industry has delivered an excellent brain, but a production-grade agent also needs a body, an immune system, and a social layer.',
    riscClose: 'ALUX is building that complete machine.',
    riscR: 'R | Robust — Body',
    riscRbody: 'Durable execution, fault tolerance, recovery, and horizontal scale. Without a resilient body, one failure can erase progress.',
    riscI: 'I | Intelligent — Brain',
    riscIbody: 'Model loops, memory, tools, and orchestration. This system determines how an agent reasons, uses tools, and completes complex work.',
    riscS: 'S | Secure — Immune System',
    riscSbody: 'Object-capability security, policy-based approvals, rollback, and audit. Without an immune system, recovery and connectivity expand the blast radius.',
    riscC: 'C | Connected — Social',
    riscCbody: 'Cross-company authorization, neutral substrate, session types, and ecosystem connectors. Without a social interface, an agent remains confined to one product.',
    radarTitle: 'AI Agent Radar',
    featuresTitle: 'New Features Worth Watching',
    githubTitle: 'Open-Source Finds on GitHub',
    githubNote: 'Stars are a publication-time snapshot of attention, not a quality ranking. Licenses follow the official repositories.',
    worldTitle: 'Global Technology and Market Watch',
    insightLabel: 'This issue: ',
    sourcesTitle: 'Sources',
    what: 'What changed',
    why: 'Why it matters',
    who: 'Who should care',
    tryLabel: 'Try it',
    noteLabel: 'Keep in mind',
    published: 'Published',
    observed: 'Observed',
    stars: 'GitHub Stars',
    licenseUnknown: 'License not declared',
    itemUnit: 'signals',
  },
  ja: {
    navTitle: '今日のAIナビ',
    radarTitle: 'AI Agentレーダー',
    featuresTitle: '注目の新機能',
    githubTitle: 'GitHubオープンソース',
    worldTitle: '世界の技術と市場',
    sourcesTitle: '出典',
    judgmentLabel: '本日の判断：',
    what: '何が起きたか',
    why: 'なぜ重要か',
    who: '誰向けか',
    tryLabel: '試す',
    noteLabel: '注意点',
  },
  ko: {
    navTitle: '오늘의 AI 안내',
    radarTitle: 'AI Agent 레이더',
    featuresTitle: '주목할 새 기능',
    githubTitle: 'GitHub 오픈소스',
    worldTitle: '글로벌 기술과 시장',
    sourcesTitle: '출처',
    judgmentLabel: '오늘의 판단: ',
    what: '무슨 일이',
    why: '왜 중요한가',
    who: '누구를 위한가',
    tryLabel: '시도',
    noteLabel: '참고',
  },
  es: {
    navTitle: 'Mapa de IA de hoy',
    radarTitle: 'Radar de AI Agent',
    featuresTitle: 'Funciones a seguir',
    githubTitle: 'Hallazgos open source',
    worldTitle: 'Tecnología y mercado',
    sourcesTitle: 'Fuentes',
    judgmentLabel: 'Juicio de hoy: ',
    what: 'Qué pasó',
    why: 'Por qué importa',
    who: 'A quién le importa',
    tryLabel: 'Probar',
    noteLabel: 'Ojo',
  },
  fr: {
    navTitle: 'Carte IA du jour',
    radarTitle: 'Radar AI Agent',
    featuresTitle: 'Fonctions à suivre',
    githubTitle: 'Découvertes open source',
    worldTitle: 'Tech et marché mondiaux',
    sourcesTitle: 'Sources',
    judgmentLabel: 'Jugement du jour : ',
    what: 'Ce qui s’est passé',
    why: 'Pourquoi ça compte',
    who: 'Pour qui',
    tryLabel: 'Essayer',
    noteLabel: 'À retenir',
  },
  de: {
    navTitle: 'KI-Karte heute',
    radarTitle: 'AI-Agent-Radar',
    featuresTitle: 'Neue Funktionen',
    githubTitle: 'GitHub-Funde',
    worldTitle: 'Technik und Markt',
    sourcesTitle: 'Quellen',
    judgmentLabel: 'Urteil heute: ',
    what: 'Was passiert ist',
    why: 'Warum es zählt',
    who: 'Für wen',
    tryLabel: 'Ausprobieren',
    noteLabel: 'Hinweis',
  },
  ar: {
    navTitle: 'خريطة الذكاء اليوم',
    radarTitle: 'رادار الوكيل',
    featuresTitle: 'ميزات تستحق المتابعة',
    githubTitle: 'اكتشافات مفتوحة المصدر',
    worldTitle: 'التقنية والسوق',
    sourcesTitle: 'المصادر',
    judgmentLabel: 'حكم اليوم: ',
    what: 'ماذا حدث',
    why: 'لماذا يهم',
    who: 'لمن',
    tryLabel: 'جرّب',
    noteLabel: 'انتبه',
  },
};

function copyFor(localeId) {
  if (localeId === 'zh' || localeId === 'zh-Hant') return { ...COPY.en, ...COPY.zh, ...(COPY[localeId] || {}) };
  return { ...COPY.en, ...(COPY[localeId] || {}) };
}

function isZhLocale(localeId) {
  return localeId === 'zh' || localeId === 'zh-Hant';
}

function navMarkup(locale, basePath) {
  const loc = localesById[locale] || localesById.zh;
  const home = localeUrl(loc, basePath, '/');
  const live = liveHref(locale, basePath);
  const latest = localeUrl(loc, basePath, '/latest/');
  const paths = Object.fromEntries(locales.map((item) => [item.id, liveHref(item.id, basePath)]));
  const more = languageMoreMarkup(loc, paths, null, loc.ui);
  return `<header class="report-sitebar">
  <a class="report-sitebrand" href="${home}"><span class="report-sitebrand-mark" aria-hidden="true"><img src="${basePath}/assets/alux-mark.png" alt=""></span><span class="report-sitebrand-copy"><span>${encodeHtml(loc.ui.brand)}</span><small>${encodeHtml(loc.ui.brandTagline)}</small></span></a>
  <nav class="report-sitenav" aria-label="${encodeHtml(loc.ui.archiveLabel)}">
    <a href="${live}" aria-current="page">${encodeHtml(loc.ui.liveLabel)}</a>
    <a href="${latest}">${encodeHtml(loc.ui.latestLabel)}</a>
    <a href="${home}#archive">${encodeHtml(loc.ui.archiveLabel)}</a>
    <span class="language-group">
    <span class="language-switch" aria-label="${encodeHtml(loc.ui.languageLabel)}">
      <a href="${liveHref('zh', basePath)}" lang="zh-CN"${locale === 'zh' ? ' aria-current="page"' : ''}>中</a>
      <a href="${liveHref('en', basePath)}" lang="en"${locale === 'en' ? ' aria-current="page"' : ''}>EN</a>
    </span>
    ${more}
    </span>
  </nav>
</header>`;
}

function footerMarkup(locale, basePath) {
  const loc = localesById[locale] || localesById.zh;
  const latest = localeUrl(loc, basePath, '/latest/');
  return `<footer class="report-sitefooter">
  <div class="report-support"><a href="${encodeHtml(loc.ui.supportUrl)}">${encodeHtml(loc.ui.supportLabel)}</a></div>
  <nav class="issue-nav" aria-label="${encodeHtml(loc.ui.archiveLabel)}"><a rel="prev" href="${latest}">${encodeHtml(loc.ui.previousLabel)}</a><span>${encodeHtml(loc.ui.nextLabel)}</span></nav>
  <p class="report-credit">${loc.ui.publisherCredit}</p>
</footer>`;
}

function sectionOf(item) {
  if (item.section) return item.section;
  if (item.category === 'open-source' || item.category === 'new-site') return 'github';
  if (item.category === 'research' || item.category === 'hardware' || item.category === 'market') return 'world';
  return 'features';
}

function cardMarkup(item, index, locale, copy) {
  const zh = isZhLocale(locale);
  const cat = zh ? item.categoryZh : item.categoryEn;
  const what = zh ? item.whatZh : item.whatEn;
  const why = zh ? item.whyZh : item.whyEn;
  const who = zh ? item.whoZh : item.whoEn;
  const tryIt = zh ? item.tryZh : item.tryEn;
  const note = zh ? item.noteZh : item.noteEn;
  const tier = zh ? (item.sourceTierZh || '公开源') : (item.sourceTierEn || 'Public source');
  const stars = item.stars ? `<span>${copy.stars} ${Number(item.stars).toLocaleString('en-US')}</span>` : '';
  const license = item.stars || item.repo
    ? `<span>${encodeHtml(item.license || copy.licenseUnknown)}</span>`
    : '';
  const dateMeta = zh
    ? `${encodeHtml(item.publishedAt)} ${copy.published} / ${encodeHtml(item.observedAt)} ${copy.observed}`
    : `${copy.published} ${encodeHtml(item.publishedAt)} / ${copy.observed} ${encodeHtml(item.observedAt)}`;
  const colon = zh ? '：' : ': ';
  return `<article class="signal" data-category="${encodeHtml(item.category)}">
<div><div class="meta"><span>${String(index + 1).padStart(2, '0')}</span><span>${encodeHtml(item.sourceLabel)}</span><span>${encodeHtml(item.region)}</span><span>${dateMeta}</span><span class="source-tier">${encodeHtml(tier)}</span><span>${encodeHtml(cat)}</span>${stars}${license}</div>
<h3>${encodeHtml(item.title)}</h3>
<p><strong>${copy.what}${colon}</strong>${encodeHtml(what)}</p>
<p><strong>${copy.why}${colon}</strong>${encodeHtml(why)}</p>
<p><strong>${copy.who}${colon}</strong>${encodeHtml(who)}</p></div>
<aside class="side"><strong>${copy.tryLabel}</strong><p>${encodeHtml(tryIt)}</p><strong>${copy.noteLabel}</strong><p>${encodeHtml(note)}</p></aside>
</article>`;
}

function riscMarkup(copy) {
  return `<section class="section"><h2>${encodeHtml(copy.riscTitle)}</h2><div class="risc-primer"><div class="risc-primer-intro"><div><p class="risc-equation">${encodeHtml(copy.riscEq)}</p><p>${encodeHtml(copy.riscP)}</p></div><div class="risc-primer-line">${encodeHtml(copy.riscLine)}<span class="risc-primer-close"><span class="nowrap">ALUX</span> ${encodeHtml(copy.riscClose.replace(/^ALUX\s*/, ''))}</span></div></div><div class="risc-primer-grid"><article class="risc-primer-card"><b>${encodeHtml(copy.riscR)}</b><span>${encodeHtml(copy.riscRbody)}</span></article><article class="risc-primer-card"><b>${encodeHtml(copy.riscI)}</b><span>${encodeHtml(copy.riscIbody)}</span></article><article class="risc-primer-card"><b>${encodeHtml(copy.riscS)}</b><span>${encodeHtml(copy.riscSbody)}</span></article><article class="risc-primer-card"><b>${encodeHtml(copy.riscC)}</b><span>${encodeHtml(copy.riscCbody)}</span></article></div></div></section>`;
}

function renderLiveHtml(rawBriefing, locale = 'zh', basePath = '/daily') {
  const briefing = decorateBriefing(rawBriefing);
  const loc = localesById[locale] || localesById.zh;
  const copy = copyFor(locale);
  const zh = isZhLocale(locale);
  const title = `${briefing.dateIso}｜${loc.ui.issueTitleSuffix}`;
  const lead = zh ? briefing.hero.leadZh : briefing.hero.leadEn;
  const subject = zh ? briefing.hero.subjectZh : briefing.hero.subjectEn;
  const judgment = zh ? briefing.hero.judgmentZh : briefing.hero.judgmentEn;
  const heatTitle = zh ? briefing.heat.titleZh : briefing.heat.titleEn;
  const heatBody = zh ? briefing.heat.bodyZh : briefing.heat.bodyEn;
  const navSub = copy.navSub;
  const tryable = briefing.stats.tryable || briefing.stats.features || briefing.stats.watching;
  const radar = (briefing.radar || []).map((card, index) => {
    const tone = card.tagTone || (index === 0 ? 'green' : index === 1 ? 'amber' : '');
    return `<article class="item"><span class="tag${tone ? ` ${tone}` : ''}">${encodeHtml(zh ? card.tagZh : card.tagEn)}</span><h3>${encodeHtml(zh ? card.titleZh : card.titleEn)}</h3><p>${encodeHtml(zh ? card.bodyZh : card.bodyEn)}</p></article>`;
  }).join('');
  const features = [];
  const github = [];
  const world = [];
  for (const item of briefing.items) {
    const bucket = sectionOf(item);
    if (bucket === 'github') github.push(item);
    else if (bucket === 'world') world.push(item);
    else features.push(item);
  }
  let cursor = 0;
  const featureCards = features.map((item) => cardMarkup(item, cursor++, locale, copy)).join('');
  const githubCards = github.map((item) => cardMarkup(item, cursor++, locale, copy)).join('');
  const worldCards = world.map((item) => cardMarkup(item, cursor++, locale, copy)).join('');
  const sources = briefing.items.map((item) => {
    const tier = zh ? (item.sourceTierZh || '公开源') : (item.sourceTierEn || 'Public source');
    return `<li><a href="${encodeHtml(item.url)}" target="_blank" rel="noopener">${encodeHtml(item.sourceLabel)}：${encodeHtml(item.title)}</a> <span class="source-tier">${encodeHtml(tier)}</span></li>`;
  }).join('');
  const heatRows = (briefing.nav || []).map((row) => `<div class="heat-row"><div><strong>${encodeHtml(zh ? row.labelZh : row.labelEn)}</strong><span class="strength">${row.count} ${copy.itemUnit}</span></div><div><p>${encodeHtml(zh ? row.factZh : row.factEn)}</p><em>${encodeHtml(zh ? row.lookZh : row.lookEn)}</em></div></div>`).join('');
  const priority = briefing.priority
    ? `<div class="priority-note"><span>${encodeHtml(copy.priorityLabel)}</span><strong>${zh ? '用' : 'Use'} <span class="priority-brand">${encodeHtml(briefing.priority.brand)}</span>${zh ? '核对这些公开更新能不能当场复现。' : ' and check whether the public update can be reproduced today.'}</strong></div>`
    : '';
  const insight = briefing.insight
    ? `<div class="matrix"><div class="note"><strong>${encodeHtml(copy.insightLabel)}</strong>${encodeHtml(zh ? briefing.insight.zh : briefing.insight.en)}</div></div>`
    : '';
  const liveCanonical = `${BASE_URL}${liveHref(locale, basePath)}`;
  const hreflang = locales.map((item) => `<link rel="alternate" hreflang="${item.hreflang}" href="${BASE_URL}${liveHref(item.id, basePath)}">`).join('\n');
  const githubSection = githubCards
    ? `<section class="section"><h2>${encodeHtml(copy.githubTitle)}</h2><div class="heat-summary"><p>${encodeHtml(copy.githubNote)}</p></div><div class="signals">${githubCards}</div></section>`
    : '';
  const featureSection = featureCards
    ? `<section class="section"><h2>${encodeHtml(copy.featuresTitle)}</h2><div class="signals">${featureCards}</div></section>`
    : '';
  const worldSection = worldCards
    ? `<section class="section"><h2>${encodeHtml(copy.worldTitle)}</h2><div class="signals">${worldCards}</div>${insight}</section>`
    : `<section class="section"><h2>${encodeHtml(copy.worldTitle)}</h2>${insight}</section>`;

  let html = `<!doctype html>
<html lang="${loc.htmlLang}"${loc.dir === 'rtl' ? ' dir="rtl"' : ''}>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${encodeHtml(title)}</title>
  <meta name="description" content="${encodeHtml(lead)}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${encodeHtml(title)}">
  <meta property="og:description" content="${encodeHtml(lead)}">
  ${socialPreviewHead(BASE_URL, basePath)}
  <link rel="canonical" href="${encodeHtml(liveCanonical)}">
  ${hreflang}
  <link rel="alternate" hreflang="x-default" href="${BASE_URL}${liveHref('zh', basePath)}">
  <link rel="icon" type="image/png" href="${basePath}/assets/alux-favicon.png">
  <link rel="apple-touch-icon" href="${basePath}/assets/alux-favicon.png">
  <link rel="stylesheet" href="${basePath}/assets/report-site.css">
  <style>${PAGE_CSS}</style>
</head>
<body>
${navMarkup(locale, basePath)}
<main class="page" data-layout-version="compact-v1" data-live-page>
<section class="hero"><div class="hero-copy"><div class="eyebrow"><span>ALUX AI Agent Daily</span><span>${encodeHtml(briefing.dateIso)}</span><span>${encodeHtml(copy.eyebrowBrief)}</span><span>${encodeHtml(copy.eyebrowLive)}</span></div><h1><span class="title-en">AI Agent</span><span class="title-cn">${encodeHtml(subject)}</span></h1><p class="lead">${encodeHtml(lead)}</p><div class="stats" aria-label="${encodeHtml(copy.navTitle)}"><div class="stat"><b>${briefing.stats.watching}</b><span>${encodeHtml(copy.statWatching)}</span></div><div class="stat"><b>${tryable}</b><span>${encodeHtml(copy.statTry)}</span></div><div class="stat"><b>${briefing.stats.openSource}</b><span>${encodeHtml(copy.statOpen)}</span></div><div class="stat"><b>${briefing.stats.regions}</b><span>${encodeHtml(copy.statRegions)}</span></div></div><div class="judgment"><strong>${encodeHtml(copy.judgmentLabel)}</strong>${encodeHtml(judgment)}</div></div><aside class="intel-panel"><div class="panel-head"><strong>${encodeHtml(copy.navTitle)}</strong><span>${encodeHtml(navSub)}</span></div><div class="heat-summary"><b>${encodeHtml(heatTitle)}</b><p>${encodeHtml(heatBody)}</p></div><div class="heat-list">${heatRows}</div>${priority}</aside></section>
${riscMarkup(copy)}
<section class="section"><h2>${encodeHtml(copy.radarTitle)}</h2><div class="radar">${radar}</div></section>
${featureSection}
${githubSection}
${worldSection}
<section class="section"><h2>${encodeHtml(copy.sourcesTitle)}</h2><ol class="sources">${sources}</ol></section>
</main>
${footerMarkup(locale, basePath)}
<script>
(() => {
  const hydrate = async () => {
    const urls = ['${basePath}/live/latest.json', '${basePath}/api/live.json', '/api/live.json'];
    for (const url of urls) {
      try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) continue;
        const data = await response.json();
        if (data && data.generatedAt && data.generatedAt !== '${briefing.generatedAt}') location.reload();
        return;
      } catch {}
    }
  };
  hydrate();
})();
</script>
</body></html>`;
  if (locale === 'zh-Hant') html = toHant(html);
  return html;
}

function renderTeaser(briefing, locale = 'zh') {
  const decorated = decorateBriefing(briefing);
  return {
    dateIso: decorated.dateIso,
    generatedAt: decorated.generatedAt,
    generatedAtShanghai: decorated.generatedAtShanghai,
    locale,
    watching: decorated.stats.watching,
    subject: locale === 'en' ? decorated.hero.subjectEn : decorated.hero.subjectZh,
    lead: locale === 'en' ? decorated.hero.leadEn : decorated.hero.leadZh,
    href: locale === 'en' ? '/daily/live/en/' : '/daily/live/',
    items: decorated.items.slice(0, 4).map((item) => ({
      title: item.title,
      source: item.sourceLabel,
      category: locale === 'en' ? item.categoryEn : item.categoryZh,
      url: item.url,
    })),
  };
}

function liveArchiveRow(briefing, localeId, basePath = '/daily') {
  const locale = localesById[localeId] || localesById.en;
  const isZh = locale.id === 'zh' || locale.id === 'zh-Hant';
  const date = utcDate(briefing.dateIso);
  const href = liveHref(isZh ? 'zh' : locale.id === 'en' ? 'en' : locale.id, basePath);
  const title = isZh ? `AI Agent${briefing.hero.subjectZh}` : `AI Agent ${briefing.hero.subjectEn}`;
  const lead = isZh ? briefing.hero.leadZh : briefing.hero.leadEn;
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
  const href = liveHref(isZh ? 'zh' : locale.id === 'en' ? 'en' : locale.id, basePath);
  const date = utcDate(briefing.dateIso);
  const dateLabel = formatDate(date, locale);
  const kicker = locale.ui.todayKicker || locale.ui.liveLabel;
  const lead = isZh ? briefing.hero.leadZh : briefing.hero.leadEn;
  const read = locale.ui.readToday || locale.ui.liveOpen;
  let next = html.replace(
    /(<div class="latest-kicker"><span>)[^<]*(<\/span><time datetime=")[^"]*("[^>]*>)[^<]*(<\/time>)/,
    `$1${encodeHtml(kicker)}$2${briefing.dateIso}$3${encodeHtml(dateLabel)}$4`,
  );
  if (next.includes('latest-title-subject')) {
    next = next.replace(
      /(<span class="latest-title-subject">)[\s\S]*?(<\/span>)/,
      `$1${encodeHtml(briefing.hero.subjectZh)}$2`,
    );
  } else {
    const title = isZh ? `AI Agent${briefing.hero.subjectZh}` : `AI Agent ${briefing.hero.subjectEn}`;
    next = next.replace(/(<article class="latest">[\s\S]*?<h2[^>]*>)[\s\S]*?(<\/h2>)/, `$1${encodeHtml(title)}$2`);
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
  const more = isEn ? 'Open today’s issue ↗' : '打开今日完整日报 ↗';
  const items = briefing.items.slice(0, 4).map((item) => (
    `<a class="live-story" href="${encodeHtml(item.url)}" target="_blank" rel="noopener"><small>${encodeHtml(item.sourceLabel)}${item.categoryZh || item.categoryEn ? ` · ${encodeHtml(locale === 'en' ? item.categoryEn : item.categoryZh)}` : ''}</small><strong>${encodeHtml(item.title)}</strong></a>`
  )).join('');
  const markup = `<div class="live-strip-list" data-live-list>${items}<a class="live-strip-fallback" href="${href}">${more}</a></div>`;
  return html.replace(/<div class="live-strip-list"[^>]*>[\s\S]*?<\/div>/, markup);
}

function injectAllHomepages(publicRoot, briefing, basePath = '/daily') {
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
    const stripLocale = locale === 'zh' || locale === 'zh-Hant' ? 'zh' : 'en';
    let html = fs.readFileSync(file, 'utf8');
    html = injectHomeLiveStrip(html, briefing, stripLocale, basePath);
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
