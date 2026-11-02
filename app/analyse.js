/* JobScout Cockpit – Stellenanalyse: Lebenslauf-Bibliothek, Analyse-Ebene,
   CV-Vergleich, Vorschläge, Anschreiben, Abschluss.
   Nutzt Helfer aus app.js ($, $$, esc, api, sicher, toast, dialog, ICON)
   und lebenslauf.js (CV, ladeCv, cvDokument, alsBase64). */
"use strict";

const AN = {
  uebersicht: null, fall: null, tracker: null, tab: "analysen", schritt: 0,
  vergleichWahl: new Set(), cvCache: {}, vorschauCv: "", vorschauTab: "cv",
  cvTab: "vorschlaege", busy: "", fehler: "", saveTimer: null, cvZoom: 1,
  mappeQuellen: null, unterlagenWahl: new Set(),
};

const AN_SCHRITTE = [
  ["stelle", "Stelle"], ["analyse", "Analyse"], ["vergleich", "Vergleich"],
  ["lebenslauf", "Lebenslauf"], ["anschreiben", "Anschreiben"], ["abschluss", "Abschluss"],
];
const AN_QUELLE = { pdf: "PDF-Anzeige", suche: "Automatische Suche", text: "Eingefügter Text" };
const AN_ICON = {
  upload: '<svg viewBox="0 0 24 24"><path d="M12 15V3M7 8l5-5 5 5"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  undo: '<svg viewBox="0 0 24 24"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>',
  chart: '<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>',
  dl: '<svg viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/></svg>',
};

const anUrl = (pfad) => `/api/analyse/download?pfad=${encodeURIComponent(pfad)}`;
const anTage = (iso) => (iso ? fmtDatum(iso) : "");

/* ---------- Daten ---------- */
async function anLadeUebersicht() {
  const d = await sicher(() => api("/api/analyse"));
  if (d) AN.uebersicht = d;
  return !!d;
}

async function anLadeFall(id) {
  const d = await sicher(() => api(`/api/analyse/fall?id=${encodeURIComponent(id)}`));
  if (!d) return false;
  AN.fall = d.fall;
  AN.tracker = d.tracker;
  AN.cvListe = d.cvs;
  return true;
}

function anQuery() {
  const q = (location.hash.split("?")[1] || "");
  return Object.fromEntries(new URLSearchParams(q));
}

/* ================================================================
   EINSTIEG / ÜBERSICHT
   ================================================================ */
async function renderAnalyse() {
  const q = anQuery();
  if (q.fall) return renderFall(q.fall);
  AN.fall = null;
  if (!(await anLadeUebersicht())) return;
  zeichneUebersicht();
}

function zeichneUebersicht() {
  const u = AN.uebersicht;
  setHeader("Analyse", "Stellen verstehen, Lebenslauf anpassen, Anschreiben erstellen",
    `<button class="btn" id="an-text">${ICON.doc}Text einfügen</button>
     <button class="btn btn-primary" id="an-pdf">${AN_ICON.upload}PDF-Anzeige hochladen</button>`);
  $("#view").innerHTML = `
    <div class="tabs">
      <button class="tab ${AN.tab === "analysen" ? "active" : ""}" data-antab="analysen">Analysen (${u.faelle.length})</button>
      <button class="tab ${AN.tab === "cvs" ? "active" : ""}" data-antab="cvs">Meine Lebensläufe (${u.cvs.length}/${u.max_cvs})</button>
    </div>
    <div id="an-inhalt"></div>`;
  $$("[data-antab]").forEach((b) => b.addEventListener("click", () => { AN.tab = b.dataset.antab; zeichneUebersicht(); }));
  $("#an-pdf").addEventListener("click", () => anzeigeDialog("pdf"));
  $("#an-text").addEventListener("click", () => anzeigeDialog("text"));
  AN.tab === "cvs" ? zeichneCvBibliothek() : zeichneFallListe();
}

function zeichneFallListe() {
  const u = AN.uebersicht;
  $("#an-inhalt").innerHTML = u.faelle.length ? `<div class="an-karten">${u.faelle.map((f) => `
    <div class="card an-fall" data-fall="${f.id}">
      <div class="an-fall-kopf">
        <div><div class="zeile-titel">${esc(f.titel)}</div><div class="muted small">${esc(f.firma || "Firma noch unbekannt")}</div></div>
        <button class="btn btn-sm btn-danger" data-fall-loeschen="${f.id}" title="Analyse löschen">${ICON.trash}</button>
      </div>
      <div class="an-bar"><i style="width:${f.fortschritt}%"></i></div>
      <div class="an-fall-fuss">
        <span class="chip">${esc(AN_QUELLE[f.quelle] || f.quelle)}</span>
        <span class="chip info">Schritt ${f.schritt + 1}: ${AN_SCHRITTE[f.schritt][1]}</span>
        ${f.score != null ? `<span class="chip ok">CV-Passung ${f.score}</span>` : ""}
        <span class="muted small" style="margin-left:auto">${anTage(f.aktualisiert)}</span>
      </div>
    </div>`).join("")}</div>` : `
    <div class="card leer">
      <b>Noch keine Analyse.</b><br>
      Lade eine PDF-Stellenanzeige hoch, füge einen Anzeigentext ein oder klicke bei einer Stelle aus der automatischen Suche auf <i>Analysieren</i>.
      <div style="margin-top:14px"><a class="btn btn-soft" href="#stellen">Zu den Stellen</a></div>
    </div>`;
  $$("[data-fall]").forEach((k) => k.addEventListener("click", (e) => {
    if (e.target.closest("[data-fall-loeschen]")) return;
    location.hash = `#analyse?fall=${k.dataset.fall}`;
  }));
  $$("[data-fall-loeschen]").forEach((b) => b.addEventListener("click", async () => {
    if (!confirm("Diese Analyse samt Lebenslauf-Anpassung und Anschreiben löschen?")) return;
    if (await sicher(() => api("/api/analyse/fall/loeschen", { id: b.dataset.fallLoeschen }), "Analyse gelöscht")) {
      await anLadeUebersicht();
      zeichneUebersicht();
    }
  }));
}

