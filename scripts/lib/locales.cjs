const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'locales/catalog.json'), 'utf8'));
const ui = JSON.parse(fs.readFileSync(path.join(root, 'locales/ui.json'), 'utf8'));

const locales = catalog.locales.map((locale) => ({ ...locale, ui: ui[locale.id] }));
const localesById = Object.fromEntries(locales.map((locale) => [locale.id, locale]));
const requiredLocales = locales.filter((locale) => catalog.requiredLocales.includes(locale.id));
const optionalLocales = locales.filter((locale) => locale.kind === 'optional-translation');

function localeHref(locale, basePath, suffix = '/') {
  const prefix = locale.pathPrefix ? `/${locale.pathPrefix}` : '';
  const rest = suffix ? (suffix.startsWith('/') ? suffix : `/${suffix}`) : '/';
  return `${basePath}${prefix}${rest}`.replace(/\/{2,}/g, '/');
}

function localeUrl(locale, basePath, suffix = '/') {
  const href = localeHref(locale, basePath, suffix);
  return /\/$|\.[a-z0-9]+$/i.test(href) ? href : `${href}/`;
}

function localePublicFile(locale, relative = 'index.html') {
  return locale.pathPrefix ? path.posix.join(locale.pathPrefix, relative) : relative;
}

function datedRelative(dateIso) {
  const [year, month, day] = dateIso.split('-');
  return `${year}/${month}/${day}/`;
}

function utcDate(dateIso) {
  return new Date(`${dateIso}T00:00:00Z`);
}

function formatDate(date, locale, style = 'long') {
  if (locale.id === 'zh' || locale.id === 'zh-Hant' || locale.id === 'ja') {
    if (style === 'month') return `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月`;
    if (style === 'monthShort') return `${date.getUTCMonth() + 1}月`;
    return `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月${date.getUTCDate()}日`;
  }
  const bcp47 = locale.bcp47;
  if (style === 'month') {
    return new Intl.DateTimeFormat(bcp47, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
  }
  if (style === 'monthShort') {
    return new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(date).toUpperCase();
  }
  return new Intl.DateTimeFormat(bcp47, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function formatArchiveRange(start, end, locale) {
  if (locale.id === 'zh' || locale.id === 'zh-Hant' || locale.id === 'ja') {
    const startText = `${start.getUTCFullYear()}年${start.getUTCMonth() + 1}月${start.getUTCDate()}日`;
    const endText = start.getUTCFullYear() === end.getUTCFullYear()
      ? `${end.getUTCMonth() + 1}月${end.getUTCDate()}日`
      : `${end.getUTCFullYear()}年${end.getUTCMonth() + 1}月${end.getUTCDate()}日`;
    return `${startText}—${endText}`;
  }
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const startFmt = new Intl.DateTimeFormat(locale.id === 'en' ? 'en-US' : locale.bcp47, {
    month: 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
    timeZone: 'UTC',
  }).format(start);
  const endFmt = new Intl.DateTimeFormat(locale.id === 'en' ? 'en-US' : locale.bcp47, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(end);
  return `${startFmt}–${endFmt}`;
}

function shanghaiParts(utcDate = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(utcDate);
  const pick = (type) => parts.find((part) => part.type === type).value;
  return {
    year: pick('year'),
    month: pick('month'),
    day: pick('day'),
    hour: Number(pick('hour')),
    minute: Number(pick('minute')),
  };
}

function shanghaiStamp(utcDate) {
  const parts = shanghaiParts(utcDate);
  return `${parts.year}-${parts.month}-${parts.day} ${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}

function shanghaiDateIso(utcDate = new Date()) {
  const parts = shanghaiParts(utcDate);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function issueCountLabel(locale, count) {
  if (locale.id === 'en' && count === 1) return '1 Issue';
  return locale.ui.issueCount.replace('{n}', String(count));
}

function fallbackLocale(locale) {
  return locale.id === 'zh-Hant' ? localesById.zh : localesById.en;
}

module.exports = {
  catalog,
  locales,
  localesById,
  requiredLocales,
  optionalLocales,
  localeHref,
  localeUrl,
  localePublicFile,
  datedRelative,
  utcDate,
  formatDate,
  formatArchiveRange,
  shanghaiParts,
  shanghaiStamp,
  shanghaiDateIso,
  issueCountLabel,
  fallbackLocale,
};
