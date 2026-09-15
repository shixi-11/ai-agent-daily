'use strict';

const { shanghaiDateIso, shanghaiStamp } = require('./locales.cjs');
const { decodeHtml } = require('./io.cjs');

const CATEGORIES = {
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
  { category: 'agent', pattern: /\b(agent|mcp|skill|orchestr|tool[- ]use|multi-agent|智能体|工作流)\b/i, bonus: 3 },
  { category: 'model-platform', pattern: /\b(gpt|claude|gemini|llama|qwen|deepseek|kimi|minimax|grok|mistral|model|weights?|checkpoint|开放权重)\b/i, bonus: 3 },
  { category: 'open-source', pattern: /\b(github|open[- ]source|release|apache|mit license|huggingface|开源|权重)\b/i, bonus: 2 },
  { category: 'research', pattern: /\b(arxiv|paper|benchmark|eval|dataset|论文|评测)\b/i, bonus: 2 },
  { category: 'hardware', pattern: /\b(gpu|cuda|npu|tpu|nvidia|inference|kernel|芯片|推理)\b/i, bonus: 2 },
  { category: 'product', pattern: /\b(launch|announce|api|product|app|发布|上线)\b/i, bonus: 1 },
  { category: 'market', pattern: /\b(fund|acqui|series [a-d]|ipo|融资|并购)\b/i, bonus: 1 },
];

const NOISE = /(weekly roundup|what you (need|should) (to )?know|job posting|hiring|comment on|comments of|redirect notice)/i;

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

function detectCategory(item) {
  if (item.origin === 'huggingface' || item.kind === 'model-platform') return 'model-platform';
  if (item.origin === 'github-release' || item.origin === 'github-repo' || item.kind === 'open-source') return 'open-source';
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
  if (item.stars) score += Math.min(5, Math.log10(item.stars + 1));
  if (item.origin === 'github-release') score += item.versionLike ? -2 : 2;
  if (item.points) score += Math.min(4, item.points / 40);
  if (NOISE.test(hay)) score -= 8;
  if (/^(?:[\w.-]+\/)?(?:v?\d[\w.-]*|b\d+)$/i.test(item.title || '')) score -= 4;
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
  if (item.repo) return item.repo;
  if (item.origin === 'hacker-news') return 'Hacker News';
  if (item.origin === 'huggingface') return 'Hugging Face';
  const host = hostOf(item.url);
  return host || item.sourceId || 'source';
}

function composeCopy(item, category, observedAt) {
  const meta = CATEGORIES[category] || CATEGORIES.product;
  const snippet = snippetOf(item);
  const published = item.date ? item.date.toISOString().slice(0, 10) : '日期未知';
  const label = sourceLabel(item);
  const title = item.title.replace(/\s+/g, ' ').trim();
  const whatZh = snippet
    ? `${label} 发布「${title}」。${snippet}`
    : `${label} 在公开源发布了「${title}」。`;
  const whatEn = snippet
    ? `${label} published “${title}”. ${snippet}`
    : `${label} published “${title}” on a public feed.`;
  return {
    title,
    category,
    categoryZh: meta.zh,
    categoryEn: meta.en,
    region: detectRegion(item),
    sourceLabel: label,
    url: item.url,
    publishedAt: published,
    observedAt,
    origin: item.origin,
    repo: item.repo || '',
    stars: item.stars || 0,
    license: item.license || '',
    whatZh: whatZh.slice(0, 220),
    whyZh: meta.whyZh,
    whoZh: meta.whoZh,
    tryZh: '打开原始链接，核对发布日期、许可和适用范围。',
    noteZh: '本条由公开 RSS、GitHub 或 Hugging Face 自动收录，摘要来自原始页面，未经人工精修。',
    whatEn: whatEn.slice(0, 320),
    whyEn: meta.whyEn,
    whoEn: meta.whoEn,
    tryEn: 'Open the original link and verify the date, license and stated scope.',
    noteEn: 'Collected automatically from a public feed. The summary is from the source page, not a human rewrite.',
    isFeature: false,
  };
}

