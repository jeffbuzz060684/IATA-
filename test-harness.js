// Harnais de tests — Assistant IATA MDD v8
var fs = require("fs");
var path = require("path");
var DIR = __dirname;
var html = fs.readFileSync(path.join(DIR, "index.html"), "utf8");
var fails = 0, total = 0;
function T(name, cond) {
  total++;
  if (!cond) { fails++; console.log("FAIL: " + name); }
  else console.log("ok  : " + name);
}

["index.html", "manifest.webmanifest", "sw.js", "icon.svg", "tools/gen-icons.js", ".github/workflows/pages.yml", "version.json", "db-onu.js"].forEach(function (f) {
  T("fichier présent " + f, fs.existsSync(path.join(DIR, f)));
});
T("badge v8", html.indexOf(">v8<") !== -1);
T("sw v8", fs.readFileSync(path.join(DIR, "sw.js"), "utf8").indexOf("iata-mdd-v8") !== -1);
T("sw inclut db-onu.js", fs.readFileSync(path.join(DIR, "sw.js"), "utf8").indexOf("db-onu.js") !== -1);
T("sw ne cache pas version.json", fs.readFileSync(path.join(DIR, "sw.js"), "utf8").indexOf("version.json") !== -1);
T("version.json v8", JSON.parse(fs.readFileSync(path.join(DIR, "version.json"), "utf8")).version === 8);
T("10 onglets présents", ["tab-wiz","tab-rech","tab-piles","tab-gaz","tab-essence","tab-classes","tab-marquage","tab-regles","tab-colis","tab-dgd"].every(function(id){ return html.indexOf('id="'+id+'"') !== -1; }));
T("bouton « Ajouter au colisage » sur les résultats de recherche", html.indexOf("data-colisadd") !== -1 && html.indexOf("Ajouter à mon état de colisage") !== -1);
T("polices agrandies (body 17.5px)", html.indexOf("font:17.5px/1.5") !== -1);
T("import xlsx retiré (accept csv seul)", html.indexOf('accept=".csv,text/csv"') !== -1 && !/accept="[^"]*\.xlsx/.test(html));
T("parseur xlsx supprimé", html.indexOf("function zipExtract") === -1 && html.indexOf("function xlsxRows") === -1 && html.indexOf("DecompressionStream") === -1);
T("onglet Règles : tableau 9.3.A", html.indexOf("Table 9.3.A") !== -1 && html.indexOf("tab-regles") !== -1);

// ---- Stubs DOM ----
function makeEl() {
  return {
    children: [], innerHTML: "", textContent: "", value: "", style: {}, files: null, className: "", dataset: {},
    addEventListener: function(){}, appendChild: function(c){this.children.push(c)},
    insertBefore: function(c){this.children.push(c)},
    setAttribute: function(){}, getAttribute: function(){return null;},
    querySelector: function(){ return null; },
    querySelectorAll: function(){ return { forEach: function(){} }; },
    classList: { add:function(){}, remove:function(){}, contains:function(){return false} }
  };
}
var els = {};
function getEl(id) { if (!els[id]) els[id] = makeEl(); return els[id]; }
var LS = {};
var document = {
  getElementById: getEl,
  querySelectorAll: function () { return { forEach: function () {} }; },
  createElement: function () { var e = makeEl(); e.href=""; e.download=""; e.click=function(){}; e.remove=function(){}; return e; }
};
var window = { scrollTo: function () {}, print: function(){} };
var localStorage = { getItem: function(k){ return LS[k] || null; }, setItem: function(k,v){ LS[k] = String(v); } };
var navigator = { storage: { persist: function(){ return { catch: function(){} }; } } };
var fetch = function(){ return Promise.reject(new Error("offline")); };
var alert = function(){}, confirm = function(){ return true; };
var URL = { createObjectURL: function(){ return "blob:fake"; }, revokeObjectURL: function(){} };
var FileReader = function(){};
FileReader.prototype.readAsText = function(){};
FileReader.prototype.readAsArrayBuffer = function(){};
function BlobCls(parts, opts){ this.parts = parts || []; this.type = (opts && opts.type) || ""; var s = 0; (parts||[]).forEach(function(p){ s += p.byteLength || p.length || 0; }); this.size = s; }
var Blob = BlobCls;

