const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const siteRoot = path.resolve(__dirname, '..');
const publicRoot = path.join(siteRoot, 'public');
const artifactRoot = path.join(siteRoot, 'artifacts');
let port = Number.parseInt(process.env.RENDER_CHECK_PORT || '0', 10);
const chromeCandidates = [
  process.env.CHROME_EXECUTABLE,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);
const chromeExecutable = chromeCandidates.find((candidate) => fs.existsSync(candidate));
const archiveZh = JSON.parse(fs.readFileSync(path.join(publicRoot, 'archive.json'), 'utf8'));
const archiveEn = JSON.parse(fs.readFileSync(path.join(publicRoot, 'en', 'archive.json'), 'utf8'));
const reportCount = archiveZh.reports.length;
const latestDate = archiveZh.latest.date;
const publicationPath = '/daily';
const fixedLayoutRegressionDates = ['2026-07-15'];

const viewports = [
  { name: 'wide', width: 1920, height: 1080 },
  { name: 'desktop', width: 1440, height: 1000, capture: true, semanticWrap: true, deviceClass: 'desktop' },
  { name: 'laptop', width: 1024, height: 768 },
  { name: 'tablet', width: 768, height: 1024, capture: true, semanticWrap: true, deviceClass: 'tablet' },
  { name: 'small-tablet', width: 620, height: 900 },
  { name: 'phone-large', width: 430, height: 932 },
  { name: 'phone', width: 390, height: 844, capture: true, checkOrphans: true, semanticWrap: true, deviceClass: 'mobile' },
  { name: 'narrow', width: 320, height: 568, capture: true, checkOrphans: true },
];

const locales = [
  {
    key: 'zh',
    home: `${publicationPath}/`,
    title: 'Agent Daily · AI智能体日报',
    latestHref: archiveZh.latest.url,
    currentLang: 'zh-CN',
    archive: archiveZh,
  },
  {
    key: 'en',
    home: `${publicationPath}/en/`,
    title: 'Agent Daily · AI智能体日报',
    latestHref: archiveEn.latest.url,
    currentLang: 'en',
    archive: archiveEn,
  },
];

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
};

function resolveRequest(urlPath) {
  let clean = decodeURIComponent(urlPath.split('?')[0]);
  if (clean === publicationPath || clean === `${publicationPath}/`) clean = '/';
  else if (clean.startsWith(`${publicationPath}/`)) clean = clean.slice(publicationPath.length);
  const relative = clean.replace(/^\/+/, '');
  let candidate = path.resolve(publicRoot, relative);
  if (!candidate.toLowerCase().startsWith(publicRoot.toLowerCase())) return null;
  if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
    candidate = path.join(candidate, 'index.html');
  } else if (!path.extname(candidate)) {
    const htmlCandidate = `${candidate}.html`;
    const indexCandidate = path.join(candidate, 'index.html');
    if (fs.existsSync(htmlCandidate)) candidate = htmlCandidate;
    else if (fs.existsSync(indexCandidate)) candidate = indexCandidate;
  }
  return fs.existsSync(candidate) && fs.statSync(candidate).isFile() ? candidate : null;
}

const server = http.createServer((req, res) => {
  const filePath = resolveRequest(req.url || '/');
  if (!filePath) {
    const notFound = path.join(publicRoot, '404.html');
    res.writeHead(404, { 'content-type': mimeTypes['.html'] });
    res.end(fs.readFileSync(notFound));
    return;
  }
  const mime = mimeTypes[path.extname(filePath)] || 'application/octet-stream';
  res.writeHead(200, { 'content-type': mime });
  res.end(fs.readFileSync(filePath));
});

