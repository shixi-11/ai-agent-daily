// Public social-image variants from shixilin presentation contract.
const images = {
  "/assets/ai/daily-zh.png": {
    "variants": [
      {
        "src": "/assets/responsive/assets-ai-daily-zh-1600-e482828609ab.webp",
        "width": 1600,
        "height": 900
      }
    ]
  },
  "/assets/ai/daily-en.png": {
    "variants": [
      {
        "src": "/assets/responsive/assets-ai-daily-en-1600-158616270b2f.jpg",
        "width": 1600,
        "height": 900
      }
    ]
  }
};
// Keep in sync with shixilin lib/agent-daily.js. Only presentation changes; historical sources stay intact.
const PUBLIC_PATH = '/ai/agent-daily';
const PUBLIC_URL = `https://shixilin.com${PUBLIC_PATH}`;

function rewriteDailyText(text) {
  return text
    .replaceAll('https://ai.alux.network/daily', PUBLIC_URL)
    .replaceAll('https://ai-agent-daily.alux.network', PUBLIC_URL)
    .replace(/(["'(\s=])\/daily(?=\/|["'#?\s)])/g, `$1${PUBLIC_PATH}`)
    .replace(/(https:\/\/shixilin\.com)?\/ai\/agent-daily\/(?=["'<>\s)])/g, (_, origin) => `${origin || ''}${PUBLIC_PATH}`)
    .replace(/<head\b[^>]*>[\s\S]*?<\/head>/i, head => {
      const language = text.match(/<html\b[^>]*\blang\s*=\s*["']([^"']+)["']/i)?.[1] || 'zh';
      const chinese = /^zh(?:-|$)/i.test(language);
      const image = images[`/assets/ai/daily-${chinese ? 'zh' : 'en'}.png`].variants.at(-1);
      const imageUrl = new URL(image.src, PUBLIC_URL).href;
      const imageType = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[image.src.split('.').at(-1)];
      const alt = chinese ? 'AI资讯日报 · 光之十一' : 'AI News Daily · Shixi Lin';
      const siteName = chinese ? 'AI资讯日报' : 'AI News Daily';
      const application = ['application-name', 'apple-mobile-web-app-title'].map(name =>
        new RegExp(`<meta\\b[^>]*\\bname\\s*=\\s*["']${name}["']`, 'i').test(head) ? '' : `<meta name="${name}" content="${siteName}">`
      ).join('');
      const metadata = `<meta property="og:image" content="${imageUrl}">
<meta property="og:image:type" content="${imageType}">
<meta property="og:image:width" content="${image.width}">
<meta property="og:image:height" content="${image.height}">
<meta property="og:image:alt" content="${alt}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${imageUrl}">
<meta name="twitter:image:alt" content="${alt}">`;
      return head
        .replace(/<meta\b[^>]*>\s*/gi, tag => /\b(?:property|name)\s*=\s*["'](?:og:image(?::(?:secure_url|type|width|height|alt))?|twitter:(?:card|image(?::(?:src|alt))?))["']/i.test(tag) ? '' : tag)
        .replace(/<\/head>/i, `${application}${metadata}</head>`);
    });
}

function fallbackDailyPath(value) {
  if (typeof value !== 'string') return null;
  const path = value.replace(/^\/+|\/+$/g, '');
  const match = path.match(/^(zh-Hant|ja|ko|es|fr|de|ar)\/(latest|20\d{2}\/\d{2}\/\d{2})$/);
  if (!match) return null;
  const rest = `${match[2]}/`;
  return match[1] === 'zh-Hant' ? rest : `en/${rest}`;
}

module.exports = { rewriteDailyText, fallbackDailyPath };
