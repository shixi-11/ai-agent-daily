'use strict';
const fs = require('node:fs');
const path = require('node:path');
const DAY = 86400000;
function plain(s) { return s.replace(/<[^>]*>/g, '').replace(/&#(x[0-9a-f]+|\d+);/gi, (_,n) => String.fromCodePoint(n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n))).replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/&quot;/g,'"').replace(/&#39;/g,"'").normalize('NFKC'); }
function titleKey(s) { return plain(s).toLowerCase().replace(/[\p{P}\p{Z}\p{Cf}\s]/gu, ''); }
function urlKey(s) {
  const u = new URL(plain(s));
  u.hash = ''; u.hostname = u.hostname.toLowerCase().replace(/^www\./, ''); u.protocol = 'https:';
  for (const k of [...u.searchParams.keys()]) if (/^(utm_.+|fbclid|gclid|ref|ref_src|mc_cid|mc_eid)$/i.test(k)) u.searchParams.delete(k);
  u.searchParams.sort(); u.pathname = u.pathname.replace(/\/+$/, '') || '/';
  if (u.hostname === 'github.com') u.pathname = u.pathname.toLowerCase().replace(/\.git$/, '');
  return u.toString();
}
function extract(html) {
  const articles = [...html.matchAll(/<article\b[^>]*class=["'][^"']*\bsignal\b[^"']*["'][^>]*>([\s\S]*?)<\/article>/gi)];
  const titles = articles.map(m => plain((m[1].match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i)||[])[1] || ''));
  const list = (html.match(/<ol\b[^>]*class=["'][^"']*\bsources\b[^"']*["'][^>]*>([\s\S]*?)<\/ol>/i)||[])[1] || '';
  const urls = [...list.matchAll(/href=["'](https?:\/\/[^"']+)["']/gi)].map(m=>plain(m[1]));
  return { titles, urls };
}
function compare(current, history) {
  const collisions = [];
  for (const prior of history) {
    const ts=new Set(prior.titles.map(titleKey)), us=new Set(prior.urls.map(urlKey));
    current.titles.forEach((title,index)=>{ if(ts.has(titleKey(title))) collisions.push({date:prior.date,kind:'title',index:index+1,value:title}); });
    current.urls.forEach(source=>{ if(us.has(urlKey(source))) collisions.push({date:prior.date,kind:'source',value:source}); });
  }
  return collisions;
}
function verify(root, date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Expected YYYY-MM-DD');
  if (date < '2026-09-10') return {ok:true,date,skipped:'Historical policy'};
  const dir=path.join(root,'content/zh'), compact=date.replaceAll('-','');
  const names=fs.readdirSync(dir).filter(n=>/^\d{8}_.*\.html$/.test(n));
  const target=names.find(n=>n.startsWith(compact+'_')); if(!target) throw new Error('Missing report '+date);
  const current=extract(fs.readFileSync(path.join(dir,target),'utf8'));
  if(!current.titles.length || current.titles.some(t=>!t) || !current.urls.length) throw new Error('Missing signal headlines or source list; freshness cannot be verified');
  const history=names.filter(n=>n.slice(0,8)<compact).map(n=>({file:n,date:n.slice(0,4)+'-'+n.slice(4,6)+'-'+n.slice(6,8)})).filter(p=>Date.parse(date)-Date.parse(p.date)<=30*DAY).map(p=>({...p,...extract(fs.readFileSync(path.join(dir,p.file),'utf8'))}));
  if(!history.length) throw new Error('No prior reports available; freshness cannot be verified');
  const duplicates=compare(current,history);
  const repeatedTitles=current.titles.filter((t,i,a)=>a.findIndex(v=>titleKey(v)===titleKey(t))!==i);
  return {ok:!duplicates.length&&!repeatedTitles.length,date,signalCount:current.titles.length,lookbackDays:30,comparedReports:history.length,duplicates,repeatedTitles};
}
module.exports={plain,titleKey,urlKey,extract,compare,verify};
if(require.main===module){try{const root=path.resolve(__dirname,'..');const date=process.argv[2]||JSON.parse(fs.readFileSync(path.join(root,'public/archive.json'),'utf8')).latest.date;const result=verify(root,date);console.log(JSON.stringify(result,null,2));process.exitCode=result.ok?0:1;}catch(e){console.error(e.message);process.exitCode=1;}}
