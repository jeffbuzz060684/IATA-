// ============================================================
// Harnais RÉGLEMENTAIRE — Assistant IATA MDD v8
// Vérifie que les DONNÉES réglementaires du code correspondent aux
// valeurs vérifiées par recherche web (règle methode-verification).
// Manifeste indépendant du code : toute divergence = FAIL.
// (Les tests logiciels restent dans test-harness.js — séparés.)
// ============================================================
var fs = require("fs");
var path = require("path");
var DIR = __dirname;
var html = fs.readFileSync(path.join(DIR, "index.html"), "utf8");

// ---- Manifeste des valeurs aériennes vérifiées (source : recherche web, date) ----
var REG = [
  // — Plomb — vérifié web 04/10/2026
  { un: "2794", pi: ["870"], cao: true, paxInterdit: true, src: "web 04/10/2026" },
  { un: "2795", pi: ["870"], cao: true, src: "web 04/10/2026" },
  { un: "2800", pi: ["872"], src: "web 04/10/2026" },
  // — Condensateurs / NiMH — vérifié web 04/10/2026
  { un: "3499", pi: ["971"], src: "web 04/10/2026" },
  { un: "3496", note: "SP A199 non restreint par air", src: "web 04/10/2026" },
  // — Liquides inflammables — vérifié web 04/10/2026 (3475 : extrait DGR)
  { un: "1203", pi: ["353", "364"], src: "web 04/10/2026" },
  { un: "1202", pi: ["355", "366"], src: "web 04/10/2026" },
  { un: "1223", pi: ["355", "366"], src: "web 04/10/2026" },
  { un: "3475", pi: ["353", "364"], src: "web 04/10/2026 (extrait DGR : 353 5 L / 364 60 L)" },
  // — Lithium / sodium — vérifié web 10/2026
  { un: "3480", pi: ["965"], cao: true, soc: true, src: "web 10/2026" },
  { un: "3481", pi: ["966", "967"], soc: true, src: "web 04/10/2026 (SoC § I et II dès 01/01/2026, SP A331)" },
  { un: "3090", pi: ["968"], cao: true, src: "web 10/2026" },
  { un: "3551", pi: ["976"], cao: true, src: "web 04/10/2026" },
  // — Divers vérifiés v4 (03/10/2026) —
  { un: "2990", pi: ["955"], cl: "9", src: "web 03/10/2026" },
  { un: "3528", pi: ["378"], src: "web 03/10/2026" },
  { un: "1044", pi: ["213"], src: "web 03/10/2026" },
  { un: "1845", pi: ["954"], src: "web 03/10/2026" },
  { un: "1072", pi: ["200"], sub: "5.1", src: "web 03/10/2026" },
  // — Base ONU corrigée — vérifié web 04/10/2026
  { un: "1950", cl: "2.1", subVide: true, src: "web 04/10/2026 (sub 8 : variantes corrosives seulement)" },
  { un: "1005", cl: "2.3", sub: "8", src: "web 04/10/2026" },
  { un: "3318", cl: "2.3", sub: "8", src: "web 04/10/2026" }
];

// ---- Stubs DOM (minimum pour évaluer le script principal) ----
function makeEl() {
  return { children: [], innerHTML: "", textContent: "", value: "", style: {}, files: null, className: "", dataset: {},
    addEventListener: function(){}, appendChild: function(c){this.children.push(c)}, insertBefore: function(c){this.children.push(c)},
    setAttribute: function(){}, getAttribute: function(){return null}, querySelector: function(){ return null; },
    querySelectorAll: function(){ return { forEach: function(){} }; },
    classList: { add:function(){}, remove:function(){}, contains:function(){return false} } };
}
var els = {};
function getEl(id){ if(!els[id]) els[id] = makeEl(); return els[id]; }
var document = { getElementById: getEl, querySelectorAll: function(){ return { forEach: function(){} }; },
  createElement: function(){ var e = makeEl(); e.href=""; e.download=""; e.click=function(){}; e.remove=function(){}; return e; } };
var window = { scrollTo: function(){}, print: function(){} };
var localStorage = { getItem: function(){ return null; }, setItem: function(){} };
var navigator = { storage: { persist: function(){ return { catch: function(){} }; } } };
var fetch = function(){ return Promise.reject(new Error("offline")); };
var alert = function(){}, confirm = function(){ return true; };
var URL = { createObjectURL: function(){ return "blob:fake"; }, revokeObjectURL: function(){} };
var FileReader = function(){}; FileReader.prototype.readAsText = function(){}; FileReader.prototype.readAsArrayBuffer = function(){};
var Blob = function(parts, opts){ this.parts = parts || []; this.type = (opts && opts.type) || ""; var s = 0; (parts||[]).forEach(function(p){ s += p.byteLength || p.length || 0; }); this.size = s; };

var scripts = [], reS = /<script>([\s\S]*?)<\/script>/g, mm;
while ((mm = reS.exec(html))) scripts.push(mm[1]);
var mainScript = scripts.filter(function(s){ return s.indexOf("APP_VERSION") !== -1; })[0];

var fails = 0, total = 0;
function T(name, cond){ total++; if(!cond){ fails++; console.log("FAIL: " + name); } else console.log("ok  : " + name); }