var scripts = [];
var reS = /<script>([\s\S]*?)<\/script>/g, mm;
while ((mm = reS.exec(html))) scripts.push(mm[1]);
var mainScript = scripts.filter(function(s){ return s.indexOf("APP_VERSION") !== -1; })[0];
T("script principal extrait", !!mainScript);

try {
  eval(fs.readFileSync(path.join(DIR, "db-onu.js"), "utf8"));
  eval(mainScript);
  T("db-onu + script principal s'exécutent sans erreur (stubs)", true);
} catch (e) {
  T("db-onu + script principal s'exécutent sans erreur (stubs) : " + e.message + " | " + (e.stack||"").split("\n")[1], false);
}

// ---- Base ONU ----
T("≥ 2000 entrées ONU", typeof DB_ONU === "object" && DB_ONU.length >= 2000);
T("UN 1203 dans la base", dbByUn("1203") && dbByUn("1203")[2] === "3");
T("UN 2990 = classe 9 (IATA)", dbByUn("2990") && dbByUn("2990")[2] === "9");
T("UN 1072 : subsidiaire 5.1", dbByUn("1072") && dbByUn("1072")[4] === "5.1");

// ---- Corrections réglementaires v4 ----
T("APP_VERSION = 8", typeof APP_VERSION !== "undefined" && APP_VERSION === 8);
var rM = compute("carb", "moteur", {});
T("UN 3528 → PI 378 (plus jamais 970)", rM.pi.indexOf("378") !== -1 && rM.pi.indexOf("970") === -1);
var rG = compute("gilet", "co2", {});
T("UN 2990 → classe 9, PI 955", rG.cl.indexOf("9") !== -1 && rG.pi.indexOf("955") !== -1 && rG.cl.indexOf("2.2") === -1);
var rE = compute("gaz", "extincteur", {});
T("UN 1044 → PI 213", rE.pi.indexOf("213") !== -1);
var rA = compute("gaz", "aerosol", {"wz-vol":"0.5"});
T("LQ aérien → marque Y (pas « LIMITED QUANTITY »)", JSON.stringify(rA.marquage).indexOf("Marque « Y »") !== -1 && JSON.stringify(rA.marquage).indexOf("LIMITED QUANTITY") === -1);
T("assistant décision présent", typeof compute === "function");
var r1 = compute("piles", "liion", {"wz-config":"seul","wz-wh":"98","wz-whc":"18","wz-etat":"neuf"});
T("li-ion seul 98 Wh → IB + DGD + CAO", r1.pi.indexOf("IB") !== -1 && JSON.stringify(r1.docs).indexOf("DGD") !== -1 && JSON.stringify(r1.etiquette).indexOf("CARGO") !== -1);
var rNa = compute("piles", "sodium", {"wz-config":"seul","wz-wh":"60","wz-etat":"neuf"});
T("sodium-ion seul → UN 3551 PI 976 (plus 977)", rNa.un === "3551" && rNa.pi.indexOf("976") !== -1 && rNa.pi.indexOf("977") === -1);

