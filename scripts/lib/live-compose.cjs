'use strict';

const { shanghaiDateIso, shanghaiStamp } = require('./locales.cjs');
const { decodeHtml } = require('./io.cjs');

const CATEGORIES = {
  'new-site': {
    zh: '新站新项目',
    en: 'New sites',
    whyZh: '新出现的公开仓库、Show HN 或产品站，往往是还没被大厂覆盖的用法实验。',
    whyEn: 'A newly public repo, Show HN or product site is often a usage experiment the big labs have not covered yet.',
    whoZh: '愿意动手试新工具的开发者和独立作者。',
    whoEn: 'Developers and indie builders who try new tools early.',
  },
  'model-platform': {
    zh: '模型平台',
    en: 'Models',
    whyZh: '新模型或平台接口会改变能做什么、成本多少，以及能不能自己跑。',
    whyEn: 'A new model or platform interface changes what you can do, what it costs, and whether you can run it yourself.',
    whoZh: '模型评测、产品接入与研究团队。',
    whoEn: 'Model evaluators, product teams and researchers.',
  },
  'open-source': {
    zh: '开源发现',
    en: 'Open source',
    whyZh: '可下载的代码、权重或工具让人能复现，而不只是阅读公告。',
    whyEn: 'Downloadable code, weights or tools let people reproduce work instead of only reading an announcement.',
    whoZh: '开源贡献者、推理工程与本地部署使用者。',
    whoEn: 'Open-source contributors, inference engineers and local-deploy users.',
  },
  agent: {
    zh: '智能体',
    en: 'Agents',
    whyZh: 'Agent、MCP 或 Skills 的变化，会改写工具怎么被调用、权限怎么被交出。',
    whyEn: 'Changes in agents, MCP or skills rewrite how tools are called and how permission is handed over.',
    whoZh: 'Agent 产品、编排与自动化开发者。',
    whoEn: 'Agent product, orchestration and automation developers.',
  },
  research: {
    zh: '研究评测',
    en: 'Research',
    whyZh: '论文和基准提供可核对的方法，而不是产品演示。',
    whyEn: 'Papers and benchmarks offer methods you can check, not just a product demo.',
    whoZh: '研究、评测与科学计算团队。',
    whoEn: 'Research, evaluation and scientific computing teams.',
  },
  product: {
    zh: '产品功能',
    en: 'Products',
    whyZh: '真正上线的功能会改变日常用法，而不只是路线图。',
    whyEn: 'Shipped features change daily usage, not just a roadmap.',
    whoZh: '产品经理、应用开发者与重度使用者。',
    whoEn: 'Product managers, app developers and power users.',
  },
  hardware: {
    zh: '硬件架构',
    en: 'Hardware',
    whyZh: '芯片、推理引擎或运行时变化会决定成本和可部署范围。',
    whyEn: 'Chips, inference engines or runtimes decide cost and where something can actually run.',
    whoZh: '基础设施、推理与硬件团队。',
    whoEn: 'Infrastructure, inference and hardware teams.',
  },
  market: {
    zh: '市场信号',
    en: 'Market',
    whyZh: '融资、并购或分发策略只有在解释产业结构时才值得看。',
    whyEn: 'Funding, deals or distribution matter when they explain a shift in the industry.',
    whoZh: '关注生态和商业结构的读者。',
    whoEn: 'Readers tracking ecosystem and commercial structure.',
  },
};

const KEYWORDS = [
  { category: 'new-site', pattern: /\b(show hn|launched|new (?:site|app|tool)|独立站|上线)\b/i, bonus: 4 },
  { category: 'agent', pattern: /\b(agent|mcp|skill|orchestr|tool[- ]use|multi-agent|智能体|工作流)\b/i, bonus: 3 },
  { category: 'model-platform', pattern: /\b(gpt|claude|gemini|llama|qwen|deepseek|kimi|minimax|grok|mistral|model|weights?|checkpoint|开放权重)\b/i, bonus: 3 },
  { category: 'open-source', pattern: /\b(github|open[- ]source|release|apache|mit license|huggingface|开源|权重)\b/i, bonus: 2 },
  { category: 'research', pattern: /\b(arxiv|paper|benchmark|eval|dataset|论文|评测)\b/i, bonus: 2 },
  { category: 'hardware', pattern: /\b(gpu|cuda|npu|tpu|nvidia|inference|kernel|芯片|推理)\b/i, bonus: 2 },
  { category: 'product', pattern: /\b(launch|announce|api|product|app|发布|上线)\b/i, bonus: 1 },
  { category: 'market', pattern: /\b(fund|acqui|series [a-d]|ipo|融资|并购)\b/i, bonus: 1 },
];