async function inspectCommon(page, options = {}) {
  return page.evaluate(async ({ checkOrphans, reportPage, checkSemanticWrap, localeKey }) => {
    const width = document.documentElement.clientWidth;
    const bodyWidth = document.body.scrollWidth;
    const rectSnapshot = (rect) => ({
      left: Math.round(rect.left * 10) / 10,
      right: Math.round(rect.right * 10) / 10,
      top: Math.round(rect.top * 10) / 10,
      bottom: Math.round(rect.bottom * 10) / 10,
      width: Math.round(rect.width * 10) / 10,
      height: Math.round(rect.height * 10) / 10,
    });
    const textRects = (root) => {
      if (!root) return [];
      const rects = [];
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const textNode = walker.currentNode;
        if (!textNode.data.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(textNode);
        for (const rect of range.getClientRects()) {
          if (rect.width > 0 && rect.height > 0) rects.push(rectSnapshot(rect));
        }
      }
      return rects;
    };
    const rectsIntersect = (a, b, tolerance = 1) =>
      Math.min(a.right, b.right) - Math.max(a.left, b.left) > tolerance &&
      Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > tolerance;
    const rectEscapesHorizontally = (rect, owner, tolerance = 1) =>
      rect.left < owner.left - tolerance ||
      rect.right > owner.right + tolerance;
    const offenders = [...document.querySelectorAll('body *')]
      .map((node) => {
        const rect = node.getBoundingClientRect();
        return { node, rect };
      })
      .filter(({ node, rect }) => {
        const style = getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden' || rect.width === 0) return false;
        return rect.left < -1 || rect.right > width + 1;
      })
      .slice(0, 8)
      .map(({ node, rect }) => ({
        tag: node.tagName,
        cls: node.className?.toString().slice(0, 80) || '',
        left: Math.round(rect.left),
        right: Math.round(rect.right),
      }));

    const countLines = (node) => {
      if (!node) return 0;
      const range = document.createRange();
      range.selectNodeContents(node);
      const tops = [...range.getClientRects()].filter((rect) => rect.width > 0).map((rect) => Math.round(rect.top));
      return new Set(tops).size;
    };

    const orphanBlocks = [];
    if (checkOrphans) {
      const selectors = reportPage
        ? '.lead,.judgment,.heat-summary p,.priority-note strong,.item p,.signal p,.side p,.note,.risc-primer p,.risc-primer-card span,.risc-evidence'
        : '.intro,.latest p,.archive-head p,.report-copy strong';
      for (const element of document.querySelectorAll(selectors)) {
        const fullText = element.textContent.replace(/\s+/g, ' ').trim();
        if (fullText.length < 8) continue;
        if (localeKey === 'en') {
          const words = [];
          const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
          while (walker.nextNode()) {
            const textNode = walker.currentNode;
            for (const match of textNode.data.matchAll(/\S+/gu)) {
              const range = document.createRange();
              range.setStart(textNode, match.index);
              range.setEnd(textNode, match.index + match[0].length);
              const rect = range.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) words.push({ word: match[0], top: Math.round(rect.top) });
            }
          }
          if (words.length > 4) {
            const lastTop = Math.max(...words.map((word) => word.top));
            const lastLineWords = words.filter((word) => Math.abs(word.top - lastTop) <= 1).map((word) => word.word);
            if (lastLineWords.length === 1) {
              orphanBlocks.push({ cls: element.className?.toString().slice(0, 80) || element.tagName, tail: lastLineWords[0] });
            }
          }
          continue;
        }
        if (!/[\u3400-\u9fff]/u.test(fullText)) continue;
        const glyphs = [];
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const textNode = walker.currentNode;
          for (let index = 0; index < textNode.data.length; index += 1) {
            const char = textNode.data[index];
            if (/\s/u.test(char)) continue;
            const range = document.createRange();
            range.setStart(textNode, index);
            range.setEnd(textNode, index + 1);
            const rect = range.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) glyphs.push({ char, top: Math.round(rect.top) });
          }
        }
        if (!glyphs.length) continue;
        const lastTop = Math.max(...glyphs.map((glyph) => glyph.top));
        const lastLine = glyphs.filter((glyph) => Math.abs(glyph.top - lastTop) <= 1).map((glyph) => glyph.char).join('');
        const chineseCount = [...lastLine].filter((char) => /[\u3400-\u9fff]/u.test(char)).length;
        if (chineseCount === 1 && lastLine.replace(/[\s\p{P}]/gu, '').length <= 1) {
          orphanBlocks.push({ cls: element.className?.toString().slice(0, 80) || element.tagName, tail: lastLine });
        }
      }
    }

    const semanticWrapIssues = [];
    if (checkSemanticWrap) {
      const selectors = reportPage
        ? '.hero h1,.section h2,.item h3,.signal h3,.panel-head strong'
        : '.latest h2,.month-strip h3';
      const englishConnectors = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'from', 'in', 'of', 'on', 'or', 'the', 'to', 'with']);
      for (const [index, element] of [...document.querySelectorAll(selectors)].entries()) {
        if (element.querySelector('br')) {
          semanticWrapIssues.push({ index, kind: 'manual-break', text: element.textContent.trim().slice(0, 120) });
          continue;
        }
        const segments = [];
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const textNode = walker.currentNode;
          const pattern = localeKey === 'en' ? /\S+/gu : /\S/gu;
          for (const match of textNode.data.matchAll(pattern)) {
            const range = document.createRange();
            range.setStart(textNode, match.index);
            range.setEnd(textNode, match.index + match[0].length);
            const rect = range.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) segments.push({ text: match[0], top: Math.round(rect.top) });
          }
        }
        const lines = [];
        for (const segment of segments) {
          let line = lines.find((candidate) => Math.abs(candidate.top - segment.top) <= 1);
          if (!line) {
            line = { top: segment.top, parts: [] };
            lines.push(line);
          }
          line.parts.push(segment.text);
        }
        lines.sort((a, b) => a.top - b.top);
        if (lines.length < 2) continue;
        const lineTexts = lines.map((line) => line.parts.join(localeKey === 'en' ? ' ' : ''));
        if (localeKey === 'en') {
          const lastWords = lineTexts.at(-1).match(/[A-Za-z0-9][A-Za-z0-9'’+.-]*/g) || [];
          const allWords = segments.map((segment) => segment.text).filter((text) => /[A-Za-z0-9]/.test(text));
          if (allWords.length > 4 && lastWords.length === 1) {
            semanticWrapIssues.push({ index, kind: 'english-orphan-word', lines: lineTexts, text: element.textContent.trim().slice(0, 120) });
          }
          lineTexts.slice(0, -1).forEach((lineText, lineIndex) => {
            const lineWords = lineText.toLowerCase().match(/[a-z0-9][a-z0-9'’+.-]*/g) || [];
            if (englishConnectors.has(lineWords.at(-1))) {
              semanticWrapIssues.push({ index, lineIndex, kind: 'english-dangling-connector', lines: lineTexts, text: element.textContent.trim().slice(0, 120) });
            }
          });
        } else {
          const lastLine = lineTexts.at(-1);
          const cjkCount = [...lastLine].filter((char) => /[\u3400-\u9fff]/u.test(char)).length;
          if (cjkCount === 1 && lastLine.replace(/[\s\p{P}]/gu, '').length <= 1) {
            semanticWrapIssues.push({ index, kind: 'chinese-orphan-character', lines: lineTexts, text: element.textContent.trim().slice(0, 120) });
          }
          lineTexts.forEach((lineText, lineIndex) => {
            if (/^[，。！？；：、）》】]/u.test(lineText)) {
              semanticWrapIssues.push({ index, lineIndex, kind: 'chinese-leading-punctuation', lines: lineTexts, text: element.textContent.trim().slice(0, 120) });
            }
            if (/[（《【]$/u.test(lineText)) {
              semanticWrapIssues.push({ index, lineIndex, kind: 'chinese-trailing-opening-punctuation', lines: lineTexts, text: element.textContent.trim().slice(0, 120) });
            }
          });
        }
      }
    }

    const gridColumnCount = (selector) => {
      const node = document.querySelector(selector);
      if (!node) return 0;
      const columns = getComputedStyle(node).gridTemplateColumns.trim();
      return columns && columns !== 'none' ? columns.split(/\s+/).length : 0;
    };
    const layoutSnapshot = reportPage ? {
      statsColumns: gridColumnCount('.stats'),
      radarColumns: gridColumnCount('.radar'),
      riscColumns: gridColumnCount('.risc-primer-grid'),
      utilityColumns: gridColumnCount('.side'),
    } : null;

    const favicon = document.querySelector('link[rel="icon"]');
    const faviconSurface = await new Promise((resolve) => {
      if (!favicon) return resolve(null);
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(image, 0, 0, 32, 32);
        const pixels = context.getImageData(0, 0, 32, 32).data;
        const cornerIndexes = [0, 31, 31 * 32, 32 * 32 - 1];
        const cornersAreWhite = cornerIndexes.every((pixelIndex) => {
          const offset = pixelIndex * 4;
          return pixels[offset] >= 245 && pixels[offset + 1] >= 245 && pixels[offset + 2] >= 245 && pixels[offset + 3] === 255;
        });
        let opaquePixels = 0;
        let darkPixels = 0;
        for (let offset = 0; offset < pixels.length; offset += 4) {
          if (pixels[offset + 3] === 255) opaquePixels += 1;
          if (pixels[offset] < 80 && pixels[offset + 1] < 80 && pixels[offset + 2] < 80) darkPixels += 1;
        }
        resolve({ naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, cornersAreWhite, opaquePixels, darkPixels });
      };
      image.onerror = () => resolve(null);
      image.src = favicon.href;
    });
    const heatRowBleeds = [...document.querySelectorAll('.heat-row')]
      .flatMap((row, index) => {
        const labelCell = row.children[0];
        const contentCell = row.children[1];
        if (!labelCell || !contentCell) return [];
        const labelRect = rectSnapshot(labelCell.getBoundingClientRect());
        const contentRect = rectSnapshot(contentCell.getBoundingClientRect());
        const escapedText = textRects(labelCell).filter(
          (rect) => rectEscapesHorizontally(rect, labelRect) || rectsIntersect(rect, contentRect),
        );
        const scrollOverflow = labelCell.clientWidth > 0 && labelCell.scrollWidth > labelCell.clientWidth + 2;
        return escapedText.length || scrollOverflow
          ? [{
              index,
              label: labelCell.textContent.replace(/\s+/g, ' ').trim(),
              labelRect,
              contentRect,
              escapedText: escapedText.slice(0, 8),
              scrollWidth: labelCell.scrollWidth,
              clientWidth: labelCell.clientWidth,
            }]
          : [];
      })
      .slice(0, 12);
    const panelHeadBleeds = [...document.querySelectorAll('.panel-head')]
      .flatMap((head, index) => {
        const title = head.querySelector('strong');
        const context = head.querySelector('span');
        if (!title || !context) return [];
        const titleOwner = rectSnapshot(title.getBoundingClientRect());
        const contextOwner = rectSnapshot(context.getBoundingClientRect());
        const titleText = textRects(title);
        const contextText = textRects(context);
        // Text glyphs can optically overhang their flex item by a few pixels even when
        // there is still a clean gap. Allow that font overhang, but never allow real
        // title/context intersections or material overflow.
        const escapedTitle = titleText.filter((rect) => rectEscapesHorizontally(rect, titleOwner, 6));
        const escapedContext = contextText.filter((rect) => rectEscapesHorizontally(rect, contextOwner, 6));
        const intersections = titleText.flatMap((titleRect) =>
          contextText
            .filter((contextRect) => rectsIntersect(titleRect, contextRect))
            .map((contextRect) => ({ titleRect, contextRect })),
        );
        const scrollOverflow =
          (title.clientWidth > 0 && title.scrollWidth > title.clientWidth + 6) ||
          (context.clientWidth > 0 && context.scrollWidth > context.clientWidth + 6);
        return escapedTitle.length || escapedContext.length || intersections.length || scrollOverflow
          ? [{
              index,
              title: title.textContent.replace(/\s+/g, ' ').trim().slice(0, 100),
              context: context.textContent.replace(/\s+/g, ' ').trim().slice(0, 100),
              titleOwner,
              contextOwner,
              escapedTitle: escapedTitle.slice(0, 6),
              escapedContext: escapedContext.slice(0, 6),
              intersections: intersections.slice(0, 6),
              scrollOverflow,
            }]
          : [];
      })
      .slice(0, 12);
    const sideLabelGaps = [...document.querySelectorAll('.side')].flatMap((side, sideIndex) => {
      const children = [...side.children];
      const pairs = [];
      for (let index = 0; index + 1 < children.length; index += 2) {
        const label = children[index];
        const copy = children[index + 1];
        if (label?.tagName !== 'STRONG' || copy?.tagName !== 'P') continue;
        const labelRect = label.getBoundingClientRect();
        const copyRect = copy.getBoundingClientRect();
        const horizontal = Math.abs(labelRect.top - copyRect.top) <= 2;
        pairs.push({
          sideIndex,
          rowIndex: index / 2,
          label: label.textContent.replace(/\s+/g, ' ').trim(),
          horizontal,
          gap: horizontal ? Math.round((copyRect.left - labelRect.right) * 10) / 10 : null,
        });
      }
      return pairs;
    });
    const dateRangeNode = document.querySelector('.fact:last-child b');
    const dateRangeOwner = dateRangeNode?.closest('.fact');
    const dateRangeNeighbour = document.querySelector('.latest');
    let dateRangeBleed = null;
    if (dateRangeNode && dateRangeOwner) {
      const ownerRect = rectSnapshot(dateRangeOwner.getBoundingClientRect());
      const neighbourRect = dateRangeNeighbour ? rectSnapshot(dateRangeNeighbour.getBoundingClientRect()) : null;
      const glyphRects = textRects(dateRangeNode);
      const escapedText = glyphRects.filter((rect) => rectEscapesHorizontally(rect, ownerRect, 2));
      const intersections = neighbourRect
        ? glyphRects.filter((rect) => rectsIntersect(rect, neighbourRect))
        : [];
      const scrollOverflow = dateRangeNode.clientWidth > 0 && dateRangeNode.scrollWidth > dateRangeNode.clientWidth + 2;
      if (escapedText.length || intersections.length || scrollOverflow) {
        dateRangeBleed = {
          text: dateRangeNode.textContent.replace(/\s+/g, ' ').trim(),
          ownerRect,
          neighbourRect,
          escapedText: escapedText.slice(0, 8),
          intersections: intersections.slice(0, 8),
          scrollWidth: dateRangeNode.scrollWidth,
          clientWidth: dateRangeNode.clientWidth,
        };
      }
    }
    const brandControl = document.querySelector('.brand-mark') || document.querySelector('.report-sitebrand');
    const languageSwitch = document.querySelector('.language-switch');
    return {
      bodyWidth,
      viewportWidth: width,
      offenders,
      orphanBlocks: orphanBlocks.slice(0, 20),
      semanticWrapIssues: semanticWrapIssues.slice(0, 20),
      layoutSnapshot,
      favicon: favicon?.getAttribute('href') || '',
      faviconSurface,
      htmlLang: document.documentElement.lang,
      monthLines: [...document.querySelectorAll('.month-strip h3')].map(countLines),
      dateLines: countLines(document.querySelector('.fact:last-child b')),
      reportCount: document.querySelectorAll('.report-row').length,
      navHeight: document.querySelector('.nav-latest, .report-sitenav > a')?.getBoundingClientRect().height || 0,
      languageHeight: document.querySelector('.language-switch a')?.getBoundingClientRect().height || 0,
      brandControlHeight: brandControl?.getBoundingClientRect().height || 0,
      languageSwitchHeight: languageSwitch?.getBoundingClientRect().height || 0,
      heatRowBleeds,
      panelHeadBleeds,
      sideLabelGaps,
      dateRangeBleed,
    };
  }, options);
}