var mk = function(un, psn, cl, sub){ return {un:un, psn:psn, cl:cl, sub:sub||"", notes:"", nb:1}; };
// ---- Corrections réglementaires v7 ----
T("esc() échappe & < > \" '", esc("a&b").indexOf("&amp;") !== -1 && esc("a<b").indexOf("&lt;") !== -1 && esc('a"b').indexOf("&quot;") !== -1 && esc("a>b").indexOf("&gt;") !== -1 && esc("a'b").indexOf("&#39;") !== -1);
T("FICHE 2794 (plomb) → PI 870 + interdit pax", FICHES.some(function(f){ return f.un === "2794" && String(f.pi).indexOf("870") !== -1 && String(f.pax).indexOf("INTERDIT") !== -1; }));
T("FICHE 2800 (VRLA) → PI 872", FICHES.some(function(f){ return f.un === "2800" && String(f.pi).indexOf("872") !== -1; }));
T("FICHE 3496 supprimée, 3499 (supercondensateurs) → PI 971", !FICHES.some(function(f){ return f.un === "3496"; }) && FICHES.some(function(f){ return f.un === "3499" && String(f.pi).indexOf("971") !== -1; }));
var dSc = detectMatiere("supercondensateur");
T("« supercondensateur » → UN 3499 PI 971", dSc && dSc.un === "3499" && dSc.pi.indexOf("971") !== -1);
var rPb = compute("piles", "plomb", {});
T("plomb-acide → PI 870 + CAO", rPb.pi.indexOf("870") !== -1 && JSON.stringify(rPb.autor).indexOf("CAO") !== -1);
var rVr = compute("piles", "vrla", {});
T("VRLA → PI 872 (plus 806)", rVr.pi.indexOf("872") !== -1 && rVr.pi.indexOf("806") === -1);
var rNi = compute("piles", "nimh", {});
T("NiMH → SP A199 non restreint par air", JSON.stringify(rNi.soc).indexOf("A199") !== -1);
var r90 = compute("piles", "liion", {"wz-config":"avec","wz-wh":"90","wz-whc":"30","wz-etat":"neuf"});
T("90 Wh / cellule 30 Wh → Section I (cellule > 20 Wh), PI 966", r90.pi.indexOf("966") !== -1 && r90.pi.indexOf("Section I") !== -1 && r90.pi.indexOf("Section II") === -1);
T("SoC ≤ 30 % affiché en Section I (966/967)", JSON.stringify(r90.soc).indexOf("SoC ≤ 30 %") !== -1 && JSON.stringify(r90.soc).indexOf("966/967") !== -1);
var rOk = compute("piles", "liion", {"wz-config":"dans","wz-wh":"90","wz-whc":"18","wz-etat":"neuf"});
T("90 Wh / cellule 18 Wh → Section II, PI 967", rOk.pi.indexOf("967") !== -1 && rOk.pi.indexOf("Section II") !== -1);
T("SoC ≤ 30 % affiché aussi en Section II", JSON.stringify(rOk.soc).indexOf("SoC ≤ 30 %") !== -1);
var rNoWh = compute("piles", "liion", {"wz-config":"avec","wz-etat":"neuf"});
T("Wh absent → section prudente (I) + invite à saisir les Wh", rNoWh.pi.indexOf("Section I") !== -1 && rNoWh.pi.indexOf("Section II") === -1 && JSON.stringify(rNoWh.soc).indexOf("saisis") !== -1);
var rVeh = compute("piles", "vehicule", {"wz-veh":"li"});
T("véhicule lithium → SoC ≤ 30 % (UN 3171/3556, SP A331)", JSON.stringify(rVeh.soc).indexOf("SoC ≤ 30 %") !== -1);
var dE = detFromUn("1203");
T("AIRX 1203 → PI 353/364 (plus 358)", dE.pi.indexOf("353") !== -1 && dE.pi.indexOf("364") !== -1 && dE.pi.indexOf("358") === -1);
T("référentiel DGR 67e éd. affiché", html.indexOf("67e") !== -1 && html.indexOf("DGR") !== -1);
var c14 = analyseIncompat([mk("9998","Essai 1.4G","1.4G"), mk("0338","Cartouches 1.4S","1.4S")]);
T("1.4G × 1.4S → PAS d'incompatibilité", c14.length === 0);
var cG = analyseIncompat([mk("9998","Essai 1.4G","1.4G"), mk("9997","Essai 1.4G bis","1.4G")]);
T("1.4G × 1.4G → renvoi groupes de compatibilité (9.3.2)", cG.length === 1 && cG[0].txt.indexOf("groupes de compatibilité") !== -1);
var cAer = analyseIncompat([mk("1950","Aérosols","2.1"), mk("1428","Sodium","4.3")]);
T("UN 1950 (sub 8 retiré) × UN 1428 → PAS de faux conflit 4.3×8", cAer.length === 0);
T("db-onu : UN 1950 = 2.1 sans sub 8", dbByUn("1950") && dbByUn("1950")[2] === "2.1" && dbByUn("1950")[4] === "");
T("db-onu : UN 1005 = 2.3 + sub 8 (conservé)", dbByUn("1005") && dbByUn("1005")[2] === "2.3" && dbByUn("1005")[4] === "8");