/* ---------- Lebenslauf-Bibliothek ---------- */
function zeichneCvBibliothek() {
  const u = AN.uebersicht;
  const voll = u.cvs.length >= u.max_cvs;
  $("#an-inhalt").innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div class="card-head"><h2>Lebensläufe hochladen</h2><div class="spacer"></div>
        <span class="chip ${voll ? "warn" : ""}">${u.cvs.length} / ${u.max_cvs} belegt</span></div>
      <p class="muted" style="margin:0 0 12px">Lege bis zu ${u.max_cvs} Lebenslauf-Varianten an (z. B. „Vertrieb“, „RevOps“, „Quereinstieg“). In einer Analyse stellst du bis zu ${u.max_vergleich} davon der Stelle gegenüber.</p>
      ${!u.claude ? `<div class="hinweis">${ICON.bell}<div>Claude Code wurde nicht gefunden – das Auslesen von PDFs braucht <code>claude</code>.</div></div>` : ""}
      <div class="an-cv-aktion">
        <label class="dropzone" id="an-cv-drop" ${voll ? 'style="opacity:.5;pointer-events:none"' : ""}>${AN_ICON.upload}<span><b>PDF hierher ziehen</b> oder klicken</span>
          <input type="file" id="an-cv-datei" accept="application/pdf,.pdf" multiple hidden></label>
        <button class="btn btn-soft" id="an-cv-master" ${voll || !u.master_vorhanden ? "disabled" : ""} title="${u.master_vorhanden ? "" : "Im Lebenslauf-Editor ist noch nichts hinterlegt"}">Master-Lebenslauf aus dem Editor übernehmen</button>
      </div>
      <div id="an-cv-status"></div>
    </div>
    ${u.cvs.length ? `<div class="an-karten">${u.cvs.map(cvKarte).join("")}</div>` : `<div class="card leer">Noch kein Lebenslauf in der Bibliothek.</div>`}`;
  const drop = $("#an-cv-drop");
  $("#an-cv-datei").addEventListener("change", (e) => cvHochladen([...e.target.files]));
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("aktiv"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("aktiv"));
  drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("aktiv"); cvHochladen([...e.dataTransfer.files]); });
  $("#an-cv-master").addEventListener("click", async () => {
    const r = await sicher(() => api("/api/analyse/cv/hinzufuegen", { master: true, name: "Master-Lebenslauf" }), "Master-Lebenslauf übernommen");
    if (r) { await anLadeUebersicht(); zeichneUebersicht(); }
  });
  $$("[data-cv-ansehen]").forEach((b) => b.addEventListener("click", () => cvAnsehen(b.dataset.cvAnsehen)));
  $$("[data-cv-name]").forEach((b) => b.addEventListener("click", () => cvUmbenennen(b.dataset.cvName)));
  $$("[data-cv-loeschen]").forEach((b) => b.addEventListener("click", async () => {
    const c = u.cvs.find((x) => x.id === b.dataset.cvLoeschen);
    if (!confirm(`„${c.name}“ aus der Bibliothek löschen?`)) return;
    if (await sicher(() => api("/api/analyse/cv/loeschen", { id: c.id }), "Lebenslauf gelöscht")) {
      delete AN.cvCache[c.id];
      await anLadeUebersicht();
      zeichneUebersicht();
    }
  }));
}

function cvKarte(c) {
  return `<div class="card an-cv">
    <div class="an-fall-kopf"><div><div class="zeile-titel">${esc(c.name)}</div>
      <div class="muted small">${esc(c.headline || "Keine Überschrift")}</div></div>
      <span class="chip">${c.quelle === "master" ? "Editor" : "PDF"}</span></div>
    <div class="an-cv-zahlen"><span><b>${c.stationen}</b> Stationen</span><span><b>${c.skills}</b> Skills</span><span class="muted small">${anTage(c.erstellt)}</span></div>
    <div class="an-fall-fuss">
      <button class="btn btn-sm" data-cv-ansehen="${c.id}">Ansehen</button>
      <button class="btn btn-sm" data-cv-name="${c.id}">Umbenennen</button>
      <button class="btn btn-sm btn-danger" data-cv-loeschen="${c.id}" style="margin-left:auto">${ICON.trash}</button>
    </div></div>`;
}

async function cvHochladen(dateien) {
  const pdfs = dateien.filter((f) => /\.pdf$/i.test(f.name));
  if (!pdfs.length) { toast("Bitte PDF-Dateien wählen", true); return; }
  const status = $("#an-cv-status");
  const frei = AN.uebersicht.max_cvs - AN.uebersicht.cvs.length;
  if (pdfs.length > frei) toast(`Nur noch ${frei} Platz – die übrigen Dateien werden übersprungen`, true);
  let ok = 0;
  for (const f of pdfs.slice(0, frei)) {
    status.innerHTML = `<div class="hinweis info"><span class="an-spin"></span><div>Claude liest „${esc(f.name)}“ … das dauert meist 30–90 Sekunden.</div></div>`;
    try {
      await api("/api/analyse/cv/hinzufuegen", { name: f.name, b64: await alsBase64(f) });
      ok++;
    } catch (e) {
      toast(`${f.name}: ${e.message}`, true);
    }
  }
  if (ok) toast(`${ok} Lebenslauf${ok > 1 ? "/Lebensläufe" : ""} hinzugefügt`);
  await anLadeUebersicht();
  zeichneUebersicht();
}

async function anCvHolen(id) {
  if (!AN.cvCache[id]) {
    const r = await sicher(() => api("/api/analyse/cv/lesen", { id }));
    if (!r) return null;
    AN.cvCache[id] = r.cv;
  }
  return AN.cvCache[id];
}

async function cvAnsehen(id) {
  const c = await anCvHolen(id);
  if (!c || !(await ladeCv())) return;
  dialog(`<div class="dialog-body"><h2>${esc(c.name)}</h2>
      <div class="an-papier-rahmen" id="an-dlg-rahmen"></div></div>
    <div class="dialog-foot"><button class="btn" data-schliessen>Schließen</button></div>`,
    (d) => cvIframe($("#an-dlg-rahmen", d), c.lebenslauf, false));
}

function cvUmbenennen(id) {
  const c = AN.uebersicht.cvs.find((x) => x.id === id);
  dialog(`<div class="dialog-body"><h2>Lebenslauf umbenennen</h2>
    <label class="feld">Name<input type="text" id="an-neuer-name" value="${esc(c.name)}" maxlength="80"></label></div>
    <div class="dialog-foot"><button class="btn" data-schliessen>Abbrechen</button><button class="btn btn-primary" id="an-name-ok">Speichern</button></div>`, (d) => {
    $("#an-name-ok", d).addEventListener("click", async () => {
      const r = await sicher(() => api("/api/analyse/cv/aendern", { id, name: $("#an-neuer-name", d).value }));
      if (r) { d.close(); await anLadeUebersicht(); zeichneUebersicht(); }
    });
  });
}

/* ---------- Anzeige hinzufügen (PDF / Text) ---------- */
function anzeigeDialog(modus = "pdf") {
  dialog(`<div class="dialog-body">
    <h2>Stellenanzeige hinzufügen</h2>
    <div class="segment" id="an-modus"><button data-m="pdf" class="${modus === "pdf" ? "an" : ""}">PDF hochladen</button><button data-m="text" class="${modus === "text" ? "an" : ""}">Text einfügen</button></div>
    <div id="an-modus-inhalt"></div><div id="an-dlg-status"></div></div>
    <div class="dialog-foot"><button class="btn" data-schliessen>Abbrechen</button></div>`, (d) => {
    const zeige = (m) => {
      $$("#an-modus button", d).forEach((b) => b.classList.toggle("an", b.dataset.m === m));
      $("#an-modus-inhalt", d).innerHTML = m === "pdf" ? `
        <p class="muted" style="margin:0">Die Anzeige wird lokal ausgelesen und danach analysiert. Das PDF braucht echten Text (kein Scan).</p>
        <label class="dropzone" id="an-a-drop">${AN_ICON.upload}<span><b>PDF hierher ziehen</b> oder klicken</span>
          <input type="file" id="an-a-datei" accept="application/pdf,.pdf" hidden></label>` : `
        <div class="an-form-zeile"><label class="feld">Titel (optional)<input type="text" id="an-t-titel"></label>
          <label class="feld">Firma (optional)<input type="text" id="an-t-firma"></label></div>
        <label class="feld">Anzeigentext<textarea id="an-t-text" rows="9" placeholder="Text der Stellenanzeige hier einfügen …"></textarea></label>
        <div style="text-align:right"><button class="btn btn-primary" id="an-t-ok">Anzeige übernehmen</button></div>`;
      if (m === "pdf") {
        const drop = $("#an-a-drop", d);
        $("#an-a-datei", d).addEventListener("change", (e) => legeAn(d, e.target.files[0], null));
        drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("aktiv"); });
        drop.addEventListener("dragleave", () => drop.classList.remove("aktiv"));
        drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("aktiv"); legeAn(d, e.dataTransfer.files[0], null); });
      } else {
        $("#an-t-ok", d).addEventListener("click", () => legeAn(d, null, {
          art: "text", titel: $("#an-t-titel", d).value, firma: $("#an-t-firma", d).value, text: $("#an-t-text", d).value }));
      }
    };
    $$("#an-modus button", d).forEach((b) => b.addEventListener("click", () => zeige(b.dataset.m)));
    zeige(modus);
  });
}

async function legeAn(d, datei, daten) {
  const status = $("#an-dlg-status", d);
  try {
    if (datei) {
      if (!/\.pdf$/i.test(datei.name)) throw new Error("Bitte eine PDF-Datei wählen");
      status.innerHTML = `<div class="hinweis info"><span class="an-spin"></span><div>Anzeige wird ausgelesen …</div></div>`;
      daten = { art: "pdf", name: datei.name, b64: await alsBase64(datei) };
    }
    const r = await api("/api/analyse/fall/anlegen", daten);
    d.close();
    location.hash = `#analyse?fall=${r.id}`;
  } catch (e) {
    status.innerHTML = `<div class="hinweis">${ICON.bell}<div>${esc(e.message)}</div></div>`;
  }
}

