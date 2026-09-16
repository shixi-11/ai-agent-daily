const { encodeHtml, htmlText, classCount, externalLinks } = require('./io.cjs');

function convertToUtcDateTime(value) {
  if (value instanceof Date) {
    return new Date(value.getTime());
  }
  const text = String(value || '').trim();
  if (!text) throw new Error('时间值不能为空。');
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) throw new Error(`不是有效的 ISO 8601 时间：${text}`);
  return parsed;
}

function setHtmlLanguage(html, language) {
  if (!/<html\b/i.test(html)) throw new Error('报告缺少 html 根元素。');
  let next = html;
  if (/<html\b[^>]*\bdir\s*=/i.test(next)) {
    next = next.replace(/(<html\b[^>]*\bdir\s*=\s*)["'][^"']*["']/i, '$1"ltr"');
  }
  if (/<html\b[^>]*\blang\s*=/i.test(next)) {
    return next.replace(/(<html\b[^>]*\blang\s*=\s*)["'][^"']*["']/i, `$1"${language}"`);
  }
  return next.replace(/<html\b/i, `<html lang="${language}"`);
}

function setHtmlDir(html, dir) {
  if (dir !== 'rtl') {
    return html.replace(/\sdir=["'][^"']*["']/i, '');
  }
  if (/<html\b[^>]*\bdir\s*=/i.test(html)) {
    return html.replace(/(<html\b[^>]*\bdir\s*=\s*)["'][^"']*["']/i, '$1"rtl"');
  }
  return html.replace(/<html\b/i, '<html dir="rtl"');
}