// ---- v8 : verdict d'expédition 4 niveaux ----
T("verdictColis défini", typeof verdictColis === "function" && typeof colisageVerdict === "function");
T("verdict 🔴 UN 3356 (interdit fret)", verdictColis({un:"3356", psn:"Générateur d'oxygène, chimique", cl:"5.1", nb:1}).v === "red");
T("verdict 🔴 pile endommagée", verdictColis({un:"3480", psn:"Piles li-ion", cl:"9", notes:"endommagée", cao:true, nb:1}).v === "red");
T("verdict ⚠️ matière non identifiée", verdictColis({un:"", psn:"", cl:"", nb:1}).v === "warn");
T("verdict ⚠️ classe 3 sans PG", verdictColis({un:"1203", psn:"Essence", cl:"3", pg:"", nb:1}).v === "warn");
T("verdict ⚠️ CAO requis mais non confirmé", verdictColis({un:"3480", psn:"Piles li-ion", cl:"9", pg:"", cao:false, notes:"tél 0601020304", nb:1}).v === "warn");
var vOr = verdictColis({un:"1203", psn:"Essence", cl:"3", pg:"II", cao:false, lq:false, nb:1});
T("verdict 🟠 classe 3 complet → sous conditions", vOr.v === "orange" && vOr.r.indexOf("DGD") !== -1);
var vGr = verdictColis({un:"3496", psn:"Piles au nickel-hydrure métallique", cl:"9", nb:1});
T("verdict 🟢 UN 3496 NiMH (non restreint)", vGr.v === "green");
var vOk2 = verdictColis({un:"3480", psn:"Piles li-ion", cl:"9", cao:true, notes:"SoC 30 % — tél 0601020304", nb:1});
T("verdict 🟠 3480 complet → CAO + SoC cités", vOk2.v === "orange" && vOk2.r.indexOf("CAO") !== -1 && vOk2.r.indexOf("SoC") !== -1);
T("colisageVerdict = pire niveau (red gagne)", colisageVerdict([mk("1203","Essence","3"), mk("3356","Générateur O₂ chimique","5.1")]).v === "red");
T("colisageVerdict tout 🟢 → green", colisageVerdict([mk("3496","Piles NiMH","9")]).v === "green");
T("resultCard : VERDICT INTERDIT (tone err)", resultCard({tone:"err", title:"t", autor:[]}).indexOf("VERDICT : INTERDIT") !== -1);
T("resultCard : VERDICT SOUS CONDITIONS (défaut)", resultCard(compute("piles", "plomb", {})).indexOf("SOUS CONDITIONS") !== -1);
T("resultCard : VERDICT AUTORISÉ (tone ok)", resultCard(compute("gilet", "mousse", {})).indexOf("VERDICT : AUTORISÉ") !== -1);
COLIS = [ { id: 801, date: "2026-10-04", un: "1203", psn: "ESSENCE", cl: "3", sub: "", pg: "II", pi: "353/364", ship: "BMPM", cons: "Doha", qty: "20 L", nb: 1, pkg: "fût ONU 3A", cao: false, lq: false, notes: "" } ];
colisSave();
colisRender();
T("bannière verdict colisage en tête", els["c-list"].children[0] && els["c-list"].children[0].innerHTML.indexOf("Verdict colisage") !== -1);
T("badge verdict sur chaque colis", els["c-list"].children.some(function(ch){ return /SOUS CONDITIONS|À COMPLÉTER|INTERDIT|AUTORISÉ/.test(ch.innerHTML || ""); }));

// ---- v8 : traçabilité des sources ----
T("SRC défini avec entrées vérifiées", typeof SRC === "object" && Object.keys(SRC).length >= 20 && SRC["1203"].indexOf("353") !== -1 && SRC["2794"].indexOf("870") !== -1);
var fPb2 = FICHES.filter(function(f){ return f.un === "2794"; })[0];
T("ficheCard affiche la source vérifiée", ficheCard(fPb2).indexOf("vérifié web 04/10/2026") !== -1 && ficheCard(fPb2).indexOf("Source :") !== -1);
T("fiche non vérifiée marquée « à confirmer »", (function(){ var f = FICHES.filter(function(x){ return !SRC[x.un]; })[0]; return f ? ficheCard(f).indexOf("à confirmer") !== -1 : true; })());
var dE75 = detFromUn("3475");
T("AIRX 3475 → PI 353/364 (vérifié extrait DGR)", dE75.pi.indexOf("353") !== -1 && dE75.pi.indexOf("364") !== -1 && dE75.pi.indexOf("358") === -1);
T("FICHE 3475 → PG II + 353/364", (function(){ var f = FICHES.filter(function(x){ return x.un === "3475"; })[0]; return f && f.pg === "II" && String(f.pi).indexOf("353") !== -1; })());
T("harnais réglementaire séparé présent et PASSANT", (function(){ var r = require("child_process").spawnSync("node", ["test-reglementaire.js"], { cwd: DIR }); return r.status === 0; })());

