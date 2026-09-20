const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { shanghaiDateIso } = require('./lib/locales.cjs');

test('a live feed cannot replace reviewed bilingual files in the watchdog', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'daily-watchdog-'));
  try {
    for (const dir of ['content/zh', 'content/en', 'public/live']) fs.mkdirSync(path.join(root, dir), { recursive: true });
    const date = shanghaiDateIso();
    fs.writeFileSync(path.join(root, 'public/live/latest.json'), JSON.stringify({ dateIso: date }));
    const manifestPath = path.join(root, 'content/en/translation-manifest.json');
    const save = reports => fs.writeFileSync(manifestPath, JSON.stringify({ reports }));
    const status = () => spawnSync(process.execPath, [path.join(__dirname, 'check-today.cjs'), '--site-root', root]).status;
    save([]);
    assert.equal(status(), 1);
    for (const lang of ['zh', 'en']) fs.writeFileSync(path.join(root, `content/${lang}/issue.html`), lang);
    const hash = text => createHash('sha256').update(text).digest('hex');
    const report = { date, status: 'reviewed', sourceFile: 'issue.html', translationFile: 'issue.html', sourceSha256: hash('zh'), translationSha256: hash('en') };
    save([report]);
    assert.equal(status(), 0);
    save([{ ...report, status: 'draft' }]);
    assert.equal(status(), 1);
    save([report]);
    fs.writeFileSync(path.join(root, 'content/en/issue.html'), 'changed after review');
    assert.equal(status(), 1);
    fs.unlinkSync(path.join(root, 'content/en/issue.html'));
    assert.equal(status(), 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
