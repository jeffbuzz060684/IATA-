// Harnais de tests — Assistant IATA MDD v4
var fs = require("fs");
var path = require("path");
var zlib = require("zlib");
var cp = require("child_process");
var DIR = __dirname;
var html = fs.readFileSync(path.join(DIR, "index.html"), "utf8");
var swSrc = fs.readFileSync(path.join(DIR, "sw.js"), "utf8");
var fails = 0, total = 0;
function T(name, cond) {
  total++;
  if (!cond) { fails++; console.log("FAIL: " + name); }
  else console.log("ok  : " + name);
}

["index.html", "manifest.webmanifest", "sw.js", "icon.svg", "tools/gen-icons.js", ".github/workflows/pages.yml", "version.json", "db-onu.js"].forEach(function (f) {
  T("fichier présent " + f, fs.existsSync(path.join(DIR, f)));
});
T("badge v4", html.indexOf(">v4<") !== -1);
T("sw v4", swSrc.indexOf("iata-mdd-v4") !== -1);
T("sw pré-cache db-onu.js", swSrc.indexOf("db-onu.js") !== -1);
T("sw ne cache pas version.json", swSrc.indexOf("version.json") !== -1);
T("9 onglets présents", ["tab-wiz","tab-rech","tab-piles","tab-gaz","tab-essence","tab-classes","tab-marquage","tab-colis","tab-dgd"].every(function(id){ return html.indexOf('id="'+id+'"') !== -1; }));
T("zone impression label présente", html.indexOf('id="print-label"') !== -1);
T("zone impression DGD présente", html.indexOf('id="print-dgd"') !== -1);
T("version.json v4", JSON.parse(fs.readFileSync(path.join(DIR, "version.json"), "utf8")).version === 4);
T("carte analyse présente", html.indexOf('id="a-out"') !== -1 && html.indexOf('id="a-file"') !== -1);
T("lignes DGD multiples présentes", html.indexOf('id="d-lines"') !== -1 && html.indexOf('id="d-addline"') !== -1);