// ---- Wizard : le bug v3 (champs effacés) est corrigé ----
T("refreshWiz(rebuild) garde les champs (garde WZ_BUILT)", html.indexOf("WZ_BUILT !== key") !== -1 && html.indexOf("refreshWiz(false)") !== -1);

// ---- analyseColis : étiquettes et avertissements ----
var a1 = analyseColis({un:"3480", psn:"Piles au lithium-ion", cl:"9", pi:"965 IB", notes:"SoC 30 % — tél 0601020304", cao:true, nb:1});
T("3480 : CAO + lithium + classe 9", a1.labels.indexOf("cao") !== -1 && a1.labels.indexOf("lithium") !== -1 && a1.labels.indexOf("9") !== -1);
var a1b = analyseColis({un:"3480", psn:"Piles au lithium-ion", cl:"9", pi:"965 IB", notes:"", cao:false, nb:1});
T("3480 sans CAO → avertissement", a1b.warns.some(function(w){ return w.indexOf("CARGO") !== -1; }));
var a2 = analyseColis({un:"1203", psn:"Essence", cl:"3", pg:"II", pi:"358", nb:2});
T("1203 : classe 3 + orientation", a2.labels.indexOf("3") !== -1 && a2.labels.indexOf("orient") !== -1);
var a2b = analyseColis({un:"1203", psn:"Essence", cl:"3", pg:"", pi:"358", nb:2});
T("1203 sans PG → avertissement PG", a2b.warns.some(function(w){ return w.indexOf("groupe d") !== -1 || w.indexOf("PG") !== -1; }));
var a3 = analyseColis({un:"1072", psn:"Oxygène comprimé", cl:"2.2", sub:"5.1", pi:"200", nb:1});
T("1072 : 2.2 + 5.1 (subsidiaire)", a3.labels.indexOf("2.2") !== -1 && a3.labels.indexOf("5.1") !== -1);
var a4 = analyseColis({un:"1950", psn:"Aérosols", cl:"2.1", lq:true, nb:1});
T("LQ → marque Y", a4.labels.indexOf("y") !== -1);
var a5 = analyseColis({un:"1845", psn:"Glace carbonique", cl:"9", pi:"954", nb:1});
T("glace carbonique : mention LTA (pas de DGD)", (a5.infos||[]).some(function(x){ return x.indexOf("LTA") !== -1; }));

// ---- détection de matière ----
var d1 = detectMatiere("essence");
T("« essence » → UN 1203", d1 && d1.un === "1203");
var d2 = detectMatiere("groupe electrogene");
T("« groupe électrogène » → UN 3528", d2 && d2.un === "3528");
var d3 = detectMatiere("UN3480");
T("« UN3480 » → UN 3480 + CAO", d3 && d3.un === "3480" && d3.cao === true);
var d4 = detectMatiere("gilet gonflable");
T("« gilet gonflable » → UN 2990", d4 && d4.un === "2990");

