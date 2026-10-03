// Harnais de tests — Assistant IATA MDD v1
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
T("manifest lié", html.indexOf('href="manifest.webmanifest"') !== -1);
T("service worker enregistré", html.indexOf("serviceWorker") !== -1);
T("7 onglets présents", ["tab-rech","tab-piles","tab-gaz","tab-essence","tab-classes","tab-marquage","tab-dgd"].every(function(id){ return html.indexOf('id="'+id+'"') !== -1; }));

var m = html.match(/<script>([\s\S]*?)<\/script>/);
T("script inline présent", !!m);
var script = m[1];

function makeEl() {
  return {
    children: [], innerHTML: "", textContent: "", value: "",
    addEventListener: function(){}, appendChild: function(c){this.children.push(c)},
    classList: { add:function(){}, remove:function(){}, contains:function(){return false} },
    querySelectorAll: function(){ return { forEach: function(){} } }
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

T("≥ 25 fiches", typeof FICHES === "object" && FICHES.length >= 25);
var un = FICHES.map(function (f) { return f.un; });
["3480","3481","3090","3091","2794","2800","3171","1072","1002","1950","1044","2990","1203","1202","3528","3356","1057"].forEach(function (u) {
  T("fiche UN " + u, un.indexOf(u) !== -1);
});
FICHES.forEach(function (f) {
  T("fiche UN " + f.un + " complète", !!(f.psn && f.cl && f.pi && f.lbl && f.pax && f.cargo && f.notes));
});
T("9 classes", CLASSES.length === 9);

getEl("q").value = "lithium";
search();
T("recherche lithium retourne des fiches", getEl("results").children.length >= 1);
T("recherche 1072 ok", FICHES.filter(function(f){return (f.un+" "+f.psn).toLowerCase().indexOf("1072")!==-1}).length === 1);

getEl("wh-ah").value = "4"; getEl("wh-v").value = "14.4"; wh();
T("Wh 4×14.4 ≈ 57.6", getEl("wh-out").textContent.indexOf("57.6") !== -1);
getEl("wh-ah").value = "10"; getEl("wh-v").value = "20"; wh();
T("Wh 200 → pleinement réglementée", getEl("wh-class").textContent.indexOf("pleinement réglement") !== -1);

try { new Function(fs.readFileSync(path.join(DIR, "sw.js"), "utf8")); T("sw.js syntaxe OK", true); } catch (e) { T("sw.js syntaxe OK : " + e.message, false); }
try { JSON.parse(fs.readFileSync(path.join(DIR, "manifest.webmanifest"), "utf8")); T("manifest JSON valide", true); } catch (e) { T("manifest JSON valide : " + e.message, false); }
var cp = require("child_process");
var r = cp.spawnSync("node", ["tools/gen-icons.js"], { cwd: DIR });
T("gen-icons exécuté", r.status === 0);
T("icon-192.png créé", fs.existsSync(path.join(DIR, "icon-192.png")));
T("icon-512.png créé", fs.existsSync(path.join(DIR, "icon-512.png")));
var png192 = fs.readFileSync(path.join(DIR, "icon-192.png"));
T("icon-192.png est un PNG", png192[0] === 0x89 && png192[1] === 0x50);

var yml = fs.readFileSync(path.join(DIR, ".github/workflows/pages.yml"), "utf8");
T("upload-pages-artifact path sous with:", yml.indexOf('with:\n          path: ".")') !== -1 || yml.indexOf("with:\n          path: \".\"") !== -1);
T("branche main", yml.indexOf("branches: [main]") !== -1);

console.log("\n" + (total - fails) + "/" + total + " tests OK" + (fails ? " — " + fails + " ÉCHEC(S)" : ""));
process.exit(fails ? 1 : 0);
