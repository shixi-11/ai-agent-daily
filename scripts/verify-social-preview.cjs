const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { rewriteDailyText } = require('./daily-public-presentation.cjs');
const root = path.resolve(__dirname, '..');
const images = Object.fromEntries(['zh', 'en'].map(localeId => {
  const name = `agent-daily-social-${localeId}-v3.png`;
  const bytes = fs.readFileSync(path.join(root, 'assets', name));
  assert.ok(bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])), 'Invalid PNG');
  assert.ok(bytes.equals(fs.readFileSync(path.join(root, 'public/assets', name))), 'Published image differs');
  return [localeId, { name, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }];
}));
let count = 0;
function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'live') continue;
      scan(file);
    } else if (entry.name === 'index.html') {
      const html = rewriteDailyText(fs.readFileSync(file, 'utf8'));
      const head = html.split(/<\/head>/i)[0];
      const values = new Map();
      for (const tag of head.match(/<meta\b[^>]*>/gi) || []) {
        const attrs = Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map(m => [m[1], m[2]]));
        const key = attrs.property || attrs.name;
        if (key?.startsWith('og:') || key?.startsWith('twitter:')) {
          assert.ok(!values.has(key), `${file}: duplicate ${key}`);
          values.set(key, attrs.content);
        }
      }
      const localeId = file.includes(`${path.sep}en${path.sep}`) ? 'en' : 'zh';
      const { name: imageName, width, height } = images[localeId];
      const expected = `https://shixilin.com/ai/agent-daily/assets/${imageName}`;
      assert.equal(values.get('og:image'), expected, file);
      assert.equal(values.get('twitter:image'), expected, file);
      assert.equal(values.get('og:image:width'), String(width), file);
      assert.equal(values.get('og:image:height'), String(height), file);
      assert.equal(values.get('og:image:type'), 'image/png', file);
      assert.equal(values.get('twitter:card'), 'summary_large_image', file);
      for (const key of ['og:title', 'og:type', 'og:url', 'og:description', 'og:image:alt']) {
        assert.ok(values.get(key), `${file}: missing ${key}`);
      }
      assert.ok(values.get('og:title').startsWith(file.includes(`${path.sep}en${path.sep}`) ? 'AI News Daily' : 'AI资讯日报'), file);
      count++;
    }
  }
}
scan(path.join(root, 'public'));
console.log(`Social preview verified: ${count} pages; localized native-size PNGs; personal-domain image URLs`);