// ---- XLSX round-trip : export → lecture → analyse ----
COLIS = [
  { id: 1, date: "2026-10-03", un: "3480", psn: "Piles au lithium-ion", cl: "9", sub: "", pg: "", pi: "965 IB", ship: "BMPM Marseille", cons: "Doha", qty: "12 kg", nb: 1, pkg: "caisse ONU 4G", cao: true, lq: false, notes: "SoC 30 %" },
  { id: 2, date: "2026-10-03", un: "1203", psn: "Essence", cl: "3", sub: "", pg: "II", pi: "358", ship: "BMPM", cons: "DOH", qty: "20 L", nb: 2, pkg: "fûts ONU 3A", cao: false, lq: false, notes: "" }
];
colisSave();
T("localStorage persisté", (LS["iata-colis-v1"] || "").indexOf("3480") !== -1);
var blob = xlsxBuild();
T("xlsxBuild retourne un Blob", typeof blob === "object" && blob.size > 1000);
function blobBytes(b){
  var out = Buffer.alloc(b.size), pos = 0;
  b.parts.forEach(function(p){ var u = p instanceof Uint8Array ? Buffer.from(p) : Buffer.from(p); u.copy(out, pos); pos += u.length; });
  return out;
}
var x = blobBytes(blob);
T("xlsx signature PK\\x03\\x04", x[0] === 0x50 && x[1] === 0x4b && x[2] === 0x03 && x[3] === 0x04);
function findEntry(buf, name){
  var off = 0;
  while (off + 30 <= buf.length && buf[off] === 0x50 && buf[off+1] === 0x4b && buf[off+2] === 0x03 && buf[off+3] === 0x04) {
    var nlen = buf.readUInt16LE(off + 26);
    var elen = buf.readUInt16LE(off + 28);
    var csize = buf.readUInt32LE(off + 18);
    var nm = buf.slice(off + 30, off + 30 + nlen).toString("utf8");
    if (nm === name) return buf.slice(off + 30 + nlen + elen, off + 30 + nlen + elen + csize);
    off += 30 + nlen + elen + csize;
  }
  return null;
}
var sheetEntry = findEntry(x, "xl/worksheets/sheet1.xml");
T("entrée sheet1.xml présente", sheetEntry !== null && sheetEntry.length > 200);
if (sheetEntry) {
  var sheetXml = sheetEntry.toString("utf8");
  T("sheet xml : UN 3480 + inlineStr", sheetXml.indexOf("3480") !== -1 && sheetXml.indexOf("inlineStr") !== -1);
}

// ---- CSV round-trip via csvRows + impAnalyse ----
var csv = csvBuild();
T("CSV BOM + point-virgule", csv.charCodeAt(0) === 0xFEFF && csv.indexOf(";") !== -1);
var rowsCsv = csvRows(csv);
impAnalyse(rowsCsv);
T("analyse CSV : 2 colis, 3480/1203", IMP_ROWS.length === 2 && IMP_ROWS[0].un === "3480" && IMP_ROWS[1].un === "1203");
T("analyse CSV : détection sans n° ONU (essence)", (function(){
  impAnalyse([["Matiere","Quantite","Expediteur"],["essence sans plomb","10 L","BMPM"]]);
  return IMP_ROWS.length === 1 && IMP_ROWS[0].un === "1203";
})());

// ---- RÈGLES v5 : incompatibilités entre colis (Table 9.3.A) ----
T("analyseIncompat défini", typeof analyseIncompat === "function");
T("3 + 5.1 → incompatibilité", analyseIncompat([mk("1203","Essence","3"), mk("9994","Matière comburante","5.1")]).length === 1);
T("piles seules (3480) + 2.1 → incompatibilité", analyseIncompat([mk("3480","Piles au lithium-ion","9"), mk("1978","Propane","2.1")]).length === 1);
T("piles seules (3480) + classe 3 → incompatibilité", analyseIncompat([mk("3480","Piles au lithium-ion","9"), mk("1090","Acétone","3")]).length === 1);
T("4.3 + 8 → incompatibilité", analyseIncompat([mk("1414","Hydrure de lithium","4.3"), mk("1830","Acide sulfurique","8")]).length === 1);
T("4.2 + 5.1 → incompatibilité", analyseIncompat([mk("9997","Matière classe 4.2","4.2"), mk("9994","Matière comburante","5.1")]).length === 1);
T("1.4S + classe 3 → PAS d'incompatibilité", analyseIncompat([mk("0338","Cartouches à armes légères","1.4S"), mk("1203","Essence","3")]).length === 0);
T("1.4B + classe 3 → incompatibilité", analyseIncompat([mk("9999","Essai 1.4B","1.4B"), mk("1203","Essence","3")]).length === 1);
T("1.4B + 1.4S → autorisé", analyseIncompat([mk("9999","Essai 1.4B","1.4B"), mk("0338","Cartouches à armes légères","1.4S")]).length === 0);
T("UN 3528 + 5.1 → PAS d'incompatibilité (exception moteurs)", analyseIncompat([mk("3528","Moteur à combustion interne","3"), mk("9994","Matière comburante","5.1")]).length === 0);
T("6.2 + 7 → pas de ségrégation", analyseIncompat([mk("9996","Matière infectieuse","6.2"), mk("9995","Matière radioactive","7")]).length === 0);
T("3481 (avec équipement) + classe 3 → PAS d'incompatibilité", analyseIncompat([mk("3481","Piles avec équipement","9"), mk("1203","Essence","3")]).length === 0);
T("subsidiaire 5.1 (UN 1072) + classe 3 → incompatibilité", analyseIncompat([mk("1072","Oxygène comprimé","2.2","5.1"), mk("1203","Essence","3")]).length === 1);
var incC = analyseIncompat(COLIS);
T("COLIS démo (3480 + 1203) → 1 incompatibilité détectée", incC.length === 1);
colisRender();
T("bannière incompatibilités affichée dans c-list (après verdict)", (function(){ var kids = els["c-list"].children; return kids.some(function(ch){ return (ch.innerHTML || "").indexOf("Incompatibilités") !== -1; }); })());
reglesCheckRender(incC);
T("bloc contrôle Règles rempli", els["reg-check"].innerHTML.indexOf("incompatibilité") !== -1);
var incOk = analyseIncompat([mk("1203","Essence","3"), mk("1266","Parfums","3")]);
reglesCheckRender(incOk);
T("bloc contrôle Règles : aucun conflit → message ✅", els["reg-check"].innerHTML.indexOf("✅") !== -1);
var dNa = detectMatiere("sodium ion");
T("« sodium ion » → UN 3551 PI 976", dNa && dNa.un === "3551" && dNa.pi.indexOf("976") !== -1);

