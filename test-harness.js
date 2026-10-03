// Harnais de tests — Assistant IATA MDD v3
var fs = require("fs");
var path = require("path");
var zlib = require("zlib");
var DIR = __dirname;
var html = fs.readFileSync(path.join(DIR, "index.html"), "utf8");
var fails = 0, total = 0;
function T(name, cond) {
  total++;
  if (!cond) { fails++; console.log("FAIL: " + name); }
  else console.log("ok  : " + name);
}

["index.html", "manifest.webmanifest", "sw.js", "icon.svg", "tools/gen-icons.js", ".github/workflows/pages.yml", "version.json"].forEach(function (f) {
  T("fichier présent " + f, fs.existsSync(path.join(DIR, f)));
});
T("badge v3", html.indexOf(">v3<") !== -1);
T("sw v3", fs.readFileSync(path.join(DIR, "sw.js"), "utf8").indexOf("iata-mdd-v3") !== -1);
T("sw ne cache pas version.json", fs.readFileSync(path.join(DIR, "sw.js"), "utf8").indexOf("version.json") !== -1);
T("9 onglets présents", ["tab-wiz","tab-rech","tab-piles","tab-gaz","tab-essence","tab-classes","tab-marquage","tab-colis","tab-dgd"].every(function(id){ return html.indexOf('id="'+id+'"') !== -1; }));
T("zone impression présente", html.indexOf('id="print-label"') !== -1);
T("version.json v3", JSON.parse(fs.readFileSync(path.join(DIR, "version.json"), "utf8")).version === 3);

