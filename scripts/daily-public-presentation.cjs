// Keep in sync with shixilin lib/agent-daily.js. Only presentation changes; historical sources stay intact.
const PUBLIC_PATH = '/ai/agent-daily';
const PUBLIC_URL = `https://shixilin.com${PUBLIC_PATH}`;

function rewriteDailyText(text) {
  return text
    .replaceAll('https://ai.alux.network/daily', PUBLIC_URL)
    .replaceAll('https://ai-agent-daily.alux.network', PUBLIC_URL)
    .replace(/(["'(\s=])\/daily(?=\/|["'#?\s)])/g, `$1${PUBLIC_PATH}`)
    .replace(/(https:\/\/shixilin\.com)?\/ai\/agent-daily\/(?=["'<>\s)])/g, (_, origin) => `${origin || ''}${PUBLIC_PATH}`);
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