// ---- étiquettes / impression ----
var lbl1 = colisLabelsHtml(COLIS[0]);
T("étiquette 3480 : CAO + lithium SVG", lbl1.indexOf("CARGO AIRCRAFT ONLY") !== -1);
printLabel(COLIS[0]);
T("print-label rempli avec UN + PSN", els["print-label"].innerHTML.indexOf("UN 3480") !== -1);

// ---- DGD multi-lignes ----
T("dgdAddFromColisQuiet + renderDgd définies", typeof dgdAddFromColisQuiet === "function" && typeof renderDgd === "function");
DGD_LINES = [];
dgdAddFromColisQuiet(COLIS[0]);
dgdAddFromColisQuiet(COLIS[1]);
renderDgd();
var dgdH = els["dgd-preview"].innerHTML;
T("DGD : 2 lignes UN rendues", dgdH.indexOf("3480") !== -1 && dgdH.indexOf("1203") !== -1);
T("DGD : mention CARGO AIRCRAFT ONLY", dgdH.indexOf("CARGO AIRCRAFT ONLY") !== -1);
T("DGD : format officiel (Nature and Quantity + déclaration)", dgdH.indexOf("Nature and Quantity") !== -1 && dgdH.indexOf("fully and accurately described") !== -1);
T("DGD : lignes texte copiables", (els["dgd-line"].textContent || "").indexOf("UN 3480") !== -1 && (els["dgd-line"].textContent || "").indexOf("UN 1203") !== -1);
T("DGD : impression A4 remplie", els["print-dgd"].innerHTML.indexOf("3480") !== -1);