async function inspectHomepage(browser, locale, viewport) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${port}${locale.home}`, { waitUntil: 'networkidle' });
  const common = await inspectCommon(page, {
    checkOrphans: viewport.checkOrphans && locale.key === 'zh',
    checkSemanticWrap: latestDate >= '2026-08-26' && viewport.semanticWrap,
    localeKey: locale.key,
    reportPage: false,
  });
  const result = {
    ...common,
    title: await page.title(),
    latestHref: await page.locator('.latest .button').getAttribute('href'),
    logoLoaded: await page.locator('.brand-mark img').evaluate((img) => img.complete && img.naturalWidth > 0),
    logoSrc: await page.locator('.brand-mark img').getAttribute('src'),
    logoAppearance: await page.locator('.brand-mark').evaluate((mark) => {
      const image = mark.querySelector('img');
      const markStyle = getComputedStyle(mark);
      const imageStyle = getComputedStyle(image);
      const imageRect = image.getBoundingClientRect();
      return {
        background: markStyle.backgroundColor,
        border: markStyle.borderTopColor,
        imageWidth: Number(imageRect.width.toFixed(2)),
        filter: imageStyle.filter,
      };
    }),
    factBalance: await page.locator('.fact').evaluateAll((cards) => cards.map((card) => {
      const title = card.querySelector('b');
      const label = card.querySelector('span');
      const cardRect = card.getBoundingClientRect();
      const titleRect = title.getBoundingClientRect();
      const labelRect = label.getBoundingClientRect();
      return {
        top: Number((titleRect.top - cardRect.top).toFixed(2)),
        bottom: Number((cardRect.bottom - labelRect.bottom).toFixed(2)),
      };
    })),
    currentLang: await page.locator('.language-switch a[aria-current="page"]').getAttribute('lang'),
  };
  if (result.title !== locale.title) throw new Error(`${locale.key}/${viewport.name}: title mismatch`);
  if (result.reportCount !== reportCount) throw new Error(`${locale.key}/${viewport.name}: expected ${reportCount} reports, got ${result.reportCount}`);
  if (result.latestHref !== locale.latestHref) throw new Error(`${locale.key}/${viewport.name}: latest href mismatch ${result.latestHref}`);
  if (result.bodyWidth > result.viewportWidth) throw new Error(`${locale.key}/${viewport.name}: horizontal overflow ${result.bodyWidth}/${result.viewportWidth}`);
  if (result.offenders.length) throw new Error(`${locale.key}/${viewport.name}: clipped elements ${JSON.stringify(result.offenders)}`);
  if (result.monthLines.some((lines) => lines !== 1)) throw new Error(`${locale.key}/${viewport.name}: month heading wrapped ${result.monthLines}`);
  if (result.dateLines !== 1) throw new Error(`${locale.key}/${viewport.name}: archive range wrapped to ${result.dateLines} lines`);
  if (result.dateRangeBleed) throw new Error(`${locale.key}/${viewport.name}: archive range escaped its fact cell ${JSON.stringify(result.dateRangeBleed)}`);
  if (!result.logoLoaded || result.logoSrc !== '/daily/assets/alux-mark.png' || result.favicon !== '/daily/assets/alux-favicon.png') {
    throw new Error(`${locale.key}/${viewport.name}: ALUX logo/favicon missing`);
  }
  if (result.logoAppearance.background !== 'rgb(255, 255, 255)' ||
      result.logoAppearance.imageWidth < 26 ||
      result.logoAppearance.filter !== 'none') {
    throw new Error(`${locale.key}/${viewport.name}: framed ALUX page mark drifted ${JSON.stringify(result.logoAppearance)}`);
  }
  if (!result.faviconSurface || !result.faviconSurface.cornersAreWhite ||
      result.faviconSurface.opaquePixels !== 1024 || result.faviconSurface.darkPixels < 24) {
    throw new Error(`${locale.key}/${viewport.name}: favicon is not an opaque white-backed ALUX mark ${JSON.stringify(result.faviconSurface)}`);
  }
  if (result.factBalance.some(({ top, bottom }) => Math.abs((top - 2) - bottom) > 1.5)) {
    throw new Error(`${locale.key}/${viewport.name}: archive facts are not vertically centered ${JSON.stringify(result.factBalance)}`);
  }
  if (result.currentLang !== locale.currentLang) throw new Error(`${locale.key}/${viewport.name}: language state mismatch ${result.currentLang}`);
  if (result.navHeight < 43) throw new Error(`${locale.key}/${viewport.name}: latest nav target too short ${result.navHeight}`);
  if (result.languageHeight < 43) throw new Error(`${locale.key}/${viewport.name}: language target too short ${result.languageHeight}`);
  if (Math.abs(result.brandControlHeight - result.languageSwitchHeight) > 1) {
    throw new Error(`${locale.key}/${viewport.name}: logo/language controls misaligned ${result.brandControlHeight}/${result.languageSwitchHeight}`);
  }
  if (result.orphanBlocks.length) throw new Error(`${locale.key}/${viewport.name}: Chinese orphan lines ${JSON.stringify(result.orphanBlocks)}`);
  if (result.semanticWrapIssues.length) throw new Error(`${locale.key}/${viewport.name}: awkward semantic wrapping ${JSON.stringify(result.semanticWrapIssues)}`);
  if (viewport.capture) await page.screenshot({ path: path.join(artifactRoot, `homepage-${locale.key}-${viewport.name}.png`), fullPage: true });
  await page.close();
  return result;
}

async function inspectArchiveHashCleanup(browser, locale) {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 });
  try {
    await page.goto(`http://127.0.0.1:${port}${locale.home}#archive`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => location.hash === '');
    const direct = {
      hash: await page.evaluate(() => location.hash),
      archiveVisible: await page.locator('#archive').evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return rect.top < innerHeight && rect.bottom > 0;
      }),
    };
    await page.goto(`http://127.0.0.1:${port}${locale.home}`, { waitUntil: 'networkidle' });
    await page.locator('.nav-archive').click();
    await page.waitForFunction(() => {
      const archive = document.getElementById('archive');
      if (!archive || location.hash !== '') return false;
      const rect = archive.getBoundingClientRect();
      return rect.top < innerHeight && rect.bottom > 0;
    });
    const clicked = {
      hash: await page.evaluate(() => location.hash),
      archiveVisible: await page.locator('#archive').evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return rect.top < innerHeight && rect.bottom > 0;
      }),
    };
    if (direct.hash || clicked.hash || !direct.archiveVisible || !clicked.archiveVisible) {
      throw new Error(`${locale.key}: archive hash cleanup failed ${JSON.stringify({ direct, clicked })}`);
    }
    return { direct, clicked };
  } finally {
    await page.close();
  }
}