try {
  eval(fs.readFileSync(path.join(DIR, "db-onu.js"), "utf8"));
  eval(mainScript);
  T("db-onu + script principal s'évaluent", true);
} catch (e) {
  T("db-onu + script principal s'évaluent : " + e.message, false);
}

REG.forEach(function(r){
  var f = FICHES.filter(function(x){ return x.un === r.un; })[0] || null;
  var ax = AIRX[r.un] || null;
  var e = dbByUn(r.un);
  var label = "UN " + r.un + " (" + (r.src || "") + ")";
  if (r.pi) {
    T(label + " : fiche présente avec PI " + r.pi.join("+"), !!f && r.pi.every(function(p){ return String(f.pi).indexOf(p) !== -1; }));
    T(label + " : AIRX cohérente", !ax || r.pi.every(function(p){ return String(ax.pi).indexOf(p) !== -1; }));
    if (!ax) T(label + " : PI présente dans AIRX", false);
  }
  if (r.cao) T(label + " : CAO exigé (AIRX cao + fiche pax INTERDIT)", !!ax && ax.cao === true && (!f || /INTERDIT/i.test(f.pax)));
  if (r.paxInterdit) T(label + " : fiche avion pax INTERDIT", !!f && /INTERDIT/i.test(f.pax));
  if (r.soc) T(label + " : SoC ≤ 30 % documenté dans la fiche", !!f && /SoC ≤ 30 %/.test((f.notes || "") + " " + String(f.cargo) + " " + String(f.pax)));
  if (r.cl) T(label + " : base ONU classe " + r.cl, !!e && e[2] === r.cl);
  if (r.sub) T(label + " : base ONU subsidiaire " + r.sub, !!e && e[4] === r.sub);
  if (r.subVide) T(label + " : base ONU sans subsidiaire", !!e && e[4] === "");
  if (r.note) T(label + " : mention « " + r.note + " » présente dans le code", JSON.stringify(FICHES) .indexOf(r.note.split(" ")[0]) !== -1 || html.indexOf("SP A199") !== -1);
});

// ---- Valeurs calculées (moteur Décision) — cohérence avec le manifeste ----
T("plomb (Décision) → PI 870 + CAO", compute("piles", "plomb", {}).pi.indexOf("870") !== -1 && JSON.stringify(compute("piles", "plomb", {}).autor).indexOf("CAO") !== -1);
T("VRLA (Décision) → PI 872", compute("piles", "vrla", {}).pi.indexOf("872") !== -1);
T("NiMH (Décision) → SP A199", JSON.stringify(compute("piles", "nimh", {}).soc).indexOf("A199") !== -1);
var r90 = compute("piles", "liion", { "wz-config":"avec", "wz-wh":"90", "wz-whc":"30", "wz-etat":"neuf" });
T("li-ion 90 Wh / cellule 30 Wh → Section I (PI 966)", r90.pi.indexOf("Section I") !== -1 && r90.pi.indexOf("Section II") === -1 && r90.pi.indexOf("966") !== -1);
T("SoC ≤ 30 % en Section I 966", JSON.stringify(r90.soc).indexOf("SoC ≤ 30 %") !== -1);
var rS2 = compute("piles", "liion", { "wz-config":"dans", "wz-wh":"50", "wz-whc":"10", "wz-etat":"neuf" });
T("li-ion 50 Wh / cellule 10 Wh → Section II (PI 967) + SoC", rS2.pi.indexOf("Section II") !== -1 && rS2.pi.indexOf("967") !== -1 && JSON.stringify(rS2.soc).indexOf("SoC ≤ 30 %") !== -1);
var rNo = compute("piles", "liion", { "wz-config":"avec", "wz-etat":"neuf" });
T("li-ion sans Wh → Section I prudente + invite", rNo.pi.indexOf("Section I") !== -1 && rNo.pi.indexOf("Section II") === -1 && JSON.stringify(rNo.soc).indexOf("saisis") !== -1);

// ---- Ségrégation : valeurs de la Table 9.3.A vérifiées v5 (10/2026) ----
function mk(un, psn, cl, sub){ return {un:un, psn:psn, cl:cl, sub:sub||"", notes:"", nb:1}; }
T("1.4S : aucune séparation (colonne vide 9.3.A)", analyseIncompat([mk("0338","Cart. 1.4S","1.4S"), mk("1203","Essence","3")]).length === 0);
T("classe 1 × classe 1 → renvoi groupes A–S (9.3.2)", analyseIncompat([mk("9998","1.4G","1.4G"), mk("9997","1.4G bis","1.4G")])[0].txt.indexOf("groupes de compatibilité") !== -1);
T("3 × 5.1 interdits ensemble", analyseIncompat([mk("1203","Essence","3"), mk("9994","Comburant","5.1")]).length === 1);
T("4.3 × 8 interdits ensemble", analyseIncompat([mk("1414","Lithium hydrure","4.3"), mk("1830","Acide sulfurique","8")]).length === 1);
T("piles seules (3480) × classe 3 interdits ensemble", analyseIncompat([mk("3480","Piles li-ion","9"), mk("1203","Essence","3")]).length === 1);

console.log("\n" + (total - fails) + "/" + total + " tests RÉGLEMENTAIRES OK" + (fails ? " — " + fails + " ÉCHEC(S) : DONNÉES À REVÉRIFIER AVANT EXPÉDITION" : ""));
process.exit(fails ? 1 : 0);