/* Aus der Stellen-Liste */
async function stelleAnalysieren(job) {
  const r = await sicher(() => api("/api/analyse/fall/anlegen", {
    art: "job", titel: job.titel, firma: job.firma, ort: job.ort, link: job.link, score: job.score, job_id: job.id }));
  if (r) location.hash = `#analyse?fall=${r.id}`;
}

/* ================================================================
   FALL (Analyse-Ebene im Referenz-Layout)
   ================================================================ */
async function renderFall(id) {
  if (!AN.fall || AN.fall.id !== id) {
    AN.busy = ""; AN.fehler = ""; AN.vorschauCv = ""; AN.vorschauTab = "cv"; AN.cvDirty = false; AN.briefDirty = false;
    AN.vergleichWahl = new Set(); AN.unterlagenWahl = new Set();
    if (!(await anLadeFall(id))) { location.hash = "#analyse"; return; }
    AN.schritt = Math.min(AN.fall.schritt || 0, 5);
    AN.vergleichWahl = new Set(AN.fall.vergleich?.cv_ids || []);
  }
  await ladeCv();
  zeichneFall();
}

function fallFortschritt() {
  const f = AN.fall;
  return Math.round(100 * [f.text || f.link, f.analyse, f.vergleich, f.cv, f.anschreiben, f.abschluss].filter(Boolean).length / 6);
}

function schrittFrei(i) {
  const f = AN.fall;
  return [true, !!(f.text || f.link), !!f.analyse, !!f.analyse && !!f.cv || !!f.vergleich, !!f.cv, !!f.anschreiben][i];
}

function zeichneFall() {
  const f = AN.fall;
  const p = fallFortschritt();
  setHeader("Analyse", `${f.titel}${f.firma ? " · " + f.firma : ""}`,
    `<a class="btn" href="#analyse">${AN_ICON.back}Alle Analysen</a>`);
  $("#view").innerHTML = `
    <div class="an-layout">
      <div class="an-links">
        <div class="card an-kopf">
          <input type="text" id="an-titel" value="${esc(f.titel)}" aria-label="Titel der Stelle" maxlength="160">
          <span class="an-prozent">${p}% erledigt</span>
          <div class="an-bar gross"><i style="width:${p}%"></i></div>
        </div>
        <div class="card an-schritte">${AN_SCHRITTE.map(([k, l], i) => `
          <button class="an-schritt ${AN.schritt === i ? "aktiv" : ""} ${schrittFrei(i) ? "" : "gesperrt"}" data-schritt="${i}">${i + 1}. ${l}</button>`).join("")}</div>
        <div class="card an-panel" id="an-panel"></div>
      </div>
      <div class="an-rechts" id="an-rechts"></div>
    </div>`;
  $("#an-titel").addEventListener("change", async (e) => {
    const r = await sicher(() => api("/api/analyse/fall/text", { id: f.id, titel: e.target.value }));
    if (r) AN.fall = r.fall;
  });
  $$("[data-schritt]").forEach((b) => b.addEventListener("click", () => {
    const i = +b.dataset.schritt;
    if (!schrittFrei(i)) { toast("Dieser Schritt wird nach den vorherigen frei", true); return; }
    gehZu(i);
  }));
  zeichnePanel();
  zeichneRechts();
}

function gehZu(i) {
  AN.schritt = i;
  AN.fehler = "";
  zeichneFall();
  window.scrollTo(0, 0);
}

function zeichnePanel() {
  const el = $("#an-panel");
  if (!el) return;
  const f = AN.fall;
  const schritt = AN_SCHRITTE[AN.schritt];
  if (AN.busy) {
    el.innerHTML = `${panelKopf(schritt[1])}<div class="hinweis info"><span class="an-spin"></span><div>${esc(AN.busy)}</div></div>`;
    return;
  }
  const fehler = AN.fehler ? `<div class="hinweis">${ICON.bell}<div>${esc(AN.fehler)}</div></div>` : "";
  const render = [pStelle, pAnalyse, pVergleich, pLebenslauf, pAnschreiben, pAbschluss][AN.schritt];
  el.innerHTML = panelKopf(schritt[1]) + fehler + render(f);
  [vStelle, vAnalyse, vVergleich, vLebenslauf, vAnschreiben, vAbschluss][AN.schritt](el, f);
}

function panelKopf(titel) {
  const sub = ["Anzeige prüfen, bei Bedarf ergänzen.", "Rolle, Aufgaben, Anforderungen und Konditionen der Stelle.",
    "Stelle bis zu 3 eigenen Lebensläufen gegenüberstellen.", "Vorschläge prüfen oder den Text frei bearbeiten.",
    "Automatisch erzeugen, danach frei bearbeiten.", "Dokumente ablegen oder herunterladen."][AN.schritt];
  return `<div class="an-panel-kopf"><h2>${titel} <small>Schritt ${AN.schritt + 1} von 6</small></h2><p class="muted">${sub}</p></div>`;
}

/* Hilfen für KI-Aufrufe im Panel */
async function lauf(text, fn, danach) {
  AN.busy = text; AN.fehler = "";
  zeichnePanel();
  try {
    const r = await fn();
    if (r?.fall) AN.fall = r.fall;
    AN.busy = "";
    if (danach) danach(r);
  } catch (e) {
    AN.busy = ""; AN.fehler = e.message;
  }
  zeichneFall();
}

const weiterKnopf = (text, id = "an-weiter") => `<div class="an-fuss"><button class="btn btn-primary" id="${id}">${text}</button></div>`;

/* ---------- 1. Stelle ---------- */
function pStelle(f) {
  const textLos = !f.text;
  return `
    <div class="an-meta"><span class="chip">${esc(AN_QUELLE[f.quelle] || f.quelle)}</span>
      ${f.link ? `<a class="chip info" href="${safeUrl(f.link)}" target="_blank" rel="noopener">Original-Anzeige ${ICON.ext}</a>` : ""}
      ${f.text ? `<span class="chip">${f.text.length.toLocaleString("de-DE")} Zeichen</span>` : ""}</div>
    ${textLos ? `<div class="hinweis info">${ICON.bell}<div>Der Anzeigentext konnte nicht automatisch geladen werden (viele Jobportale blockieren das). Claude versucht, die Seite direkt abzurufen – sicherer ist es, den Text hier einzufügen oder die Anzeige als PDF hochzuladen.</div></div>` : ""}
    <div class="an-form-zeile">
      <label class="feld">Firma<input type="text" id="an-firma" value="${esc(f.firma)}"></label>
    </div>
    <label class="feld">Anzeigentext ${textLos ? "(optional einfügen)" : "(bearbeitbar)"}
      <textarea id="an-text-feld" rows="${textLos ? 8 : 12}" placeholder="Text der Stellenanzeige …">${esc(f.text || "")}</textarea></label>
    <div class="an-fuss">
      <button class="btn" id="an-text-speichern">Text speichern</button>
      <button class="btn btn-primary" id="an-weiter">${ICON.spark}${f.analyse ? "Neu analysieren" : "Stelle analysieren"}</button>
      ${f.analyse ? `<button class="btn" id="an-weiter-ohne">Weiter zur Analyse</button>` : ""}
    </div>`;
}

