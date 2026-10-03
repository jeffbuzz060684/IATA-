// Harnais de tests — Assistant IATA MDD v2
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

["index.html", "manifest.webmanifest", "sw.js", "icon.svg", "tools/gen-icons.js", ".github/workflows/pages.yml"].forEach(function (f) {
  T("fichier présent " + f, fs.existsSync(path.join(DIR, f)));
});

T("doctype", /^<!DOCTYPE html>/i.test(html));
T("lang fr", html.indexOf('lang="fr"') !== -1);
T("badge v2", html.indexOf(">v2<") !== -1);
T("8 onglets présents", ["tab-wiz","tab-rech","tab-piles","tab-gaz","tab-essence","tab-classes","tab-marquage","tab-dgd"].every(function(id){ return html.indexOf('id="'+id+'"') !== -1; }));
T("sw v2", fs.readFileSync(path.join(DIR, "sw.js"), "utf8").indexOf("iata-mdd-v2") !== -1);

// ---- Stubs DOM + exécution du script ----
var m = html.match(/<script>([\s\S]*?)<\/script>/);
T("script inline présent", !!m);
var script = m[1];

var storage = {};
function makeEl() {
  return {
    children: [], innerHTML: "", textContent: "", value: "", style: {},
    addEventListener: function(){}, appendChild: function(c){this.children.push(c)},
    querySelectorAll: function(){ return { forEach: function(){} }; },
    classList: { add:function(){}, remove:function(){}, contains:function(){return false} }
  };
}
var els = {};
function getEl(id) { if (!els[id]) els[id] = makeEl(); return els[id]; }
var document = {
  getElementById: getEl,
  querySelectorAll: function () { return { forEach: function () {} }; },
  createElement: function () { return makeEl(); }
};
var window = { scrollTo: function () {} };
try {
  eval(script);
  T("script s'exécute sans erreur (stubs)", true);
} catch (e) {
  T("script s'exécute sans erreur (stubs) : " + e.message, false);
}

// ---- Données ----
T("≥ 25 fiches", typeof FICHES === "object" && FICHES.length >= 25);
var uns = FICHES.map(function (f) { return f.un; });
["3480","3481","3090","3091","2800","3171","1072","1002","1950","1044","2990","1203","3528","3356","1057"].forEach(function (u) {
  T("fiche UN " + u, uns.indexOf(u) !== -1);
});
T("fiche 3480 : Section II supprimée", FICHES.filter(function(f){return f.un==="3480"})[0].pi.indexOf("IA/IB") !== -1);
T("fiche 3528 : classe 3", FICHES.filter(function(f){return f.un==="3528"})[0].cl.indexOf("3") === 0);
T("9 classes", CLASSES.length === 9);

// ---- Wizard : fonctions de décision ----
T("assistant définie", typeof compute === "function");

// Li-ion seul ≤ 100 Wh → Section IB
var r1 = compute("piles", "liion", {"wz-config":"seul","wz-wh":"98","wz-whc":"18","wz-etat":"neuf"});
T("li-ion seul 98 Wh → UN 3480", r1.un === "3480");
T("li-ion seul 98 Wh → Section IB", r1.pi.indexOf("IB") !== -1);
T("li-ion seul → DGD obligatoire", JSON.stringify(r1.docs).indexOf("DGD") !== -1);
T("li-ion seul → CAO", JSON.stringify(r1.etiquette).indexOf("CARGO AIRCRAFT ONLY") !== -1);

// Li-ion seul > 100 Wh → Section IA
var r2 = compute("piles", "liion", {"wz-config":"seul","wz-wh":"160","wz-etat":"neuf"});
T("li-ion seul 160 Wh → Section IA", r2.pi.indexOf("IA") !== -1);

// Li-ion endommagée → interdit
var r3 = compute("piles", "liion", {"wz-config":"seul","wz-wh":"98","wz-etat":"def"});
T("li-ion endommagée → interdit", r3.tone === "err");

// Li-ion avec équipement 90 Wh → Section II, pas de DGD
var r4 = compute("piles", "liion", {"wz-config":"avec","wz-wh":"90","wz-etat":"neuf"});
T("li-ion avec équipement 90 Wh → UN 3481 § II", r4.pi.indexOf("II") !== -1);
T("li-ion avec équipement 90 Wh → pas de DGD", JSON.stringify(r4.docs).indexOf("Pas de DGD") !== -1);
T("li-ion avec équipement 90 Wh → SoC 2026", JSON.stringify(r4.soc).indexOf("01/01/2026") !== -1);

// Li-ion avec équipement > 100 Wh → Section I
var r5 = compute("piles", "liion", {"wz-config":"dans","wz-wh":"150","wz-etat":"neuf"});
T("li-ion dans équipement 150 Wh → Section I", r5.pi.indexOf("I —") !== -1 || r5.pi.split("—")[1].indexOf("I") !== -1);

// Li-métal seul 0.8 g → IB ; 3090
var r6 = compute("piles", "limetal", {"wz-config":"seul","wz-g":"0.8","wz-gt":"1.6","wz-etat":"neuf"});
T("li-métal seul 0.8g → UN 3090 IB", r6.un === "3090" && r6.pi.indexOf("IB") !== -1);