const NOISE = /(weekly roundup|what you (need|should) (to )?know|job posting|hiring|comment on|comments of|redirect notice|is hiring)/i;

function hasCjk(text) {
  return /[\u3400-\u9fff]/.test(text || '');
}

function normalizeTitle(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9\u3400-\u9fff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function isVersionNoise(item) {
  const title = String(item.title || '');
  return Boolean(item.versionLike)
    || /^(?:release\s+)?v?\d[\w.-]*$/i.test(title)
    || /^[\w.-]+\/[\w.-]+\s+v?\d[\w.-]*$/i.test(title)
    || /nightly|preview\.\d|b\d{4,}/i.test(title);
}

function cleanTitle(item) {
  let title = String(item.title || '').replace(/\s+/g, ' ').trim();
  title = title.replace(/^show hn:\s*/i, '');
  if (item.repo) {
    const prefix = String(item.repo).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    title = title.replace(new RegExp(`^${prefix}\\s*:\\s*`), '');
  }
  if (/^(?:release\s+)?v?\d[\w.-]*$/i.test(title) && item.repo) {
    return `${item.repo} ${title.replace(/^release\s+/i, '')}`;
  }
  if (/^release\s+/i.test(title) && item.repo) {
    return `${item.repo} ${title.replace(/^release\s+/i, '')}`;
  }
  return title;
}


function detectCategory(item) {
  if (item.origin === 'show-hn' || item.origin === 'github-repo' || item.kind === 'new-site') return 'new-site';
  if (item.origin === 'huggingface' || item.kind === 'model-platform') return 'model-platform';
  if (item.origin === 'github-release' || item.kind === 'open-source') return 'open-source';
  if (item.kind === 'research' || /arxiv\.org/i.test(item.url || '')) return 'research';
  const hay = `${item.title} ${item.summary} ${item.sourceId}`;
  let best = 'product';
  let score = 0;
  for (const rule of KEYWORDS) {
    if (rule.pattern.test(hay) && rule.bonus >= score) {
      best = rule.category;
      score = rule.bonus;
    }
  }
  return best;
}

function detectRegion(item) {
  const hay = `${item.title} ${item.sourceId} ${item.repo || ''} ${item.url}`;
  if (item.region && item.region !== '全球社区') return item.region;
  if (/(qwen|deepseek|minimax|moonshot|internlm|智谱|阿里|字节|百度|华为|jiqizhixin|solidot|infoq\.cn)/i.test(hay)) return '中国';
  if (/(openai|anthropic|google|meta|nvidia|microsoft|openai\.com)/i.test(hay)) return '美国';
  if (/(deepmind|mistral|cohere)/i.test(hay)) return /cohere/i.test(hay) ? '加拿大' : '欧洲';
  return item.region || '全球社区';
}

function hoursAgo(date) {
  if (!date || Number.isNaN(date.getTime())) return null;
  return (Date.now() - date.getTime()) / 36e5;
}

function scoreItem(item) {
  const hay = `${item.title} ${item.summary}`;
  let score = Number(item.sourceWeight || 5);
  const age = hoursAgo(item.date);
  if (age == null) score += Number(item.sourceWeight || 5) >= 8 ? 3 : 0;
  else if (age <= 24) score += 8;
  else if (age <= 48) score += 6;
  else if (age <= 72) score += 4;
  else if (age <= 168) score += 2;
  else score -= 4;
  if (/nightly|preview\.\d|b\d{4,}/i.test(item.title || '')) score -= 10;
  for (const rule of KEYWORDS) {
    if (rule.pattern.test(hay)) score += rule.bonus;
  }
  if (item.stars) score += Math.min(6, Math.log10(item.stars + 1) * 2);
  if (item.origin === 'github-release') score += item.versionLike ? -6 : 2;
  if (item.origin === 'github-repo' || item.origin === 'show-hn') score += 3;
  if (item.kind === 'official') score += 4;
  if (/awesome[-_ ]|curated (list|collection)|awesome-/i.test(hay)) score -= 12;
  if (item.origin === 'github-repo' && /awesome/i.test(item.repo || item.title || '')) score -= 8;
  if (/^v?\d[\w.-]*:\s*docs\(/i.test(item.title || '')) score -= 8;
  if (item.points) score += Math.min(4, item.points / 40);
  if (NOISE.test(hay)) score -= 8;
  if (/^(?:[\w.-]+\/)?(?:v?\d[\w.-]*|b\d+)$/i.test(item.title || '')) score -= 6;
  return score;
}

function snippetOf(item, max = 160) {
  let text = String(item.summary || '');
  for (let pass = 0; pass < 3; pass += 1) {
    text = decodeHtml(text).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  text = text.replace(/^arXiv:[\w.]+v\d+\s+Announce Type:\s+\w+\s+Abstract:\s*/i, '');
  text = text.replace(/^What's [Cc]hanged\s*/i, '');
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function sourceLabel(item) {
  if (item.origin === 'show-hn') return 'Show HN';
  if (item.repo) return item.repo;
  if (item.origin === 'hacker-news') return 'Hacker News';
  if (item.origin === 'huggingface') return 'Hugging Face';
  const host = hostOf(item.url);
  return host || item.sourceId || 'source';
}

function sourceTier(item, category) {
  if (item.origin === 'github-repo') return { zh: '社区新仓库', en: 'Community repo' };
  if (item.origin === 'show-hn') return { zh: 'Show HN', en: 'Show HN' };
  if (item.origin === 'github-release') return { zh: '官方发布', en: 'Official release' };
  if (item.origin === 'huggingface') return { zh: '开放权重', en: 'Open weights' };
  if (item.origin === 'hacker-news') return { zh: '社区讨论', en: 'Community' };
  if (category === 'research' || /arxiv\.org/i.test(item.url || '')) return { zh: '论文预印', en: 'Preprint' };
  if (item.kind === 'official' || /openai\.com|anthropic\.com|blog\.google|deepmind|nvidia\.com|ai\.google|huggingface\.co\/blog/i.test(item.url || '')) {
    return { zh: '官方公告', en: 'Official' };
  }
  return { zh: '公开源', en: 'Public source' };
}

function sectionOf(category) {
  if (category === 'open-source' || category === 'new-site') return 'github';
  if (category === 'research' || category === 'hardware' || category === 'market') return 'world';
  return 'features';
}

function clip(text, max) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}


function composeCopy(item, category, observedAt) {
  const meta = CATEGORIES[category] || CATEGORIES.product;
  const snippet = snippetOf(item);
  const published = item.date ? item.date.toISOString().slice(0, 10) : '日期未知';
  const label = sourceLabel(item);
  const title = cleanTitle(item);
  let whatZh;
  let whatEn;
  if (item.origin === 'github-repo') {
    whatZh = `新公开仓库 ${item.repo}。${snippet || title}`;
    whatEn = `New public repository ${item.repo}. ${snippet || title}`;
  } else if (item.origin === 'show-hn') {
    whatZh = `Show HN 出现「${title}」。${snippet}`;
    whatEn = `Show HN posted “${title}”. ${snippet}`;
  } else if (snippet) {
    whatZh = `${label}：${snippet}`;
    whatEn = `${label}: ${snippet}`;
  } else {
    whatZh = `${label} 在公开源发布了「${title}」。`;
    whatEn = `${label} published “${title}” on a public feed.`;
  }
  const tier = sourceTier(item, category);
  return {
    title,
    category,
    categoryZh: meta.zh,
    categoryEn: meta.en,
    section: sectionOf(category),
    region: detectRegion(item),
    sourceLabel: label,
    sourceTierZh: tier.zh,
    sourceTierEn: tier.en,
    url: item.url,
    publishedAt: published,
    observedAt,
    origin: item.origin,
    repo: item.repo || '',
    stars: item.stars || 0,
    license: item.license || '',
    versionLike: Boolean(item.versionLike || isVersionNoise({ ...item, title })),
    whatZh: whatZh.slice(0, 220),
    whyZh: meta.whyZh,
    whoZh: meta.whoZh,
    tryZh: '打开原始链接，核对发布日期、许可和适用范围。',
    noteZh: '先看原始页面的日期、范围和许可，再决定要不要跟进。',
    whatEn: whatEn.slice(0, 320),
    whyEn: meta.whyEn,
    whoEn: meta.whoEn,
    tryEn: 'Open the original link and verify the date, license and stated scope.',
    noteEn: 'Check the original date, scope and license before treating this as settled.',
    isFeature: false,
  };
}

function pickMix(ranked) {
  const selected = [];
  const seenCat = {};
  const seenRepo = new Set();
  const push = (item) => {
    if (selected.length >= 16) return false;
    if (selected.some((row) => row.url === item.url || row.title === item.title)) return false;
    if (item.repo && (item.origin === 'github-release' || item.origin === 'github-repo')) {
      if (seenRepo.has(item.repo)) return false;
      seenRepo.add(item.repo);
    }
    selected.push(item);
    seenCat[item.category] = (seenCat[item.category] || 0) + 1;
    return true;
  };

  const used = new Set();
  for (const item of ranked) {
    if (isVersionNoise(item) || item.category === 'new-site') continue;
    if (selected.length >= 6) break;
    if (used.has(item.category) && used.size < 4) continue;
    if (push(item)) used.add(item.category);
  }
  for (const item of ranked) {
    if (item.category !== 'new-site') continue;
    if (selected.filter((row) => row.category === 'new-site').length >= 3) break;
    push(item);
  }
  for (const item of ranked) {
    if (isVersionNoise(item)) continue;
    if (selected.length >= 16) break;
    if (item.origin === 'github-release' && selected.filter((row) => row.origin === 'github-release').length >= 2) continue;
    if ((seenCat[item.category] || 0) >= 4) continue;
    push(item);
  }
  for (const item of ranked) {
    if (isVersionNoise(item)) continue;
    if (selected.length >= 16) break;
    push(item);
  }
  selected.slice(0, Math.min(6, selected.length)).forEach((item) => {
    item.isFeature = true;
  });
  return selected;
}

function radarCards(items) {
  const groups = {};
  for (const item of items) {
    groups[item.category] = groups[item.category] || [];
    groups[item.category].push(item);
  }
  return Object.entries(groups)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 3)
    .map(([category, group], index) => {
      const meta = CATEGORIES[category];
      const names = [...new Set(group.slice(0, 3).map((item) => item.sourceLabel))];
      const lead = group[0];
      const shortName = String(lead.sourceLabel || meta.zh).replace(/\.com$/i, '');
      const titleZh = clip(`${shortName}交出新变化`, 20);
      const titleEn = clip(`${shortName} ships a new change`, 48);
      return {
        category,
        tagZh: meta.zh,
        tagEn: meta.en,
        tagTone: index === 0 ? 'green' : index === 1 ? 'amber' : '',
        titleZh,
        titleEn,
        bodyZh: `${names.join('、')} 同时给出可点开的原始页面，适合对照来源，而不是把摘要当结论。`,
        bodyEn: `${names.join(', ')} published public pages. Treat the original source as the claim, not this summary.`,
      };
    });
}

function pickHero(selected) {
  const official = selected.find((item) => /openai|google|deepmind|anthropic|huggingface|nvidia|gemini/i.test(`${item.sourceLabel} ${item.url} ${item.title}`) && !item.versionLike);
  const newsy = selected.find((item) => !item.versionLike && item.category !== 'new-site' && String(item.title || '').length >= 12);
  return official || newsy || selected.find((item) => !item.versionLike) || selected[0] || null;
}

const THEMES = {
  agent: { zh: 'Agent把工具权限交出来', en: 'Agents Hand Over Tool Rights' },
  'model-platform': { zh: '新模型走进可调用接口', en: 'New Models Become Callable' },
  'open-source': { zh: '开源把可运行代码交出来', en: 'Open Source Ships Running Code' },
  'new-site': { zh: '新站把新用法先跑起来', en: 'New Sites Try New Uses First' },
  research: { zh: '评测把方法交给可核对', en: 'Evals Make Methods Checkable' },
  hardware: { zh: '芯片改写Agent成本', en: 'Chips Rewrite Agent Cost' },
  product: { zh: '产品把能力装进工作流', en: 'Products Put Capability to Work' },
  market: { zh: '市场改写供给与分发', en: 'Markets Rewrite Supply Lines' },
};

function dominantCategory(items) {
  const counts = {};
  for (const item of items || []) {
    counts[item.category] = (counts[item.category] || 0) + (item.isFeature ? 2 : 1);
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'product';
}

function composeHero(items, counts) {
  const top = pickHero(items);
  const n = items.length;
  const total = counts?.total || n;
  const shortZh = top
    ? (top.hasCjk ? top.title.slice(0, 22) : `${top.categoryZh}：${top.title.slice(0, 18)}`)
    : '公开源自动雷达';
  const subjectEn = top ? top.title.slice(0, 72) : 'Public-source radar';
  return {
    subjectZh: shortZh,
    subjectEn,
    leadZh: `从 ${total} 条公开源里选出 ${n} 条，覆盖官方博客、GitHub、新仓库、Show HN 与论文源。`,
    leadEn: `Selected ${n} items from ${total} public-source records across official blogs, GitHub, new repos, Show HN and paper feeds.`,
    judgmentZh: '这些条目来自可点击的原始页面，不是付费接口，也不是模型代写。把它当雷达，不当已经精修的刊物正文。',
    judgmentEn: 'Every item points at a public page. This is a radar assembled without paid APIs or an editorial model, not a human-rewritten magazine issue.',
  };
}

const NAV_LANES = [
  {
    cats: ['product', 'agent', 'model-platform'],
    zh: '产品现场',
    en: 'Field',
    lookZh: '看点：能直接上手的产品、模型和 Agent 入口。',
    lookEn: 'Look for: products, models and agent surfaces you can open today.',
  },
  {
    cats: ['open-source', 'new-site'],
    zh: '开源新站',
    en: 'Open',
    lookZh: '看点：仓库和独立站可以立刻点开验证。',
    lookEn: 'Look for: repos and new sites you can verify immediately.',
  },
  {
    cats: ['research'],
    zh: '研究评测',
    en: 'Research',
    lookZh: '看点：论文和基准给出可核对的方法。',
    lookEn: 'Look for: papers and benchmarks with checkable methods.',
  },
  {
    cats: ['hardware', 'market'],
    zh: '系统市场',
    en: 'Systems',
    lookZh: '看点：成本、供给和产业结构的真实变化。',
    lookEn: 'Look for: real shifts in cost, supply and industry structure.',
  },
];

function navLanes(items) {
  const assigned = new Set();
  const rows = NAV_LANES.map((lane) => {
    const group = (items || []).filter((item) => lane.cats.includes(item.category));
    group.forEach((item) => assigned.add(item.url));
    return { ...lane, group };
  });
  const leftover = (items || []).filter((item) => !assigned.has(item.url));
  for (const row of rows) {
    if (!row.group.length && leftover.length) row.group = [leftover.shift()];
  }
  const largest = [...rows].sort((a, b) => b.group.length - a.group.length)[0];
  for (const row of rows) {
    if (!row.group.length && largest?.group?.length) row.group = largest.group.slice(0, 1);
  }
  return rows.map((row) => {
    const names = [...new Set(row.group.slice(0, 2).map((item) => item.sourceLabel))];
    const lead = row.group[0];
    return {
      labelZh: row.zh,
      labelEn: row.en,
      count: row.group.length,
      factZh: names.length ? `${names.join('、')} 给出可点开的原始页面。` : (lead?.title || '公开源仍有可核对条目。'),
      factEn: names.length ? `${names.join(', ')} published a public page.` : (lead?.title || 'Public sources still have a checkable item.'),
      lookZh: row.lookZh,
      lookEn: row.lookEn,
    };
  });
}

function composePriority(items) {
  const pick = (items || []).find((item) => item.category === 'new-site' || item.category === 'open-source')
    || (items || []).find((item) => item.isFeature)
    || items?.[0];
  if (!pick) return null;
  return {
    brand: pick.sourceLabel,
    zh: `打开 ${pick.sourceLabel}，核对今天这条公开更新能不能在官方页面上复现。`,
    en: `Open ${pick.sourceLabel} and check whether today’s public update can be reproduced on the official page.`,
  };
}

function composeInsight(items) {
  const cats = [...new Set((items || []).map((item) => item.categoryZh))].slice(0, 3).join('、');
  const catsEn = [...new Set((items || []).map((item) => item.categoryEn))].slice(0, 3).join(', ');
  return {
    zh: `本期最密的是${cats || '公开源'}。真正有用的读法，是打开原始页面核对日期、许可和能不能当场试用。`,
    en: `The densest signals sit in ${catsEn || 'public sources'}. Open the original pages and check the date, license and whether you can try it today.`,
  };
}

function composeHeatSummary(items, hero) {
  const n = items.length;
  const names = [...new Set(items.slice(0, 3).map((item) => item.sourceLabel))];
  return {
    titleZh: `主轴：${hero.subjectZh}`,
    titleEn: `Through-line: ${hero.subjectEn}`,
    bodyZh: `${n}条信号覆盖${names.join('、')}等公开源。`,
    bodyEn: `${n} signals cover ${names.join(', ')} and other public sources.`,
  };
}

function decorateBriefing(briefing) {
  const items = briefing.items || [];
  const hero = composeHero(items, briefing.counts);
  const tryable = items.filter((item) => item.category !== 'research').length || items.length;
  return {
    ...briefing,
    hero,
    stats: {
      watching: items.length,
      features: items.filter((item) => item.isFeature).length,
      tryable,
      openSource: items.filter((item) => item.category === 'open-source' || item.category === 'new-site').length,
      newSites: items.filter((item) => item.category === 'new-site').length,
      regions: new Set(items.map((item) => item.region)).size,
    },
    nav: navLanes(items),
    radar: radarCards(items),
    heat: composeHeatSummary(items, hero),
    priority: composePriority(items),
    insight: composeInsight(items),
  };
}

function composeBriefing(collected, options = {}) {
  const now = options.now || new Date();
  const observedAt = shanghaiDateIso(now);
  const lookbackHours = Number(collected.lookbackDays || 7) * 24;
  const seen = new Set();
  const ranked = [];

  for (const raw of collected.items || []) {
    const date = raw.date instanceof Date ? raw.date : raw.date ? new Date(raw.date) : null;
    if (date && hoursAgo(date) > lookbackHours + 24) continue;
    if (NOISE.test(raw.title || '')) continue;
    const cleaned = { ...raw, title: cleanTitle(raw), date };
    const key = `${hostOf(cleaned.url)}|${normalizeTitle(cleaned.title)}`;
    if (!key.endsWith('|') && seen.has(key)) continue;
    seen.add(key);
    const category = detectCategory(cleaned);
    const card = composeCopy(cleaned, category, observedAt);
    card.score = scoreItem(cleaned);
    card.hasCjk = hasCjk(card.title);
    ranked.push(card);
  }

  ranked.sort((a, b) => b.score - a.score);
  const selected = pickMix(ranked);

  return decorateBriefing({
    schemaVersion: 1,
    mode: 'live-public-sources',
    dateIso: observedAt,
    generatedAt: now.toISOString(),
    generatedAtShanghai: shanghaiStamp(now),
    collectedAt: collected.collectedAt,
    counts: collected.counts,
    feedReports: collected.feedReports,
    items: selected,
    leftover: ranked.length - selected.length,
  });
}

module.exports = {
  composeBriefing,
  decorateBriefing,
  cleanTitle,
  pickHero,
  navLanes,
  CATEGORIES,
};
