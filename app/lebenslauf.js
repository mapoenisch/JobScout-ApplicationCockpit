/* JobScout Cockpit – Profilseite und Lebenslauf-Editor (ATS-lesbare CVs).
   Nutzt die Helfer aus app.js ($, $$, esc, api, sicher, toast, dialog, ICON). */
"use strict";

const CV = {
  profil: null, cv: null, pdfs: [], chrome: false, claude: false,
  schritt: 0, saveTimer: {}, vorschauTimer: null, zoom: 1,
};

const CV_SCHRITTE = [
  ["profil", "Profil"], ["erfahrung", "Erfahrung"], ["bildung", "Bildung"],
  ["skills", "Skills"], ["extras", "Extras"], ["check", "Check"],
];
const NIVEAUS = ["Muttersprache", "verhandlungssicher (C2)", "fließend (C1)",
  "sehr gut (B2)", "gute Kenntnisse (B1)", "Grundkenntnisse (A2)", "Anfänger (A1)"];
const TITEL = {
  zusammenfassung: ["Profil", "Summary"], erfahrung: ["Berufserfahrung", "Experience"],
  bildung: ["Ausbildung & Weiterbildung", "Education"], skills: ["Kompetenzen", "Skills"],
  sprachen: ["Sprachen", "Languages"], zertifikate: ["Zertifikate", "Certifications"],
  projekte: ["Projekte", "Projects"], eigene: ["", ""],
};
const LEER = {
  erfahrung: { rolle: "", firma: "", ort: "", start: "", ende: "", punkte: [] },
  bildung: { abschluss: "", institution: "", ort: "", start: "", ende: "", punkte: [] },
  skills: { gruppe: "", eintraege: [] },
  zertifikate: { name: "", aussteller: "", datum: "", url: "", nummer: "", skills: [], datei: "", vorschau: "" },
  projekte: { name: "", beschreibung: "" },
  eigene: { titel: "", punkte: [] },
  nachweise: { typ: "", titel: "", aussteller: "", datum: "", note: "", notiz: "", auswertung: "", kontakt_name: "", kontakt_position: "", kontakt_email: "", kontakt_telefon: "", datei: "", vorschau: "" },
  sprachen: { sprache: "", niveau: "" },
};
const ICON_CV = {
  up: '<svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12l7 7 7-7"/></svg>',
  upload: '<svg viewBox="0 0 24 24"><path d="M12 15V3M7 8l5-5 5 5"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/></svg>',
  download: '<svg viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/></svg>',
  print: '<svg viewBox="0 0 24 24"><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="7"/></svg>',
  user: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
};

/* ---------- Daten ---------- */
async function ladeCv(neu = false) {
  if (CV.profil && !neu) return true;
  const d = await sicher(() => api("/api/cv"));
  if (!d) return false;
  Object.assign(CV, { profil: d.profil, cv: d.lebenslauf, pdfs: d.pdfs, chrome: d.chrome, claude: d.claude });
  return true;
}

const SPEICHER = { p: "profil", c: "cv", n: "nachweise" };
/* Daten-Ziele: p = Profil, c = Lebenslauf, n = Unterlagen (Pfade „nachweise.…“) */
function datenVon(ziel) { return ziel === "p" ? CV.profil : ziel === "n" ? UNT : CV.cv; }
const pfadTeile = (pfad) => pfad.split(".").map((k) => (/^\d+$/.test(k) ? +k : k));
function holen(obj, pfad) { return pfadTeile(pfad).reduce((o, k) => o?.[k], obj); }
function setzen(obj, pfad, wert) {
  const t = pfadTeile(pfad); const letzter = t.pop();
  t.reduce((o, k) => o[k], obj)[letzter] = wert;
}

function speichereSpaeter(was) {
  clearTimeout(CV.saveTimer[was]);
  const pill = $("#cv-status");
  if (pill) { pill.textContent = "Speichert …"; pill.className = "chip"; }
  CV.saveTimer[was] = setTimeout(async () => {
    try {
      if (was === "nachweise") await api("/api/nachweise", { nachweise: UNT.nachweise });
      else await api(was === "profil" ? "/api/profil" : "/api/cv", was === "profil" ? CV.profil : CV.cv);
      if (pill) { pill.textContent = "Gespeichert"; pill.className = "chip ok"; }
    } catch (e) {
      toast(e.message, true);
      if (pill) { pill.textContent = "Nicht gespeichert"; pill.className = "chip bad"; }
    }
  }, 700);
}

/* Eingaben: data-p (Profil) / data-c (Lebenslauf); Modus über data-modus:
   "zeilen" = eine Zeile pro Listeneintrag, "komma" = Komma-getrennt */
function eingabeWert(el) {
  if (el.type === "checkbox") return el.checked;
  const m = el.dataset.modus;
  if (m === "zeilen") return el.value.split("\n").map((x) => x.replace(/^[\s•●▪◦\-–*]+/, "").trim()).filter(Boolean);
  if (m === "komma") return el.value.split(/[,;·]/).map((x) => x.trim()).filter(Boolean);
  return el.value;
}
function anzeigeWert(v, modus) {
  if (modus === "zeilen") return (v || []).join("\n");
  if (modus === "komma") return (v || []).join(", ");
  return v ?? "";
}
function feld(ziel, pfad, label, opt = {}) {
  const daten = datenVon(ziel);
  const wert = anzeigeWert(holen(daten, pfad), opt.modus);
  const attr = `data-${ziel}="${pfad}" ${opt.modus ? `data-modus="${opt.modus}"` : ""} placeholder="${esc(opt.ph || "")}"`;
  const input = opt.zeilen
    ? `<textarea ${attr} rows="${opt.zeilen}">${esc(wert)}</textarea>`
    : opt.liste
      ? `<input type="text" ${attr} list="${opt.liste}" value="${esc(wert)}">`
      : `<input type="${opt.typ || "text"}" ${attr} value="${esc(wert)}">`;
  return `<label class="feld ${opt.voll ? "voll" : ""}">${label}${input}${opt.hilfe ? `<span class="muted small" style="font-weight:400">${opt.hilfe}</span>` : ""}</label>`;
}
function verdrahteEingaben(root, nachher) {
  root.addEventListener("input", (e) => {
    const el = e.target;
    const kurz = ["p", "c", "n"].find((k) => el.dataset[k] !== undefined);
    if (!kurz) return;
    setzen(datenVon(kurz), el.dataset[kurz], eingabeWert(el));
    speichereSpaeter(SPEICHER[kurz]);
    nachher?.();
  });
}

/* Listen-Aktionen: data-add="cv:erfahrung", data-del / data-hoch / data-runter="cv:erfahrung.2" */
function verdrahteListen(root, neuZeichnen) {
  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-add],[data-del],[data-hoch],[data-runter]");
    if (!b) return;
    const roh = b.dataset.add || b.dataset.del || b.dataset.hoch || b.dataset.runter;
    const [ziel, pfad] = roh.split(":");
    const daten = datenVon(ziel);
    if (b.dataset.add) {
      const typ = pfad.split(".").pop();
      holen(daten, pfad).push(structuredClone(LEER[typ] ?? ""));
    } else {
      const teile = pfad.split("."); const i = +teile.pop(); const liste = holen(daten, teile.join("."));
      if (b.dataset.del) {
        const eintrag = liste[i];
        const name = eintrag?.rolle || eintrag?.abschluss || eintrag?.name || eintrag?.gruppe || eintrag?.sprache || eintrag?.titel || "Eintrag";
        if (!confirm(`„${name}“ entfernen?${eintrag?.datei ? "\nDie hochgeladene Datei wird mitgelöscht." : ""}`)) return;
        if (eintrag?.datei) api("/api/unterlagen/loeschen", { datei: eintrag.datei, vorschau: eintrag.vorschau }).catch(() => {});
        liste.splice(i, 1);
      } else {
        const j = b.dataset.hoch ? i - 1 : i + 1;
        if (j < 0 || j >= liste.length) return;
        [liste[i], liste[j]] = [liste[j], liste[i]];
      }
    }
    speichereSpaeter(SPEICHER[ziel]);
    neuZeichnen();
  });
}
function eintragKopf(ziel, pfad, i, titel, anzahl) {
  return `<div class="eintrag-kopf"><b>${esc(titel || `Eintrag ${i + 1}`)}</b>
    <span class="eintrag-aktionen">
      <button type="button" class="icon-btn mini" data-hoch="${ziel}:${pfad}.${i}" title="Nach oben" ${i === 0 ? "disabled" : ""}>${ICON_CV.up}</button>
      <button type="button" class="icon-btn mini" data-runter="${ziel}:${pfad}.${i}" title="Nach unten" ${i === anzahl - 1 ? "disabled" : ""}>${ICON_CV.down}</button>
      <button type="button" class="icon-btn mini klein" data-del="${ziel}:${pfad}.${i}" title="Entfernen">${ICON.trash}</button>
    </span></div>`;
}
const addKnopf = (ziel, pfad, text) => `<button type="button" class="btn btn-soft add-knopf" data-add="${ziel}:${pfad}">${ICON.plus}${text}</button>`;

/* ================================================================
   PROFILSEITE
   ================================================================ */
function profilVollstaendig(p = CV.profil) {
  const pflicht = [p.persoenlich.vorname, p.persoenlich.nachname, p.persoenlich.titel, p.kontakt.email,
    p.kontakt.telefon, p.kontakt.ort, p.kontakt.linkedin, p.beruf.wunschrollen.length, p.beruf.verfuegbar_ab,
    p.beruf.arbeitsmodell, p.sprachen.length, p.staerken.length, p.kurzprofil];
  return Math.round((pflicht.filter(Boolean).length / pflicht.length) * 100);
}

async function renderProfil() {
  setHeader("Mein Profil", "Persönliche Daten – eine Quelle für Lebenslauf, Anschreiben und Interview-Prep",
    `<span class="chip ok" id="cv-status">Gespeichert</span>
     <button class="btn" id="pr-import">${ICON_CV.upload}Aus PDF übernehmen</button>
     <a class="btn btn-primary" href="#lebenslauf">${ICON.doc}Zum Lebenslauf-Editor</a>`);
  if (!(await ladeCv())) return;
  $("#pr-import").onclick = importDialog;
  zeichneProfil();
}