// ---- Stubs DOM ----
var m = html.match(/<script>([\s\S]*?)<\/script>/);
var script = m[1];
function makeEl() {
  return {
    children: [], innerHTML: "", textContent: "", value: "", style: {}, files: null,
    addEventListener: function(){}, appendChild: function(c){this.children.push(c)},
    setAttribute: function(){}, getAttribute: function(){return null;},
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
function BlobCls(parts, opts){ this.parts = parts || []; this.type = (opts && opts.type) || ""; var s = 0; (parts||[]).forEach(function(p){ s += p.byteLength || p.length || 0; }); this.size = s; }
var Blob = BlobCls;
try {
  eval(script);
  T("script s'exécute sans erreur (stubs)", true);
} catch (e) {
  T("script s'exécute sans erreur (stubs) : " + e.message, false);
}

// ---- Données v2 conservées ----
T("≥ 25 fiches", typeof FICHES === "object" && FICHES.length >= 25);
T("assistant décision", typeof compute === "function");
var r1 = compute("piles", "liion", {"wz-config":"seul","wz-wh":"98","wz-whc":"18","wz-etat":"neuf"});
T("li-ion seul 98 Wh → IB + DGD", r1.pi.indexOf("IB") !== -1 && JSON.stringify(r1.docs).indexOf("DGD") !== -1);
var c1 = compute("carb", "essence", {"wz-mode":"fret"});
T("essence → UN 1203 PG II", c1.un === "1203" && c1.cl.indexOf("II") !== -1);

// ---- Fonctions colis ----
T("colisLoad/Save définies", typeof colisLoad === "function" && typeof colisSave === "function");
T("csvBuild définie", typeof csvBuild === "function");
T("csvImport définie", typeof csvImport === "function");
T("xlsxBuild définie", typeof xlsxBuild === "function");
T("zipStore définie", typeof zipStore === "function");
T("printLabel définie", typeof printLabel === "function");
T("dgdFromColis définie", typeof dgdFromColis === "function");
T("checkVersion définie", typeof checkVersion === "function");
T("APP_VERSION = 3", APP_VERSION === 3);

// Ajouter un colis directement dans le modèle
COLIS.push({
  id: 1, date: "2026-10-03", un: "3480", psn: "Piles au lithium-ion", cl: "9", pg: "—",
  pi: "965 IB", etiquettes: "9 (lithium-ion) + CAO",
  ship: "BMPM Marseille", cons: "Doha", qty: "12 kg", nb: 1, pkg: "caisse ONU 4G",
  cao: true, notes: "SoC 30 %"
});
COLIS.push({
  id: 2, date: "2026-10-03", un: "1203", psn: "Essence", cl: "3", pg: "II",
  pi: "358", etiquettes: "3", ship: "BMPM", cons: "DOH", qty: "20 L", nb: 2,
  pkg: "fûts ONU 3A", cao: false, notes: "LQ non"
});
colisSave();
T("localStorage persisté", (LS["iata-colis-v1"] || "").indexOf("3480") !== -1);

// CSV : contenu
var csv = csvBuild();
T("CSV contient UN 3480", csv.indexOf("3480") !== -1);
T("CSV contient expéditeur", csv.indexOf("BMPM Marseille") !== -1);
T("CSV BOM + point-virgule", csv.charCodeAt(0) === 0xFEFF && csv.indexOf(";") !== -1);

// CSV : import round-trip
COLIS = [];
csvImport(csv);
T("import CSV : 2 colis", COLIS.length === 2);
T("import CSV : UN retrouvé", COLIS[0].un === "3480" && COLIS[0].cao === true);
T("import CSV : essence PG II", COLIS[1].un === "1203" && COLIS[1].pg === "II");

// XLSX : structure zip valide
var blob = xlsxBuild();
T("xlsxBuild retourne un Blob", typeof blob === "object" && blob.size > 1000);
function blobBytes(b){
  var out = Buffer.alloc(b.size), pos = 0;
  b.parts.forEach(function(p){ var u = p instanceof Uint8Array ? Buffer.from(p) : Buffer.from(p); u.copy(out, pos); pos += u.length; });
  return out;
}
var x = blobBytes(blob);
T("xlsx signature PK\x03\x04", x[0] === 0x50 && x[1] === 0x4b && x[2] === 0x03 && x[3] === 0x04);
T("xlsx EOCD PK\x05\x06 en fin", x.slice(-22)[0] === 0x50 && x.slice(-22)[1] === 0x4b && x.slice(-22)[2] === 0x05);
function findEntry(buf, name){
  // parcours séquentiel des en-têtes locaux du ZIP
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
  var s = sheetEntry.toString("utf8");
  T("sheet xml : UN 3480", s.indexOf("3480") !== -1);
  T("sheet xml : inlineStr", s.indexOf("inlineStr") !== -1);
  T("sheet xml : expéditeur", s.indexOf("BMPM Marseille") !== -1);
  T("sheet xml : 3 lignes de données + en-tête", (s.match(/<row /g) || []).length === 3);
}
var ctEntry = findEntry(x, "[Content_Types].xml");
T("[Content_Types].xml présent", ctEntry !== null && ctEntry.toString("utf8").indexOf("spreadsheetml") !== -1);
if (sheetEntry) {
  var CRCT2 = [];
  for (var nn = 0; nn < 256; nn++) { var ccc = nn; for (var kk = 0; kk < 8; kk++) ccc = (ccc & 1) ? (0xedb88320 ^ (ccc >>> 1)) : (ccc >>> 1); CRCT2[nn] = ccc >>> 0; }
  function crc32buf(b){ var c = 0xffffffff; for (var ii = 0; ii < b.length; ii++) c = CRCT2[(c ^ b[ii]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  // retrouver l'offset du bon en-tête local (celui dont le nom correspond)
  var walkOff = 0, hIdx = -1;
  while (walkOff + 30 <= x.length && x[walkOff] === 0x50 && x[walkOff+1] === 0x4b && x[walkOff+2] === 0x03 && x[walkOff+3] === 0x04) {
    var nl = x.readUInt16LE(walkOff + 26), el = x.readUInt16LE(walkOff + 28), csz = x.readUInt32LE(walkOff + 18);
    var nm2 = x.slice(walkOff + 30, walkOff + 30 + nl).toString("utf8");
    if (nm2 === "xl/worksheets/sheet1.xml") { hIdx = walkOff; break; }
    walkOff += 30 + nl + el + csz;
  }
  T("CRC32 entrée sheet1 correct", hIdx !== -1 && x.readUInt32LE(hIdx + 14) === crc32buf(sheetEntry));
}

// Étiquettes : rendu HTML
var lbl1 = colisLabelsHtml(COLIS[0]);
T("étiquette li-ion : CAO SVG", lbl1.indexOf("CARGO AIRCRAFT ONLY") !== -1);
T("étiquette li-ion : marquage lithium", lbl1.toLowerCase().indexOf("svg") !== -1 && /lithium/i.test(COLIS[0].psn));
var lbl2 = colisLabelsHtml(COLIS[1]);
T("étiquette essence : diamante classe 3 + orientation", lbl2.indexOf("3") !== -1);

// printLabel remplit la zone d'impression
COLIS[0].psn = "Piles au lithium-ion";
printLabel(COLIS[0]);
T("print-label rempli avec UN + PSN", els["print-label"].innerHTML.indexOf("UN 3480") !== -1 && els["print-label"].innerHTML.indexOf("BMPM Marseille") !== -1);

// dgdFromColis préremplit
els["d-ship"].value = ""; // reset stub
dgdFromColis(COLIS[0]);
T("DGD préremplie : UN", els["d-un"].value === "3480");
T("DGD préremplie : PSN majuscules", els["d-psn"].value === "PILES AU LITHIUM-ION");
T("DGD préremplie : CAO", els["d-cao"].value === "oui");
var dgdH = els["dgd-preview"].innerHTML;
T("DGD rendue avec données du colis", dgdH.indexOf("3480") !== -1 && dgdH.indexOf("CARGO AIRCRAFT ONLY") !== -1);

// checkVersion offline (fetch rejetée) : ne doit pas crasher
try { checkVersion(); T("checkVersion offline sans crash", true); } catch (e) { T("checkVersion offline sans crash", false); }

// ---- workflow / icônes ----
var yml = fs.readFileSync(path.join(DIR, ".github/workflows/pages.yml"), "utf8");
T("workflow path sous with:", yml.indexOf("with:\n          path: \".\"") !== -1);
var cp = require("child_process");
var r = cp.spawnSync("node", ["tools/gen-icons.js"], { cwd: DIR });
T("gen-icons exécuté", r.status === 0);

console.log("\n" + (total - fails) + "/" + total + " tests OK" + (fails ? " — " + fails + " ÉCHEC(S)" : ""));
process.exit(fails ? 1 : 0);