function setHtmlTitle(html, title) {
  if (!/<title>[\s\S]*?<\/title>/i.test(html)) throw new Error('报告缺少 title。');
  return html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${encodeHtml(title)}</title>`);
}

function setDocumentBody(html, bodyFragment) {
  if (!/^\s*<main\b/i.test(bodyFragment) || !/<\/main>\s*$/i.test(bodyFragment)) {
    throw new Error('译文母稿必须是从 <main> 到 </main> 的完整 body 片段。');
  }
  if (/<\/?(?:html|head|body|style|script)\b/i.test(bodyFragment)) {
    throw new Error('译文母稿不得包含 html/head/body/style/script 标签。');
  }
  const match = html.match(/<body\b[^>]*>[\s\S]*?<\/body>/i);
  if (!match) throw new Error('报告缺少 body。');
  const open = html.match(/<body\b[^>]*>/i)[0];
  const start = match.index;
  const end = start + match[0].length;
  return `${html.slice(0, start)}${open}\n${bodyFragment.trim()}\n</body>${html.slice(end)}`;
}

function removeSiteInjection(html) {
  let next = html;
  for (const name of ['i18n-head', 'i18n-nav', 'issue-footer']) {
    next = next.replace(
      new RegExp(`\\s*<!--\\s*site:${name}:start\\s*-->[\\s\\S]*?<!--\\s*site:${name}:end\\s*-->\\s*`, 'gi'),
      '\n',
    );
  }
  return next;
}

function stripLanguageMore(html) {
  return html.replace(/<details\b[^>]*class=["'][^"']*\blanguage-more\b[^"']*["'][^>]*>[\s\S]*?<\/details>/gi, '');
}

function extractTitleLead(html) {
  const titleEn = htmlText(html, /<span[^>]+class\s*=\s*["'][^"']*\btitle-en\b[^"']*["'][^>]*>(?<value>.*?)<\/span>/is);
  let titleCn = htmlText(html, /<span[^>]+class\s*=\s*["'][^"']*\btitle-cn\b[^"']*["'][^>]*>(?<value>.*?)<\/span>/is);
  if (!titleEn && !titleCn) {
    titleCn = htmlText(html, /<h1[^>]*>(?<value>.*?)<\/h1>/is);
  }
  if (titleEn && titleCn && titleEn.endsWith('Agent') && titleCn.startsWith('Agent ')) {
    titleCn = titleCn.slice(6).trimStart();
  }
  const displayTitle = [titleEn, titleCn].filter(Boolean).join('') || 'ALUX AI智能体情报日报';
  const lead = htmlText(html, /<p[^>]+class\s*=\s*["'][^"']*\blead\b[^"']*["'][^>]*>(?<value>.*?)<\/p>/is)
    || '聚焦 AI Agent 运行时、可靠执行、安全边界与产业信号。';
  return { titleEn, titleCn, displayTitle, lead };
}

function extractEnglishTitleLead(html, dateIso) {
  const titleMain = htmlText(html, /<span[^>]+class\s*=\s*["'][^"']*\btitle-en\b[^"']*["'][^>]*>(?<value>.*?)<\/span>/is);
  const titleSubject = htmlText(html, /<span[^>]+class\s*=\s*["'][^"']*\btitle-cn\b[^"']*["'][^>]*>(?<value>.*?)<\/span>/is);
  let displayTitle;
  if (titleMain && titleSubject) displayTitle = `${titleMain} — ${titleSubject}`;
  else displayTitle = titleMain || titleSubject || htmlText(html, /<h1[^>]*>(?<value>.*?)<\/h1>/is);
  if (!displayTitle) throw new Error(`${dateIso} 英文母稿缺少标题。`);
  const lead = htmlText(html, /<p[^>]+class\s*=\s*["'][^"']*\blead\b[^"']*["'][^>]*>(?<value>.*?)<\/p>/is);
  if (!lead) throw new Error(`${dateIso} 英文母稿缺少 lead。`);
  return { displayTitle, lead, titleMain, titleSubject };
}

function assertTranslationBody({ bodyFragment, sourceHtml, dateIso, localeId = 'en' }) {
  if (!/^\s*<main\b/i.test(bodyFragment) || !/<\/main>\s*$/i.test(bodyFragment)) {
    throw new Error(`${dateIso} ${localeId} 母稿不是完整 main 片段。`);
  }
  if (localeId === 'en' && /[\u3400-\u9fff]/.test(bodyFragment)) {
    const sample = bodyFragment.match(/.{0,24}[\u3400-\u9fff].{0,24}/s)?.[0] || '';
    throw new Error(`${dateIso} 英文母稿仍含中文：${sample}`);
  }
  for (const className of ['hero', 'section', 'signal', 'sources']) {
    const sourceCount = classCount(sourceHtml, className);
    const translationCount = classCount(bodyFragment, className);
    if (sourceCount !== translationCount) {
      throw new Error(`${dateIso} ${localeId} 结构数量不一致：${className} 源=${sourceCount} 译=${translationCount}`);
    }
  }
  const sourceLinks = externalLinks(sourceHtml).join('\n');
  const translationLinks = externalLinks(bodyFragment).join('\n');
  if (sourceLinks !== translationLinks) {
    throw new Error(`${dateIso} ${localeId} 外部来源链接集合不一致。`);
  }
  const translationLinkCount = externalLinks(bodyFragment).length;
  for (const required of ['target="_blank"', 'rel="noopener"']) {
    if (translationLinkCount > 0 && !bodyFragment.toLowerCase().includes(required.toLowerCase())) {
      throw new Error(`${dateIso} ${localeId} 母稿缺少外链安全属性：${required}`);
    }
  }
}

function socialPreviewHead(baseUrl, basePath) {
  const imageUrl = `${baseUrl.replace(/\/$/, '')}/${basePath.replace(/^\/|\/$/g, '')}/assets/agent-daily-social-v1.png`;
  return `<meta property="og:site_name" content="Agent Daily">
<meta property="og:image" content="${encodeHtml(imageUrl)}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1734">
<meta property="og:image:height" content="907">
<meta property="og:image:alt" content="Agent Daily — AI news by Shixi Lin, with an orbital glass sphere">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${encodeHtml(imageUrl)}">
<meta name="twitter:image:alt" content="Agent Daily — AI news by Shixi Lin, with an orbital glass sphere">`;
}

function stripSocialMeta(html) {
  return html.replace(/<meta\b[^>]*(?:property|name)=["'](?:og:(?:title|type|description|site_name|url|locale|image(?::[^"']+)?)|twitter:[^"']+)["'][^>]*>\s*/gis, '');
}

module.exports = {
  convertToUtcDateTime,
  setHtmlLanguage,
  setHtmlDir,
  setHtmlTitle,
  setDocumentBody,
  removeSiteInjection,
  stripLanguageMore,
  extractTitleLead,
  extractEnglishTitleLead,
  assertTranslationBody,
  socialPreviewHead,
  stripSocialMeta,
};
