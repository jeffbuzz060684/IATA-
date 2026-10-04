const fs = require('fs');
const db = JSON.parse(fs.readFileSync('onu-db.json','utf8'));
const out = [];
for(const e of db){
  let psn = (e.fr && e.fr.length > 1) ? e.fr : e.en;
  psn = psn.replace(/\s+/g,' ').trim();
  if(!psn) continue;
  psn = psn.replace(/^./, c=>c.toUpperCase());
  if(psn.length > 160) psn = psn.slice(0,157)+'…';
  let cl = (e.cl||'').trim();
  const pg = (e.pg||'').replace(/^\/+|\/+$/g,'');
  let sub = '';
  if(e.lab){
    const primary = cl.split('/')[0].trim();
    const toks = e.lab.split(/[;]/)[0].split(',').map(s=>s.trim()).filter(Boolean);
    sub = toks.filter(t=>t !== primary && t !== 'None').join(',');
  }
  out.push([e.un, psn, cl, pg, sub]);
}
out.sort((a,b)=>a.un<b.un?-1:1);
// Correctifs aériens (v7, vérifiés le 04/10/2026 contre sources publiques) :
// - 1950 aérosols : 2.1 si inflammable ; le sub « 8 » du CFR ne s'applique qu'aux variantes corrosives → retiré (évite de faux conflits de ségrégation).
// - 1005 / 3318 ammoniac : 2.3 (le « 2.2 » du CFR correspond à des variantes gazeuses) ; sub 8 conservé (corrosif, correct).
const FIX = { '1950': ['2.1',''], '1005': ['2.3','8'], '3318': ['2.3','8'] };
for(const e of out){ if(FIX[e[0]]){ e[2] = FIX[e[0]][0]; e[4] = FIX[e[0]][1]; } }
const js = '// Base ONU — Marchandises dangereuses (générée le 2026-10-03, correctifs aériens v7 2026-10-04)\n'
+ '// Source : table publique 49 CFR 172.101 (US DOT) + listes ONU publiques (désignations FR : liste publique ONU/ADR).\n'
+ '// Format : [n°ONU, désignation (FR si dispo), classe/division, PG, risques subsidiaires]\n'
+ '// ⚠️ Aide-mémoire : la désignation officielle de transport (PSN), la PI aérienne et les limites exactes doivent toujours être confirmées dans le DGR IATA en vigueur.\n'
+ 'var DB_ONU = ' + JSON.stringify(out) + ';\n';
fs.writeFileSync('db-onu.js', js);
console.log('entries:', out.length, 'size:', js.length);