function sampleReportUrls(locale) {
  const reports = locale.archive.reports;
  const indexes = [0, Math.floor((reports.length - 1) / 2), reports.length - 1];
  const fixedUrls = fixedLayoutRegressionDates
    .map((date) => reports.find((report) => report.date === date)?.url)
    .filter(Boolean);
  return [...new Set([...indexes.map((index) => reports[index].url), ...fixedUrls])];
}

async function auditAllEnglishLayouts(browser) {
  const auditViewports = [
    ...viewports,
    { name: 'heat-breakpoint-above', width: 621, height: 900 },
    { name: 'panel-breakpoint-below', width: 920, height: 900 },
    { name: 'panel-breakpoint-above', width: 921, height: 900 },
  ];
  const results = {};
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  try {
    for (const viewport of auditViewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      let heatRowsChecked = 0;
      for (const report of archiveEn.reports) {
        await page.goto(`http://127.0.0.1:${port}${report.url}`, { waitUntil: 'networkidle' });
        const common = await inspectCommon(page, { checkOrphans: false, checkSemanticWrap: false, localeKey: 'en', reportPage: true });
        const heatRowCount = await page.locator('.heat-row').count();
        if (heatRowCount !== 4) throw new Error(`en/${viewport.name}${report.url}: expected 4 heat rows, got ${heatRowCount}`);
        if (common.bodyWidth > common.viewportWidth) {
          throw new Error(`en/${viewport.name}${report.url}: horizontal overflow ${common.bodyWidth}/${common.viewportWidth}`);
        }
        if (common.offenders.length) {
          throw new Error(`en/${viewport.name}${report.url}: clipped elements ${JSON.stringify(common.offenders)}`);
        }
        if (common.heatRowBleeds.length) {
          throw new Error(`en/${viewport.name}${report.url}: heat-row label overlap ${JSON.stringify(common.heatRowBleeds)}`);
        }
        if (common.panelHeadBleeds.length) {
          throw new Error(`en/${viewport.name}${report.url}: panel-head overlap ${JSON.stringify(common.panelHeadBleeds)}`);
        }
        if (Math.abs(common.brandControlHeight - common.languageSwitchHeight) > 1) {
          throw new Error(`en/${viewport.name}${report.url}: logo/language controls misaligned ${common.brandControlHeight}/${common.languageSwitchHeight}`);
        }
        heatRowsChecked += heatRowCount;
      }
      results[viewport.name] = {
        width: viewport.width,
        reportsChecked: archiveEn.reports.length,
        heatRowsChecked,
        failures: 0,
      };
    }
  } finally {
    await page.close();
  }
  return results;
}

