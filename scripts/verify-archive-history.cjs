#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const {execFileSync} = require('child_process');
function validateHistory(before, after, archiveZh, archiveEn) {
  const errors = [];
  for (const [file, body] of Object.entries(before)) {
    if (!(file in after)) errors.push(`Published issue removed: ${file}`);
    else if (!Buffer.from(body).equals(Buffer.from(after[file]))) errors.push(`Published issue overwritten: ${file}`);
  }
  const dates = Object.keys(after).filter(f => /^content\/zh\/\d{8}_/.test(f)).map(f => f.match(/(\d{4})(\d{2})(\d{2})_/).slice(1).join('-'));
  for (const [locale, archive] of [['zh',archiveZh],['en',archiveEn]]) {
    const reports = archive?.reports || [];
    const byDate = new Map(reports.map(r => [r.date,r]));
    if (byDate.size !== dates.length || reports.length !== dates.length) errors.push(`${locale}: archive must retain every dated issue exactly once`);
    for (const date of dates) {
      const compact = date.replaceAll('-','');
      if (!after[`content/en/${compact}.body.html`]) errors.push(`${date}: English source missing`);
      const expected = `/daily/${locale === 'en' ? 'en/' : ''}${date.replaceAll('-','/')}/`;
      if (byDate.get(date)?.url !== expected) errors.push(`${locale}/${date}: must use permanent dated URL ${expected}`);
    }
  }
  return errors;
}
if (require.main === module) {
  const root = path.resolve(__dirname,'..');
  const base = process.argv[process.argv.indexOf('--base-ref')+1];
  if (!process.argv.includes('--base-ref') || !base || base.startsWith('-')) throw new Error('--base-ref is required');
  const git = args => execFileSync('git',args,{cwd:root,maxBuffer:32*1024*1024});
  const ref = git(['rev-parse','--verify',`${base}^{commit}`]).toString().trim();
  const names = git(['ls-tree','-rz','--name-only',ref,'--','content/zh','content/en']).toString().split('\0').filter(f => /^content\/(?:zh\/\d{8}_.*\.html|en\/\d{8}\.body\.html)$/.test(f));
  const before = Object.fromEntries(names.map(f => [f,git(['show',`${ref}:${f}`])]));
  const after = {};
  for (const locale of ['zh','en']) for (const name of fs.readdirSync(path.join(root,'content',locale))) {
    if ((locale==='zh' ? /^\d{8}_.*\.html$/ : /^\d{8}\.body\.html$/).test(name)) {
      const file=`content/${locale}/${name}`; after[file]=fs.readFileSync(path.join(root,file));
    }
  }
  const read = file => JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
  const errors=validateHistory(before,after,read('public/archive.json'),read('public/en/archive.json'));
  if(errors.length) throw new Error(errors.join('\n')+'\nRoutine publication is append-only. Corrections require a separately reviewed change; do not bypass this check in the daily job.');
  console.log(JSON.stringify({ok:true,preservedSources:names.length,base:ref}));
}
module.exports={validateHistory};