// Plomb, VRLA, NiMH, véhicule
var r7 = compute("piles", "plomb", {});
T("plomb → UN 2794/2795, classe 8", r7.un.indexOf("2794") !== -1 && r7.cl.indexOf("8") !== -1);
var r8 = compute("piles", "vrla", {});
T("VRLA → UN 2800", r8.un === "2800");
var r9 = compute("piles", "nimh", {});
T("NiMH → pas de DGD", JSON.stringify(r9.docs).indexOf("Pas de DGD") !== -1);
var r10 = compute("piles", "vehicule", {"wz-veh":"li"});
T("véhicule li-ion → UN 3171 PI 952", r10.un === "3171" && r10.pi.indexOf("952") !== -1);

// Gaz
var g1 = compute("gaz", "o2", {"wz-o2use":"fret"});
T("O₂ fret → UN 1072, 5.1 obligatoire", g1.un === "1072" && JSON.stringify(g1.etiquette).indexOf("5.1") !== -1);
var g2 = compute("gaz", "air", {});
T("air → UN 1002, sans 5.1", g2.un === "1002" && JSON.stringify(g2.etiquette).indexOf("2.2 uniquement") !== -1);
var g3 = compute("gaz", "aerosol", {"wz-vol":"0.5"});
T("aérosol 0.5 L → LQ Y203 pas de DGD", g3.pi.indexOf("Y203") !== -1 && JSON.stringify(g3.docs).indexOf("Pas de DGD") !== -1);
var g4 = compute("gaz", "extincteur", {});
T("extincteur → UN 1044", g4.un === "1044");

// Carburants
var c1 = compute("carb", "essence", {"wz-mode":"fret"});
T("essence fret → UN 1203 PG II PI 358", c1.un === "1203" && c1.cl.indexOf("II") !== -1 && c1.pi.indexOf("358") !== -1);
var c2 = compute("carb", "essence", {"wz-mode":"bag"});
T("essence bagage → interdit", c2.tone === "err");
var c3 = compute("carb", "moteur", {});
T("moteur → UN 3528 classe 3", c3.un === "3528" && c3.cl.indexOf("3") !== -1);
var c4 = compute("carb", "gasoil", {});
T("gasoil → UN 1202", c4.un === "1202");

// Gilets
var j1 = compute("gilet", "mousse", {});
T("gilet mousse → OK sans restriction", j1.tone === "ok");
var j2 = compute("gilet", "co2", {});
T("gilet CO₂ → UN 2990 accord", j2.un === "2990" && JSON.stringify(j2.autor).indexOf("Accord") !== -1);
var j3 = compute("gilet", "fusees", {});
T("gilet fusées → 1.4G accord obligatoire", j3.un.indexOf("0191") !== -1 && j3.cl.indexOf("1.4G") !== -1);
var j4 = compute("gilet", "pile", {});
T("gilet avec pile → UN 3481 § II", j4.un.indexOf("3481") !== -1);

// ---- DGD ----
T("renderDgd définie", typeof renderDgd === "function");
["d-ship","d-un","d-psn","d-cl","d-pg","d-pi","d-qty","d-pkg","d-cao","d-sign"].forEach(function(id){
  T("champ DGD " + id, html.indexOf('id="'+id+'"') !== -1);
});
// Remplir et rendre
getEl("d-ship").value = "BMPM Marseille";
getEl("d-cons").value = "DOH";
getEl("d-cie").value = "Qatar Airways";
getEl("d-awb").value = "157-12345675";
getEl("d-dep").value = "MRS";
getEl("d-arr").value = "DOH";
getEl("d-un").value = "3480";
getEl("d-psn").value = "PILES AU LITHIUM-ION";
getEl("d-cl").value = "9";
getEl("d-pg").value = "—";
getEl("d-pi").value = "965 IB";
getEl("d-qty").value = "12 kg";
getEl("d-pkg").value = "1 caisse";
getEl("d-cao").value = "oui";
getEl("d-hi").value = "";
getEl("d-sign").value = "J. FONTAINE";
renderDgd();
var dgdHtml = getEl("dgd-preview").innerHTML;
T("DGD rendue : expéditeur", dgdHtml.indexOf("BMPM Marseille") !== -1);
T("DGD rendue : UN 3480", dgdHtml.indexOf("3480") !== -1);
T("DGD rendue : CARGO AIRCRAFT ONLY", dgdHtml.indexOf("CARGO AIRCRAFT ONLY") !== -1);
T("DGD rendue : déclaration", dgdHtml.indexOf("Je déclare") !== -1);
var lineTxt = getEl("dgd-line").textContent;
T("ligne copiable contient UN + PI", lineTxt.indexOf("UN 3480") !== -1 && lineTxt.indexOf("965 IB") !== -1);

// ---- sw.js / manifest / icônes ----
try { new Function(fs.readFileSync(path.join(DIR, "sw.js"), "utf8")); T("sw.js syntaxe OK", true); } catch (e) { T("sw.js syntaxe OK : " + e.message, false); }
try { JSON.parse(fs.readFileSync(path.join(DIR, "manifest.webmanifest"), "utf8")); T("manifest JSON valide", true); } catch (e) { T("manifest JSON valide : " + e.message, false); }
var cp = require("child_process");
var r = cp.spawnSync("node", ["tools/gen-icons.js"], { cwd: DIR });
T("gen-icons exécuté", r.status === 0);
T("icon-192.png PNG", fs.readFileSync(path.join(DIR, "icon-192.png"))[0] === 0x89);

var yml = fs.readFileSync(path.join(DIR, ".github/workflows/pages.yml"), "utf8");
T("workflow path sous with:", yml.indexOf("with:\n          path: \".\"") !== -1);

console.log("\n" + (total - fails) + "/" + total + " tests OK" + (fails ? " — " + fails + " ÉCHEC(S)" : ""));
process.exit(fails ? 1 : 0);
