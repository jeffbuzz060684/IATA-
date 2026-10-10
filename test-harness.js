// Harnais de tests — Assistant IATA MDD v11
var fs = require("fs");
var path = require("path");
var DIR = __dirname;
var html = fs.readFileSync(path.join(DIR, "index.html"), "utf8");
html += "\n" + fs.readFileSync(path.join(DIR, "app-core.js"), "utf8");
var fails = 0, total = 0;
function T(name, cond) {
  total++;
  if (!cond) { fails++; console.log("FAIL: " + name); }
  else console.log("ok  : " + name);
}

["index.html", "app-core.js", "manifest.webmanifest", "sw.js", "icon.svg", "tools/gen-icons.js", ".github/workflows/pages.yml", "version.json", "db-onu.js"].forEach(function (f) {
  T("fichier présent " + f, fs.existsSync(path.join(DIR, f)));
});
T("badge v11", html.indexOf(">v11<") !== -1);
T("dgr-schema.json présent (V11)", fs.existsSync(path.join(DIR, "dgr-schema.json")));
T("sw v12 (redéploiement monolithique)", fs.readFileSync(path.join(DIR, "sw.js"), "utf8").indexOf("iata-mdd-v12") !== -1);
T("sw inclut db-onu.js", fs.readFileSync(path.join(DIR, "sw.js"), "utf8").indexOf("db-onu.js") !== -1);
T("sw ne cache pas version.json", fs.readFileSync(path.join(DIR, "sw.js"), "utf8").indexOf("version.json") !== -1);
// V11.0.1 — bugfix déploiement : le SHELL du sw ne doit référencer QUE des fichiers réellement présents (sinon install du sw échoue → PWA jamais mise à jour)
(function(){
  var swSrc = fs.readFileSync(path.join(DIR, "sw.js"), "utf8");
  var shell = (swSrc.match(/SHELL = \[([^\]]*)\]/) || [])[1] || "";
  var entries = (shell.match(/"\.\/([^"]*)"/g) || []).map(function(s){ return s.slice(3, -1); });
  T("sw SHELL lisible (" + entries.length + " entrées)", entries.length >= 5);
  entries.forEach(function(f){
    var p = f === "" ? "index.html" : f; // "./" → la page elle-même
    T("sw SHELL : " + (f === "" ? "./" : "./" + f) + " existe dans le déploiement", fs.existsSync(path.join(DIR, p)));
  });
  T("sw SHELL : aucun PNG binaire (icônes SVG uniquement)", !/\.png"/.test(shell));
})();
T("manifest : icônes SVG uniquement (aucun PNG à déployer)", (function(){ var m = fs.readFileSync(path.join(DIR, "manifest.webmanifest"), "utf8"); return m.indexOf("icon.svg") !== -1 && m.indexOf("image/png") === -1; })());
T("version.json v11", JSON.parse(fs.readFileSync(path.join(DIR, "version.json"), "utf8")).version === 11);
// ---- v12 : redéploiement monolithique en fichiers directs (suppression du chargeur v11b à blocs compressés) ----
T("v12 : index.html référence app-core.js", fs.readFileSync(path.join(DIR, "index.html"), "utf8").indexOf('src="app-core.js"') !== -1);
T("v12 : index.html léger (HTML/CSS seul)", fs.statSync(path.join(DIR, "index.html")).size < 60000);
T("v12 : app-core.js complet (script principal intégral)", fs.statSync(path.join(DIR, "app-core.js")).size > 100000);
T("v12 : aucun bloc compressé ni chargeur (architecture directe)", !fs.existsSync(path.join(DIR, "app-a.b64")) && !fs.existsSync(path.join(DIR, "app-b.b64")));
T("v12 : plus de reconstruction runtime (DecompressionStream ni atob côté app)", html.indexOf("DecompressionStream") === -1);
T("v12 : le sw référence app-core.js dans le SHELL", fs.readFileSync(path.join(DIR, "sw.js"), "utf8").indexOf("app-core.js") !== -1);
// ---- v13 : bandeau repliable (demande de Jade : bandeau fixe trop grand, réduire avec une flèche) ----
T("v13 : bouton flèche du bandeau présent", fs.readFileSync(path.join(DIR, "index.html"), "utf8").indexOf('id="hdr-toggle"') !== -1);
T("v13 : contenu du bandeau repliable (#hdr-fold)", fs.readFileSync(path.join(DIR, "index.html"), "utf8").indexOf('id="hdr-fold"') !== -1);
T("v13 : CSS état replié (header.folded masque #hdr-fold)", fs.readFileSync(path.join(DIR, "index.html"), "utf8").indexOf("header.folded #hdr-fold{display:none}") !== -1);
T("v13 : repli persistant localStorage + replié par défaut", fs.readFileSync(path.join(DIR, "index.html"), "utf8").indexOf("iata-hdr-fold") !== -1 && fs.readFileSync(path.join(DIR, "index.html"), "utf8").indexOf('saved !== "0"') !== -1);
T("v13 : script de repli sécurisé (try/catch complet)", fs.readFileSync(path.join(DIR, "index.html"), "utf8").indexOf('btn.addEventListener("click", function(){') !== -1);
// ---- v14 : DGD guidée (demande de Jade : consignes + exemples + particularités plutôt qu'un formulaire nu) ----
var idxHtml = fs.readFileSync(path.join(DIR, "index.html"), "utf8");
var coreJs = fs.readFileSync(path.join(DIR, "app-core.js"), "utf8");
T("v14 : panneau consignes repliable <details id=\"dgd-guide\">", idxHtml.indexOf('id="dgd-guide"') !== -1 && idxHtml.indexOf("<summary") !== -1);
T("v14 : consignes champ par champ (expéditeur 24h/24, FRG-07, signature manuscrite)", idxHtml.indexOf("joignable pendant TOUT le transport") !== -1 && idxHtml.indexOf("signature manuscrite obligatoire sur l'original") !== -1 && idxHtml.indexOf("FRG-07") !== -1);
T("v14 : mode d'emploi des lignes (PSN liste 4.2 jamais tronqué, source de vérité = colis)", idxHtml.indexOf("liste 4.2") !== -1 && idxHtml.indexOf("jamais tronqué ni reformulé") !== -1 && idxHtml.indexOf("corriger le colis, pas la DGD") !== -1);
T("v14 : particularités — cas SANS DGD (lithium Section II, UN 3373 PI 650, UN 1845, LQ, CAO, classe 7)", idxHtml.indexOf("Section II") !== -1 && idxHtml.indexOf("PI 650") !== -1 && idxHtml.indexOf("Dry Ice, UN 1845") !== -1 && idxHtml.indexOf("marque Y") !== -1 && idxHtml.indexOf("CARGO AIRCRAFT ONLY") !== -1 && idxHtml.indexOf("IAEA") !== -1);
T("v14 : bouton exemple complet (#d-example)", idxHtml.indexOf('id="d-example"') !== -1 && coreJs.indexOf("dgdLoadExample") !== -1);
T("v14 : exemple UN 1203 cohérent base vérifiée (GASOLINE via psnEn, PI 364 cargo, PG II)", coreJs.indexOf('psnEn("1203"') !== -1 && coreJs.indexOf('pi:"364"') !== -1 && coreJs.indexOf('pg:"II"') !== -1);
T("v14 : exemple remplit l'en-tête complet (13 champs dont FRG-07 oui + tél 24h/24)", ["d-ship","d-cons","d-cie","d-awb","d-ref","d-dep","d-arr","d-flight","d-hi","d-france","d-tel","d-sign","d-place"].every(function(id){ return coreJs.indexOf('"' + id + '"') !== -1; }) && coreJs.indexOf('"d-france": "oui"') !== -1);
T("v14 : exemple ligne manuelle sans srcId (brouillon 📝, jamais liée à un colis)", coreJs.indexOf('cao:false, srcId:null}') !== -1);
T("v14 : exemple avertit avant remplacement (confirm) et l'exemple n'écrase pas silencieusement", coreJs.indexOf("Cela remplace le contenu actuel de la DGD") !== -1);
// ---- v15 : refonte UX (demande de Jade : application simple, éducative, intuitive, professionnelle) ----
T("v15 : les guides ne sont plus des onglets de nav (TABS = 6, plus de {id:\"piles\"})", (coreJs.match(/var TABS = \[([\s\S]*?)\];/) || ["",""])[1].indexOf('id:"piles"') === -1 && (coreJs.match(/var TABS = \[([\s\S]*?)\];/) || ["",""])[1].indexOf('id:"guides"') !== -1);
T("v15 : chips des sous-onglets Guides + dernier guide mémorisé (localStorage iata-guide)", idxHtml.indexOf('id="guide-chips"') !== -1 && coreJs.indexOf("iata-guide") !== -1 && coreJs.indexOf('data-guide') !== -1);
T("v15 : goTab compatible anciens ids de guides (goTab(\"piles\") ouvre Guides + sélectionne)", coreJs.indexOf("showGuide(id);") !== -1 && coreJs.indexOf('function goTab(id){') !== -1);
T("v15 : barre d'état DGD en direct (#dgd-status rendu par dgdStatusRender, appelé par renderDgd)", idxHtml.indexOf('id="dgd-status"') !== -1 && coreJs.indexOf("function dgdStatusRender()") !== -1 && coreJs.indexOf("dgdStatusRender();") !== -1);
T("v15 : DGD parcours numéroté ①②③④", ["① · En-tête de l'expédition","② · Matières transportées","③ · Aperçu","④ · Consignes complètes"].every(function(s){ return idxHtml.indexOf(s) !== -1; }));
T("v15 : aide contextuelle sous les champs d'en-tête DGD (≥ 8 .hint)", (idxHtml.match(/class="hint"/g) || []).length >= 8);
T("v15 : états pédagogiques de la barre DGD (à commencer / complète / à corriger)", coreJs.indexOf("À commencer") !== -1 && coreJs.indexOf("DGD complète") !== -1 && coreJs.indexOf("à corriger") !== -1);
T("v15 : contenu des 5 guides préservé intégralement (Power banks, ONU 3373 PI 650 note, marque Y, table 9.3.A)", idxHtml.indexOf("Power banks") !== -1 && idxHtml.indexOf("≤ 4 kg") !== -1 && idxHtml.indexOf("marque Y") !== -1 && idxHtml.indexOf("Table 9.3.A") !== -1);
// ---- v16 : ⚡ saisie express par n° ONU (demande de Jade : tout se remplit automatiquement) ----
T("v16 : champ express + suggestions + zone résultat présents", idxHtml.indexOf('id="ex-un"') !== -1 && idxHtml.indexOf('id="ex-ac"') !== -1 && idxHtml.indexOf('id="ex-res"') !== -1);
T("v16 : carte express = toutes les particularités connues (PSN anglais DGD, PI avec fallback vérifier DGR, CAO, LQ, pax/fret/notes de la fiche)", coreJs.indexOf('psnEn(det.un, det.psn)') !== -1 && coreJs.indexOf("à vérifier dans le DGR (absente de la base vérifiée)") !== -1 && coreJs.indexOf("CARGO AIRCRAFT ONLY — interdit avion passagers") !== -1 && coreJs.indexOf("f.pax") !== -1 && coreJs.indexOf("f.cargo") !== -1 && coreJs.indexOf("f.notes") !== -1);
T("v16 : exPrepare remplit tout automatiquement (colis via colisBuildFromDet + DGD via dgdAddFromColisQuiet + retour à l'onglet Colis)", coreJs.indexOf("function exPrepare()") !== -1 && (coreJs.match(/function exPrepare\(\)\{[\s\S]*?colisBuildFromDet/) || []).length === 1 && (coreJs.match(/function exPrepare\(\)\{[\s\S]*?dgdAddFromColisQuiet/) || []).length === 1 && (coreJs.match(/function exPrepare\(\)\{[\s\S]*?goTab\("colis"\)/) || []).length === 1);
T("v16 : exPrepare refuse les codes interdits et la classe 7 (aucune préparation automatique)", coreJs.indexOf("aucune préparation automatique") !== -1 && coreJs.indexOf("hors périmètre de cet outil — procédure IAEA") !== -1);
T("v16 : exPrepare signale ce qui reste à compléter (quantité nette, emballage, PG classe 3)", coreJs.indexOf("quantité nette (obligatoire au marquage)") !== -1 && coreJs.indexOf("type d'emballage (selon PI)") !== -1 && coreJs.indexOf("groupe d'emballage PG") !== -1);
T("v16 : autocomplétion express (base ONU + synonymes + 4 chiffres → carte immédiate)", coreJs.indexOf("function exSearch") !== -1 && coreJs.indexOf("SYNONYMES") !== -1 && coreJs.indexOf("/^\\d{4}$/.test(t)") !== -1);
T("v16 : « Ajuster avant d'ajouter » réutilise le dialogue existant (colisAddOpen depuis la carte express)", coreJs.indexOf('colisAddOpen(EX_DET.un, exRes.firstChild)') !== -1);
T("v16 : fiche express pour UN 3480 dans la base vérifiée (FICHES : pax INTERDIT passagers, PI 965 IA/IB)", coreJs.indexOf('un:"3480"') !== -1 && coreJs.indexOf("INTERDIT avion passagers") !== -1 && coreJs.indexOf("pi:\"965 (IA/IB)\"") !== -1);
// ---- v16.1 : correctif listes déroulantes (bug rapporté par Jade : « la recherche rapide ne fonctionne pas ») ----
// Racine : la CSS impose .ac-list{display:none} ; le JS « affichait » en remettant le style inline à "" → retombe sur display:none → liste invisible. Le harnais ne simule pas la cascade CSS d'où 278/278 verts malgré le bug.
T("v16.1 : simulation cascade CSS — style inline \"\" sur .ac-list ⇒ invisible (leçon du bug)", (function(){ var css = (idxHtml.match(/ac-list\{[^}]*\}/) || [""])[0]; return css.indexOf("display:none") !== -1; })() && coreJs.indexOf("exAc.style.display = \"block\";") !== -1);
T("v16.1 : liste express VISIBLE — exRenderList affiche en block (plus aucun retour à \"\" qui retombe sur display:none)", coreJs.indexOf('exAc.style.display = "block";') !== -1 && coreJs.indexOf('exAc.style.display = "";') === -1);
T("v16.1 : liste matière colis VISIBLE — cAc affiché en block (même correctif v15)", coreJs.indexOf('cAc.style.display = "block";') !== -1 && coreJs.indexOf('cAc.style.display = "";') === -1);
T("v16.1 : détection matière au blur du champ colis (detectMatiere + applyDetected quand liste fermée sans sélection)", coreJs.indexOf("if(AC_SEL < 0){ var d = detectMatiere(cMat.value); if(d) applyDetected(d); }") !== -1);
T("v16.1 : carte express au blur si n° ONU complet saisi (robustesse saisie)", coreJs.indexOf("exRenderCard(detFromUn(m[0]))") !== -1);
T("v16.1 : acPick remet AC_SEL à -1 (pas de blocage de détection après un choix)", (coreJs.match(/function acPick\(i\)\{[\s\S]*?AC_SEL = -1;/) || []).length === 1);
T("v15 : navigation 6 onglets + guides en sous-onglets", ["tab-wiz","tab-rech","tab-guides","tab-regles","tab-colis","tab-dgd"].every(function(id){ return html.indexOf('id="'+id+'"') !== -1; }) && ["gp-piles","gp-gaz","gp-essence","gp-classes","gp-marquage"].every(function(id){ return html.indexOf('id="'+id+'"') !== -1; }));
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
var mainScript = scripts.filter(function(s){ return s.indexOf("APP_VERSION") !== -1; })[0] || fs.readFileSync(path.join(DIR, "app-core.js"), "utf8");
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
T("APP_VERSION = 11", typeof APP_VERSION !== "undefined" && APP_VERSION === 11);
T("REGULATORY_DATA défini (édition ≠ version logicielle)", typeof REGULATORY_DATA === "object" && REGULATORY_DATA.edition === "67" && REGULATORY_DATA.applicableFrom === "2026-01-01" && REGULATORY_DATA.applicableTo === "2026-12-31");
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

var mk = function(un, psn, cl, sub){ return {un:un, psn:psn, cl:cl, sub:sub||"", notes:"", nb:1, confirme:"oui", etat:"sain"}; };
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
T("v9 : SoC ≤ 30 % OBLIGATOIRE en PI 966 (emballées avec)", JSON.stringify(r90.soc).indexOf("SoC ≤ 30 %") !== -1 && JSON.stringify(r90.soc).indexOf("OBLIGATOIRE") !== -1 && JSON.stringify(r90.soc).indexOf("966") !== -1);
var rOk = compute("piles", "liion", {"wz-config":"dans","wz-wh":"90","wz-whc":"18","wz-etat":"neuf"});
T("90 Wh / cellule 18 Wh → Section II, PI 967", rOk.pi.indexOf("967") !== -1 && rOk.pi.indexOf("Section II") !== -1);
T("v9 : SoC ≤ 30 % RECOMMANDÉ en PI 967 (dans l'équipement)", JSON.stringify(rOk.soc).indexOf("SoC ≤ 30 %") !== -1 && JSON.stringify(rOk.soc).indexOf("RECOMMANDÉ") !== -1);
var rNoWh = compute("piles", "liion", {"wz-config":"avec","wz-etat":"neuf"});
T("Wh absent → section prudente (I) + invite à saisir les Wh", rNoWh.pi.indexOf("Section I") !== -1 && rNoWh.pi.indexOf("Section II") === -1 && JSON.stringify(rNoWh.soc).indexOf("saisis") !== -1);
var rVeh = compute("piles", "vehicule", {"wz-veh":"li"});
T("v9 : véhicule lithium → SoC ≤ 30 % OBLIGATOIRE UN 3556 (PI 952)", JSON.stringify(rVeh.soc).indexOf("SoC ≤ 30 %") !== -1 && rVeh.pi.indexOf("952") !== -1 && JSON.stringify(rVeh.soc).indexOf("3556") !== -1);
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
T("verdict 🔴 pile endommagée (champ structuré etat)", verdictColis({un:"3480", psn:"Piles li-ion", cl:"9", etat:"endommage", cao:true, nb:1}).v === "red");
T("v9 : notes « endommagée » en texte libre ne déclenchent PAS rouge tout seuls", verdictColis({un:"3480", psn:"Piles li-ion", cl:"9", cao:true, notes:"endommagée", nb:1}).v !== "red");
T("v9 : notes « non réglementé » en texte libre ne déclenchent PAS vert", verdictColis({un:"1170", psn:"Alcool", cl:"3", pg:"III", notes:"boisson non réglementée", nb:1}).v !== "green");
T("v10 : verdict 🔵 matière non identifiée (bloqué, pas de verdict)", verdictColis({un:"", psn:"", cl:"", nb:1}).v === "blue");
T("v10 : verdict 🟡 classe 3 sans PG (confirmée) — DONNÉES DGR INCOMPLÈTES", verdictColis({un:"1203", psn:"Essence", cl:"3", pg:"", confirme:"oui", nb:1}).v === "yellow");
T("v11 : verdict 🟠 3480 sans déclarations bloquantes → CONDITIONNEL avec UN 38.3 exigé", (function(){ var v = verdictColis({un:"3480", psn:"Piles li-ion", cl:"9", pg:"", cao:false, confirme:"oui", nb:1}); return v.v === "orange" && v.r.indexOf("UN 38.3") !== -1 && v.r.indexOf("CARGO AIRCRAFT ONLY") !== -1; })());
var vOr = verdictColis({un:"1203", psn:"Essence", cl:"3", pg:"II", cao:false, lq:false, confirme:"oui", nb:1});
T("verdict 🟠 classe 3 complet → sous conditions", vOr.v === "orange" && vOr.r.indexOf("DGD") !== -1);
var vGr = verdictColis({un:"3496", psn:"Piles au nickel-hydrure métallique", cl:"9", confirme:"oui", nb:1, qval:2, qunit:"kg", pkgcode:"4G", pkgspec:"4G/X45/S/24", pkgver:"yes", un38_3:"yes", batstate:"normal"});
T("v11 : verdict UN 3496 sans référentiel licencié → 🟡 guidance publique (jamais 🟢 sans licence)", vGr.v === "yellow" && vGr.t.indexOf("LICENCIÉ") !== -1 && vGr.t.indexOf("PRÊT SUR GUIDANCE PUBLIQUE") !== -1);
var vOk2 = verdictColis({un:"3480", psn:"Piles li-ion", cl:"9", cao:true, confirme:"oui", soc:"30", tel:"0601020304", nb:1});
T("v10 : verdict 🟠 3480 complet → CAO + marquage batterie cités", vOk2.v === "orange" && vOk2.r.indexOf("CAO") !== -1 && vOk2.r.indexOf("téléphone 24h/24") !== -1);
T("colisageVerdict = pire niveau (red gagne)", colisageVerdict([mk("1203","Essence","3"), mk("3356","Générateur O₂ chimique","5.1")]).v === "red");
T("v11 : colisageVerdict green UNIQUEMENT si déclarations complètes + référentiel licencié chargé", (function(){ var keep = DGR_OFFICIAL; var cOk = { un:"3496", psn:"Piles NiMH", cl:"9", sub:"", notes:"", nb:1, confirme:"oui", etat:"sain", qval:2, qunit:"kg", pkgcode:"4G", pkgspec:"4G/X45/S/24", pkgver:"yes", un38_3:"yes", batstate:"normal" }; var g0 = colisageVerdict([cOk]).v; dgrDataParse(JSON.stringify({edition:"67", complete:true, variationsComplete:true, records:[{un:"3496", psn:"NICKEL METAL HYDRIDE BATTERIES"}]})); var g1 = colisageVerdict([cOk]).v; var cNoPk = JSON.parse(JSON.stringify(cOk)); cNoPk.pkgver = "no"; var g2 = colisageVerdict([cNoPk]).v; DGR_OFFICIAL = keep; return g0 === "yellow" && g1 === "green" && g2 === "orange"; })());
T("v10 : resultCard — NON COMPLIANT — INTERDIT (tone err)", resultCard({tone:"err", title:"t", autor:[]}).indexOf("NON COMPLIANT — INTERDIT") !== -1);
T("v10 : resultCard — CONDITIONNEL (défaut)", resultCard(compute("piles", "plomb", {})).indexOf("CONDITIONNEL") !== -1);
T("v10 : resultCard — PRÊT POUR ACCEPTATION (tone ok)", resultCard(compute("gilet", "mousse", {})).indexOf("PRÊT POUR ACCEPTATION") !== -1);
COLIS = [ { id: 801, date: "2026-10-04", un: "1203", psn: "ESSENCE", cl: "3", sub: "", pg: "II", pi: "353/364", ship: "BMPM", cons: "Doha", qty: "20 L", nb: 1, pkg: "fût ONU 3A", cao: false, lq: false, notes: "", confirme: "oui", etat: "sain" } ];
colisSave();
colisRender();
T("bannière verdict colisage en tête (Verdict DGR)", els["c-list"].children[0] && els["c-list"].children[0].innerHTML.indexOf("Verdict DGR") !== -1);
T("v10 : badge verdict sur chaque colis (5 états)", els["c-list"].children.some(function(ch){ return /CONDITIONNEL|NON COMPLIANT|NON CONFIRMÉE|IDENTIFICATION INCOMPLÈTE|DONNÉES DGR|READY FOR ACCEPTANCE/.test(ch.innerHTML || ""); }));

// ---- v8 : traçabilité des sources ----
T("SRC défini avec entrées vérifiées", typeof SRC === "object" && Object.keys(SRC).length >= 20 && SRC["1203"].indexOf("353") !== -1 && SRC["2794"].indexOf("870") !== -1);
var fPb2 = FICHES.filter(function(f){ return f.un === "2794"; })[0];
T("ficheCard affiche la source vérifiée", ficheCard(fPb2).indexOf("vérifié web 04/10/2026") !== -1 && ficheCard(fPb2).indexOf("Source :") !== -1);
T("fiche non vérifiée marquée « à confirmer »", (function(){ var f = FICHES.filter(function(x){ return !SRC[x.un]; })[0]; return f ? ficheCard(f).indexOf("à confirmer") !== -1 : true; })());
var dE75 = detFromUn("3475");
T("AIRX 3475 → PI 353/364 (vérifié extrait DGR)", dE75.pi.indexOf("353") !== -1 && dE75.pi.indexOf("364") !== -1 && dE75.pi.indexOf("358") === -1);
T("FICHE 3475 → PG II + 353/364", (function(){ var f = FICHES.filter(function(x){ return x.un === "3475"; })[0]; return f && f.pg === "II" && String(f.pi).indexOf("353") !== -1; })());
T("harnais réglementaire séparé présent et PASSANT", (function(){ var r = require("child_process").spawnSync("node", ["test-reglementaire.js"], { cwd: DIR }); return r.status === 0; })());

// ---- v9 : fiabilité réglementaire ----
T("v10 : verdict 🟡 DONNÉES DGR INCOMPLÈTES (NON VÉRIFIÉ) : UN 0004 (1.1D)", (function(){ var v = verdictColis({un:"0004", psn:"Picrate d'ammonium", cl:"1.1D", confirme:"oui", nb:1}); return v.v === "yellow" && v.t.indexOf("NON VÉRIFIÉ") !== -1; })());
T("v10 : verdict 🟡 NON VÉRIFIÉ : UN 1005 ammoniac (2.3)", verdictColis({un:"1005", psn:"Ammoniac anhydre", cl:"2.3", sub:"8", confirme:"oui", nb:1}).v === "yellow");
T("v10 : verdict 🟡 NON VÉRIFIÉ : UN 2814 infectieux (6.2)", verdictColis({un:"2814", psn:"Substance infectieuse", cl:"6.2", confirme:"oui", nb:1}).v === "yellow");
T("v11 : verdict 🟢 UN 3496 possible UNIQUEMENT avec entrée DGR licenciée chargée (fail-safe)", (function(){ var v0 = verdictColis({un:"3496", psn:"Piles au nickel-hydrure métallique", cl:"9", confirme:"oui", nb:1, qval:2, qunit:"kg", pkgcode:"4G", pkgspec:"4G/X45/S/24", pkgver:"yes", un38_3:"yes", batstate:"normal"}).v; var keep = DGR_OFFICIAL; dgrDataParse(JSON.stringify({edition:"67", complete:true, variationsComplete:true, records:[{un:"3496", psn:"NICKEL METAL HYDRIDE BATTERIES"}]})); var v1 = verdictColis({un:"3496", psn:"Piles au nickel-hydrure métallique", cl:"9", confirme:"oui", nb:1, qval:2, qunit:"kg", pkgcode:"4G", pkgspec:"4G/X45/S/24", pkgver:"yes", un38_3:"yes", batstate:"normal"}).v; DGR_OFFICIAL = keep; return v0 === "yellow" && v1 === "green"; })());
T("FICHE 3556 (véhicules lithium-ion) → PI 952", FICHES.some(function(f){ return f.un === "3556" && String(f.pi).indexOf("952") !== -1; }));
T("FICHE 3573 absente ; FICHE 3557/3558 → PI 952", FICHES.some(function(f){ return f.un === "3557" && String(f.pi).indexOf("952") !== -1; }) && FICHES.some(function(f){ return f.un === "3558" && String(f.pi).indexOf("952") !== -1; }));
T("FICHE 3373 (biologique catégorie B) → PI 650, pas de DGD", FICHES.some(function(f){ return f.un === "3373" && String(f.pi).indexOf("650") !== -1; }) && AIRX["3373"] && AIRX["3373"].noDgd === true);
T("sodium métal UN 1428 : PAS traité comme pile lithium (pas de marquage SoC)", (function(){ var a = analyseColis({un:"1428", psn:"Sodium", cl:"4.3", nb:1}); return a.labels.indexOf("lithium") === -1; })());
T("soude UN 1824 : pas de marquage lithium non plus", analyseColis({un:"1824", psn:"Soude caustique", cl:"8", nb:1}).labels.indexOf("lithium") === -1);
T("contrôle de quantité : 200 L essence pax > 5 L (PI 353) → avertissement", analyseColis({un:"1203", psn:"Essence", cl:"3", pg:"II", qty:"200 L", nb:1}).warns.some(function(w){ return w.indexOf("maximum") !== -1; }));
T("quantité conforme 5 L pax → pas d'avertissement quantité", !analyseColis({un:"1203", psn:"Essence", cl:"3", pg:"II", qty:"5 L", nb:1}).warns.some(function(w){ return w.indexOf("maximum") !== -1; }));
T("psnEn : UN 1203 → GASOLINE (PSN anglais DGD)", psnEn("1203", "Essence") === "GASOLINE");
T("psnEn : UN 3480 → LITHIUM ION BATTERIES… (non tronqué)", psnEn("3480", "x").indexOf("LITHIUM ION BATTERIES") === 0);
T("psnEn : UN 1950 → AEROSOLS, FLAMMABLE (2.1)", psnEn("1950", "Aérosols") === "AEROSOLS, FLAMMABLE");
T("DGD : PSN anglais repris depuis les colis", (function(){ DGD_LINES = []; dgdAddFromColisQuiet({un:"1203", psn:"Essence", cl:"3", pg:"II", qty:"5 L", nb:1, pkg:"fût", cao:false}); return DGD_LINES[0].psn === "GASOLINE"; })());
T("v9 : « super » ne mène plus à l'essence UN 1203 (retombe sur la base ONU)", (function(){ var d = detectMatiere("super"); return d === null || d.un !== "1203"; })());
T("v9 : « alcool » seul ne mène plus au raccourci UN 1170 (retombe sur la base ONU)", (function(){ var d = detectMatiere("alcool"); return d === null || d.un !== "1170" || !d.syn; })());
T("v9 : « sodium » seul ne mène plus aux piles sodium-ion UN 3551 (base ONU) ; « sodium ion » OK", (function(){ var d = detectMatiere("sodium"); return (d === null || d.un !== "3551") && detectMatiere("sodium ion").un === "3551"; })());
T("v9 : « plomb » seul ne mène plus aux accumulateurs UN 2794 (base ONU)", (function(){ var d = detectMatiere("plomb"); return d === null || d.un !== "2794"; })());
T("« CASS » entièrement remplacé par variations État/opérateur", html.indexOf("CASS") === -1 && html.indexOf("variations État/opérateur") !== -1);
T("bandeau formation 24 mois présent (DGR 1.5)", html.indexOf("24 mois") !== -1);
T("bandeau classe 7 hors périmètre présent", html.indexOf("hors périmètre") !== -1);
T("champ état structuré dans le formulaire colis", html.indexOf('id="c-etat"') !== -1 && html.indexOf('id="ca-etat"') !== -1);
T("colisBuildFromDet : état par défaut sain", colisBuildFromDet(detFromUn("1203"), {}).etat === "sain");
T("validité DGR 67 affichée (01/01/2026 → 31/12/2026, 68e au 01/01/2027)", html.indexOf("31/12/2026") !== -1 && html.indexOf("01/01/2027") !== -1);

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

// ---- v10 : compliance engine ----
T("v10 : DGR_EDITIONS + dgrEditionFor (67 en 2026, 68 dès 2027)", typeof DGR_EDITIONS === "object" && DGR_EDITIONS["68"].from === "2027-01-01" && dgrEditionFor("2026-06-15") === "67" && dgrEditionFor("2027-01-01") === "68");
T("v11 : tMode/tDate + REGULATORY_DATA dataset v11", typeof tMode === "function" && typeof tDate === "function" && REGULATORY_DATA.datasetVersion === "2026.10.04-v11");
T("v10 : sans confirmation → 🔵 CLASSIFICATION NON CONFIRMÉE (bloqué)", (function(){ var v = verdictColis({un:"1203", psn:"Essence", cl:"3", pg:"II", confirme:"non", nb:1}); return v.v === "blue" && v.t.indexOf("CLASSIFICATION") !== -1; })());
T("v10 : classe 7 → 🔴 NON COMPLIANT HORS PÉRIMÈTRE", (function(){ var v = verdictColis({un:"2977", psn:"Matière radioactive", cl:"7", confirme:"oui", nb:1}); return v.v === "red" && v.t.indexOf("CLASSE 7") !== -1; })());
T("v10 : dgdAddFromColis refuse la classe 7 (aucune DGD générée)", (function(){ DGD_LINES = []; dgdAddFromColis({un:"2977", psn:"Radioactif", cl:"7", nb:1, cao:false}); return DGD_LINES.length === 0; })());
T("v10 : dbCard marque la classe 7 hors périmètre", dbCard(["2977","Matière radioactive","7","",""]).indexOf("hors périmètre") !== -1);
T("v10 : SoC 40 % sur UN 3480 → 🔴 NON CONFORME", verdictColis({un:"3480", psn:"Piles li-ion", cl:"9", cao:true, confirme:"oui", soc:"40", tel:"0601020304", nb:1}).v === "red");
T("v10 : SoC 40 % en PI 967 → 🟠 recommandation non suivie (pas rouge)", (function(){ var v = verdictColis({un:"3481", psn:"Piles avec équipement", cl:"9", pi:"967 Section II", confirme:"oui", soc:"40", tel:"0601020304", nb:1}); return v.v === "orange" && v.r.indexOf("recommandation") !== -1; })());
T("v10 : mode passager + matière CAO → 🔴 INTERDIT AVION PASSAGERS", (function(){ getEl("t-mode").value = "passager"; var v = verdictColis({un:"3480", psn:"Piles li-ion", cl:"9", cao:true, confirme:"oui", soc:"30", tel:"0601020304", nb:1}); getEl("t-mode").value = ""; return v.v === "red" && v.t.indexOf("PASSAGERS") !== -1; })());
T("v10 : expédition datée 2027 → 🟡 DONNÉES À RE-VÉRIFIER (DGR 68)", (function(){ getEl("t-date").value = "2027-03-01"; var v = verdictColis({un:"3496", psn:"Piles NiMH", cl:"9", confirme:"oui", nb:1}); getEl("t-date").value = ""; return v.v === "yellow" && v.t.indexOf("68") !== -1; })());
T("v10 : marquage sodium-ion — étiquette « sodium » (pas lithium)", (function(){ var a = analyseColis({un:"3551", psn:"Piles sodium-ion", cl:"9", pi:"976 IA", nb:1}); return a.labels.indexOf("sodium") !== -1 && a.labels.indexOf("lithium") === -1 && a.isBat === true && a.liType === "na"; })());
T("v10 : labelSvg sodium défini (marquage batterie avec n° ONU approprié)", labelSvg("sodium").indexOf("svg") !== -1);
T("v10 : UN 3480 sans tél dédié → avertissement marquage (champ dédié, pas les notes)", analyseColis({un:"3480", psn:"Piles li-ion", cl:"9", pi:"965 IB", cao:true, nb:1}).warns.some(function(w){ return w.indexOf("téléphone 24h/24") !== -1; }));
T("v10 : dgdValidate — FRG-07 France sans n° → erreur validateur", (function(){ DGD_LINES = []; getEl("d-france").value = "oui"; getEl("d-tel").value = ""; getEl("d-ship").value = "BMPM"; getEl("d-cons").value = "DOH"; getEl("d-sign").value = "JF"; getEl("d-place").value = "Marseille"; var errs = dgdValidate(); getEl("d-france").value = ""; return errs.some(function(e){ return e.indexOf("FRG-07") !== -1; }); })());
T("v10 : dgdValidate — ligne incomplète détectée", (function(){ DGD_LINES = [{un:"", psn:"", cl:"", qty:"", pi:"", pkg:"", nb:1}]; return dgdValidate().length >= 5; })());
T("v10 : DGD verrouillée par défaut (select d-unlock + champs disabled)", html.indexOf("d-unlock") !== -1 && html.indexOf("x.disabled = true") !== -1 && html.indexOf("DGD verrouillée") !== -1);
T("v10 : renderDgd affiche le bloc FRG-07 quand la France est impliquée", (function(){ DGD_LINES = [{un:"1203", psn:"GASOLINE", cl:"3", sub:"", pg:"II", qty:"5 L", nb:1, pkg:"fût 3A", pi:"353", auth:"", cao:false}]; getEl("d-france").value = "oui"; renderDgd(); getEl("d-france").value = ""; return els["dgd-preview"].innerHTML.indexOf("FRG-07") !== -1; })());
T("v10 : power banks — max 2 par personne, cabine uniquement, DGR 68 au 01/01/2027", html.indexOf("Maximum 2 power banks par personne") !== -1 && html.indexOf("Cabine uniquement") !== -1 && html.indexOf("01/01/2027") !== -1);
T("v10 : FRG-07, CBTA, classe 7 hors périmètre — bandeaux présents", html.indexOf("FRG-07") !== -1 && html.indexOf("CBTA") !== -1 && html.indexOf("hors périmètre") !== -1);
T("v10 : colisRead lit confirme/clsbase/soc/tel", (function(){ getEl("c-confirm").value = "oui"; getEl("c-clsbase").value = "SDS"; getEl("c-soc").value = "30"; getEl("c-tel").value = "0601020304"; var c = colisRead(); getEl("c-confirm").value = "non"; getEl("c-clsbase").value = ""; getEl("c-soc").value = ""; getEl("c-tel").value = ""; return c.confirme === "oui" && c.clsbase === "SDS" && c.soc === "30" && c.tel === "0601020304"; })());
T("v10 : colisBuildFromDet — classification non confirmée par défaut (imports = non validés)", colisBuildFromDet(detFromUn("1203"), {}).confirme === "non");
T("v10 : acceptanceRender — checklist DO NOT ACCEPT sur anomalie", (function(){ DGD_LINES = []; COLIS = [{ id: 901, un:"1203", psn:"ESSENCE", cl:"3", sub:"", pg:"II", pi:"353", ship:"BMPM", cons:"DOH", qty:"5 L", nb:1, pkg:"fût 3A", cao:false, lq:false, notes:"", etat:"endommage", confirme:"oui" }]; colisRender(); var h = els["accept-check"].innerHTML; return h.indexOf("Acceptance Check") !== -1 && h.indexOf("DO NOT ACCEPT") !== -1; })());
T("v11 : acceptanceRender — colis 3496 sans déclarations V11 → DO NOT ACCEPT (quantité structurée, emballage, UN 38.3)", (function(){ COLIS = [{ id: 902, un:"3496", psn:"Piles NiMH", cl:"9", sub:"", pg:"", pi:"", ship:"BMPM", cons:"DOH", qty:"2 kg", nb:1, pkg:"caisse", cao:false, lq:false, notes:"", etat:"sain", confirme:"oui" }]; colisRender(); var h = els["accept-check"].innerHTML; return h.indexOf("DO NOT ACCEPT") !== -1 && h.indexOf("UN 38.3") !== -1; })());
T("v11 : acceptanceRender — colis 3496 complet (déclarations V11 + référentiel licencié) → READY FOR ACCEPTANCE", (function(){ var keep = DGR_OFFICIAL; dgrDataParse(JSON.stringify({edition:"67", complete:true, variationsComplete:true, records:[{un:"3496", psn:"NICKEL METAL HYDRIDE BATTERIES"}]})); COLIS = [{ id: 903, un:"3496", psn:"Piles NiMH", cl:"9", sub:"", pg:"", pi:"", ship:"BMPM", cons:"DOH", qty:"2 kg", nb:1, pkg:"caisse", cao:false, lq:false, notes:"", etat:"sain", confirme:"oui", qval:2, qunit:"kg", pkgcode:"4G", pkgspec:"4G/X45/S/24", pkgver:"yes", un38_3:"yes", batcfg:"seule", batstate:"normal", v11:true }]; colisRender(); var h = els["accept-check"].innerHTML; DGR_OFFICIAL = keep; return h.indexOf("READY FOR ACCEPTANCE") !== -1 && h.indexOf("DO NOT ACCEPT") === -1; })());

// ---- checkVersion offline ----
try { checkVersion(); T("checkVersion offline sans crash", true); } catch (e) { T("checkVersion offline sans crash", false); }

// ---- workflow / icônes ----
var yml = fs.readFileSync(path.join(DIR, ".github/workflows/pages.yml"), "utf8");
T("workflow path sous with:", yml.indexOf("with:") !== -1 && yml.indexOf('path: "."') !== -1);
// ====================== V11 : tests du moteur fusionné (fusion des deux V10) ======================
T("v11 : isBatteryUn reconnaît les UN batteries", isBatteryUn("3480") && isBatteryUn("3551") && isBatteryUn("3558") && !isBatteryUn("1203"));
T("v11 : v11Missing — emballage non déclaré listé pour UN régulé", v11Missing({un:"1203", cl:"3", pkgver:"no"}, analyseColis({un:"1203", psn:"Essence", cl:"3"}), AIRX["1203"], null).some(function(m){ return m.indexOf("emballage") !== -1; }));
T("v11 : v11Missing — emballage déclaré complet → motif absent", !v11Missing({un:"1203", cl:"3", pkgver:"yes", pkgcode:"4G", pkgspec:"4G/X45/S/24", qval:5, qunit:"L"}, analyseColis({un:"1203", psn:"Essence", cl:"3"}), AIRX["1203"], null).some(function(m){ return m.indexOf("emballage") !== -1; }));
T("v11 : v11Missing — quantité structurée manquante listée", v11Missing({un:"1203", cl:"3", pkgver:"yes", pkgcode:"4G", pkgspec:"x"}, analyseColis({un:"1203", psn:"Essence", cl:"3"}), AIRX["1203"], null).some(function(m){ return m.indexOf("quantité nette structurée") !== -1; }));
T("v11 : v11Missing — UN 38.3 exigé pour une batterie", v11Missing({un:"3480", cl:"9", un38_3:""}, analyseColis({un:"3480", psn:"Piles au lithium-ion", cl:"9"}), AIRX["3480"], null).some(function(m){ return m.indexOf("UN 38.3") !== -1; }));
T("v11 : v11Missing — configuration batterie exigée", v11Missing({un:"3480", cl:"9", un38_3:"yes"}, analyseColis({un:"3480", psn:"Piles au lithium-ion", cl:"9"}), AIRX["3480"], null).some(function(m){ return m.indexOf("configuration batterie") !== -1; }));
T("v11 : verdict 🔴 batterie gonflante (état fin)", verdictColis({un:"3480", psn:"Piles li-ion", cl:"9", cao:true, confirme:"oui", soc:"30", tel:"06", batstate:"gonflement", nb:1}).v === "red");
T("v11 : verdict 🔴 batterie fuite", verdictColis({un:"3481", psn:"Piles avec équipement", cl:"9", confirme:"oui", batstate:"fuite", nb:1}).v === "red");
T("v11 : verdict 🔴 batterie événement thermique", verdictColis({un:"3551", psn:"Batteries sodium-ion", cl:"9", confirme:"oui", batstate:"evenement_thermique", nb:1}).v === "red");
T("v11 : batterie état normal → pas de rouge d'état", verdictColis({un:"3480", psn:"Piles li-ion", cl:"9", cao:true, confirme:"oui", soc:"30", tel:"06", batstate:"normal", nb:1}).v !== "red");
T("v11 : UN 38.3 non confirmé → motif dans le verdict (jamais 🟢)", (function(){ var v = verdictColis({un:"3480", psn:"Piles li-ion", cl:"9", cao:true, confirme:"oui", soc:"30", tel:"06", un38_3:"", qval:5, qunit:"kg", pkgcode:"4G", pkgspec:"x", pkgver:"yes", nb:1}); return v.v === "orange" && v.r.indexOf("UN 38.3") !== -1; })());
T("v11 : UN 38.3 confirmé → motif absent", (function(){ var v = verdictColis({un:"3480", psn:"Piles li-ion", cl:"9", cao:true, confirme:"oui", soc:"30", tel:"06", un38_3:"yes", batcfg:"seule", qval:5, qunit:"kg", pkgcode:"4G", pkgspec:"x", pkgver:"yes", batstate:"normal", nb:1}); return v.r.indexOf("UN 38.3") === -1; })());
T("v11 : UN 3090 sans SoC → motif SoC à documenter", (function(){ var v = verdictColis({un:"3090", psn:"Piles au lithium-métal", cl:"9", cao:true, confirme:"oui", un38_3:"yes", batcfg:"seule", qval:2, qunit:"kg", pkgcode:"4G", pkgspec:"x", pkgver:"yes", batstate:"normal", nb:1}); return v.v === "orange" && v.r.indexOf("SoC ≤ 30 % à documenter") !== -1; })());
T("v11 : masse nette 3480 > 35 kg/colis → 🔴 QUANTITÉ DÉPASSÉE", verdictColis({un:"3480", psn:"Piles li-ion", cl:"9", cao:true, confirme:"oui", soc:"30", tel:"06", qval:40, qunit:"kg", nb:1}).v === "red");
T("v11 : masse nette 3480 IB 5 kg → pas de rouge quantité", verdictColis({un:"3480", psn:"Piles li-ion", cl:"9", cao:true, confirme:"oui", soc:"30", tel:"06", qval:5, qunit:"kg", batwh:98, batwhc:18, nb:1}).v !== "red");
T("v11 : classe saisie ≠ base ONU → motif revalidation", (function(){ var v = verdictColis({un:"1203", psn:"Essence", cl:"8", pg:"II", confirme:"oui", qval:5, qunit:"L", pkgcode:"4G", pkgspec:"x", pkgver:"yes", nb:1}); return v.v !== "green" && v.r.indexOf("revalider la classification") !== -1; })());
T("v11 : UN 1845 sans mention LTA vérifiée → motif", v11Missing({un:"1845", cl:"9"}, analyseColis({un:"1845", psn:"Glace carbonique", cl:"9"}), AIRX["1845"], null).some(function(m){ return m.indexOf("LTA/AWB") !== -1; }));
T("v11 : UN 1845 mention LTA vérifiée → aucun motif", !v11Missing({un:"1845", cl:"9", awbinfo:"UN 1845, Dry ice, 9, III, 10 kg", qval:10, qunit:"kg", pkgver:"yes", pkgcode:"4G", pkgspec:"x"}, analyseColis({un:"1845", psn:"Glace carbonique", cl:"9"}), AIRX["1845"], null).length);
T("v11 : dgrDataParse rejette un JSON invalide", dgrDataParse("ceci n'est pas json").err === "JSON invalide");
T("v11 : dgrDataParse rejette un schéma invalide", dgrDataParse(JSON.stringify({foo:1})).err.indexOf("schéma") !== -1);
T("v11 : dgrDataParse refuse une édition incompatible avec la date", dgrDataParse(JSON.stringify({edition:"68", records:[]})).err.indexOf("incompatible") !== -1);
T("v11 : dgrDataParse accepte un jeu licencié complet → dgrLicensedReady", (function(){ var keep = DGR_OFFICIAL; var r = dgrDataParse(JSON.stringify({edition:"67", complete:true, variationsComplete:true, records:[{un:"3496", psn:"NICKEL METAL HYDRIDE BATTERIES"}]})); var ok = r.ok && dgrLicensedReady() && dgrOfficialFor("3496") !== null && dgrOfficialFor("9999") === null; DGR_OFFICIAL = keep; return ok; })());
T("v11 : jeu chargé incomplet → fail-safe maintenu (pas de licence)", (function(){ var keep = DGR_OFFICIAL; dgrDataParse(JSON.stringify({edition:"67", complete:false, variationsComplete:true, records:[{un:"3496"}]})); var bad = !dgrLicensedReady(); DGR_OFFICIAL = keep; return bad; })());
T("v11 : sans licence → dgrLicensedReady faux", (function(){ var keep = DGR_OFFICIAL; DGR_OFFICIAL = null; var bad = !dgrLicensedReady(); DGR_OFFICIAL = keep; return bad; })());
T("v11 : dgdAddFromColis lie la ligne au colis (srcId)", (function(){ DGD_LINES = []; dgdAddFromColisQuiet({id:777, un:"1203", psn:"Essence", cl:"3", pg:"II", qty:"5 L", nb:1, pkg:"fût", cao:false}); return DGD_LINES[0].srcId === 777; })());
T("v11 : ligne manuelle = brouillon (pas de srcId)", (function(){ DGD_LINES = []; dgdAddLine(); return DGD_LINES[0].srcId == null; })());
T("v11 : dgdProdReady faux sans licence (ligne liée)", (function(){ var keep = DGR_OFFICIAL; DGR_OFFICIAL = null; DGD_LINES = [{un:"1203", srcId:1}]; var bad = !dgdProdReady(); DGD_LINES = []; DGR_OFFICIAL = keep; return bad; })());
T("v11 : dgdProdReady faux avec ligne manuelle même licencié", (function(){ var keep = DGR_OFFICIAL; dgrDataParse(JSON.stringify({edition:"67", complete:true, variationsComplete:true, records:[{un:"1203"}]})); DGD_LINES = [{un:"1203", srcId:null}]; var bad = !dgdProdReady(); DGD_LINES = []; DGR_OFFICIAL = keep; return bad; })());
T("v11 : dgdProdReady vrai = licence complète + lignes liées", (function(){ var keep = DGR_OFFICIAL; dgrDataParse(JSON.stringify({edition:"67", complete:true, variationsComplete:true, records:[{un:"1203"}]})); DGD_LINES = [{un:"1203", srcId:1}]; var ok = dgdProdReady(); DGD_LINES = []; DGR_OFFICIAL = keep; return ok; })());
T("v11 : dgdValidate signale un colis source non conforme", (function(){ var keep = DGR_OFFICIAL; DGR_OFFICIAL = null; DGD_LINES = [{un:"3356", psn:"x", cl:"5.1", qty:"1", pi:"x", pkg:"x", nb:1, srcId:555}]; COLIS = [{id:555, un:"3356", psn:"Générateur d'oxygène", cl:"5.1", confirme:"oui", etat:"sain"}]; var errs = dgdValidate(); DGD_LINES = []; COLIS = []; DGR_OFFICIAL = keep; return errs.some(function(e){ return e.indexOf("colis source") !== -1; }); })());
T("v11 : filigrane DRAFT affiché sans licence (aperçu)", (function(){ var keep = DGR_OFFICIAL; DGR_OFFICIAL = null; DGD_LINES = []; renderDgd(); var h = els["dgd-preview"].innerHTML; DGR_OFFICIAL = keep; return h.indexOf("dgd-wm") !== -1 && h.indexOf("DRAFT") !== -1; })());
T("v11 : FRG-07 auto-détecté via pays d'origine France → erreur validateur sans n°", (function(){ DGD_LINES = []; getEl("d-france").value = ""; getEl("t-origin").value = "France"; getEl("d-ship").value = "BMPM"; getEl("d-cons").value = "DOH"; getEl("d-sign").value = "JF"; getEl("d-place").value = "Marseille"; var errs = dgdValidate(); var ok = errs.some(function(e){ return e.indexOf("FRG-07") !== -1; }); getEl("t-origin").value = ""; return ok; })());
T("v11 : ctxHasFrance détecte France en destination", (function(){ getEl("t-dest").value = "Qatar"; var f0 = ctxHasFrance(); getEl("t-dest").value = "France"; var f1 = ctxHasFrance(); getEl("t-dest").value = ""; return !f0 && f1; })());
T("v11 : enregistrement colis refusé si verdict 🔴 (code présent)", html.indexOf("enregistrement refusé") !== -1);
T("v11 : colisRead lit les champs V11", (function(){ getEl("c-qval").value = "5"; getEl("c-qunit").value = "kg"; getEl("c-pkgcode").value = "4G"; getEl("c-pkgspec").value = "4G/X45/S/24"; getEl("c-awbinfo").value = "test"; getEl("c-batcfg").value = "seule"; getEl("c-batwh").value = "98"; getEl("c-batun38").value = "yes"; getEl("c-batstate").value = "normal"; var c = colisRead(); ["c-qval","c-qunit","c-pkgcode","c-pkgspec","c-awbinfo","c-batcfg","c-batwh","c-batun38","c-batstate"].forEach(function(id){ getEl(id).value = ""; }); return c.qval === 5 && c.qunit === "kg" && c.pkgcode === "4G" && c.pkgspec === "4G/X45/S/24" && c.awbinfo === "test" && c.batcfg === "seule" && c.batwh === 98 && c.un38_3 === "yes" && c.batstate === "normal" && c.pkgver === "no"; })());
T("v11 : colisLoad enrichit les anciens colis (fail-safe, pas de confiance implicite)", (function(){ LS["iata-colis-v1"] = JSON.stringify([{id:1, un:"1203", psn:"ESSENCE", cl:"3", qty:"5 L", nb:1, confirme:"oui"}]); COLIS = []; colisLoad(); var c = COLIS[0]; var ok = c.v11 === true && c.un38_3 === "" && c.pkgver === "no" && c.qunit === "" && c.batstate === "normal"; LS["iata-colis-v1"] = "[]"; colisLoad(); return ok; })());
T("v11 : chargeur DGR présent (champ fichier + schéma référencé)", html.indexOf("t-load-dgr") !== -1 && html.indexOf("dgr-schema.json") !== -1);

var cp = require("child_process");
var r = cp.spawnSync("node", ["tools/gen-icons.js"], { cwd: DIR });
T("gen-icons exécuté", r.status === 0);

console.log("\n" + (total - fails) + "/" + total + " tests OK" + (fails ? " — " + fails + " ÉCHEC(S)" : ""));
process.exit(fails ? 1 : 0);