function zeichneProfil() {
  const p = CV.profil;
  const quote = profilVollstaendig();
  $("#view").innerHTML = `<div class="profil-seite" id="pr-root">
    <div class="card profil-hero">
      <div class="avatar">${esc((p.persoenlich.vorname[0] || "") + (p.persoenlich.nachname[0] || "")) || ICON_CV.user}</div>
      <div class="zeile-main"><h2>${esc([p.persoenlich.vorname, p.persoenlich.nachname].filter(Boolean).join(" ") || "Dein Name")}</h2>
        <div class="muted">${esc(p.persoenlich.titel || "Deine berufliche Überschrift")}</div></div>
      <div class="quote"><b id="pr-quote">${quote} %</b><span class="muted small">vollständig</span>
        <div class="balken"><span id="pr-balken" style="width:${quote}%"></span></div></div>
    </div>
    <div class="profil-grid">
      <div class="einst-spalte">
        ${abschnittCv("Persönliches", "", `<div class="form-grid">
          ${feld("p", "persoenlich.vorname", "Vorname")}
          ${feld("p", "persoenlich.nachname", "Nachname")}
          ${feld("p", "persoenlich.titel", "Berufliche Überschrift", { voll: true, ph: "z. B. Kaufmann im Groß- und Außenhandel | Digital Sales Manager i. W.", hilfe: "Erscheint unter deinem Namen im Lebenslauf." })}
          ${feld("p", "persoenlich.geburtsdatum", "Geburtsdatum", { ph: "TT.MM.JJJJ" })}
          ${feld("p", "persoenlich.geburtsort", "Geburtsort")}
          ${feld("p", "persoenlich.nationalitaet", "Staatsangehörigkeit")}
          ${feld("p", "persoenlich.familienstand", "Familienstand", { ph: "optional" })}
        </div>`)}
        ${abschnittCv("Kontakt", "", `<div class="form-grid">
          ${feld("p", "kontakt.email", "E-Mail", { typ: "email" })}
          ${feld("p", "kontakt.telefon", "Telefon", { typ: "tel" })}
          ${feld("p", "kontakt.strasse", "Straße & Hausnummer", { voll: true })}
          ${feld("p", "kontakt.plz", "PLZ")}
          ${feld("p", "kontakt.ort", "Ort")}
          ${feld("p", "kontakt.land", "Land")}
          ${feld("p", "kontakt.linkedin", "LinkedIn", { ph: "linkedin.com/in/…" })}
          ${feld("p", "kontakt.xing", "XING", { ph: "optional" })}
          ${feld("p", "kontakt.website", "Website / Portfolio", { ph: "optional" })}
        </div>`)}
        ${abschnittCv("Kurzprofil", "Dein Elevator Pitch in 3–5 Sätzen. Wird als Vorlage für die Zusammenfassung im Lebenslauf genutzt.",
          feld("p", "kurzprofil", "", { zeilen: 5, ph: "Quereinsteiger in den digitalen B2B-Vertrieb mit …" }))}
        ${abschnittCv("Motivation & Notizen für Anschreiben", "Was Claude über dich wissen soll, das nicht in den Lebenslauf gehört: Warum Vertrieb, was dir wichtig ist, No-Gos.",
          feld("p", "motivation", "", { zeilen: 5, ph: "z. B. Ich will in den systemgestützten Vertrieb, keine reine Kaltakquise …" }))}
      </div>
      <div class="einst-spalte">
        ${abschnittCv("Beruflich", "Rahmenbedingungen für Bewerbungen und Gespräche.", `<div class="form-grid">
          ${feld("p", "beruf.wunschrollen", "Wunschrollen (Komma-getrennt)", { modus: "komma", voll: true, ph: "Inside Sales, Account Manager, Sales Development" })}
          ${feld("p", "beruf.verfuegbar_ab", "Verfügbar ab", { ph: "sofort / 01.02.2027" })}
          ${feld("p", "beruf.kuendigungsfrist", "Kündigungsfrist", { ph: "z. B. keine" })}
          ${feld("p", "beruf.gehaltswunsch", "Gehaltswunsch (brutto/Jahr)", { ph: "z. B. 42.000 €" })}
          ${feld("p", "beruf.arbeitsmodell", "Arbeitsmodell", { liste: "pr-modelle", ph: "Remote, Hybrid, Vor Ort" })}
          ${feld("p", "beruf.reisebereitschaft", "Reisebereitschaft", { ph: "z. B. gelegentlich" })}
          ${feld("p", "beruf.fuehrerschein", "Führerschein", { ph: "z. B. Klasse B" })}
          ${feld("p", "beruf.umzugsbereit", "Umzugsbereit", { ph: "ja / nein / Raum Leipzig" })}
        </div>
        <datalist id="pr-modelle"><option value="Remote"><option value="Hybrid"><option value="Vor Ort"><option value="Remote oder Hybrid"></datalist>`)}
        ${abschnittCv("Sprachen", "", `${p.sprachen.map((s, i) => `<div class="sprach-zeile">
            ${feld("p", `sprachen.${i}.sprache`, i ? "" : "Sprache", { ph: "z. B. Englisch" })}
            ${feld("p", `sprachen.${i}.niveau`, i ? "" : "Niveau", { liste: "pr-niveaus" })}
            <button type="button" class="icon-btn mini klein" data-del="p:sprachen.${i}" title="Entfernen">${ICON.trash}</button>
          </div>`).join("")}
          <datalist id="pr-niveaus">${NIVEAUS.map((n) => `<option value="${esc(n)}">`).join("")}</datalist>
          ${addKnopf("p", "sprachen", "Sprache hinzufügen")}`)}
        ${abschnittCv("Stärken & Interessen", "", `<div class="form-grid">
          ${feld("p", "staerken", "Stärken (Komma-getrennt)", { modus: "komma", voll: true, zeilen: 2, ph: "Kommunikationsstärke, Disziplin, strukturiertes Arbeiten" })}
          ${feld("p", "interessen", "Interessen / Hobbys (Komma-getrennt)", { modus: "komma", voll: true, zeilen: 2, ph: "optional" })}
        </div>`)}
        <div class="hinweis info">${ICON.spark}<div>Die Bewerbungs- und Interview-Workflows lesen dein Profil (<code>profil.json</code>) und deinen Lebenslauf (<code>lebenslauf.json</code>) automatisch als primäre Quelle.</div></div>
      </div>
    </div></div>`;
  const root = $("#pr-root");
  verdrahteEingaben(root, () => {
    const q = profilVollstaendig();
    $("#pr-quote").textContent = `${q} %`;
    $("#pr-balken").style.width = `${q}%`;
  });
  verdrahteListen(root, zeichneProfil);
}

function abschnittCv(titel, text, inhalt, rechts = "") {
  return `<div class="card">
    <div class="abschnitt-kopf"><h2>${titel}</h2>${rechts}</div>
    ${text ? `<p class="abschnitt-text">${text}</p>` : ""}${inhalt}</div>`;
}

/* ================================================================
   LEBENSLAUF-EDITOR
   ================================================================ */
async function renderLebenslauf() {
  setHeader("Lebenslauf-Editor", "ATS-lesbare Lebensläufe – aus deinen PDFs importiert, live in der Vorschau",
    `<span class="chip ok" id="cv-status">Gespeichert</span>
     <button class="btn" id="cv-import">${ICON_CV.upload}PDF importieren</button>
     <button class="btn btn-primary" id="cv-download">${ICON_CV.download}PDF herunterladen</button>`);
  if (!(await ladeCv())) return;
  $("#cv-import").onclick = importDialog;
  $("#cv-download").onclick = exportierePdf;
  const d = CV.cv.design;
  $("#view").innerHTML = `<div class="cv-layout">
    <div class="cv-editor">
      <div class="card cv-fortschritt">
        <div class="zeile-main"><b id="cv-name"></b><span class="muted small" id="cv-quote-text"></span></div>
        <div class="balken"><span id="cv-balken"></span></div>
      </div>
      <div class="cv-schritte" role="tablist">${CV_SCHRITTE.map(([id, name], i) =>
        `<button type="button" data-schritt="${i}" role="tab">${i + 1}. ${name}</button>`).join("")}</div>
      <div id="cv-schritt" class="card cv-inhalt"></div>
      <div class="cv-nav">
        <button class="btn" id="cv-zurueck">Zurück</button>
        <button class="btn btn-primary" id="cv-weiter"></button>
      </div>
    </div>
    <div class="cv-vorschau-spalte">
      <div class="card cv-toolbar">
        <div class="cv-design">
          <span class="muted small">Vorlage</span><b>Klassisch</b><span class="chip ok">ATS-sicher</span>
        </div>
        <label class="farbe" title="Akzentfarbe"><input type="color" id="cv-akzent" value="${esc(d.akzent)}"></label>
        <div class="segment" id="cv-schrift">
          <button type="button" data-wert="sans" class="${d.schrift !== "serif" ? "an" : ""}">Sans</button>
          <button type="button" data-wert="serif" class="${d.schrift === "serif" ? "an" : ""}">Serif</button>
        </div>
        <div class="segment" id="cv-sprache">
          <button type="button" data-wert="de" class="${d.titel_de ? "an" : ""}">DE</button>
          <button type="button" data-wert="en" class="${!d.titel_de ? "an" : ""}">EN</button>
        </div>
        <label class="check"><input type="checkbox" id="cv-eine-seite" ${d.eine_seite ? "checked" : ""}> Auf eine Seite</label>
        <button class="icon-btn" id="cv-drucken" title="Drucken / Als PDF sichern">${ICON_CV.print}</button>
      </div>
      <div class="cv-blatt-rahmen" id="cv-rahmen"><iframe id="cv-vorschau" title="Lebenslauf-Vorschau"></iframe></div>
      <div class="muted small cv-seiten" id="cv-seiten"></div>
    </div>
  </div>`;

  $$("[data-schritt]").forEach((b) => b.addEventListener("click", () => { CV.schritt = +b.dataset.schritt; zeichneSchritt(); }));
  $("#cv-zurueck").onclick = () => { if (CV.schritt > 0) { CV.schritt--; zeichneSchritt(); } };
  $("#cv-weiter").onclick = () => { if (CV.schritt < CV_SCHRITTE.length - 1) { CV.schritt++; zeichneSchritt(); } else exportierePdf(); };
  $("#cv-akzent").addEventListener("input", (e) => designSetzen("akzent", e.target.value));
  $("#cv-eine-seite").addEventListener("change", (e) => designSetzen("eine_seite", e.target.checked));
  $("#cv-drucken").onclick = druckeCv;
  for (const [id, key, map] of [["#cv-schrift", "schrift", (w) => w], ["#cv-sprache", "titel_de", (w) => w === "de"]]) {
    $(id).addEventListener("click", (e) => {
      const b = e.target.closest("[data-wert]"); if (!b) return;
      $$(`${id} button`).forEach((x) => x.classList.toggle("an", x === b));
      designSetzen(key, map(b.dataset.wert));
    });
  }
  const box = $("#cv-schritt");
  verdrahteEingaben(box, () => { planeVorschau(); zeichneFortschritt(); });
  verdrahteListen(box, () => { zeichneSchritt(); });
  verdrahteCheck(box);
  verdrahteDateien(box, zeichneSchritt);
  new ResizeObserver(() => skaliereVorschau()).observe($("#cv-rahmen"));
  zeichneSchritt();
}

function designSetzen(key, wert) {
  CV.cv.design[key] = wert;
  speichereSpaeter("cv");
  planeVorschau(0);
}

function zeichneSchritt() {
  const box = $("#cv-schritt");
  if (!box) return;
  const [id, name] = CV_SCHRITTE[CV.schritt];
  $$("[data-schritt]").forEach((b) => b.classList.toggle("an", +b.dataset.schritt === CV.schritt));
  const unter = {
    profil: "Kontaktdaten und Kurzprofil. Kontaktdaten kommen aus deinem Profil und werden dort mitgespeichert.",
    erfahrung: "Stationen mit messbaren Ergebnissen – neueste zuerst.",
    bildung: "Ausbildung, Weiterbildung, Schulabschluss.",
    skills: "Die Begriffe, nach denen ein ATS sucht – gruppiert.",
    extras: "Zertifikate, Projekte und eigene Abschnitte.",
    check: "ATS-Check, Zielstelle und Reihenfolge der Abschnitte.",
  }[id];
  box.innerHTML = `<div class="schritt-kopf"><h2>${name}</h2><span class="muted small">Schritt ${CV.schritt + 1} von ${CV_SCHRITTE.length}</span></div>
    <p class="abschnitt-text">${unter}</p>${SCHRITT_RENDER[id]()}`;
  if (id === "skills") $("#cv-skills-uebernehmen")?.addEventListener("click", skillsAusProfil);
  if (id === "profil") $("#cv-zus-uebernehmen")?.addEventListener("click", () => {
    CV.cv.zusammenfassung = CV.profil.kurzprofil; speichereSpaeter("cv"); zeichneSchritt(); planeVorschau(0);
  });
  $("#cv-zurueck").disabled = CV.schritt === 0;
  $("#cv-weiter").innerHTML = CV.schritt < CV_SCHRITTE.length - 1
    ? `Weiter: ${CV_SCHRITTE[CV.schritt + 1][1]}` : `${ICON_CV.download}PDF herunterladen`;
  zeichneFortschritt();
  planeVorschau(0);
}