function vStelle(el, f) {
  const speichern = async () => {
    const daten = { id: f.id, firma: $("#an-firma", el).value };
    const t = $("#an-text-feld", el).value.trim();
    if (t && t !== (f.text || "")) daten.text = t;
    const r = await sicher(() => api("/api/analyse/fall/text", daten));
    if (r) AN.fall = r.fall;
    return !!r;
  };
  $("#an-text-speichern", el).addEventListener("click", async () => {
    if (await speichern()) { toast("Gespeichert"); zeichneFall(); }
  });
  $("#an-weiter", el).addEventListener("click", async () => {
    if (!(await speichern())) return;
    lauf("Claude analysiert die Stelle … das dauert meist 20–60 Sekunden.",
      () => api("/api/analyse/fall/analysieren", { id: f.id }), () => { AN.schritt = 1; });
  });
  $("#an-weiter-ohne", el)?.addEventListener("click", () => gehZu(1));
}

/* ---------- 2. Analyse ---------- */
const MODELL_CHIP = { remote: "ok", hybrid: "info", "vor Ort": "warn", unklar: "" };
const GEWICHT_CHIP = { hoch: "bad", mittel: "warn", niedrig: "" };
const PASSUNG_CHIP = { passt: "ok", teilweise: "warn", "passt nicht": "bad", unklar: "" };