// ---- Stubs DOM ----
var RealBlob = globalThis.Blob;
function makeEl() {
  return {
    children: [], innerHTML: "", textContent: "", value: "", style: {}, files: null, dataset: {}, onclick: null,
    addEventListener: function(){}, appendChild: function(c){this.children.push(c)},
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
BlobCls.prototype.stream = function(){ return new RealBlob(this.parts).stream(); };
var Blob = BlobCls;

// ---- Chargement db-onu.js puis du script principal ----
var dbSrc = fs.readFileSync(path.join(DIR, "db-onu.js"), "utf8");
var m = html.match(/<script>([\s\S]*?)<\/script>/);
T("script inline trouvé", !!m);
var script = m[1];
try {
  eval(dbSrc);
  T("db-onu.js s'évalue", typeof DB_ONU !== "undefined" && DB_ONU.length > 2000);
  T("base ONU ≥ 2300 entrées", DB_ONU.length >= 2300);
  eval(script);
  T("script principal s'exécute sans erreur (stubs)", true);
} catch (e) {
  T("script s'exécute sans erreur (stubs) : " + e.message + "\n" + e.stack, false);
}

async function main() {
  // ---- Base ONU : valeurs clés (issues de sources publiques vérifiées) ----
  T("DBX 1203 → 3 / II", DBX["1203"] && DBX["1203"].cl === "3" && DBX["1203"].pg === "II");
  T("DBX 1072 → 2.2 + 5.1", DBX["1072"] && String(DBX["1072"].cl).indexOf("2.2") !== -1 && String(DBX["1072"].sub).indexOf("5.1") !== -1);
  T("DBX 2990 → classe 9", DBX["2990"] && String(DBX["2990"].cl).indexOf("9") !== -1);
  T("DBX 3528 → classe 3", DBX["3528"] && String(DBX["3528"].cl).indexOf("3") !== -1);
  T("DBX 1845 présent (glace carbonique)", !!DBX["1845"]);

  // ---- Corrections réglementaires dans les fiches / wizard ----
  T("fiche 2990 : classe 9, PI 955", ficheByUn("2990").cl === "9" && ficheByUn("2990").pi.indexOf("955") !== -1);
  T("fiche 3528 : PI 378", ficheByUn("3528").pi.indexOf("378") !== -1);
  T("fiche 1044 : PI 213", ficheByUn("1044").pi.indexOf("213") !== -1);
  T("AIRX 1203 : LQ Y341 possible (pas de défaut LQ)", AIRX["1203"].pi.indexOf("Y341") !== -1 && !AIRX["1203"].lq);
  var g = compute("gilet", "co2", {});
  T("wizard gilet CO₂ → UN 2990 classe 9 PI 955", g.un === "2990" && g.cl.indexOf("9") === 0 && g.pi.indexOf("955") !== -1);
  var mo = compute("carb", "moteur", {});
  T("wizard moteur → UN 3528 PI 378", mo.un === "3528" && mo.pi.indexOf("378") !== -1);
  var ex = compute("carb", "essence", { "wz-mode": "fret" });
  T("wizard essence → 1203 PG II marque Y", ex.un === "1203" && ex.marquage.join(" ").indexOf("Y") !== -1);
  var r1 = compute("piles", "liion", {"wz-config":"seul","wz-wh":"98","wz-whc":"18","wz-etat":"neuf"});
  T("li-ion seul 98 Wh → IB + DGD", r1.pi.indexOf("IB") !== -1 && JSON.stringify(r1.docs).indexOf("DGD") !== -1);

  // ---- Bug v3 corrigé : recompute sans reconstruire les champs ----
  WZ.cat = "piles"; WZ.sub = "liion";
  refreshWiz();
  var paramsSnapshot = els["wz-params"].innerHTML;
  els["wz-wh"].value = "98";
  els["wz-config"].value = "seul";
  recomputeWiz();
  T("wizard : recompute ne vide PAS les champs", els["wz-params"].innerHTML === paramsSnapshot);
  T("wizard : résultat recalculé en direct", els["wz-result"].innerHTML.indexOf("IB") !== -1);

  // ---- Étiquettes SVG ----
  ["1","2.1","2.2","2.3","3","4.1","4.2","4.3","5.1","5.2","6.1","7","8","9","9li","9lm","9na","cao","lqy","batmark","orient"].forEach(function(k){
    T("svgLabel " + k, svgLabel(k).indexOf("<svg") === 0);
  });
  var L3480 = computeLabels({ un:"3480", psn:"Piles au lithium-ion", cl:"9", sub:"", cao:true, lq:false, qty:"10 kg", notes:"" });
  T("labels 3480 : 9li + CAO + batmark + pas d'orient", L3480.list.indexOf("9li") !== -1 && L3480.list.indexOf("cao") !== -1 && L3480.list.indexOf("batmark") !== -1 && L3480.list.indexOf("orient") === -1);
  var L1203 = computeLabels({ un:"1203", psn:"Essence", cl:"3", sub:"", cao:false, lq:false, qty:"20 L", notes:"" });
  T("labels 1203 : 3 + orientations", L1203.list.indexOf("3") !== -1 && L1203.list.indexOf("orient") !== -1);
  var L1072 = computeLabels({ un:"1072", psn:"Oxygène, comprimé", cl:"2.2", sub:"5.1", cao:false, lq:false, qty:"", notes:"" });
  T("labels 1072 : 2.2 + 5.1 (subsidiaire)", L1072.list.indexOf("2.2") !== -1 && L1072.list.indexOf("5.1") !== -1);
  var L1950 = computeLabels({ un:"1950", psn:"Aérosols", cl:"2.1", sub:"", cao:false, lq:true, qty:"", notes:"" });
  T("labels 1950 LQ : marque Y", L1950.list.indexOf("lqy") !== -1);
  T("analyseColis : 3480 sans CAO → avertissement", analyseColis({ un:"3480", psn:"Piles au lithium-ion", cl:"9", sub:"", pg:"", ship:"A", cons:"B", qty:"1 kg", nb:1, pkg:"", pi:"", cao:false, lq:false, notes:"" }).some(function(w){ return w.indexOf("CAO") !== -1; }));
  T("analyseColis : colis complet → pas d'avertissement bloquant", analyseColis({ un:"1203", psn:"ESSENCE", cl:"3", sub:"", pg:"II", ship:"A", cons:"B", qty:"20 L", nb:2, pkg:"fûts", pi:"358", cao:false, lq:false, notes:"" }).length === 0);

  // ---- Fonctions colis ----
  T("colisLoad/Save définies", typeof colisLoad === "function" && typeof colisSave === "function");
  T("APP_VERSION = 4", APP_VERSION === 4);
  T("clé localStorage inchangée (continuité v3)", COLIS_KEY === "iata-colis-v1");
  COLIS.push({ id: 1, date: "2026-10-03", un: "3480", psn: "Piles au lithium-ion", cl: "9", sub: "", pg: "", pi: "965 IB", etiquettes: "9 lithium-ion", ship: "BMPM Marseille", cons: "Doha", qty: "12 kg", nb: 1, pkg: "caisse ONU 4G", cao: true, lq: false, notes: "SoC 30 %" });
  COLIS.push({ id: 2, date: "2026-10-03", un: "1203", psn: "Essence", cl: "3", sub: "", pg: "II", pi: "358", etiquettes: "3", ship: "BMPM", cons: "DOH", qty: "20 L", nb: 2, pkg: "fûts ONU 3A", cao: false, lq: false, notes: "" });
  COLIS.push({ id: 3, date: "2026-10-03", un: "1072", psn: "Oxygène, comprimé", cl: "2.2", sub: "5.1", pg: "", pi: "200", etiquettes: "2.2 + 5.1", ship: "BMPM", cons: "DOH", qty: "2 bouteilles", nb: 1, pkg: "cage", cao: false, lq: false, notes: "" });
  colisSave();
  T("localStorage persisté", (LS["iata-colis-v1"] || "").indexOf("3480") !== -1);

  // CSV round-trip avec nouvelles colonnes
  var csv = csvBuild();
  T("CSV : en-têtes Subsidiaire + LQ", csv.indexOf("Subsidiaire") !== -1 && csv.indexOf("LQ") !== -1);
  T("CSV : risque subsidiaire exporté", csv.indexOf("5.1") !== -1);
  T("CSV BOM + point-virgule", csv.charCodeAt(0) === 0xFEFF && csv.indexOf(";") !== -1);
  COLIS = [];
  csvImport(csv);
  T("import CSV : 3 colis", COLIS.length === 3);
  T("import CSV : UN + CAO", COLIS[0].un === "3480" && COLIS[0].cao === true);
  T("import CSV : sub 5.1 conservé", COLIS[2].sub === "5.1");

  // XLSX : structure zip valide (stockée)
  var blob = xlsxBuild();
  T("xlsxBuild retourne un Blob", typeof blob === "object" && blob.size > 1000);
  function blobBytes(b){
    var out = Buffer.alloc(b.size), pos = 0;
    b.parts.forEach(function(p){ var u = p instanceof Uint8Array ? Buffer.from(p) : Buffer.from(p); u.copy(out, pos); pos += u.length; });
    return out;
  }
  var x = blobBytes(blob);
  T("xlsx signature PK\\x03\\x04", x[0] === 0x50 && x[1] === 0x4b && x[2] === 0x03 && x[3] === 0x04);
  T("xlsx EOCD en fin", x.slice(-22)[0] === 0x50 && x.slice(-22)[1] === 0x4b && x.slice(-22)[2] === 0x05);

  // XLSX : relire son propre export via le parseur maison (zipEntries + parseXlsxRows)
  var abX = x.buffer.slice(x.byteOffset, x.byteOffset + x.byteLength);
  var rowsX = await parseXlsxRows(abX);
  T("parseXlsxRows : 4 lignes (en-tête + 3)", rowsX.length === 4);
  T("parseXlsxRows : inlineStr lus", rowsX[0].join(";").indexOf("Subsidiaire") !== -1 && String(rowsX[1][1]) === "3480");
  T("parseXlsxRows : colonne sub", String(rowsX[3][4]) === "5.1");

  // XLSX déflatté (method 8) : end-to-end avec DecompressionStream
  var CRCT = [];
  for (var nn = 0; nn < 256; nn++) { var cc = nn; for (var kk = 0; kk < 8; kk++) cc = (cc & 1) ? (0xedb88320 ^ (cc >>> 1)) : (cc >>> 1); CRCT[nn] = cc >>> 0; }
  function crc32Buf(b){ var c = 0xffffffff; for (var ii = 0; ii < b.length; ii++) c = CRCT[(c ^ b[ii]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  function zipDeflate(files){
    var parts = [], central = [], offset = 0;
    files.forEach(function(f){
      var name = Buffer.from(f.name, "utf8");
      var raw = Buffer.from(f.data, "utf8");
      var data = zlib.deflateRawSync(raw);
      var crc = crc32Buf(raw);
      var local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6); local.writeUInt16LE(8, 8);
      local.writeUInt16LE(0, 10); local.writeUInt16LE(0, 12); local.writeUInt32LE(crc, 14);
      local.writeUInt32LE(data.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
      parts.push(local, name, data);
      var cen = Buffer.alloc(46);
      cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(8, 10);
      cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(data.length, 20); cen.writeUInt32LE(raw.length, 24);
      cen.writeUInt16LE(name.length, 28); cen.writeUInt32LE(offset, 42);
      central.push(cen, name);
      offset += 30 + name.length + data.length;
    });
    var cdSize = central.reduce(function(s, p){ return s + p.length; }, 0);
    var eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(files.length, 8); eocd.writeUInt16LE(files.length, 10);
    eocd.writeUInt32LE(cdSize, 12); eocd.writeUInt32LE(offset, 16);
    return Buffer.concat(parts.concat(central, [eocd]));
  }
  var sheetXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'
    + '<row r="1"><c r="A1" t="inlineStr"><is><t>Article</t></is></c><c r="B1" t="inlineStr"><is><t>Detail</t></is></c></row>'
    + '<row r="2"><c r="A2" t="s"><v>0</v></c><c r="B2"><v>42</v></c></row>'
    + '</sheetData></worksheet>';
  var ssXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="1" uniqueCount="1"><si><t>Bidon essence 5 L</t></si></sst>';
  var xz = zipDeflate([
    { name: "xl/sharedStrings.xml", data: ssXml },
    { name: "xl/worksheets/sheet1.xml", data: sheetXml }
  ]);
  var abz = xz.buffer.slice(xz.byteOffset, xz.byteOffset + xz.byteLength);
  var rowsZ = await parseXlsxRows(abz);
  T("xlsx déflatté : sharedStrings décodé", rowsZ.length === 2 && rowsZ[1][0] === "Bidon essence 5 L");
  T("xlsx déflatté : valeur numérique + inlineStr", rowsZ[1][1] === "42" && rowsZ[0][0] === "Article");

  // ---- Analyse : détection automatique ----
  var props = analyseRows([
    ["Article", "Qté", "Colis"],
    ["Bidon d'essence sans plomb 5 L", "1", "C1"],
    ["Groupe électrogène 2000 W", "1", "C2"],
    ["Batterie lithium-ion 98 Wh UN 3480", "2", "C3"],
    ["Bouteille oxygène médical", "1", "C4"],
    ["Glace carbonique (dry ice) 3 kg", "1", "C5"],
    ["Riz basmati 10 kg", "4", "C6"],
    ["Aérosols spray 400 ml", "12", "C7"]
  ]);
  T("analyse : 6 matières détectées + 1 non réglementée (en-tête ignoré)", props.length === 7 && props.filter(function(p){ return !p.none; }).length === 6);
  T("analyse : essence → 1203", props[0].un === "1203" && props[0].cl.indexOf("3") !== -1);
  T("analyse : groupe électrogène → 3528", props[1].un === "3528");
  T("analyse : UN 3480 détecté par n°", props[2].un === "3480" && props[2].how === "n° ONU");
  T("analyse : oxygène → 1072 + packAdvice", props[3].un === "1072" && props[3].pack.length > 0);
  T("analyse : glace carbonique → 1845 + mention LTA", props[4].un === "1845" && props[4].docs.join(" ").indexOf("LTA") !== -1);
  T("analyse : riz non réglementé", props[5].none === true);
  T("analyse : aérosols → 1950 + packAdvice", props[6].un === "1950");
  T("analyse : 3480 → proposition CAO", props[2].cao === true);
  PROPS = props;
  renderAnalyse();
  T("renderAnalyse : affiche les propositions", els["a-out"].innerHTML.indexOf("UN 1203") !== -1 && els["a-out"].innerHTML.indexOf("UN 3528") !== -1);
  var added = addProposal(props[0]);
  T("addProposal : colis créé depuis proposition", COLIS.some(function(c){ return c.id === added.id && c.un === "1203"; }));
  COLIS = COLIS.filter(function(c){ return c.id !== added.id; });

  // Analyse CSV texte (le flux réel du téléphone)
  var csvTxt = "Article;Qté\nBouteille propane 400g;2\nExtincteur 6kg;1\nBidon gasoil 10 L;1\n";
  var props2 = analyseRows(parseCsvRows(csvTxt));
  T("analyse CSV : propane → 1978", props2[0].un === "1978");
  T("analyse CSV : extincteur → 1044", props2[1].un === "1044");
  T("analyse CSV : gasoil → 1202", props2[2].un === "1202");

  // ---- DGD multi-lignes ----
  T("DGD_LINES initialisée", DGD_LINES.length === 1 && typeof renderDgd === "function");
  dgdFromColis(COLIS[0]);
  T("dgdFromColis : ajoute une ligne (et remplit l'en-tête)", DGD_LINES.length === 2 && els["d-ship"].value === "BMPM Marseille");
  dgdFromColis(COLIS[1], true);
  T("dgdFromColis : 2 lignes au total", DGD_LINES.length === 3);
  var dgdH = els["dgd-preview"].innerHTML;
  T("DGD rendue : les 2 matières au tableau", dgdH.indexOf("3480") !== -1 && dgdH.indexOf("1203") !== -1);
  T("DGD rendue : mention CARGO AIRCRAFT ONLY (ligne 3480)", dgdH.indexOf("CARGO AIRCRAFT ONLY") !== -1);
  T("DGD rendue : déclaration IATA", dgdH.indexOf("fully and accurately described") !== -1);
  T("DGD rendue : contact 24h/24 + case NON-RADIOACTIVE", dgdH.indexOf("NON-RADIOACTIVE") !== -1 && dgdH.indexOf("Emergency contact") !== -1);
  var dgdTxt = dgdLineText();
  T("dgdLineText : les 2 lignes", dgdTxt.indexOf("UN 3480") !== -1 && dgdTxt.indexOf("UN 1203") !== -1);
  DGD_LINES = [{ un:"", psn:"", cl:"", sub:"", pg:"", qty:"", pkg:"", pi:"", auth:"", type:"" }];
  dgdFromColisAll();
  T("dgdFromColisAll : 1 ligne par colis enregistré", DGD_LINES.length === 1 + COLIS.length);
  renderDgdLines();
  var dlch = els["d-lines"].children;
  T("renderDgdLines : champs par ligne générés", dlch.length >= DGD_LINES.length && dlch[dlch.length - 1].innerHTML.indexOf("data-ix") !== -1);

  // printLabel
  printLabel(COLIS[0]);
  T("print-label rempli avec UN + PSN", els["print-label"].innerHTML.indexOf("UN 3480") !== -1 && els["print-label"].innerHTML.indexOf("BMPM Marseille") !== -1);

  // checkVersion offline : ne doit pas crasher
  try { checkVersion(); T("checkVersion offline sans crash", true); } catch (e) { T("checkVersion offline sans crash : " + e.message, false); }

  // Recherche fusionnée fiches + base
  var nF = 0; Object.keys(DBX).forEach(function(u){ if(norm(u + " " + DBX[u].psn).indexOf("essence") !== -1) nF++; });
  T("recherche normalisée (accents) fonctionne sur la base", nF > 0);
  T("norm() retire les accents", norm("ÉTHANOL à brûler") === "ethanol a bruler");

  // ---- workflow / icônes ----
  var yml = fs.readFileSync(path.join(DIR, ".github/workflows/pages.yml"), "utf8");
  T("workflow path sous with:", yml.indexOf('path: "."') !== -1);
  var r = cp.spawnSync("node", ["tools/gen-icons.js"], { cwd: DIR });
  T("gen-icons exécuté", r.status === 0);

  console.log("\n" + (total - fails) + "/" + total + " tests OK" + (fails ? " — " + fails + " ÉCHEC(S)" : ""));
  process.exit(fails ? 1 : 0);
}
main().catch(function(e){ console.error("HARNAIS CRASH: " + e.stack); process.exit(2); });