async function inspectReport(browser, locale, viewport, url, capture) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${port}${url}`, { waitUntil: 'networkidle' });
  const isLatest = url === locale.latestHref;
  const enforceThreeDeviceReadability = latestDate >= '2026-08-26' && isLatest && Boolean(viewport.deviceClass);
  const common = await inspectCommon(page, {
    checkOrphans: enforceThreeDeviceReadability,
    checkSemanticWrap: enforceThreeDeviceReadability && viewport.semanticWrap,
    localeKey: locale.key,
    reportPage: true,
  });
  const result = {
    ...common,
    title: await page.title(),
    sitebar: await page.locator('.report-sitebar').count(),
    logoLoaded: await page.locator('.report-sitebrand-mark img').evaluate((img) => img.complete && img.naturalWidth > 0),
    logoAppearance: await page.locator('.report-sitebrand-mark').evaluate((mark) => {
      const image = mark.querySelector('img');
      const markStyle = getComputedStyle(mark);
      const imageStyle = getComputedStyle(image);
      const imageRect = image.getBoundingClientRect();
      return {
        background: markStyle.backgroundColor,
        border: markStyle.borderTopColor,
        imageWidth: Number(imageRect.width.toFixed(2)),
        filter: imageStyle.filter,
      };
    }),
    footer: await page.locator('.report-sitefooter').count(),
    alternate: await page.locator(`.language-switch a:not([aria-current="page"])`).getAttribute('href'),
    canonical: await page.locator('link[rel="canonical"]').getAttribute('href'),
    externalLinks: await page.locator('a[href^="http"]').count(),
  };
  if (result.bodyWidth > result.viewportWidth) throw new Error(`${locale.key}/${viewport.name}${url}: horizontal overflow ${result.bodyWidth}/${result.viewportWidth}`);
  if (result.offenders.length) throw new Error(`${locale.key}/${viewport.name}${url}: clipped elements ${JSON.stringify(result.offenders)}`);
  if (result.sitebar !== 1 || result.footer !== 1) throw new Error(`${locale.key}/${viewport.name}${url}: site navigation missing`);
  if (!result.logoLoaded) throw new Error(`${locale.key}/${viewport.name}${url}: ALUX logo missing`);
  if (result.logoAppearance.background !== 'rgb(255, 255, 255)' ||
      result.logoAppearance.imageWidth < 26 ||
      result.logoAppearance.filter !== 'none') {
    throw new Error(`${locale.key}/${viewport.name}${url}: framed ALUX page mark drifted ${JSON.stringify(result.logoAppearance)}`);
  }
  if (!result.alternate) throw new Error(`${locale.key}/${viewport.name}${url}: language alternate missing`);
  if (!result.canonical?.startsWith('https://ai.alux.network/daily/')) throw new Error(`${locale.key}/${viewport.name}${url}: canonical mismatch`);
  if (result.externalLinks === 0) throw new Error(`${locale.key}/${viewport.name}${url}: external sources missing`);
  if (result.favicon !== '/daily/assets/alux-favicon.png') throw new Error(`${locale.key}/${viewport.name}${url}: favicon missing`);
  if (!result.faviconSurface || !result.faviconSurface.cornersAreWhite ||
      result.faviconSurface.opaquePixels !== 1024 || result.faviconSurface.darkPixels < 24) {
    throw new Error(`${locale.key}/${viewport.name}${url}: favicon is not an opaque white-backed ALUX mark ${JSON.stringify(result.faviconSurface)}`);
  }
  if (result.heatRowBleeds.length) throw new Error(`${locale.key}/${viewport.name}${url}: heat-row label overlap ${JSON.stringify(result.heatRowBleeds)}`);
  if (result.panelHeadBleeds.length) throw new Error(`${locale.key}/${viewport.name}${url}: panel-head overlap ${JSON.stringify(result.panelHeadBleeds)}`);
  if (result.viewportWidth > 620 && result.navHeight < 43) {
    throw new Error(`${locale.key}/${viewport.name}${url}: latest nav target too short ${result.navHeight}`);
  }
  if (result.languageHeight < 43) throw new Error(`${locale.key}/${viewport.name}${url}: language target too short ${result.languageHeight}`);
  if (Math.abs(result.brandControlHeight - result.languageSwitchHeight) > 1) {
    throw new Error(`${locale.key}/${viewport.name}${url}: logo/language controls misaligned ${result.brandControlHeight}/${result.languageSwitchHeight}`);
  }
  if (result.orphanBlocks.length) throw new Error(`${locale.key}/${viewport.name}${url}: orphan lines ${JSON.stringify(result.orphanBlocks)}`);
  if (result.semanticWrapIssues.length) throw new Error(`${locale.key}/${viewport.name}${url}: awkward semantic wrapping ${JSON.stringify(result.semanticWrapIssues)}`);
  if (enforceThreeDeviceReadability) {
    const expectedColumns = {
      desktop: { statsColumns: 4, radarColumns: 3, riscColumns: 4, utilityColumns: 2 },
      tablet: { statsColumns: 2, radarColumns: 1, riscColumns: 2, utilityColumns: 2 },
      mobile: { statsColumns: 2, radarColumns: 1, riscColumns: 1, utilityColumns: 1 },
    }[viewport.deviceClass];
    for (const [key, expected] of Object.entries(expectedColumns)) {
      if (result.layoutSnapshot?.[key] !== expected) {
        throw new Error(`${locale.key}/${viewport.name}${url}: ${key} must be ${expected}, got ${result.layoutSnapshot?.[key]}`);
      }
    }
    if (viewport.deviceClass !== 'mobile') {
      const badUtilityGaps = result.sideLabelGaps.filter((entry) => !entry.horizontal || entry.gap < 6 || entry.gap > 14);
      if (badUtilityGaps.length) {
        throw new Error(`${locale.key}/${viewport.name}${url}: utility label/copy gap must stay between 6px and 14px ${JSON.stringify(badUtilityGaps)}`);
      }
    }
  }
  if (capture) {
    const date = url.split('/').filter(Boolean).slice(-3).join('-');
    await page.screenshot({ path: path.join(artifactRoot, `report-${locale.key}-${date}-${viewport.name}.png`), fullPage: true });
  }
  await page.close();
  return result;
}

(async () => {
  fs.mkdirSync(artifactRoot, { recursive: true });
  if (!chromeExecutable) throw new Error('Google Chrome executable was not found');
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  const address = server.address();
  if (address && typeof address === 'object') port = address.port;
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: chromeExecutable });
    const results = { latestDate, reportCount, homepages: {}, archiveHashCleanup: {}, reports: {}, allEnglishLayouts: {} };
    for (const locale of locales) {
      results.homepages[locale.key] = {};
      results.reports[locale.key] = {};
      for (const viewport of viewports) {
        results.homepages[locale.key][viewport.name] = await inspectHomepage(browser, locale, viewport);
      }
      results.archiveHashCleanup[locale.key] = await inspectArchiveHashCleanup(browser, locale);
      const sampleUrls = sampleReportUrls(locale);
      for (const viewport of viewports) {
        results.reports[locale.key][viewport.name] = [];
        for (const [index, url] of sampleUrls.entries()) {
          const capture = viewport.capture && index === 0;
          results.reports[locale.key][viewport.name].push(await inspectReport(browser, locale, viewport, url, capture));
        }
      }
    }
    results.allEnglishLayouts = await auditAllEnglishLayouts(browser);
    process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
  } finally {
    if (browser) await browser.close();
    if (server.listening) await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