function pickMix(ranked) {
  const selected = [];
  const seenCat = {};
  const seenRepo = new Set();
  const push = (item) => {
    if (selected.length >= 16) return;
    if (selected.some((row) => row.url === item.url)) return;
    if (item.repo && item.origin === 'github-release') {
      if (seenRepo.has(item.repo)) return;
      seenRepo.add(item.repo);
    }
    selected.push(item);
    seenCat[item.category] = (seenCat[item.category] || 0) + 1;
  };
  const used = new Set();
  for (const item of ranked) {
    if (/nightly/i.test(item.title)) continue;
    if (selected.length >= 6) break;
    if (used.has(item.category) && used.size < 4) continue;
    push(item);
    used.add(item.category);
  }
  for (const item of ranked) {
    if (/nightly/i.test(item.title)) continue;
    if (selected.length >= 16) break;
    if (item.origin === 'github-release' && selected.filter((row) => row.origin === 'github-release').length >= 3) continue;
    if ((seenCat[item.category] || 0) >= 4) continue;
    push(item);
  }
  for (const item of ranked) {
    if (/nightly/i.test(item.title)) continue;
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
    .map(([category, group]) => {
      const meta = CATEGORIES[category];
      const names = group.slice(0, 2).map((item) => item.sourceLabel);
      const zhTitle = `${meta.zh}出现可核验更新`.slice(0, 20);
      return {
        category,
        tagZh: meta.zh,
        tagEn: meta.en,
        titleZh: zhTitle,
        titleEn: `${meta.en} show verifiable updates`,
        bodyZh: `${names.join('、')} 等来源在公开渠道给出新文件或新说明，适合对照原始页面查看。`,
        bodyEn: `${names.join(', ')} published new files or notes on public channels. Check the original pages before treating them as product claims.`,
      };
    });
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
    const key = `${hostOf(raw.url)}|${normalizeTitle(raw.title)}`;
    if (!key.endsWith('|') && seen.has(key)) continue;
    seen.add(key);
    const item = { ...raw, date };
    const category = detectCategory(item);
    const card = composeCopy(item, category, observedAt);
    card.score = scoreItem(item);
    card.hasCjk = hasCjk(card.title);
    ranked.push(card);
  }

  ranked.sort((a, b) => b.score - a.score);
  const selected = pickMix(ranked);
  const openSource = selected.filter((item) => item.category === 'open-source').length;
  const regions = new Set(selected.map((item) => item.region));
  const features = selected.filter((item) => item.isFeature);
  const top = selected.find((item) => /gemini|gpt-|claude|openai|deepmind|qwen|llama|codex/i.test(`${item.title} ${item.url}`)) || selected[0];
  const heroSubjectZh = top
    ? (top.hasCjk ? top.title.slice(0, 22) : (top.title.length <= 18 ? top.title : '公开源里的新模型与工具'))
    : '公开源自动雷达';
  const heroSubjectEn = top ? top.title.slice(0, 72) : 'Public-source radar';

  return {
    schemaVersion: 1,
    mode: 'live-public-sources',
    dateIso: observedAt,
    generatedAt: now.toISOString(),
    generatedAtShanghai: shanghaiStamp(now),
    collectedAt: collected.collectedAt,
    counts: collected.counts,
    feedReports: collected.feedReports,
    stats: {
      watching: selected.length,
      features: features.length,
      openSource,
      regions: regions.size,
    },
    hero: {
      subjectZh: heroSubjectZh,
      subjectEn: heroSubjectEn,
      leadZh: `从 ${collected.counts?.total || 0} 条公开源里选出 ${selected.length} 条，覆盖官方博客、GitHub、Hugging Face 与论文源。`,
      leadEn: `Selected ${selected.length} items from ${collected.counts?.total || 0} public-source records across official blogs, GitHub, Hugging Face and paper feeds.`,
      judgmentZh: '这些条目来自可点击的原始页面，不是付费接口，也不是模型代写。把它当雷达，不当已经精修的刊物正文。',
      judgmentEn: 'Every item points at a public page. This is a radar assembled without paid APIs or an editorial model, not a human-rewritten magazine issue.',
    },
    radar: radarCards(selected),
    items: selected,
    leftover: ranked.length - selected.length,
  };
}

module.exports = {
  composeBriefing,
  CATEGORIES,
};