function liste(arr, leer = "–") {
  return arr?.length ? `<ul class="an-liste">${arr.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : `<div class="muted small">${leer}</div>`;
}

function pAnalyse(f) {
  const a = f.analyse;
  if (!a) {
    return `<div class="leer">Noch nicht analysiert.</div>
      <div class="an-fuss"><button class="btn btn-primary" id="an-analysieren">${ICON.spark}Jetzt analysieren</button></div>`;
  }
  const k = a.konditionen;
  const kv = [["Gehalt", k.gehalt], ["Vertragsart", k.vertragsart], ["Befristung", k.befristung], ["Arbeitszeit", k.arbeitszeit],
    ["Start", k.start], ["Urlaub", k.urlaub], ["Bewerbungsfrist", k.bewerbungsfrist], ["Ansprechpartner", k.ansprechpartner]].filter(([, v]) => v);
  return `
    <div class="an-meta">${[a.rolle, a.firma, a.ort, a.branche, a.senioritaet].filter(Boolean).map((x) => `<span class="chip neu">${esc(x)}</span>`).join("")}</div>
    ${a.zusammenfassung ? `<p class="an-lead">${esc(a.zusammenfassung)}</p>` : ""}

    <h3 class="an-h">Arbeitsmodell &amp; Konditionen</h3>
    <div class="an-kv">
      <div><span>Arbeitsmodell</span><b><span class="chip ${MODELL_CHIP[k.arbeitsmodell] || ""}">${esc(k.arbeitsmodell)}</span> ${esc(k.arbeitsmodell_detail)}</b></div>
      ${kv.map(([l, v]) => `<div><span>${l}</span><b>${esc(v)}</b></div>`).join("")}
    </div>
    ${k.benefits.length ? `<div class="an-meta" style="margin-top:8px">${k.benefits.map((b) => `<span class="chip">${esc(b)}</span>`).join("")}</div>` : ""}

    <h3 class="an-h">Wichtigste Fakten – nach Priorität</h3>
    <ol class="an-prio">${a.prioritaet.map((p) => `<li>
      <div class="an-prio-kopf"><b>${esc(p.fakt)}</b>
        <span class="chip ${GEWICHT_CHIP[p.gewicht] || ""}">${esc(p.gewicht)}</span>
        <span class="chip ${PASSUNG_CHIP[p.passung] || ""}">${esc(p.passung)}</span>
        ${p.kategorie ? `<span class="muted small">${esc(p.kategorie)}</span>` : ""}</div>
      ${p.warum ? `<div class="muted small">${esc(p.warum)}</div>` : ""}</li>`).join("") || '<li class="muted">–</li>'}</ol>

    <h3 class="an-h">Aufgaben – was du dort tust</h3>${liste(a.aufgaben)}
    <h3 class="an-h">Anforderungen</h3>
    <div class="an-spalten">
      <div><div class="an-sub">Muss</div>${liste(a.anforderungen.muss)}</div>
      <div><div class="an-sub">Kann / Plus</div>${liste(a.anforderungen.kann)}</div>
      <div><div class="an-sub">Persönlich</div>${liste(a.anforderungen.soft)}</div>
    </div>
    ${a.keywords.length ? `<h3 class="an-h">ATS-Schlüsselbegriffe</h3><div class="an-meta">${a.keywords.map((x) => `<span class="chip">${esc(x)}</span>`).join("")}</div>` : ""}
    ${a.ton ? `<h3 class="an-h">Tonalität der Anzeige</h3><p style="margin:0">${esc(a.ton)}</p>` : ""}
    ${a.warnsignale.length ? `<div class="hinweis" style="margin-top:14px">${ICON.bell}<div><b>Auffälligkeiten</b>${liste(a.warnsignale)}</div></div>` : ""}
    <div class="an-fuss"><button class="btn" id="an-analysieren">${ICON.refresh}Neu analysieren</button>
      <button class="btn btn-primary" id="an-weiter">Weiter: Lebensläufe vergleichen</button></div>`;
}

function vAnalyse(el, f) {
  $("#an-analysieren", el)?.addEventListener("click", () => lauf(
    "Claude analysiert die Stelle …", () => api("/api/analyse/fall/analysieren", { id: f.id })));
  $("#an-weiter", el)?.addEventListener("click", () => gehZu(2));
}

/* ---------- 3. Vergleich ---------- */
function pVergleich(f) {
  const u = AN.cvListe || [];
  if (!f.analyse) return `<div class="leer">Bitte zuerst die Stelle analysieren.</div>`;
  if (!u.length) {
    return `<div class="hinweis info">${ICON.bell}<div>Deine Bibliothek ist leer. Lade mindestens einen Lebenslauf hoch.</div></div>
      <div class="an-fuss"><a class="btn btn-primary" href="#analyse" id="an-zur-bib">Lebensläufe verwalten</a></div>`;
  }
  const max = AN.uebersicht?.max_vergleich || 3;
  const v = f.vergleich;
  return `
    <div class="an-wahl-kopf"><b>Lebensläufe wählen</b><span class="chip" id="an-wahl-zahl">${AN.vergleichWahl.size} / ${max}</span></div>
    <div class="an-wahl">${u.map((c) => `
      <label class="an-wahl-zeile ${AN.vergleichWahl.has(c.id) ? "an" : ""}">
        <input type="checkbox" value="${c.id}" ${AN.vergleichWahl.has(c.id) ? "checked" : ""}>
        <div class="zeile-main"><div class="zeile-titel">${esc(c.name)}</div><div class="muted small">${esc(c.headline || "")} · ${c.stationen} Stationen · ${c.skills} Skills</div></div>
      </label>`).join("")}</div>
    <div class="an-fuss"><button class="btn btn-primary" id="an-vergleichen">${AN_ICON.chart}${v ? "Neu vergleichen" : "Vergleich starten"}</button></div>
    ${v ? ergebnisVergleich(v) : ""}`;
}

function ergebnisVergleich(v) {
  const sortiert = [...v.bewertungen].sort((a, b) => b.score - a.score);
  return `<h3 class="an-h">Ergebnis</h3>
    ${v.begruendung ? `<p class="an-lead">${esc(v.begruendung)}</p>` : ""}
    <div class="an-ranking">${sortiert.map((b) => `
      <div class="an-rang ${b.id === v.bester ? "bester" : ""}">
        <div class="an-rang-kopf"><div class="score ${scoreKlasse(b.score)}">${b.score}</div>
          <div class="zeile-main"><div class="zeile-titel">${esc(b.name)} ${b.id === v.bester ? '<span class="chip ok">Beste Passung</span>' : ""}</div>
            <div class="muted small">${esc(b.fazit)}</div></div></div>
        <div class="an-spalten zwei">
          <div><div class="an-sub plus">Passt</div>${liste(b.passt)}</div>
          <div><div class="an-sub minus">Lücken</div>${liste(b.luecken)}</div></div>
        <div class="an-fuss"><button class="btn btn-sm ${b.id === v.bester ? "btn-primary" : ""}" data-nimm="${b.id}">Diesen Lebenslauf anpassen</button>
          <button class="btn btn-sm" data-vorschau="${b.id}">Vorschau rechts</button></div>
      </div>`).join("")}</div>`;
}

function vVergleich(el, f) {
  const max = AN.uebersicht?.max_vergleich || 3;
  $$("input[type=checkbox]", el).forEach((cb) => cb.addEventListener("change", () => {
    if (cb.checked && AN.vergleichWahl.size >= max) { cb.checked = false; toast(`Maximal ${max} Lebensläufe`, true); return; }
    cb.checked ? AN.vergleichWahl.add(cb.value) : AN.vergleichWahl.delete(cb.value);
    cb.closest(".an-wahl-zeile").classList.toggle("an", cb.checked);
    $("#an-wahl-zahl", el).textContent = `${AN.vergleichWahl.size} / ${max}`;
  }));
  $("#an-vergleichen", el)?.addEventListener("click", () => {
    if (!AN.vergleichWahl.size) { toast("Bitte mindestens einen Lebenslauf wählen", true); return; }
    lauf("Claude vergleicht die Lebensläufe mit der Stelle … ca. 30–90 Sekunden.",
      () => api("/api/analyse/fall/vergleichen", { id: f.id, cv_ids: [...AN.vergleichWahl] }));
  });
  $$("[data-nimm]", el).forEach((b) => b.addEventListener("click", () => {
    if (f.cv && f.cv_id !== b.dataset.nimm && !confirm("Die bisherige Anpassung (Vorschläge, manuelle Änderungen, Anschreiben) wird durch diesen Lebenslauf ersetzt. Fortfahren?")) return;
    lauf("Lebenslauf wird übernommen …", () => api("/api/analyse/fall/cv_waehlen", { id: f.id, cv_id: b.dataset.nimm }),
      () => { AN.schritt = 3; AN.cvTab = "vorschlaege"; });
  }));
  $$("[data-vorschau]", el).forEach((b) => b.addEventListener("click", async () => {
    AN.vorschauCv = b.dataset.vorschau;
    zeichneRechts();
  }));
}

/* ---------- 4. Lebenslauf ---------- */
const PFAD_LABEL = { headline: "Überschrift", zusammenfassung: "Profil / Zusammenfassung" };

function pfadLabel(pfad, cvDaten) {
  if (PFAD_LABEL[pfad]) return PFAD_LABEL[pfad];
  const t = pfad.split(".");
  const [sek, i, feld, j] = [t[0], +t[1], t[2], t[3]];
  const e = cvDaten?.[sek]?.[i];
  if (sek === "erfahrung") {
    const wo = e ? `${e.rolle || "Station"} (${e.firma || "?"})` : "Station";
    return feld === "rolle" ? `Berufserfahrung › Rolle bei ${e?.firma || "?"}` : `Berufserfahrung › ${wo} › ${j !== undefined ? `Punkt ${+j + 1}` : "neuer Punkt"}`;
  }
  if (sek === "bildung") return `Ausbildung › ${e?.abschluss || "Eintrag"} › Punkt ${+j + 1}`;
  if (sek === "skills") return feld === "gruppe" ? "Skills › Gruppenname" : `Skills › ${e?.gruppe || "Gruppe"} › neuer Skill`;
  return pfad;
}

function pLebenslauf(f) {
  if (!f.cv) {
    const best = f.vergleich?.bester;
    return `<div class="leer">Es ist noch kein Lebenslauf für diese Stelle gewählt.</div>
      <div class="an-fuss">${best ? `<button class="btn btn-primary" data-nimm="${best}">Besten Lebenslauf übernehmen</button>` : ""}
      <button class="btn" id="an-zum-vergleich">Zum Vergleich</button></div>`;
  }
  const v = f.vorschlaege || [];
  const offen = v.filter((x) => x.status === "offen").length;
  return `
    <div class="an-meta"><span class="chip neu">${esc(AN.cvListe?.find((c) => c.id === f.cv_id)?.name || "Arbeitskopie")}</span>
      <span class="muted small">Änderungen betreffen nur diese Analyse – die Bibliothek bleibt unverändert.</span></div>
    <div class="tabs" style="margin-top:12px"><button class="tab ${AN.cvTab === "vorschlaege" ? "active" : ""}" data-cvtab="vorschlaege">KI-Vorschläge${v.length ? ` (${offen} offen)` : ""}</button>
      <button class="tab ${AN.cvTab === "manuell" ? "active" : ""}" data-cvtab="manuell">Manuell bearbeiten</button></div>
    ${AN.cvTab === "vorschlaege" ? pVorschlaege(f, v) : cvEditor(f.cv)}
    <div class="an-fuss"><button class="btn btn-primary" id="an-weiter">Weiter: Anschreiben</button></div>`;
}

function pVorschlaege(f, v) {
  return `
    <div class="an-fuss" style="margin:0 0 12px">
      <button class="btn btn-soft" id="an-vorschlaege">${ICON.spark}${v.length ? "Neue Vorschläge erzeugen" : "Vorschläge von Claude holen"}</button>
      ${v.some((x) => x.status === "offen") ? `<button class="btn" id="an-alle-an">Alle offenen annehmen</button>` : ""}</div>
    ${v.length ? `<div class="an-vorschlaege">${v.map((x) => vorschlagKarte(x, f.cv)).join("")}</div>` : `<div class="leer-mini muted small" style="padding:10px 0">Noch keine Vorschläge. Claude schlägt Umformulierungen vor – erfunden wird nichts, du entscheidest jeden einzelnen.</div>`}
    ${f.luecken?.length ? `<div class="hinweis" style="margin-top:14px">${ICON.bell}<div><b>Nicht belegte Anforderungen</b> (nicht in den Lebenslauf geschrieben)${liste(f.luecken)}</div></div>` : ""}`;
}

function vorschlagKarte(x, cvDaten) {
  const status = { offen: "", angenommen: "ok", abgelehnt: "bad" }[x.status];
  const neu = x.art === "ergaenzen" ? `+ ${esc(x.neu)}` : esc(x.neu);
  return `<div class="an-vorschlag ${x.status}">
    <div class="an-vorschlag-kopf"><span class="muted small">${esc(pfadLabel(x.pfad, cvDaten))}</span>
      <span class="chip ${status}">${x.status}</span></div>
    ${x.art === "ersetzen" ? `<div class="an-diff alt">${esc(x.alt)}</div>` : ""}
    <div class="an-diff neu">${neu}</div>
    <div class="muted small">${esc(x.grund)}</div>
    <div class="an-fuss" style="margin-top:8px">
      ${x.status === "offen" ? `<button class="btn btn-sm btn-primary" data-ent="annehmen" data-v="${x.id}">${AN_ICON.check}Annehmen</button>
        <button class="btn btn-sm" data-ent="ablehnen" data-v="${x.id}">${AN_ICON.x}Ablehnen</button>`
        : x.eingefroren ? `<span class="muted small">Danach manuell verändert – nicht mehr automatisch rückgängig zu machen</span>`
        : `<button class="btn btn-sm" data-ent="zuruecksetzen" data-v="${x.id}">${AN_ICON.undo}Rückgängig</button>`}
    </div></div>`;
}

/* Vollständiger manueller Editor für den Lebenslauf der Analyse */
const EDIT_SEKTIONEN = [
  ["erfahrung", "Berufserfahrung", [["rolle", "Rolle"], ["firma", "Firma"], ["ort", "Ort"], ["start", "Start"], ["ende", "Ende"]], "punkte", "Aufgaben / Erfolge (eine Zeile je Punkt)"],
  ["bildung", "Ausbildung & Weiterbildung", [["abschluss", "Abschluss"], ["institution", "Institution"], ["ort", "Ort"], ["start", "Start"], ["ende", "Ende"]], "punkte", "Punkte (eine Zeile je Punkt)"],
  ["skills", "Skills", [["gruppe", "Gruppe"]], "eintraege", "Skills (kommagetrennt oder eine Zeile je Skill)"],
  ["zertifikate", "Zertifikate", [["name", "Name"], ["aussteller", "Aussteller"], ["datum", "Datum"]], null, ""],
  ["projekte", "Projekte", [["name", "Name"]], "beschreibung", "Beschreibung"],
  ["eigene", "Eigene Abschnitte", [["titel", "Titel"]], "punkte", "Punkte (eine Zeile je Punkt)"],
];
const EDIT_LEER = { erfahrung: LEER.erfahrung, bildung: LEER.bildung, skills: LEER.skills, zertifikate: LEER.zertifikate, projekte: LEER.projekte, eigene: LEER.eigene };

function cvEditor(c) {
  return `<div class="an-editor">
    <label class="feld">Überschrift<input type="text" data-p="headline" value="${esc(c.headline)}"></label>
    <label class="feld">Profil / Zusammenfassung<textarea data-p="zusammenfassung" rows="6">${esc(c.zusammenfassung)}</textarea></label>
    ${EDIT_SEKTIONEN.map(([sek, titel, felder, lang, langLabel]) => `
      <div class="an-ed-sek"><div class="an-ed-kopf"><b>${titel}</b>
        <button class="btn btn-sm btn-soft" data-add="${sek}">${ICON.plus}Hinzufügen</button></div>
        ${c[sek].map((e, i) => `<div class="an-ed-eintrag">
          <div class="an-form-zeile">${felder.map(([k, l]) => `<label class="feld">${l}<input type="text" data-p="${sek}.${i}.${k}" value="${esc(e[k])}"></label>`).join("")}</div>
          ${lang ? `<label class="feld">${langLabel}<textarea data-p="${sek}.${i}.${lang}" data-liste="${Array.isArray(e[lang]) ? 1 : 0}" rows="${lang === "beschreibung" ? 2 : 4}">${esc(Array.isArray(e[lang]) ? e[lang].join(sek === "skills" ? ", " : "\n") : e[lang])}</textarea></label>` : ""}
          <button class="btn btn-sm btn-danger" data-del="${sek}.${i}">${ICON.trash}Entfernen</button></div>`).join("") || '<div class="muted small">Keine Einträge.</div>'}
      </div>`).join("")}</div>`;
}

function setzePfad(obj, pfad, wert) {
  const t = pfad.split(".").map((x) => (/^\d+$/.test(x) ? +x : x));
  const letzter = t.pop();
  const ziel = t.reduce((o, k) => o?.[k], obj);
  if (ziel) ziel[letzter] = wert;
}

function eingabeZuWert(el) {
  if (el.dataset.liste !== "1") return el.value;
  const skills = el.dataset.p.startsWith("skills.");
  return el.value.split(skills ? /[,\n]/ : /\n/).map((x) => x.trim()).filter(Boolean);
}

async function cvJetztSpeichern() {
  clearTimeout(AN.saveTimer);
  if (!AN.cvDirty) return true;
  const r = await sicher(() => api("/api/analyse/fall/cv_speichern", { id: AN.fall.id, lebenslauf: AN.fall.cv }));
  if (!r) return false;
  AN.cvDirty = false;
  AN.fall.vorschlaege = r.fall.vorschlaege;
  return true;
}

function vLebenslauf(el, f) {
  $$("[data-nimm]", el).forEach((b) => b.addEventListener("click", () => lauf("Lebenslauf wird übernommen …",
    () => api("/api/analyse/fall/cv_waehlen", { id: f.id, cv_id: b.dataset.nimm }))));
  $("#an-zum-vergleich", el)?.addEventListener("click", () => gehZu(2));
  $$("[data-cvtab]", el).forEach((b) => b.addEventListener("click", async () => {
    if (!(await cvJetztSpeichern())) return;
    AN.cvTab = b.dataset.cvtab;
    zeichnePanel();
  }));
  $("#an-weiter", el)?.addEventListener("click", async () => {
    if (await cvJetztSpeichern()) gehZu(4);
  });
  $("#an-vorschlaege", el)?.addEventListener("click", async () => {
    if (!(await cvJetztSpeichern())) return;
    if (f.vorschlaege?.some((x) => x.status !== "offen") && !confirm("Neue Vorschläge ersetzen die bisherige Liste (bereits angenommene Änderungen bleiben im Lebenslauf). Fortfahren?")) return;
    lauf("Claude prüft den Lebenslauf gegen die Stelle … ca. 30–90 Sekunden.", () => api("/api/analyse/fall/vorschlaege", { id: f.id }));
  });
  const entscheide = async (id, ent) => {
    if (!(await cvJetztSpeichern())) return;
    const r = await sicher(() => api("/api/analyse/fall/vorschlag", { id: f.id, vorschlag: id, entscheidung: ent }));
    if (r) { AN.fall = r.fall; zeichnePanel(); zeichneRechts(); }
  };
  $$("[data-ent]", el).forEach((b) => b.addEventListener("click", () => entscheide(b.dataset.v, b.dataset.ent)));
  $("#an-alle-an", el)?.addEventListener("click", async () => {
    for (const x of AN.fall.vorschlaege.filter((v) => v.status === "offen")) {
      const r = await sicher(() => api("/api/analyse/fall/vorschlag", { id: f.id, vorschlag: x.id, entscheidung: "annehmen" }));
      if (!r) break;
      AN.fall = r.fall;
    }
    zeichnePanel(); zeichneRechts();
  });

  // Manueller Editor
  const aenderung = () => {
    AN.cvDirty = true;
    clearTimeout(AN.saveTimer);
    AN.saveTimer = setTimeout(cvJetztSpeichern, 900);
    zeichneRechts();
  };
  $$("[data-p]", el).forEach((inp) => inp.addEventListener("input", () => {
    setzePfad(AN.fall.cv, inp.dataset.p, eingabeZuWert(inp));
    aenderung();
  }));
  $$("[data-add]", el).forEach((b) => b.addEventListener("click", () => {
    AN.fall.cv[b.dataset.add].push(JSON.parse(JSON.stringify(EDIT_LEER[b.dataset.add])));
    aenderung(); zeichnePanel();
  }));
  $$("[data-del]", el).forEach((b) => b.addEventListener("click", () => {
    const [sek, i] = b.dataset.del.split(".");
    AN.fall.cv[sek].splice(+i, 1);
    aenderung(); zeichnePanel();
  }));
}

/* ---------- 5. Anschreiben ---------- */
function pAnschreiben(f) {
  if (!f.cv) return `<div class="leer">Bitte zuerst den Lebenslauf festlegen.</div>`;
  const a = f.anschreiben;
  if (!a) {
    return `<p>Claude schreibt ein Anschreiben (Geschäftsbriefnorm, Sie-Form, max. eine Seite) auf Basis der Stellenanalyse und deines angepassten Lebenslaufs. Anschließend kannst du den gesamten Text frei ändern.</p>
      <div class="an-fuss"><button class="btn btn-primary" id="an-erzeugen">${ICON.spark}Anschreiben automatisch erstellen</button></div>`;
  }
  const woerter = a.text.trim().split(/\s+/).length;
  return `
    <div class="an-meta"><span class="chip ${a.bearbeitet ? "info" : "neu"}">${a.bearbeitet ? "manuell bearbeitet" : "automatisch erstellt"}</span>
      <span class="chip" id="an-woerter">${woerter} Wörter</span></div>
    <label class="feld">Gesamter Text des Anschreibens
      <textarea id="an-brief" rows="20" class="an-brief">${esc(a.text)}</textarea></label>
    <p class="muted small" style="margin:6px 0 0">Absender, Empfänger und Datum setzt das Cockpit beim PDF-Export. Die erste Zeile mit „Betreff:“ wird fett gesetzt. Absätze trennst du mit einer Leerzeile.</p>
    <div class="an-fuss"><button class="btn" id="an-neu-erzeugen">${ICON.refresh}Neu erstellen</button>
      <button class="btn btn-primary" id="an-weiter">Weiter: Abschluss</button></div>`;
}

async function briefSpeichern() {
  clearTimeout(AN.saveTimer);
  const feld = $("#an-brief");
  if (!feld || !AN.briefDirty) return true;
  const r = await sicher(() => api("/api/analyse/fall/anschreiben_speichern", { id: AN.fall.id, text: feld.value }));
  if (!r) return false;
  AN.briefDirty = false;
  AN.fall.anschreiben = r.fall.anschreiben;
  return true;
}

function vAnschreiben(el, f) {
  $("#an-erzeugen", el)?.addEventListener("click", () => lauf("Claude schreibt das Anschreiben … ca. 20–60 Sekunden.",
    () => api("/api/analyse/fall/anschreiben", { id: f.id }), () => { AN.vorschauTab = "brief"; }));
  $("#an-neu-erzeugen", el)?.addEventListener("click", () => {
    if (f.anschreiben?.bearbeitet && !confirm("Dein manuell bearbeiteter Text wird überschrieben. Fortfahren?")) return;
    lauf("Claude schreibt das Anschreiben neu …", () => api("/api/analyse/fall/anschreiben", { id: f.id }));
  });
  $("#an-brief", el)?.addEventListener("input", (e) => {
    AN.briefDirty = true;
    AN.fall.anschreiben.text = e.target.value;
    $("#an-woerter", el).textContent = `${e.target.value.trim().split(/\s+/).filter(Boolean).length} Wörter`;
    clearTimeout(AN.saveTimer);
    AN.saveTimer = setTimeout(briefSpeichern, 900);
    zeichneRechts();
  });
  $("#an-weiter", el)?.addEventListener("click", async () => { if (await briefSpeichern()) gehZu(5); });
}

/* ---------- 6. Abschluss ---------- */
function pAbschluss(f) {
  if (!f.cv || !f.anschreiben) return `<div class="leer">Lebenslauf und Anschreiben müssen fertig sein.</div>`;
  const ab = f.abschluss || {};
  const q = (AN.mappeQuellen || []).filter((x) => /^unterlagen\//.test(x.pfad));
  const dl = (pfad) => pfad ? `<a class="btn btn-sm" href="${anUrl(pfad)}">${AN_ICON.dl}Herunterladen</a>
    <button class="btn btn-sm" data-oeffnen="${esc(pfad)}">Öffnen</button>` : "";
  return `
    <div class="an-abschluss">
      <div class="an-ab-karte"><div><b>Lebenslauf</b><div class="muted small">${ab.cv_pdf ? esc(ab.cv_pdf) : "als PDF (ATS-lesbar) speichern"}</div></div>
        <div class="an-ab-akt">${dl(ab.cv_pdf)}<button class="btn btn-sm btn-soft" id="an-cv-pdf">${ab.cv_pdf ? "Neu erzeugen" : "PDF erzeugen"}</button></div></div>
      <div class="an-ab-karte"><div><b>Anschreiben</b><div class="muted small">${ab.anschreiben_pdf ? esc(ab.anschreiben_pdf) : "als PDF im Briefformat speichern"}</div></div>
        <div class="an-ab-akt">${dl(ab.anschreiben_pdf)}<button class="btn btn-sm btn-soft" id="an-br-pdf">${ab.anschreiben_pdf ? "Neu erzeugen" : "PDF erzeugen"}</button></div></div>
      <div class="an-ab-karte mehrzeilig"><div class="an-ab-zeile"><div><b>Bewerbungsmappe</b><div class="muted small">${ab.mappe ? esc(ab.mappe) : "Deckblatt + Anschreiben + Lebenslauf + gewählte Nachweise in einer PDF"}</div></div>
        <div class="an-ab-akt">${dl(ab.mappe)}<button class="btn btn-sm btn-primary" id="an-mappe">Mappe bauen</button></div></div>
        ${q.length ? `<div class="vorschau-titel" style="margin-top:8px">Zertifikate &amp; Nachweise beilegen</div>
          <div class="imp-liste">${q.map((x) => `<label class="check"><input type="checkbox" data-beilage="${esc(x.pfad)}" ${AN.unterlagenWahl.has(x.pfad) ? "checked" : ""}> ${esc(x.name)}</label>`).join("")}</div>` : ""}</div>
      <div class="an-ab-karte"><div><b>Tracker</b><div class="muted small">Eintrag „vorbereitet“ in der Pipeline anlegen</div></div>
        <div class="an-ab-akt"><button class="btn btn-sm" id="an-tracker">${ICON.pipe}Eintragen</button></div></div>
      <div class="an-ab-karte"><div><b>Stammdaten</b><div class="muted small">Diesen Lebenslauf als Master im Lebenslauf-Editor übernehmen (Sicherung wird angelegt)</div></div>
        <div class="an-ab-akt"><button class="btn btn-sm" id="an-stamm">Als Stammdaten laden</button></div></div>
    </div>`;
}

async function anPdfs(brauchtCv, brauchtBrief) {
  const f = AN.fall;
  const name = [CV.profil.persoenlich.vorname, CV.profil.persoenlich.nachname].filter(Boolean).join(" ");
  if (!name) { toast("Bitte zuerst im Profil deinen Namen eintragen", true); return null; }
  if (!CV.chrome) { toast("Für den PDF-Export wird Google Chrome gebraucht", true); return null; }
  const erg = {};
  if (brauchtCv) {
    const r = await sicher(() => api("/api/cv/pdf", { html: cvHtmlFuer(f.cv, AN.cvZoom), name, zusatz: f.firma || f.titel, eine_seite: f.cv.design.eine_seite }));
    if (!r) return null;
    erg.cv_pdf = r.pfad;
  }
  if (brauchtBrief) {
    const r = await sicher(() => api("/api/analyse/fall/anschreiben_pdf", { id: f.id }));
    if (!r) return null;
    erg.anschreiben_pdf = r.pfad;
  }
  const r = await sicher(() => api("/api/analyse/fall/abschluss", { id: f.id, ...erg }));
  if (!r) return null;
  AN.fall = r.fall;
  return AN.fall.abschluss;
}

function vAbschluss(el, f) {
  if (!AN.mappeQuellen) {
    api("/api/unterlagen").then((u) => { AN.mappeQuellen = u.quellen; if (AN.schritt === 5 && !AN.busy) zeichnePanel(); }).catch(() => { AN.mappeQuellen = []; });
  }
  const neu = async (cv, brief) => { if (await anPdfs(cv, brief)) { toast("PDF gespeichert in bewerbungen/"); zeichnePanel(); } };
  $("#an-cv-pdf", el)?.addEventListener("click", () => neu(true, false));
  $("#an-br-pdf", el)?.addEventListener("click", () => neu(false, true));
  $$("[data-beilage]", el).forEach((cb) => cb.addEventListener("change", () => {
    cb.checked ? AN.unterlagenWahl.add(cb.dataset.beilage) : AN.unterlagenWahl.delete(cb.dataset.beilage);
  }));
  $("#an-mappe", el)?.addEventListener("click", async (e) => {
    e.target.disabled = true;
    const ab = await anPdfs(true, true);
    if (ab) {
      const teile = [{ art: "datei", pfad: ab.anschreiben_pdf, titel: "Anschreiben" }, { art: "datei", pfad: ab.cv_pdf, titel: "Lebenslauf" },
        ...[...AN.unterlagenWahl].map((pfad) => ({ art: "datei", pfad }))];
      const r = await sicher(() => api("/api/mappe", { firma: f.firma, rolle: f.titel, deckblatt: true, teile }));
      if (r) {
        const s = await sicher(() => api("/api/analyse/fall/abschluss", { id: f.id, mappe: r.pfad }));
        if (s) AN.fall = s.fall;
        toast(`Bewerbungsmappe fertig (${r.seiten} Seiten, ${(r.groesse / 1048576).toFixed(1)} MB)`);
        if (r.warnung) toast(r.warnung, true);
      }
    }
    zeichnePanel();
  });
  $("#an-tracker", el)?.addEventListener("click", async () => {
    const r = await sicher(() => api("/api/tracker", { aktion: "neu", ...AN.tracker }), "Im Tracker eingetragen (vorbereitet)");
    if (r) { await ladeTracker(); aktualisiereSidebar(); }
  });
  $("#an-stamm", el)?.addEventListener("click", async () => {
    if (!confirm("Den Master-Lebenslauf im Editor durch diese angepasste Version ersetzen? Der bisherige wird als lebenslauf.json.bak gesichert.")) return;
    if (await sicher(() => api("/api/analyse/fall/stammdaten", { id: f.id }), "Als Stammdaten übernommen")) await ladeCv(true);
  });
}

/* ================================================================
   RECHTE SEITE: VORSCHAU
   ================================================================ */
function cvHtmlFuer(c, zoom = 1) {
  const alt = CV.cv;
  CV.cv = c;
  try { return cvDokument(zoom); } finally { CV.cv = alt; }
}

function cvIframe(rahmen, c, passeAn = true) {
  rahmen.innerHTML = "";
  const frame = document.createElement("iframe");
  frame.className = "an-iframe";
  frame.setAttribute("sandbox", "allow-same-origin");
  frame.onload = () => {
    const doc = frame.contentDocument;
    const hoehe = doc.querySelector(".seite").scrollHeight;
    let zoom = 1;
    if (passeAn && c.design.eine_seite && hoehe > A4_PX.h) zoom = Math.max(.72, A4_PX.h / hoehe - .005);
    if (zoom < 1) doc.querySelector(".seite").style.zoom = zoom;
    if (passeAn) AN.cvZoom = zoom;
    const h = Math.max(A4_PX.h, Math.ceil(hoehe * zoom / A4_PX.h - .02) * A4_PX.h);
    frame.style.height = `${h}px`;
    const s = Math.min(1, rahmen.clientWidth / A4_PX.b);
    frame.style.transform = `scale(${s})`;
    rahmen.style.height = `${h * s}px`;
    const info = $("#an-seiten");
    if (info && passeAn) info.textContent = `${Math.max(1, Math.ceil(hoehe * zoom / A4_PX.h - .02))} Seite(n) · A4${zoom < 1 ? ` · auf ${Math.round(zoom * 100)} % verkleinert` : ""}`;
  };
  frame.srcdoc = cvHtmlFuer(c, 1);
  rahmen.append(frame);
}

function briefPapier(f) {
  const p = CV.profil, k = p.kontakt;
  const name = [p.persoenlich.vorname, p.persoenlich.nachname].filter(Boolean).join(" ");
  const absender = [name, k.strasse, [k.plz, k.ort].filter(Boolean).join(" "), k.telefon, k.email].filter(Boolean);
  const abs = (f.anschreiben?.text || "").split(/\n\s*\n/).map((a) => a.trim()).filter(Boolean);
  return `<div class="an-brief-papier">
    <div class="an-bp-abs">${absender.map(esc).join("<br>")}</div>
    <div class="an-bp-empf">${esc(f.firma)}</div>
    <div class="an-bp-datum">${esc(k.ort ? k.ort + ", " : "")}${new Date().toLocaleDateString("de-DE")}</div>
    ${abs.map((a, i) => i === 0 && /^betreff:/i.test(a) ? `<p><b>${esc(a.slice(8).trim())}</b></p>` : `<p>${esc(a).replace(/\n/g, "<br>")}</p>`).join("")}</div>`;
}

async function zeichneRechts() {
  const el = $("#an-rechts");
  if (!el) return;
  const f = AN.fall;
  const s = AN.schritt;
  let art = "anzeige";
  if (s === 2) art = AN.vorschauCv ? "cv" : "anzeige";
  else if (s === 3) art = "cv";
  else if (s === 4) art = "brief";
  else if (s === 5) art = AN.vorschauTab === "brief" ? "brief" : "cv";
  if (art === "cv" && !(s === 2 ? AN.vorschauCv : f.cv)) art = "anzeige";
  if (art === "brief" && !f.anschreiben) art = f.cv ? "cv" : "anzeige";

  const titel = { anzeige: ["STELLENANZEIGE", f.titel], cv: ["LEBENSLAUF", s === 2 ? (AN.cvListe?.find((c) => c.id === AN.vorschauCv)?.name || "") : (AN.cvListe?.find((c) => c.id === f.cv_id)?.name || "Arbeitskopie")],
    brief: ["ANSCHREIBEN", f.firma || f.titel] }[art];
  el.innerHTML = `
    <div class="card an-r-kopf"><div class="an-r-titel"><span>${titel[0]}</span><b>${esc(titel[1])}</b></div>
      ${s >= 3 && f.cv && f.anschreiben ? `<div class="segment"><button data-rt="cv" class="${art === "cv" ? "an" : ""}">Lebenslauf</button><button data-rt="brief" class="${art === "brief" ? "an" : ""}">Anschreiben</button></div>` : ""}</div>
    ${art === "anzeige" ? "" : `<div class="card an-r-leiste"><span class="muted small" id="an-seiten">${art === "brief" ? "1 Seite · A4" : ""}</span></div>`}
    <div class="an-r-papier" id="an-papier"></div>`;
  $$("[data-rt]", el).forEach((b) => b.addEventListener("click", () => { AN.vorschauTab = b.dataset.rt; zeichneRechts(); }));
  const papier = $("#an-papier", el);
  if (art === "anzeige") {
    papier.innerHTML = `<div class="an-anzeige">${f.text ? esc(f.text) : `<span class="muted">Der Anzeigentext ist noch nicht geladen.${f.link ? " Die Analyse versucht, die Seite direkt abzurufen." : ""}</span>`}</div>`;
  } else if (art === "cv") {
    let c = f.cv;
    if (s === 2) { const x = await anCvHolen(AN.vorschauCv); c = x?.lebenslauf; }
    if (!c) return;
    const rahmen = document.createElement("div");
    rahmen.className = "an-papier-rahmen";
    papier.append(rahmen);
    cvIframe(rahmen, c, s !== 2);
  } else {
    papier.innerHTML = briefPapier(f);
  }
}

window.addEventListener("hashchange", () => { clearTimeout(AN.saveTimer); });

VIEWS.analyse = renderAnalyse;