// ---- v6 : ajout depuis la recherche + choix du colis de destination ----
T("detFromUn défini", typeof detFromUn === "function");
var det1 = detFromUn("1072");
T("detFromUn 1072 → 2.2 + subsidiaire 5.1 + PI 200", det1.cl === "2.2" && det1.sub === "5.1" && det1.pi.indexOf("200") !== -1);
var det2 = detFromUn("3480");
T("detFromUn 3480 → CAO + PI 965", det2.cao === true && det2.pi.indexOf("965") !== -1);
COLIS = [ { id: 501, date: "2026-10-04", un: "3480", psn: "Piles au lithium-ion", cl: "9", sub: "", pg: "", pi: "965 IB", ship: "BMPM Marseille", cons: "Doha", qty: "5 kg", nb: 1, pkg: "caisse ONU 4G", cao: true, lq: false, notes: "" } ];
colisSave();
var newC = colisBuildFromDet(detFromUn("1203"), { dstPkg: "caisse ONU 4G", qty: "20 L", nb: 2 });
T("colisBuildFromDet : colis existant → ship/cons/pkg copiés", newC.ship === "BMPM Marseille" && newC.pkg === "caisse ONU 4G" && newC.qty === "20 L");
var newD = colisBuildFromDet(detFromUn("1203"), {});
T("colisBuildFromDet : nouveau colis → pkg vide, expéditeur vide", newD.pkg === "" && newD.ship === "");
COLIS.push(newC); colisSave();
var confSame = analyseIncompat(COLIS);
T("deux matières incompatibles dans le MÊME colis → même=true", confSame.length === 1 && confSame[0].same === true);
T("incompatHtml : mention « Même colis »", incompatHtml(confSame).indexOf("ême colis") !== -1);
var confNew = colisNewConflicts(newC);
T("colisNewConflicts : conflit impliquant le colis ajouté", confNew.length === 1 && (confNew[0].a.id === newC.id || confNew[0].b.id === newC.id));
var confFar = analyseIncompat([mk("1203","Essence","3"), mk("1266","Parfums","3")]);
T("colis distincts (pkg différents) → même=false", (function(){ var x = analyseIncompat([mk("1203","Essence","3",""), mk("9994","Comburant","5.1")]); return x.length===1 && x[0].same===false; })());
void confFar;
colisRender();
T("bannière OVERPACK pour colis multi-matières", els["c-list"].children.some(function(ch){ return (ch.innerHTML||"").indexOf("OVERPACK") !== -1; }));
T("badge colis (pkg) affiché sur chaque matière", els["c-list"].children.some(function(ch){ return (ch.innerHTML||"").indexOf("caisse ONU 4G") !== -1; }));
// flux complet via le formulaire (stubs DOM)
COLIS = [ { id: 601, date: "2026-10-04", un: "1203", psn: "ESSENCE", cl: "3", sub: "", pg: "II", pi: "358", ship: "BMPM", cons: "Doha", qty: "20 L", nb: 1, pkg: "fût ONU 3A", cao: false, lq: false, notes: "" } ];
colisSave();
colisAddOpen("3480", null);
T("formulaire d'ajout ouvert (destination + quantité)", ADD_BOX && ADD_BOX.innerHTML.indexOf("ca-dst") !== -1 && ADD_BOX.innerHTML.indexOf("ca-qty") !== -1);
T("liste des destinations : colis existant proposé", ADD_BOX.innerHTML.indexOf("fût ONU 3A") !== -1);
getEl("ca-dst").value = "fût ONU 3A";
getEl("ca-qty").value = "5 kg";
getEl("ca-nb").value = "1";
getEl("ca-notes").value = "SoC 30 %";
colisAddConfirm();
T("ajout confirmé : colis créé avec les bons champs", COLIS.length === 2 && COLIS[1].un === "3480" && COLIS[1].pkg === "fût ONU 3A" && COLIS[1].ship === "BMPM" && COLIS[1].notes === "SoC 30 %" && COLIS[1].cao === true);
T("feedback : ✅ ajouté + incompatibilité même colis signalée", els["ca-res"].innerHTML.indexOf("✅") !== -1 && els["ca-res"].innerHTML.indexOf("ême colis") !== -1);
colisRender();
T("bannière incompatibilités mise à jour après ajout", els["c-list"].children.some(function(ch){ return (ch.innerHTML||"").indexOf("Incompatibilité") !== -1; }));
// un ajout compatible ne génère pas d'alerte
COLIS = [ { id: 701, date: "2026-10-04", un: "1203", psn: "ESSENCE", cl: "3", sub: "", pg: "II", pi: "358", ship: "BMPM", cons: "Doha", qty: "20 L", nb: 1, pkg: "fût ONU 3A", cao: false, lq: false, notes: "" } ];
colisSave();
colisAddOpen("1266", null);
getEl("ca-dst").value = "";
getEl("ca-pkg").value = "caisse ONU 4G";
getEl("ca-qty").value = "3 L";
colisAddConfirm();
T("ajout compatible : aucune incompatibilité signalée", COLIS.length === 2 && els["ca-res"].innerHTML.indexOf("Aucune incompatibilité") !== -1);

// ---- checkVersion offline ----
try { checkVersion(); T("checkVersion offline sans crash", true); } catch (e) { T("checkVersion offline sans crash", false); }

// ---- workflow / icônes ----
var yml = fs.readFileSync(path.join(DIR, ".github/workflows/pages.yml"), "utf8");
T("workflow path sous with:", yml.indexOf("with:") !== -1 && yml.indexOf('path: "."') !== -1);
var cp = require("child_process");
var r = cp.spawnSync("node", ["tools/gen-icons.js"], { cwd: DIR });
T("gen-icons exécuté", r.status === 0);

console.log("\n" + (total - fails) + "/" + total + " tests OK" + (fails ? " — " + fails + " ÉCHEC(S)" : ""));
process.exit(fails ? 1 : 0);