const SCHRITT_RENDER = {
  profil() {
    return `<div class="form-grid">
      ${feld("p", "persoenlich.vorname", "Vorname")}
      ${feld("p", "persoenlich.nachname", "Nachname")}
      ${feld("c", "headline", "Überschrift für diesen Lebenslauf", { voll: true, ph: CV.profil.persoenlich.titel || "z. B. Inside Sales | Digital Sales Manager i. W.", hilfe: "Leer = Überschrift aus dem Profil. Tipp: an die Zielrolle anpassen." })}
      ${feld("p", "kontakt.email", "E-Mail", { typ: "email" })}
      ${feld("p", "kontakt.telefon", "Telefon", { typ: "tel" })}
      ${feld("p", "kontakt.strasse", "Straße")}
      <div class="form-grid" style="grid-template-columns:90px 1fr;gap:10px">${feld("p", "kontakt.plz", "PLZ")}${feld("p", "kontakt.ort", "Ort")}</div>
      ${feld("p", "kontakt.linkedin", "LinkedIn", { voll: true })}
      ${feld("c", "zusammenfassung", "Zusammenfassung", { voll: true, zeilen: 6, ph: "3–5 Sätze: wer du bist, was du kannst, was du suchst. Keine Ich-Form." })}
    </div>
    ${CV.profil.kurzprofil && CV.profil.kurzprofil !== CV.cv.zusammenfassung
      ? `<button type="button" class="btn btn-soft btn-sm" id="cv-zus-uebernehmen" style="margin-top:10px">${ICON.refresh}Kurzprofil aus dem Profil übernehmen</button>` : ""}`;
  },
  erfahrung() {
    const l = CV.cv.erfahrung;
    return l.map((e, i) => `<div class="eintrag">
      ${eintragKopf("c", "erfahrung", i, [e.rolle, e.firma].filter(Boolean).join(" · "), l.length)}
      <div class="form-grid">
        ${feld("c", `erfahrung.${i}.rolle`, "Position")}
        ${feld("c", `erfahrung.${i}.firma`, "Unternehmen")}
        ${feld("c", `erfahrung.${i}.ort`, "Ort")}
        <div class="form-grid" style="gap:10px">${feld("c", `erfahrung.${i}.start`, "Von", { ph: "MM/JJJJ" })}${feld("c", `erfahrung.${i}.ende`, "Bis", { ph: "MM/JJJJ oder heute" })}</div>
        ${feld("c", `erfahrung.${i}.punkte`, "Aufgaben & Erfolge (eine pro Zeile)", { modus: "zeilen", zeilen: 4, voll: true, ph: "Mit Verb starten und Ergebnis nennen, z. B. „Betreute 120 B2B-Kunden und steigerte den Umsatz um 15 %“" })}
      </div></div>`).join("") + addKnopf("c", "erfahrung", "Station hinzufügen");
  },
  bildung() {
    const l = CV.cv.bildung;
    return l.map((e, i) => `<div class="eintrag">
      ${eintragKopf("c", "bildung", i, e.abschluss, l.length)}
      <div class="form-grid">
        ${feld("c", `bildung.${i}.abschluss`, "Abschluss / Titel")}
        ${feld("c", `bildung.${i}.institution`, "Schule / Institut")}
        ${feld("c", `bildung.${i}.ort`, "Ort")}
        <div class="form-grid" style="gap:10px">${feld("c", `bildung.${i}.start`, "Von", { ph: "MM/JJJJ" })}${feld("c", `bildung.${i}.ende`, "Bis")}</div>
        ${feld("c", `bildung.${i}.punkte`, "Schwerpunkte (eine pro Zeile, optional)", { modus: "zeilen", zeilen: 3, voll: true })}
      </div></div>`).join("") + addKnopf("c", "bildung", "Bildung hinzufügen");
  },
  skills() {
    const l = CV.cv.skills;
    return `${l.map((g, i) => `<div class="eintrag">
      ${eintragKopf("c", "skills", i, g.gruppe || "Gruppe " + (i + 1), l.length)}
      <div class="form-grid">
        ${feld("c", `skills.${i}.gruppe`, "Gruppenname", { ph: "z. B. Vertrieb & Digital" })}
        ${feld("c", `skills.${i}.eintraege`, "Skills (Komma-getrennt)", { modus: "komma", zeilen: 2, ph: "HubSpot, Salesforce, Lead-Management" })}
      </div></div>`).join("")}
      <div class="knopf-reihe">${addKnopf("c", "skills", "Skill-Gruppe hinzufügen")}
        <button type="button" class="btn" id="cv-skills-uebernehmen">${ICON.star}Aus Skill-Profil übernehmen</button></div>
      <p class="muted small">Sprachen pflegst du in deinem <a href="#profil">Profil</a> – sie erscheinen als eigener Abschnitt.</p>`;
  },
  extras() { return extrasHtml(); },
  check() {
    const ats = atsCheck();
    const rf = CV.cv.design.reihenfolge;
    return `<div class="card-innen">
        <div class="abschnitt-kopf"><h2>Zielstelle</h2><span class="muted small">optional</span></div>
        <p class="abschnitt-text">Füge die Stellenanzeige ein – der Check zeigt dir, welche Schlüsselbegriffe im Lebenslauf fehlen.</p>
        <div class="form-grid">
          ${feld("c", "zielstelle.rolle", "Rolle", { ph: "z. B. Inside Sales Manager" })}
          ${feld("c", "zielstelle.firma", "Firma", { hilfe: "Wird an den PDF-Dateinamen angehängt." })}
          ${feld("c", "zielstelle.beschreibung", "Stellenanzeige", { voll: true, zeilen: 5, ph: "Anzeigentext hier einfügen …" })}
        </div>
      </div>
      <div class="card-innen" id="ats-box">${atsHtml(ats)}</div>
      <div class="card-innen">
        <div class="abschnitt-kopf"><h2>Reihenfolge der Abschnitte</h2></div>
        <div class="reihenfolge">${rf.map((a, i) => `<div class="rf-zeile"><span>${esc(abschnittTitel(a) || "Eigene Abschnitte")}</span>
          <button type="button" class="icon-btn mini" data-rf="${i}" data-dir="-1" ${i === 0 ? "disabled" : ""}>${ICON_CV.up}</button>
          <button type="button" class="icon-btn mini" data-rf="${i}" data-dir="1" ${i === rf.length - 1 ? "disabled" : ""}>${ICON_CV.down}</button></div>`).join("")}</div>
      </div>`;
  },
};

function verdrahteCheck(box) {
  box.addEventListener("input", (e) => {
    if (e.target.dataset.c?.startsWith("zielstelle")) {
      clearTimeout(CV.atsTimer);
      CV.atsTimer = setTimeout(() => { $("#ats-box").innerHTML = atsHtml(atsCheck()); }, 400);
    }
  });
  box.addEventListener("click", (e) => {
    const b = e.target.closest("[data-rf]");
    if (b) {
      const rf = CV.cv.design.reihenfolge; const i = +b.dataset.rf; const j = i + +b.dataset.dir;
      [rf[i], rf[j]] = [rf[j], rf[i]];
      speichereSpaeter("cv"); zeichneSchritt();
    }
    if (e.target.closest("#ats-toggle")) $("#ats-details").hidden = !$("#ats-details").hidden;
  });
}

async function skillsAusProfil() {
  const e = await sicher(() => api("/api/einstellungen"));
  if (!e) return;
  const vorhanden = e.skill_status.vorhanden, wb = e.skill_status.weiterbildung;
  const neu = [];
  if (vorhanden.length) neu.push({ gruppe: "Fachkenntnisse", eintraege: vorhanden });
  if (wb.length) neu.push({ gruppe: "In Weiterbildung", eintraege: wb });
  if (!neu.length) { toast("Im Skill-Profil ist noch nichts als vorhanden markiert", true); return; }
  const bestehend = new Set(CV.cv.skills.flatMap((g) => g.eintraege.map((x) => x.toLowerCase())));
  neu.forEach((g) => { g.eintraege = g.eintraege.filter((x) => !bestehend.has(x.toLowerCase())); });
  const rest = neu.filter((g) => g.eintraege.length);
  if (!rest.length) { toast("Alle Skills aus dem Skill-Profil stehen schon drin"); return; }
  CV.cv.skills.push(...rest);
  speichereSpaeter("cv"); zeichneSchritt();
  toast(`${rest.reduce((n, g) => n + g.eintraege.length, 0)} Skills übernommen`);
}

/* ---------- Fortschritt ---------- */
function cvFortschritt() {
  const p = CV.profil, c = CV.cv;
  const teile = [p.persoenlich.vorname && p.persoenlich.nachname, p.kontakt.email, p.kontakt.telefon, p.kontakt.ort,
    c.headline || p.persoenlich.titel, c.zusammenfassung, c.erfahrung.length, c.erfahrung.every((e) => e.start && e.punkte.length),
    c.bildung.length, c.skills.length, p.sprachen.length];
  return Math.round((teile.filter(Boolean).length / teile.length) * 100);
}
function zeichneFortschritt() {
  const q = cvFortschritt();
  const name = [CV.profil.persoenlich.vorname, CV.profil.persoenlich.nachname].filter(Boolean).join(" ");
  if ($("#cv-name")) {
    $("#cv-name").textContent = name || "Neuer Lebenslauf";
    $("#cv-quote-text").textContent = `${q} % vollständig`;
    $("#cv-balken").style.width = `${q}%`;
  }
}

/* ================================================================
   ATS-CHECK (lokal, regelbasiert)
   ================================================================ */
const VERBEN = ["beriet", "berate", "beraten", "verkaufte", "verkauft", "betreute", "betreut", "steuerte", "gesteuert", "koordinierte", "koordiniert",
  "baute", "aufgebaut", "entwickelte", "entwickelt", "gewann", "gewonnen", "steigerte", "gesteigert", "setzte", "umgesetzt", "verantwortete", "verantwortet",
  "führte", "geführt", "organisierte", "organisiert", "analysierte", "analysiert", "akquirierte", "akquiriert", "wickelte", "abgewickelt", "optimierte", "optimiert",
  "führte ein", "eingeführt", "verhandelte", "verhandelt", "erstellte", "erstellt", "qualifizierte", "qualifiziert", "senkte", "reduziert", "reduzierte",
  "sicherte", "gesichert", "erzielte", "erzielt", "überzeugte", "schulte", "geschult", "plante", "geplant", "pflegte", "gepflegt", "erhöhte", "erhöht",
  "led", "built", "managed", "increased", "reduced", "delivered", "drove", "won", "closed", "developed", "launched", "negotiated", "generated", "achieved"];
const STOPP = new Set(("aber alle allem also auch auf aus bei beim bist bitte dabei damit dann dass dein deine dem den der des dich die dies diese dieser doch dort durch "
  + "ein eine einem einen einer eines euch für gibt habe haben hast hat hier ihr ihre ihren im in ist ja jede jeden jeder kann kannst kein keine mit nach nicht noch nur "
  + "oder sich sie sind so sowie über um und uns unser unsere unter vom von vor wie wir wird wirst wo zu zum zur zwischen sowohl werden wurde wurden deiner deinen "
  + "unseres unserem unseren bieten bietet suchen suchst erwartet erwarten freuen dich ihnen sollte solltest möchtest arbeitest aufgaben profil bringst mitbringst "
  + "unternehmen stelle team bewerbung benefits vollzeit teilzeit m/w/d w/m/d gerne idealerweise erste ersten sehr gute guten neue neuen mehr bereich rahmen tätigkeit "
  + "with and the for you your our are will have this that from about who what work").split(" "));

