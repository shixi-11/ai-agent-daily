// Keep in sync with shixilin lib/agent-daily.js. Only presentation changes; historical sources stay intact.
const PUBLIC_PATH = '/ai/agent-daily';
const PUBLIC_URL = `https://shixilin.com${PUBLIC_PATH}`;

function rewriteDailyText(text) {
  return text
    .replace(/<title>([\s\S]*?)<\/title>/gi, (_, title) => {
      const clean = title.replace(/ALUX\s*/gi, '').trim();
      return `<title>${/^(?:AI智能体情报日报|AI Agent Intelligence Daily)$/.test(clean) ? 'Agent Daily · AI智能体日报' : clean}</title>`;
    })
    .replace(/(<meta\s+[^>]*(?:property|name)=["'](?:og:title|og:site_name|twitter:title|application-name|apple-mobile-web-app-title)["'][^>]*content=["'])ALUX\s*/gi, '$1')
    .replace(/(?<!content="Agent Daily">)<\/head>/i, '<meta name="application-name" content="Agent Daily"><meta name="apple-mobile-web-app-title" content="Agent Daily"></head>')
    .replaceAll('https://ai.alux.network/daily', PUBLIC_URL)
    .replaceAll('https://ai-agent-daily.alux.network', PUBLIC_URL)
    .replace(/(["'(\s=])\/daily(?=\/|["'#?\s)])/g, `$1${PUBLIC_PATH}`)
    .replace(/(https:\/\/shixilin\.com)?\/ai\/agent-daily\/(?=["'<>\s)])/g, (_, origin) => `${origin || ''}${PUBLIC_PATH}`);
}


module.exports = { rewriteDailyText };