function cvText() {
  const c = CV.cv;
  return [c.headline, c.zusammenfassung, ...c.erfahrung.flatMap((e) => [e.rolle, e.firma, ...e.punkte]),
    ...c.bildung.flatMap((e) => [e.abschluss, e.institution, ...e.punkte]), ...c.skills.flatMap((g) => [g.gruppe, ...g.eintraege]),
    ...c.zertifikate.map((z) => z.name), ...c.projekte.flatMap((p) => [p.name, p.beschreibung]), ...c.eigene.flatMap((e) => e.punkte),
    ...CV.profil.sprachen.map((s) => s.sprache)].join(" ").toLowerCase();
}

function schluesselbegriffe(text) {
  const zaehler = new Map();
  (text.toLowerCase().match(/[a-zäöüß][a-zäöüß0-9+#./-]{2,}/g) || []).forEach((w) => {
    w = w.replace(/[./-]+$/, "");
    if (w.length < 4 && !/^(crm|sap|b2b|saas|seo|sea|kpi|erp|ki|ai)$/.test(w)) return;
    if (STOPP.has(w)) return;
    zaehler.set(w, (zaehler.get(w) || 0) + 1);
  });
  return [...zaehler.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length).slice(0, 25).map(([w]) => w);
}

function atsCheck() {
  const p = CV.profil, c = CV.cv;
  const punkte = c.erfahrung.flatMap((e) => e.punkte);
  const regeln = [];
  const r = (titel, max, erreicht, tipp) => regeln.push({ titel, max, erreicht: Math.round(Math.max(0, Math.min(max, erreicht))), tipp });
  const kontakt = [p.kontakt.email, p.kontakt.telefon, p.kontakt.ort, p.persoenlich.vorname && p.persoenlich.nachname].filter(Boolean).length;
  r("Kontaktdaten", 10, kontakt * 2.5, kontakt < 4 ? "Name, E-Mail, Telefon und Ort gehören in den Kopf." : "");
  const zl = c.zusammenfassung.trim().split(/\s+/).filter(Boolean).length;
  r("Zusammenfassung", 10, zl >= 30 && zl <= 120 ? 10 : zl ? 5 : 0, !zl ? "Schreib 3–5 Sätze Zusammenfassung." : zl < 30 ? "Etwas ausführlicher (mind. 30 Wörter)." : zl > 120 ? "Kürzen – max. ca. 120 Wörter." : "");
  const komplett = c.erfahrung.filter((e) => e.start && e.ende && e.punkte.length >= 2).length;
  r("Berufserfahrung", 20, c.erfahrung.length ? (komplett / c.erfahrung.length) * 20 : 0,
    komplett < c.erfahrung.length ? "Jede Station braucht Zeitraum (von/bis) und mindestens zwei Punkte." : "");
  const mitVerb = punkte.filter((t) => VERBEN.some((v) => t.toLowerCase().split(/\s+/).slice(0, 4).join(" ").includes(v))).length;
  r("Aktive Formulierungen", 10, punkte.length ? (mitVerb / punkte.length) * 20 : 0,
    punkte.length && mitVerb / punkte.length < .5 ? `Nur ${mitVerb} von ${punkte.length} Punkten enthalten ein Tätigkeitsverb (z. B. „betreute“, „steigerte“, „gewann“). Nominalstil wie „Kundenberatung und Verkauf“ ist okay, wirkt aber passiver.` : "");
  const zahl = punkte.filter((t) => /\d/.test(t)).length;
  r("Messbare Erfolge", 15, punkte.length ? (zahl / punkte.length) * 30 : 0,
    zahl / Math.max(1, punkte.length) < .5 ? `Nur ${zahl} von ${punkte.length} Punkten haben Zahlen. Ergänze z. B. Kundenanzahl, Umsatz, %, Anrufe/Tag.` : "");
  const skills = c.skills.flatMap((g) => g.eintraege).length;
  r("Skills", 10, skills >= 8 ? 10 : skills * 1.25, skills < 8 ? "Mindestens 8 konkrete Skills (Tools, Methoden) nennen." : "");
  const bildungOk = c.bildung.filter((b) => b.abschluss && b.institution).length;
  r("Bildung", 10, c.bildung.length ? (bildungOk / c.bildung.length) * 10 : 0, !c.bildung.length || bildungOk < c.bildung.length ? "Abschluss und Institution bei jedem Bildungseintrag angeben." : "");
  const ich = /\b(ich|mein|meine|meinen|mir|mich)\b/i.test(c.zusammenfassung + " " + punkte.join(" "));
  r("Keine Ich-Form", 5, ich ? 0 : 5, ich ? "Lebensläufe ohne „ich/mein“ formulieren." : "");
  const seiten = CV.seiten || 1;
  r("Länge", 10, seiten <= 2 ? 10 : 3, seiten > 2 ? "Auf maximal 2 Seiten kürzen." : "");
  let keywords = null;
  if (c.zielstelle.beschreibung.trim().length > 80) {
    const kw = schluesselbegriffe(c.zielstelle.beschreibung);
    const text = cvText();
    const fehlt = kw.filter((w) => !text.includes(w));
    keywords = { alle: kw, fehlt };
    r("Passung zur Stelle", 20, kw.length ? ((kw.length - fehlt.length) / kw.length) * 20 : 0,
      fehlt.length ? "Prüfe die fehlenden Begriffe – nur übernehmen, was wirklich auf dich zutrifft." : "");
  }
  const max = regeln.reduce((n, x) => n + x.max, 0);
  const summe = regeln.reduce((n, x) => n + x.erreicht, 0);
  return { score: Math.round((summe / max) * 100), regeln, keywords };
}

function atsHtml(ats) {
  const klasse = ats.score >= 80 ? "ok" : ats.score >= 60 ? "warn" : "bad";
  return `<div class="abschnitt-kopf"><h2>ATS-Score: ${ats.score}/100</h2>
      <button type="button" class="btn btn-sm" id="ats-toggle">Details</button></div>
    <div class="balken ats-${klasse}"><span style="width:${ats.score}%"></span></div>
    ${ats.keywords ? `<div class="kw-box"><div class="muted small">Schlüsselbegriffe aus der Anzeige</div>
      <div class="kw-liste">${ats.keywords.alle.map((w) => `<span class="chip ${ats.keywords.fehlt.includes(w) ? "bad" : "ok"}">${esc(w)}</span>`).join("")}</div></div>` : ""}
    <div id="ats-details">${ats.regeln.map((x) => `<div class="ats-regel">
      <div class="ats-zeile"><span>${esc(x.titel)}</span><b class="${x.erreicht === x.max ? "ok-text" : ""}">${x.erreicht}/${x.max}</b></div>
      ${x.tipp ? `<div class="muted small">${esc(x.tipp)}</div>` : ""}</div>`).join("")}</div>
    <p class="muted small">Grundlage: einspaltiges Layout, echter Text, Standard-Überschriften – das ist bei der Vorlage „Klassisch“ immer erfüllt.</p>`;
}

/* ================================================================
   VORSCHAU / HTML-RENDERING (gleiches HTML für Vorschau, Druck, PDF)
   ================================================================ */
function abschnittTitel(a) { return (TITEL[a] || ["", ""])[CV.cv.design.titel_de ? 0 : 1]; }
const zeitraum = (s, e) => [s, e].filter(Boolean).join(" – ");
const heute = (s) => (CV.cv.design.titel_de ? s : s.replace(/^heute$/i, "present"));

function cvDokument(zoom = 1) {
  const p = CV.profil, c = CV.cv, d = c.design;
  const name = [p.persoenlich.vorname, p.persoenlich.nachname].filter(Boolean).join(" ");
  const k = p.kontakt;
  const adresse = [k.strasse, [k.plz, k.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const kontakt = [k.email, k.telefon, adresse, k.linkedin.replace(/^https?:\/\/(www\.)?/, ""), k.xing.replace(/^https?:\/\/(www\.)?/, ""),
    k.website.replace(/^https?:\/\/(www\.)?/, "")].filter(Boolean).map(esc).join(" &nbsp;|&nbsp; ");
  const liste = (punkte) => punkte.length ? `<ul>${punkte.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "";
  const eintrag = (titel, unter, zeit, punkte) => `<div class="eintrag">
      <div class="zeile"><span class="titel">${esc(titel)}</span><span class="zeit">${esc(heute(zeit))}</span></div>
      ${unter ? `<div class="unter">${esc(unter)}</div>` : ""}${liste(punkte)}</div>`;
  const teile = {
    zusammenfassung: () => c.zusammenfassung && `<p class="text">${esc(c.zusammenfassung).replace(/\n/g, "<br>")}</p>`,
    erfahrung: () => c.erfahrung.map((e) => eintrag(e.rolle, [e.firma, e.ort].filter(Boolean).join(", "), zeitraum(e.start, e.ende), e.punkte)).join(""),
    bildung: () => c.bildung.map((e) => eintrag(e.abschluss, [e.institution, e.ort].filter(Boolean).join(", "), zeitraum(e.start, e.ende), e.punkte)).join(""),
    skills: () => c.skills.map((g) => `<p class="skill">${g.gruppe ? `<b>${esc(g.gruppe)}:</b> ` : ""}${g.eintraege.map(esc).join(" · ")}</p>`).join(""),
    sprachen: () => p.sprachen.length && `<p class="skill">${p.sprachen.map((s) => `${esc(s.sprache)}${s.niveau ? ` (${esc(s.niveau)})` : ""}`).join(" · ")}</p>`,
    zertifikate: () => liste(c.zertifikate.map((z) => [z.name, [z.aussteller, z.datum].filter(Boolean).join(", ")].filter(Boolean).join(" – "))),
    projekte: () => c.projekte.map((x) => `<p class="skill"><b>${esc(x.name)}</b>${x.beschreibung ? ` – ${esc(x.beschreibung)}` : ""}</p>`).join(""),
  };
  const abschnitte = d.reihenfolge.map((a) => {
    if (a === "eigene") return c.eigene.map((e) => `<section><h2>${esc(e.titel)}</h2>${liste(e.punkte)}</section>`).join("");
    const inhalt = teile[a]?.();
    return inhalt ? `<section><h2>${esc(abschnittTitel(a))}</h2>${inhalt}</section>` : "";
  }).join("");
  const schrift = d.schrift === "serif" ? 'Georgia, "Times New Roman", serif' : 'Helvetica, Arial, "Liberation Sans", sans-serif';
  return `<!doctype html><html lang="${d.titel_de ? "de" : "en"}"><head><meta charset="utf-8"><title>Lebenslauf ${esc(name)}</title>
<style>
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; background: #fff; }
body { font-family: ${schrift}; color: #1d2130; font-size: 10pt; line-height: 1.42; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.seite { width: 210mm; padding: 15mm 17mm 14mm; zoom: ${zoom}; }
h1 { font-size: 21pt; margin: 0; color: ${d.akzent}; letter-spacing: -.01em; line-height: 1.15; }
.headline { font-size: 11.5pt; color: #4a4f63; margin-top: 3px; }
.kontakt { font-size: 8.8pt; color: #4a4f63; margin-top: 5px; }
h2 { font-size: 9.5pt; text-transform: uppercase; letter-spacing: .09em; color: ${d.akzent}; margin: 15px 0 7px; padding-bottom: 3px; border-bottom: 1px solid ${d.akzent}55; }
section { break-inside: auto; }
.eintrag { margin-bottom: 8px; break-inside: avoid; }
.zeile { display: flex; justify-content: space-between; gap: 12px; }
.titel { font-weight: 700; }
.zeit { color: #4a4f63; white-space: nowrap; font-size: 9.3pt; }
.unter { color: #4a4f63; font-size: 9.3pt; }
ul { margin: 3px 0 0; padding-left: 15px; }
li { margin: 1px 0; }
p { margin: 0 0 4px; }
.text { text-align: left; }
</style></head><body><div class="seite">
<header><h1>${esc(name || "Dein Name")}</h1>
${c.headline || p.persoenlich.titel ? `<div class="headline">${esc(c.headline || p.persoenlich.titel)}</div>` : ""}
${kontakt ? `<div class="kontakt">${kontakt}</div>` : ""}</header>
${abschnitte}
</div></body></html>`;
}

function planeVorschau(ms = 250) {
  clearTimeout(CV.vorschauTimer);
  CV.vorschauTimer = setTimeout(zeichneVorschau, ms);
}

const A4_PX = { b: 794, h: 1123 };   // A4 bei 96 dpi

function zeichneVorschau() {
  const frame = $("#cv-vorschau");
  if (!frame) return;
  const html = cvDokument(1);
  frame.onload = () => {
    const doc = frame.contentDocument;
    const hoehe = doc.querySelector(".seite").scrollHeight;
    CV.seitenRoh = hoehe / A4_PX.h;
    CV.zoom = CV.cv.design.eine_seite && hoehe > A4_PX.h ? Math.max(.72, A4_PX.h / hoehe - .005) : 1;
    if (CV.zoom < 1) doc.querySelector(".seite").style.zoom = CV.zoom;
    const neueHoehe = hoehe * CV.zoom;
    CV.seiten = Math.max(1, Math.ceil(neueHoehe / A4_PX.h - .02));
    frame.style.height = `${Math.max(A4_PX.h, CV.seiten * A4_PX.h)}px`;
    skaliereVorschau();
    const info = $("#cv-seiten");
    if (info) {
      info.textContent = `${CV.seiten} Seite${CV.seiten > 1 ? "n" : ""} · A4`
        + (CV.zoom < 1 ? ` · auf ${Math.round(CV.zoom * 100)} % verkleinert` : "")
        + (CV.cv.design.eine_seite && CV.zoom <= .72 && CV.seiten > 1 ? " – zu viel Inhalt für eine Seite, bitte kürzen" : "");
    }
    if (CV_SCHRITTE[CV.schritt][0] === "check" && $("#ats-box")) $("#ats-box").innerHTML = atsHtml(atsCheck());
  };
  frame.srcdoc = html;
}

function skaliereVorschau() {
  const rahmen = $("#cv-rahmen"), frame = $("#cv-vorschau");
  if (!rahmen || !frame) return;
  const s = Math.min(1, rahmen.clientWidth / A4_PX.b);
  frame.style.transform = `scale(${s})`;
  rahmen.style.height = `${parseFloat(frame.style.height || A4_PX.h) * s}px`;
}

/* ---------- Export ---------- */
async function speichereCvPdf(zusatz, knopf) {
  const name = [CV.profil.persoenlich.vorname, CV.profil.persoenlich.nachname].filter(Boolean).join(" ");
  if (!name) { toast("Bitte zuerst im Profil deinen Namen eintragen", true); return null; }
  if (!CV.chrome) { druckeCv(); return null; }
  if (knopf) knopf.disabled = true;
  const r = await sicher(() => api("/api/cv/pdf", { html: cvDokument(CV.zoom), name, zusatz, eine_seite: CV.cv.design.eine_seite }));
  if (knopf) knopf.disabled = false;
  if (r) toast(`In Unterlagen gespeichert: ${r.pfad}`);
  return r;
}

async function exportierePdf() {
  if (!CV.profil.persoenlich.vorname) { CV.schritt = 0; zeichneSchritt(); }
  const r = await speichereCvPdf(CV.cv.zielstelle.firma, $("#cv-download"));
  if (r) await sicher(() => api("/api/oeffnen", { pfad: r.pfad }));
}

function druckeCv() {
  const w = window.open("", "_blank");
  if (!w) { toast("Pop-up wurde blockiert", true); return; }
  w.document.write(cvDokument(CV.zoom));
  w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 400);
}

/* ================================================================
   PDF-IMPORT
   ================================================================ */
function importDialog() {
  dialog(`<div class="dialog-body">
    <h2>Lebenslauf aus PDF übernehmen</h2>
    <p class="muted">Wähle ein oder mehrere PDFs (z. B. deinen aktuellen CV und den LinkedIn-Profil-Export). Der Text wird lokal ausgelesen und von Claude strukturiert – kaputte Zeichen werden repariert. Erfunden wird nichts.</p>
    ${!CV.claude ? `<div class="hinweis">${ICON.bell}<div>Claude Code wurde nicht gefunden – der Import braucht <code>claude</code>.</div></div>` : ""}
    <label class="dropzone" id="imp-drop">${ICON_CV.upload}<span><b>PDF hierher ziehen</b> oder klicken zum Auswählen</span>
      <input type="file" id="imp-datei" accept="application/pdf,.pdf" multiple hidden></label>
    <div id="imp-dateien" class="imp-dateien"></div>
    ${CV.pdfs.length ? `<div class="vorschau-titel">Oder aus dem Projektordner</div>
      <div class="imp-liste">${CV.pdfs.map((p) => `<label class="check"><input type="checkbox" value="${esc(p.pfad)}" data-imp-pfad> ${esc(p.pfad)}</label>`).join("")}</div>` : ""}
    <div id="imp-status"></div>
  </div>
  <div class="dialog-foot"><button class="btn" data-schliessen>Abbrechen</button>
    <button class="btn btn-primary" id="imp-start" ${CV.claude ? "" : "disabled"}>${ICON.spark}Mit Claude auslesen</button></div>`, (d) => {
    const dateien = [];
    const zeige = () => { $("#imp-dateien", d).innerHTML = dateien.map((f) => `<span class="chip">${ICON.doc}${esc(f.name)}</span>`).join(""); };
    const hinzu = (liste) => { [...liste].filter((f) => /\.pdf$/i.test(f.name)).forEach((f) => dateien.push(f)); zeige(); };
    const drop = $("#imp-drop", d);
    $("#imp-datei", d).addEventListener("change", (e) => hinzu(e.target.files));
    drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("aktiv"); });
    drop.addEventListener("dragleave", () => drop.classList.remove("aktiv"));
    drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("aktiv"); hinzu(e.dataTransfer.files); });
    $("#imp-start", d).addEventListener("click", async () => {
      const pfade = $$("[data-imp-pfad]:checked", d).map((x) => x.value);
      if (!dateien.length && !pfade.length) { toast("Bitte mindestens eine PDF wählen", true); return; }
      const knopf = $("#imp-start", d);
      knopf.disabled = true;
      $("#imp-status", d).innerHTML = `<div class="hinweis info"><span class="spinner"></span><div>Claude liest deine Unterlagen … das dauert meist 30–90 Sekunden.</div></div>`;
      try {
        const hochgeladen = await Promise.all(dateien.map(async (f) => ({ name: f.name, b64: await alsBase64(f) })));
        const r = await api("/api/cv/import", { dateien: hochgeladen, pfade });
        importErgebnis(r);
      } catch (e) {
        $("#imp-status", d).innerHTML = `<div class="hinweis">${ICON.bell}<div>${esc(e.message)}</div></div>`;
        knopf.disabled = false;
      }
    });
  });
}

function alsBase64(datei) {
  return new Promise((ok, fehler) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(",")[1] || "");
    r.onerror = () => fehler(new Error(`${datei.name} konnte nicht gelesen werden`));
    r.readAsDataURL(datei);
  });
}

function importErgebnis(r) {
  const c = r.lebenslauf, p = r.profil;
  const zahlen = [[c.erfahrung.length, "Stationen"], [c.bildung.length, "Bildungseinträge"],
    [c.skills.reduce((n, g) => n + g.eintraege.length, 0), "Skills"], [c.zertifikate.length, "Zertifikate"], [p.sprachen.length, "Sprachen"]];
  dialog(`<div class="dialog-body">
    <h2>Gefunden in ${r.quellen.map(esc).join(", ")}</h2>
    <div class="imp-zahlen">${zahlen.map(([n, l]) => `<div class="vz"><b>${n}</b><div class="muted small">${l}</div></div>`).join("")}</div>
    <div class="imp-vorschau">
      <b>${esc([p.persoenlich.vorname, p.persoenlich.nachname].join(" "))}</b> – ${esc(p.persoenlich.titel)}<br>
      <span class="muted small">${esc([p.kontakt.email, p.kontakt.telefon, p.kontakt.ort].filter(Boolean).join(" · "))}</span>
      <ul>${c.erfahrung.slice(0, 6).map((e) => `<li>${esc(e.rolle)} – ${esc(e.firma)} <span class="muted">(${esc(zeitraum(e.start, e.ende))})</span></li>`).join("")}</ul>
    </div>
    <label class="schalter-zeile"><div class="zeile-main"><b>Lebenslauf-Inhalte ersetzen</b><span class="muted small">Zusammenfassung, Stationen, Bildung, Skills, Zertifikate, Projekte</span></div>
      <span class="schalter"><input type="checkbox" id="imp-cv" checked><span></span></span></label>
    <label class="schalter-zeile"><div class="zeile-main"><b>Profil ergänzen</b><span class="muted small">Füllt nur leere Felder im Profil – vorhandene Angaben bleiben</span></div>
      <span class="schalter"><input type="checkbox" id="imp-profil" checked><span></span></span></label>
    <label class="schalter-zeile"><div class="zeile-main"><b>Profil überschreiben</b><span class="muted small">Ersetzt auch bereits ausgefüllte Profilfelder</span></div>
      <span class="schalter"><input type="checkbox" id="imp-profil-hart"><span></span></span></label>
  </div>
  <div class="dialog-foot"><button class="btn" data-schliessen>Verwerfen</button>
    <button class="btn btn-primary" id="imp-ok">Übernehmen</button></div>`, (d) => {
    $("#imp-ok", d).addEventListener("click", async () => {
      if ($("#imp-cv", d).checked) {
        const design = CV.cv.design, ziel = CV.cv.zielstelle;
        CV.cv = { ...c, design, zielstelle: ziel };
      }
      if ($("#imp-profil-hart", d).checked) CV.profil = fuelle(CV.profil, p, true);
      else if ($("#imp-profil", d).checked) CV.profil = fuelle(CV.profil, p, false);
      const ok = await sicher(async () => {
        await api("/api/cv", CV.cv);
        await api("/api/profil", CV.profil);
        return true;
      }, "Übernommen");
      if (!ok) return;
      d.close();
      await ladeCv(true);
      CV.schritt = 0;
      route();
    });
  });
}

/* Profil zusammenführen: leere Felder füllen (oder alles überschreiben) */
function fuelle(alt, neu, hart) {
  if (Array.isArray(alt)) return hart ? (neu.length ? neu : alt) : (alt.length ? alt : neu);
  if (alt && typeof alt === "object") {
    const out = { ...alt };
    for (const k of Object.keys(alt)) if (k in neu) out[k] = fuelle(alt[k], neu[k], hart);
    return out;
  }
  return hart ? (neu || alt) : (alt || neu);
}

/* ================================================================
   ZERTIFIKATE, PROJEKTE, EIGENE ABSCHNITTE
   (gemeinsam für CV-Editor „Extras“ und Unterlagen)
   ================================================================ */
const dateiUrl = (rel) => "/datei/" + rel.split("/").map(encodeURIComponent).join("/");

function zertifikatKarte(z, i, n) {
  const pdf = /\.pdf$/i.test(z.datei);
  const mini = z.vorschau
    ? `<button type="button" class="zert-mini" data-oeffnen="${esc(z.datei)}" title="Datei öffnen"><img src="${dateiUrl(z.vorschau)}" alt="Vorschau ${esc(z.name)}" loading="lazy">${pdf ? '<span class="chip">PDF</span>' : ""}</button>`
    : `<label class="zert-mini leer-mini" title="PNG, JPG oder PDF hochladen">${ICON_CV.upload}<span>Datei hochladen</span>
        <input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" data-upload="${i}" hidden></label>`;
  return `<div class="eintrag zert">
    ${eintragKopf("c", "zertifikate", i, z.name, n)}
    <div class="zert-grid">
      <div class="zert-links">${mini}
        ${z.datei ? `<div class="zert-knoepfe">
          <label class="btn btn-sm" title="Datei ersetzen">${ICON_CV.upload}Ersetzen<input type="file" accept=".pdf,.png,.jpg,.jpeg" data-upload="${i}" hidden></label>
          <button type="button" class="btn btn-sm btn-soft" data-auslesen="${i}" ${CV.claude ? "" : "disabled"} title="Name, Aussteller, Datum, Nummer und Skills aus der Datei übernehmen">${ICON.spark}Auslesen</button>
        </div>` : ""}
      </div>
      <div class="form-grid">
        ${feld("c", `zertifikate.${i}.name`, "Zertifikat", { voll: true })}
        ${feld("c", `zertifikate.${i}.aussteller`, "Aussteller")}
        ${feld("c", `zertifikate.${i}.datum`, "Datum", { ph: "MM/JJJJ" })}
        ${feld("c", `zertifikate.${i}.nummer`, "Zertifikats-Nummer", { ph: "z. B. ID / Credential-ID" })}
        ${feld("c", `zertifikate.${i}.url`, "Zertifikats-URL", { typ: "url", ph: "https://…" })}
        ${feld("c", `zertifikate.${i}.skills`, "Erlernte Skills (Komma-getrennt)", { modus: "komma", voll: true, ph: "z. B. Prompting, Copilot, KI-Grundlagen" })}
      </div>
    </div></div>`;
}

function extrasHtml(teile = ["zertifikate", "projekte", "eigene"]) {
  const z = CV.cv.zertifikate, pr = CV.cv.projekte, ei = CV.cv.eigene;
  const html = {
    zertifikate: `<h3 class="extra-titel">Zertifikate</h3>
      <label class="dropzone klein" data-dropzone>${ICON_CV.upload}<span><b>Zertifikate hochladen</b> – PNG, JPG oder PDF hierher ziehen oder klicken. Für jede Datei wird ein Eintrag angelegt.</span>
        <input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" multiple data-upload-neu hidden></label>
      ${z.map((e, i) => zertifikatKarte(e, i, z.length)).join("")}
      ${addKnopf("c", "zertifikate", "Zertifikat ohne Datei hinzufügen")}`,
    projekte: `<h3 class="extra-titel">Projekte</h3>
      ${pr.map((e, i) => `<div class="eintrag">${eintragKopf("c", "projekte", i, e.name, pr.length)}
        <div class="form-grid">${feld("c", `projekte.${i}.name`, "Projekt", { voll: true })}
        ${feld("c", `projekte.${i}.beschreibung`, "Beschreibung", { voll: true, zeilen: 2 })}</div></div>`).join("")}
      ${addKnopf("c", "projekte", "Projekt hinzufügen")}`,
    eigene: `<h3 class="extra-titel">Eigene Abschnitte</h3>
      ${ei.map((e, i) => `<div class="eintrag">${eintragKopf("c", "eigene", i, e.titel, ei.length)}
        <div class="form-grid">${feld("c", `eigene.${i}.titel`, "Überschrift", { voll: true, ph: "z. B. Ehrenamt" })}
        ${feld("c", `eigene.${i}.punkte`, "Inhalt (eine Zeile pro Punkt)", { voll: true, modus: "zeilen", zeilen: 3 })}</div></div>`).join("")}
      ${addKnopf("c", "eigene", "Abschnitt hinzufügen")}`,
  };
  return teile.map((t) => html[t]).join("");
}

async function ladeDateiHoch(datei) {
  if (!/\.(pdf|png|jpe?g)$/i.test(datei.name)) throw new Error(`${datei.name}: nur PDF, PNG oder JPG`);
  return api("/api/unterlagen/upload", { name: datei.name, b64: await alsBase64(datei) });
}

function verdrahteDateien(root, neuZeichnen) {
  const neueDateien = async (dateien) => {
    let n = 0;
    for (const f of dateien) {
      const r = await sicher(() => ladeDateiHoch(f));
      if (!r) continue;
      CV.cv.zertifikate.push({ ...structuredClone(LEER.zertifikate), name: f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "), datei: r.datei, vorschau: r.vorschau });
      n++;
    }
    if (n) { speichereSpaeter("cv"); neuZeichnen(); toast(`${n} Zertifikat${n > 1 ? "e" : ""} hochgeladen – „Auslesen“ füllt die Felder automatisch`); }
  };
  root.addEventListener("change", async (e) => {
    const el = e.target;
    if (el.matches("[data-upload-neu]")) { await neueDateien([...el.files]); return; }
    if (el.dataset.upload === undefined || !el.files[0]) return;
    const z = CV.cv.zertifikate[+el.dataset.upload];
    const r = await sicher(() => ladeDateiHoch(el.files[0]), "Datei hochgeladen");
    if (!r) return;
    if (z.datei) api("/api/unterlagen/loeschen", { datei: z.datei, vorschau: z.vorschau }).catch(() => {});
    Object.assign(z, { datei: r.datei, vorschau: r.vorschau });
    speichereSpaeter("cv"); neuZeichnen();
  });
  root.addEventListener("dragover", (e) => { const d = e.target.closest("[data-dropzone]"); if (d) { e.preventDefault(); d.classList.add("aktiv"); } });
  root.addEventListener("dragleave", (e) => e.target.closest("[data-dropzone]")?.classList.remove("aktiv"));
  root.addEventListener("drop", (e) => {
    const d = e.target.closest("[data-dropzone]"); if (!d) return;
    e.preventDefault(); d.classList.remove("aktiv"); neueDateien([...e.dataTransfer.files]);
  });
  root.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-auslesen]"); if (!b) return;
    const z = CV.cv.zertifikate[+b.dataset.auslesen];
    b.disabled = true; b.innerHTML = '<span class="spinner"></span>Liest …';
    const r = await sicher(() => api("/api/unterlagen/auslesen", { datei: z.datei }));
    if (r) {
      const neu = r.zertifikat;
      for (const k of ["name", "aussteller", "datum", "nummer", "url"]) if (neu[k]) z[k] = neu[k];
      if (neu.skills.length) z.skills = [...new Set([...z.skills, ...neu.skills])];
      speichereSpaeter("cv"); toast("Zertifikat ausgelesen – bitte kurz prüfen");
    }
    neuZeichnen();
  });
}

/* ================================================================
   UNTERLAGEN (ersetzt die alte Unterlagen-Seite)
   ================================================================ */
const UNT = { tab: "stamm", docs: null, nachweise: [], typen: [], quellen: [],
  mappe: { firma: "", rolle: "", deckblatt: true, teile: [] }, ergebnis: null };
const UNT_TABS = [
  ["stamm", "Stammdaten", ICON_CV.user],
  ["extras", "Zertifikate, Projekte, Eigene Abschnitte", ICON.star],
  ["nachweise", "Zeugnisse & Nachweise", ICON.doc],
  ["anschreiben", "Anschreiben", ICON.send],
  ["mappe", "Bewerbungsmappe", ICON.pipe],
  ["firmen", "Nach Bewerbung", ICON.brief],
];

async function renderUnterlagen() {
  setHeader("Unterlagen", "Stammdaten, Nachweise und alle Bewerbungsdokumente an einem Ort",
    `<span class="chip ok" id="cv-status">Gespeichert</span>
     <button class="btn" data-finder="bewerbungen">${ICON.finder}Ordner öffnen</button>`);
  $("#view").innerHTML = '<div class="leer">Lade …</div>';
  const [ok, docs, unt] = await Promise.all([ladeCv(true), sicher(() => api("/api/dokumente")), sicher(() => api("/api/unterlagen"))]);
  if (!ok || !docs || !unt) return;
  UNT.docs = docs;
  Object.assign(UNT, { nachweise: unt.nachweise, typen: unt.typen, quellen: unt.quellen });
  $("#view").innerHTML = `
    <div class="tabs tabs-umbruch" role="tablist">${UNT_TABS.map(([id, name, icon]) =>
      `<button class="tab ${UNT.tab === id ? "active" : ""}" data-unt-tab="${id}" role="tab">${icon}${name}</button>`).join("")}</div>
    <div id="unt-inhalt"></div>`;
  $$("[data-unt-tab]").forEach((t) => t.addEventListener("click", () => {
    UNT.tab = t.dataset.untTab;
    $$("[data-unt-tab]").forEach((x) => x.classList.toggle("active", x === t));
    zeichneUnterlagen();
  }));
  const box = $("#unt-inhalt");
  verdrahteEingaben(box);
  verdrahteListen(box, zeichneUnterlagen);
  verdrahteDateien(box, zeichneUnterlagen);
  verdrahteNachweise(box, zeichneUnterlagen);
  verdrahteMappe(box);
  box.addEventListener("click", async (e) => {
    if (e.target.closest("#unt-cv-pdf")) {
      const r = await speichereCvPdf($("#unt-cv-zusatz").value.trim(), e.target.closest("button"));
      if (r) { UNT.docs = await api("/api/dokumente"); zeichneUnterlagen(); }
    }
  });
  zeichneUnterlagen();
}

function zeichneUnterlagen() {
  const box = $("#unt-inhalt");
  if (!box) return;
  box.innerHTML = { stamm: untStamm, extras: untExtras, nachweise: untNachweise, anschreiben: untAnschreiben, mappe: untMappe, firmen: untFirmen }[UNT.tab]();
  if (UNT.tab === "stamm") {
    const f = $("#unt-cv-mini");
    f.onload = () => { f.style.height = `${f.contentDocument.querySelector(".seite").scrollHeight}px`; };
    f.srcdoc = cvDokument(1);
  }
}

const alleDocs = () => Object.values(UNT.docs.gruppen).flat();
const docListe = (liste, leer) => liste.length ? liste.map(docZeile).join("") : `<div class="muted small" style="padding:8px 0">${leer}</div>`;

function untStamm() {
  const p = CV.profil, q = profilVollstaendig();
  const lebenslaeufe = alleDocs().filter((d) => d.typ === "Lebenslauf").sort((a, b) => b.geaendert.localeCompare(a.geaendert));
  return `<div class="unt-grid">
    <div class="card unt-cv">
      <div class="abschnitt-kopf"><h2>Lebenslauf aus dem Editor</h2><a class="btn btn-sm" href="#lebenslauf">Bearbeiten</a></div>
      <p class="abschnitt-text">Speichert den aktuellen Stand als ATS-lesbares PDF in deine Unterlagen (Ordner <code>bewerbungen/</code>).</p>
      <div class="unt-cv-mini-rahmen"><iframe id="unt-cv-mini" title="Lebenslauf-Vorschau"></iframe></div>
      <div class="unt-cv-aktion">
        <label class="feld">Dateizusatz<input type="text" id="unt-cv-zusatz" value="${esc(CV.cv.zielstelle.firma || "")}" placeholder="z. B. Master oder Firmenname"></label>
        <button class="btn btn-primary" id="unt-cv-pdf">${ICON_CV.download}Als PDF in Unterlagen speichern</button>
      </div>
    </div>
    <div class="einst-spalte">
      <div class="card">
        <div class="abschnitt-kopf"><h2>Mein Profil</h2><a class="btn btn-sm" href="#profil">Bearbeiten</a></div>
        <div class="profil-mini"><div class="avatar">${esc((p.persoenlich.vorname[0] || "") + (p.persoenlich.nachname[0] || "")) || ICON_CV.user}</div>
          <div class="zeile-main"><b>${esc([p.persoenlich.vorname, p.persoenlich.nachname].join(" ").trim() || "Noch kein Name")}</b>
            <div class="muted small">${esc(p.persoenlich.titel)}</div>
            <div class="muted small">${esc([p.kontakt.email, p.kontakt.telefon, p.kontakt.ort].filter(Boolean).join(" · "))}</div></div>
          <span class="chip ${q >= 80 ? "ok" : ""}">${q} %</span></div>
      </div>
      <div class="card"><div class="abschnitt-kopf"><h2>Gespeicherte Lebensläufe</h2><span class="muted small">${lebenslaeufe.length}</span></div>
        ${docListe(lebenslaeufe, "Noch keine Lebensläufe gespeichert.")}</div>
      <div class="card"><div class="abschnitt-kopf"><h2>Master-Dateien</h2></div>
        ${docListe(UNT.docs.stamm, "Keine Master-Dateien gefunden.")}</div>
    </div>
  </div>`;
}

function untExtras() {
  const n = CV.cv.zertifikate.length, mitDatei = CV.cv.zertifikate.filter((z) => z.datei).length;
  return `<div class="einst-spalte" style="max-width:980px">
    <div class="hinweis info">${ICON.star}<div>Diese Einträge sind dieselben wie im Lebenslauf-Editor unter „Extras“ – Änderungen erscheinen sofort in beiden Ansichten.
      Aktuell: <b>${n}</b> Zertifikate, davon <b>${mitDatei}</b> mit Datei.</div></div>
    <div class="card">${extrasHtml()}</div>
  </div>`;
}

function untAnschreiben() {
  const briefe = alleDocs().filter((d) => d.typ === "Anschreiben").sort((a, b) => b.geaendert.localeCompare(a.geaendert));
  return `<div class="unt-grid">
    <div class="card"><div class="abschnitt-kopf"><h2>Anschreiben</h2><span class="muted small">${briefe.length}</span></div>
      <p class="abschnitt-text">Vom Bewerbungs-Workflow erstellt. Neue Anschreiben startest du unter <a href="#stellen">Stellen</a>.</p>
      ${docListe(briefe, "Noch keine Anschreiben erstellt.")}</div>
    <div class="card"><div class="abschnitt-kopf"><h2>Bausteine für Anschreiben</h2><span class="muted small">aus deinem Profil</span></div>
      <p class="abschnitt-text">Claude liest diese Notizen bei jedem Anschreiben mit. Hier gehört hin, was nicht im Lebenslauf steht: Motivation, Wechselgrund, Wünsche, No-Gos.</p>
      ${feld("p", "motivation", "", { zeilen: 10, ph: "z. B. Ich will in den systemgestützten B2B-Vertrieb mit CRM, nicht in die reine Kaltakquise …" })}
    </div>
  </div>`;
}

function untFirmen() {
  const d = UNT.docs;
  const firmen = Object.keys(d.gruppen).filter((f) => f !== "Sonstiges").sort((a, b) => a.localeCompare(b, "de"));
  return `<div class="doc-grid">
    ${firmen.length ? firmen.map((f) => {
      const t = state.tracker.find((r) => r.Firma.toLowerCase().replace(/\s/g, "") === f.toLowerCase().replace(/\s/g, ""));
      return `<div class="card"><div class="card-head"><h2>${esc(f)}</h2><span class="spacer"></span>${t ? chipStatus(t.Status) : ""}</div>
        ${d.gruppen[f].map(docZeile).join("")}</div>`;
    }).join("") : '<div class="card leer">Noch keine Unterlagen erstellt.</div>'}
    ${d.gruppen.Sonstiges ? `<div class="card"><div class="card-head"><h2>Sonstiges</h2></div>${d.gruppen.Sonstiges.map(docZeile).join("")}</div>` : ""}
  </div>`;
}

/* ---------- Zeugnisse & Nachweise ---------- */
const TYP_HILFE = {
  Arbeitszeugnis: "„Auswerten“ entschlüsselt die Zeugnissprache und die Gesamtnote.",
  Referenz: "Vorher fragen, ob du die Person als Referenz angeben darfst.",
  Bewerbungsfoto: "Nur beilegen, wenn die Firma ein Foto möchte – in Deutschland freiwillig.",
};
function typRaten(name) {
  const n = name.toLowerCase();
  if (/arbeitszeugnis|zwischenzeugnis|zeugnis.*(obi|gmbh|ag)/.test(n)) return "Arbeitszeugnis";
  if (/ihk|abschluss|gesellen|prüfung/.test(n)) return "Abschlusszeugnis";
  if (/abitur|schul|reife/.test(n)) return "Schulzeugnis";
  if (/teilnahme|weiterbildung|bescheinigung|idvw/.test(n)) return "Weiterbildungsnachweis";
  if (/foto|bewerbungsbild|portrait|porträt/.test(n)) return "Bewerbungsfoto";
  if (/zeugnis/.test(n)) return "Arbeitszeugnis";
  return "Sonstiges";
}

function nachweisKarte(x, i, n) {
  const pdf = /\.pdf$/i.test(x.datei);
  const mini = x.vorschau
    ? `<button type="button" class="zert-mini" data-oeffnen="${esc(x.datei)}" title="Datei öffnen"><img src="${dateiUrl(x.vorschau)}" alt="Vorschau ${esc(x.titel)}" loading="lazy">${pdf ? '<span class="chip">PDF</span>' : ""}</button>`
    : `<label class="zert-mini leer-mini">${ICON_CV.upload}<span>Datei hochladen</span>
        <input type="file" accept=".pdf,.png,.jpg,.jpeg" data-n-upload="${i}" hidden></label>`;
  const referenz = x.typ === "Referenz";
  return `<div class="eintrag zert">
    ${eintragKopf("n", "nachweise", i, [x.typ, x.titel].filter(Boolean).join(" · "), n)}
    <div class="zert-grid">
      <div class="zert-links">${mini}
        ${x.datei ? `<div class="zert-knoepfe">
          <label class="btn btn-sm">${ICON_CV.upload}Ersetzen<input type="file" accept=".pdf,.png,.jpg,.jpeg" data-n-upload="${i}" hidden></label>
          <button type="button" class="btn btn-sm btn-soft" data-n-auswerten="${i}" ${CV.claude ? "" : "disabled"}>${ICON.spark}Auswerten</button>
        </div>` : ""}
      </div>
      <div class="form-grid">
        ${feld("n", `nachweise.${i}.typ`, "Art", { liste: "n-typen", ph: "Arbeitszeugnis, Referenz …", hilfe: TYP_HILFE[x.typ] || "" })}
        ${feld("n", `nachweise.${i}.datum`, "Datum", { ph: "MM/JJJJ" })}
        ${feld("n", `nachweise.${i}.titel`, "Titel", { ph: "z. B. Arbeitszeugnis OBI Jena" })}
        ${feld("n", `nachweise.${i}.aussteller`, referenz ? "Firma" : "Aussteller")}
        ${referenz ? `
          ${feld("n", `nachweise.${i}.kontakt_name`, "Name der Referenz")}
          ${feld("n", `nachweise.${i}.kontakt_position`, "Position")}
          ${feld("n", `nachweise.${i}.kontakt_telefon`, "Telefon", { typ: "tel" })}
          ${feld("n", `nachweise.${i}.kontakt_email`, "E-Mail", { typ: "email" })}` : `
          ${feld("n", `nachweise.${i}.note`, "Note / Bewertung", { ph: "z. B. gut (2)" })}`}
        ${feld("n", `nachweise.${i}.notiz`, "Notiz", { voll: true, ph: "optional, z. B. „nur auf Nachfrage beilegen“" })}
        ${x.auswertung || x.datei ? feld("n", `nachweise.${i}.auswertung`, "Auswertung (Claude)", { voll: true, zeilen: x.auswertung ? 5 : 2, ph: "Noch nicht ausgewertet – „Auswerten“ klicken" }) : ""}
      </div>
    </div></div>`;
}

function untNachweise() {
  const l = UNT.nachweise;
  const fehlt = ["Arbeitszeugnis", "Abschlusszeugnis", "Schulzeugnis"].filter((t) => !l.some((x) => x.typ === t));
  return `<div class="einst-spalte" style="max-width:980px">
    ${fehlt.length ? `<div class="hinweis info">${ICON.bell}<div>Typisch für deutsche Bewerbungen, aber noch nicht hinterlegt: <b>${fehlt.join(", ")}</b>.</div></div>` : ""}
    <div class="card">
      <label class="dropzone klein" data-n-dropzone>${ICON_CV.upload}<span><b>Zeugnisse & Nachweise hochladen</b> – PNG, JPG oder PDF hierher ziehen oder klicken. Die Art wird aus dem Dateinamen geraten.</span>
        <input type="file" accept=".pdf,.png,.jpg,.jpeg" multiple data-n-upload-neu hidden></label>
      ${l.map((x, i) => nachweisKarte(x, i, l.length)).join("")}
      ${addKnopf("n", "nachweise", "Eintrag ohne Datei hinzufügen (z. B. Referenz)")}
      <datalist id="n-typen">${UNT.typen.map((t) => `<option value="${esc(t)}">`).join("")}</datalist>
    </div>
  </div>`;
}

function verdrahteNachweise(root, neuZeichnen) {
  const hoch = (f) => {
    if (!/\.(pdf|png|jpe?g)$/i.test(f.name)) throw new Error(`${f.name}: nur PDF, PNG oder JPG`);
    return alsBase64(f).then((b64) => api("/api/unterlagen/upload", { name: f.name, b64, ordner: "nachweise" }));
  };
  const neue = async (dateien) => {
    let n = 0;
    for (const f of dateien) {
      const r = await sicher(() => hoch(f));
      if (!r) continue;
      UNT.nachweise.push({ ...structuredClone(LEER.nachweise), typ: typRaten(f.name), titel: f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "), datei: r.datei, vorschau: r.vorschau });
      n++;
    }
    if (n) { speichereSpaeter("nachweise"); neuZeichnen(); toast(`${n} Datei${n > 1 ? "en" : ""} hochgeladen – „Auswerten“ füllt die Felder`); }
  };
  root.addEventListener("change", async (e) => {
    const el = e.target;
    if (el.matches("[data-n-upload-neu]")) { await neue([...el.files]); return; }
    if (el.dataset.nUpload === undefined || !el.files[0]) return;
    const x = UNT.nachweise[+el.dataset.nUpload];
    const r = await sicher(() => hoch(el.files[0]), "Datei hochgeladen");
    if (!r) return;
    if (x.datei) api("/api/unterlagen/loeschen", { datei: x.datei, vorschau: x.vorschau }).catch(() => {});
    Object.assign(x, { datei: r.datei, vorschau: r.vorschau });
    speichereSpaeter("nachweise"); neuZeichnen();
  });
  root.addEventListener("dragover", (e) => { const d = e.target.closest("[data-n-dropzone]"); if (d) { e.preventDefault(); d.classList.add("aktiv"); } });
  root.addEventListener("dragleave", (e) => e.target.closest("[data-n-dropzone]")?.classList.remove("aktiv"));
  root.addEventListener("drop", (e) => {
    const d = e.target.closest("[data-n-dropzone]"); if (!d) return;
    e.preventDefault(); d.classList.remove("aktiv"); neue([...e.dataTransfer.files]);
  });
  root.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-n-auswerten]"); if (!b) return;
    const x = UNT.nachweise[+b.dataset.nAuswerten];
    b.disabled = true; b.innerHTML = '<span class="spinner"></span>Liest …';
    const r = await sicher(() => api("/api/nachweise/auswerten", { datei: x.datei, typ: x.typ }));
    if (r) {
      for (const [k, v] of Object.entries(r.nachweis)) if (v) x[k] = v;
      speichereSpaeter("nachweise"); toast("Ausgewertet – bitte kurz prüfen");
    }
    neuZeichnen();
  });
}

/* ---------- Bewerbungsmappe ---------- */
const MAPPE_RANG = { anschreiben: 0, cv: 1, lebenslauf: 1, zeugnis: 2, zertifikat: 3, sonstiges: 4 };
const teilSchluessel = (t) => t.art === "cv" ? "cv" : t.pfad;

function mappeQuellen() {
  const q = UNT.quellen;
  const zertDateien = new Set(CV.cv.zertifikate.map((z) => z.datei).filter(Boolean));
  const nwDateien = new Set(UNT.nachweise.map((x) => x.datei).filter(Boolean));
  const name = (d) => d.name.replace(/\.[^.]+$/, "").replace(/_/g, " ");
  return {
    anschreiben: q.filter((d) => /^bewerbungen\/Anschreiben_/i.test(d.pfad)).map((d) => ({ art: "datei", pfad: d.pfad, titel: "Anschreiben", label: d.name, gruppe: "anschreiben" })),
    lebenslauf: [{ art: "cv", titel: "Lebenslauf", label: "Aktueller Lebenslauf aus dem Editor (empfohlen)", gruppe: "cv" },
      ...q.filter((d) => /Lebenslauf|^CV_/i.test(d.name) && !d.pfad.startsWith("unterlagen/")).map((d) => ({ art: "datei", pfad: d.pfad, titel: "Lebenslauf", label: d.pfad, gruppe: "lebenslauf" }))],
    zeugnis: UNT.nachweise.filter((x) => x.datei && x.typ !== "Bewerbungsfoto").map((x) => ({ art: "datei", pfad: x.datei, titel: x.titel || x.typ, label: [x.typ, x.titel].filter(Boolean).join(" · "), gruppe: "zeugnis" })),
    zertifikat: CV.cv.zertifikate.filter((z) => z.datei).map((z) => ({ art: "datei", pfad: z.datei, titel: `Zertifikat: ${z.name}`, label: [z.name, z.aussteller].filter(Boolean).join(" – "), gruppe: "zertifikat" })),
    sonstiges: q.filter((d) => !/^bewerbungen\/Anschreiben_/i.test(d.pfad) && !/Lebenslauf|^CV_/i.test(d.name) && !zertDateien.has(d.pfad) && !nwDateien.has(d.pfad) && !/\.vorschau/.test(d.pfad))
      .map((d) => ({ art: "datei", pfad: d.pfad, titel: name(d), label: d.pfad, gruppe: "sonstiges" })),
  };
}

function untMappe() {
  const m = UNT.mappe, quellen = mappeQuellen();
  const gewaehlt = new Set(m.teile.map(teilSchluessel));
  const firmen = [...new Set([...state.tracker.map((r) => r.Firma), ...Object.keys(UNT.docs.gruppen).filter((f) => f !== "Sonstiges")])].filter(Boolean);
  const gruppe = (titel, liste, leer) => `<div class="mappe-gruppe"><div class="vorschau-titel">${titel}</div>
    ${liste.length ? liste.map((t) => `<label class="check mappe-wahl"><input type="checkbox" data-mappe-wahl='${esc(JSON.stringify({ art: t.art, pfad: t.pfad, titel: t.titel, gruppe: t.gruppe }))}' ${gewaehlt.has(teilSchluessel(t)) ? "checked" : ""}> <span>${esc(t.label)}</span></label>`).join("")
      : `<div class="muted small">${leer}</div>`}</div>`;
  const e = UNT.ergebnis;
  return `<div class="unt-grid">
    <div class="card">
      <div class="abschnitt-kopf"><h2>1. Für welche Bewerbung?</h2></div>
      <div class="form-grid">
        <label class="feld">Firma<input type="text" id="mappe-firma" list="mappe-firmen" value="${esc(m.firma)}" placeholder="z. B. Jumio"></label>
        <label class="feld">Position<input type="text" id="mappe-rolle" value="${esc(m.rolle)}" placeholder="z. B. Inside Sales Manager"></label>
      </div>
      <datalist id="mappe-firmen">${firmen.map((f) => `<option value="${esc(f)}">`).join("")}</datalist>
      <div class="abschnitt-kopf" style="margin-top:18px"><h2>2. Dokumente auswählen</h2></div>
      ${gruppe("Anschreiben", quellen.anschreiben, "Noch keine Anschreiben – die erstellt der Bewerbungs-Workflow.")}
      ${gruppe("Lebenslauf", quellen.lebenslauf, "")}
      ${gruppe("Zeugnisse & Nachweise", quellen.zeugnis, "Noch keine Dateien unter „Zeugnisse & Nachweise“.")}
      ${gruppe("Zertifikate", quellen.zertifikat, "Noch keine Zertifikate mit Datei hochgeladen.")}
      ${quellen.sonstiges.length ? `<details class="mappe-mehr"><summary>Weitere Dateien (${quellen.sonstiges.length})</summary>${gruppe("", quellen.sonstiges, "")}</details>` : ""}
    </div>
    <div class="einst-spalte sticky">
      <div class="card">
        <div class="abschnitt-kopf"><h2>3. Reihenfolge & erstellen</h2><span class="muted small">${m.teile.length} Dokument${m.teile.length === 1 ? "" : "e"}</span></div>
        <label class="schalter-zeile"><div class="zeile-main"><b>Deckblatt</b><span class="muted small">Name, Position, Firma, Kontakt und Inhaltsverzeichnis</span></div>
          <span class="schalter"><input type="checkbox" id="mappe-deckblatt" ${m.deckblatt ? "checked" : ""}><span></span></span></label>
        <div class="reihenfolge">${m.deckblatt ? '<div class="rf-zeile fest"><span>Deckblatt</span></div>' : ""}
          ${m.teile.map((t, i) => `<div class="rf-zeile"><span title="${esc(t.pfad || "Lebenslauf aus dem Editor")}">${esc(t.titel)}</span>
            <button type="button" class="icon-btn mini" data-mappe-rf="${i}" data-dir="-1" ${i === 0 ? "disabled" : ""}>${ICON_CV.up}</button>
            <button type="button" class="icon-btn mini" data-mappe-rf="${i}" data-dir="1" ${i === m.teile.length - 1 ? "disabled" : ""}>${ICON_CV.down}</button>
            <button type="button" class="icon-btn mini klein" data-mappe-weg="${i}">${ICON.trash}</button></div>`).join("") || '<div class="muted small">Links Dokumente anhaken.</div>'}
        </div>
        <button class="btn btn-primary btn-block" id="mappe-bauen" style="margin-top:14px" ${m.teile.length ? "" : "disabled"}>${ICON_CV.download}Bewerbungsmappe als PDF erstellen</button>
        <p class="muted small">Word-Dateien werden über Microsoft Word in PDF umgewandelt. Beim ersten Mal fragt macOS eventuell nach einer Freigabe.</p>
        ${e ? `<div class="hinweis ${e.warnung ? "" : "info"}">${ICON.doc}<div><b>${esc(e.pfad.split("/").pop())}</b><br>${e.seiten} Seiten · ${(e.groesse / 1048576).toFixed(1)} MB${e.warnung ? `<br>${esc(e.warnung)}` : ""}
          <div class="knopf-reihe"><button class="btn btn-sm" data-oeffnen="${esc(e.pfad)}">Öffnen</button><button class="btn btn-sm" data-finder="${esc(e.pfad)}">Im Finder</button></div></div></div>` : ""}
      </div>
    </div>
  </div>`;
}

function mappeVorauswahl(firma) {
  const m = UNT.mappe, f = firma.toLowerCase().replace(/[\s_]/g, "");
  if (!f) return;
  const q = mappeQuellen();
  const brief = q.anschreiben.find((t) => t.pfad.toLowerCase().replace(/[\s_]/g, "").includes(f));
  m.teile = m.teile.filter((t) => t.gruppe !== "anschreiben");
  if (brief) m.teile.push(brief);
  if (!m.teile.some((t) => t.gruppe === "cv" || t.gruppe === "lebenslauf")) m.teile.push(q.lebenslauf[0]);
  m.teile.sort((a, b) => MAPPE_RANG[a.gruppe] - MAPPE_RANG[b.gruppe]);
  const t = state.tracker.find((r) => r.Firma.toLowerCase().replace(/\s/g, "") === f);
  if (t && !m.rolle) m.rolle = t.Position;
}

function verdrahteMappe(root) {
  root.addEventListener("change", (e) => {
    const el = e.target, m = UNT.mappe;
    if (el.id === "mappe-firma") { m.firma = el.value.trim(); mappeVorauswahl(m.firma); zeichneUnterlagen(); return; }
    if (el.id === "mappe-rolle") { m.rolle = el.value.trim(); return; }
    if (el.id === "mappe-deckblatt") { m.deckblatt = el.checked; zeichneUnterlagen(); return; }
    if (el.dataset.mappeWahl) {
      const t = JSON.parse(el.dataset.mappeWahl);
      if (el.checked) {
        if (t.gruppe === "anschreiben" || t.gruppe === "cv" || t.gruppe === "lebenslauf") {
          const ersetzt = t.gruppe === "anschreiben" ? ["anschreiben"] : ["cv", "lebenslauf"];
          m.teile = m.teile.filter((x) => !ersetzt.includes(x.gruppe));
        }
        m.teile.push(t);
        m.teile.sort((a, b) => MAPPE_RANG[a.gruppe] - MAPPE_RANG[b.gruppe]);
      } else m.teile = m.teile.filter((x) => teilSchluessel(x) !== teilSchluessel(t));
      zeichneUnterlagen();
    }
  });
  root.addEventListener("click", async (e) => {
    const m = UNT.mappe;
    const rf = e.target.closest("[data-mappe-rf]"), weg = e.target.closest("[data-mappe-weg]");
    if (rf) { const i = +rf.dataset.mappeRf, j = i + +rf.dataset.dir; [m.teile[i], m.teile[j]] = [m.teile[j], m.teile[i]]; zeichneUnterlagen(); }
    if (weg) { m.teile.splice(+weg.dataset.mappeWeg, 1); zeichneUnterlagen(); }
    const b = e.target.closest("#mappe-bauen");
    if (!b) return;
    m.rolle = $("#mappe-rolle").value.trim(); m.firma = $("#mappe-firma").value.trim();
    b.disabled = true; b.innerHTML = '<span class="spinner"></span>Erstelle Mappe …';
    const r = await sicher(() => api("/api/mappe", {
      firma: m.firma, rolle: m.rolle, deckblatt: m.deckblatt,
      teile: m.teile.map(({ art, pfad, titel }) => ({ art, pfad, titel })),
      cv_html: m.teile.some((t) => t.art === "cv") ? cvDokument(CV.zoom) : "",
    }), "Bewerbungsmappe erstellt");
    if (r) { UNT.ergebnis = r; UNT.docs = await api("/api/dokumente"); }
    zeichneUnterlagen();
  });
}

VIEWS.dokumente = renderUnterlagen;

VIEWS.profil = renderProfil;
VIEWS.lebenslauf = renderLebenslauf;
