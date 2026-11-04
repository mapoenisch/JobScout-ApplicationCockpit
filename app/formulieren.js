/* JobScout Cockpit – Ebene „CV neu formulieren“ des Lebenslauf-Editors.
   Führt den Skill skills/lebenslauf-cockpit im Cockpit aus (Backend: cv_formulieren.py).
   Nutzt die Helfer aus app.js und lebenslauf.js (feld, verdrahteEingaben,
   verdrahteListen, eintragKopf, addKnopf, ladeCv, alsBase64, skaliereVorschau …). */
"use strict";

const FO = { e: null, schritt: 0, liste: null, arbeit: "", vorschauTimer: null, vorschauNr: 0, pdfUrl: null,
  cvGeaendert: false, entwuerfe: [], claude: false, chrome: false };

const FO_SCHRITTE = [["stelle", "Stelle"], ["profil", "Profil"], ["erfahrung", "Erfahrung"], ["bildung", "Bildung"],
  ["extras", "Kenntnisse"], ["fragen", "Fragen"], ["kurzprofil", "Kurzprofil"], ["ergebnis", "Ergebnis"]];
const FO_TEXT = {
  stelle: "Für diese Stelle wird der Lebenslauf geschrieben. Die Anzeige liefert nur Wortwahl und Schwerpunkte, nie Fakten über dich.",
  profil: "Deine persönlichen Daten kommen aus dem Profil. Änderungen hier werden dort mitgespeichert.",
  erfahrung: "Lose Wortgruppen und unsortierte Tätigkeiten reichen. Daraus entstehen fertige Formulierungen. Eigene Texte bleiben mit „Wörtlich“ unverändert.",
  bildung: "Ausbildung, Studium, Weiterbildung und Schulabschluss.",
  extras: "IT, Zertifikate, Sprachen sowie Projekte oder Ehrenamt, gern als grobe Liste.",
  fragen: "Der Abgleich mit der Stelle zeigt, was fehlt. Nur was du hier beantwortest, kommt als Fakt in den Lebenslauf.",
  kurzprofil: "Optional. Drei bis vier belegte Zeilen ganz oben im Lebenslauf.",
  ergebnis: "Der fertige Lebenslauf. Kurzprofil, Punkte und Kernkompetenzen kannst du hier noch ändern.",
};

/* ---------- Start und Übersicht ---------- */
async function renderFormulieren() {
  const id = new URLSearchParams(location.hash.split("?")[1] || "").get("id");
  if (!(await ladeCv())) return;
  const u = await sicher(() => api("/api/formulieren"));
  if (!u) return;
  Object.assign(FO, { entwuerfe: u.entwuerfe, claude: u.claude, chrome: u.chrome });
  if (id) {
    const d = await sicher(() => api(`/api/formulieren/entwurf?id=${encodeURIComponent(id)}`));
    if (d) { foOeffne(d.entwurf); return; }
  }
  foUebersicht();
}

function foUebersicht() {
  FO.e = null;
  setHeader("Lebenslauf-Editor", "Aus Stichpunkten oder einem Entwurf entsteht ein bewerbungsfertiger Lebenslauf für genau eine Stelle");
  $("#view").innerHTML = `${ebenenLeiste("neu")}
    ${FO.claude ? "" : `<div class="hinweis">${ICON.bell}<div>Claude Code wurde nicht gefunden. Formulieren und Rückfragen brauchen <code>claude</code>.</div></div>`}
    <div class="fo-start">
      <button class="card" data-fo-neu="umformulieren"><h2>${ICON_CV.upload}CV-Entwurf umformulieren</h2>
        <p>Vorhandenen Lebenslauf hochladen oder aus dem ATS-Editor holen und auf die Stelle zuschneiden.</p></button>
      <button class="card" data-fo-neu="neu"><h2>${ICON.spark}Von Grund auf neu formulieren</h2>
        <p>Alles in Felder eintragen, gern als lose Stichpunkte. Eigene Formulierungen kannst du wörtlich übernehmen.</p></button>
    </div>
    ${FO.entwuerfe.length ? `<div class="vorschau-titel">Deine Entwürfe</div><div class="an-karten">${FO.entwuerfe.map((x) => `
      <div class="card an-fall" data-fo-oeffnen="${esc(x.id)}">
        <div class="an-fall-kopf"><div class="zeile-main"><b>${esc(x.position || "Noch keine Stelle")}</b>
          <div class="muted small">${esc(x.firma || (x.modus === "neu" ? "Von Grund auf neu" : "Entwurf umformulieren"))}</div></div>
          ${x.fertig ? '<span class="chip ok">Formuliert</span>' : '<span class="chip">In Arbeit</span>'}</div>
        <div class="an-fall-fuss"><span class="muted small">${fmtDatum(x.geaendert)}</span>
          <button class="icon-btn mini klein" style="margin-left:auto" data-fo-loeschen="${esc(x.id)}" title="Entwurf löschen">${ICON.trash}</button></div>
      </div>`).join("")}</div>` : ""}`;
  const v = $("#view");
  v.onclick = async (ev) => {
    const neu = ev.target.closest("[data-fo-neu]");
    if (neu) {
      const r = await sicher(() => api("/api/formulieren/anlegen", { modus: neu.dataset.foNeu }));
      if (r) location.hash = `#formulieren?id=${r.entwurf.id}`;
      return;
    }
    const weg = ev.target.closest("[data-fo-loeschen]");
    if (weg) {
      ev.stopPropagation();
      if (!confirm("Diesen Entwurf mit allen Antworten löschen? Bereits gespeicherte PDFs in den Unterlagen bleiben.")) return;
      if (await sicher(() => api("/api/formulieren/loeschen", { id: weg.dataset.foLoeschen }), "Entwurf gelöscht")) renderFormulieren();
      return;
    }
    const auf = ev.target.closest("[data-fo-oeffnen]");
    if (auf) location.hash = `#formulieren?id=${auf.dataset.foOeffnen}`;
  };
}

/* ---------- Editor-Gerüst (wie der ATS-Editor) ---------- */
function foOeffne(e) {
  const gleicher = FO.e?.id === e.id;
  FO.e = e;
  if (!gleicher) { FO.schritt = 0; FO.cvGeaendert = false; }
  setHeader("Lebenslauf-Editor", e.stelle.position ? `Für: ${e.stelle.position}${e.stelle.firma ? `, ${e.stelle.firma}` : ""}` : "Neuer Lebenslauf für eine konkrete Stelle",
    `<span class="chip ok" id="cv-status">Gespeichert</span>
     <a class="btn" href="#formulieren">Alle Entwürfe</a>
     <button class="btn btn-primary" id="fo-pdf">${ICON_CV.download}PDF speichern</button>`);
  $("#view").onclick = null;
  $("#view").innerHTML = `${ebenenLeiste("neu")}<div class="cv-layout">
    <div class="cv-editor">
      <div class="card cv-fortschritt">
        <div class="zeile-main"><b id="fo-name"></b><span class="muted small" id="fo-stand"></span></div>
        <div class="balken"><span id="fo-balken"></span></div>
      </div>
      <div class="cv-schritte fo" role="tablist">${FO_SCHRITTE.map(([, name], i) =>
        `<button type="button" data-fo-schritt="${i}" role="tab">${i + 1}. ${name}</button>`).join("")}</div>
      <div id="fo-inhalt" class="card cv-inhalt"></div>
      <div class="cv-nav"><button class="btn" id="fo-zurueck">Zurück</button><button class="btn btn-primary" id="fo-weiter"></button></div>
    </div>
    <div class="cv-vorschau-spalte">
      <div class="card cv-toolbar">
        <div class="cv-design"><span class="muted small">Vorlage</span><b>Modul 4</b><span class="chip ok">ATS-sicher</span></div>
        <span class="chip" id="fo-art"></span>
      </div>
      <div class="cv-blatt-rahmen" id="cv-rahmen"><iframe id="cv-vorschau" title="Lebenslauf-Vorschau"></iframe></div>
      <div class="muted small cv-seiten" id="cv-seiten"></div>
    </div>
  </div>`;
  $$("[data-fo-schritt]").forEach((b) => b.addEventListener("click", () => foGehe(+b.dataset.foSchritt)));
  $("#fo-zurueck").onclick = () => foGehe(FO.schritt - 1);
  $("#fo-weiter").onclick = () => foGehe(FO.schritt + 1);
  $("#fo-pdf").onclick = foPdf;
  const box = $("#fo-inhalt");
  verdrahteEingaben(box, () => {
    if (document.activeElement?.dataset?.f?.startsWith("cv.")) FO.cvGeaendert = true;
    foPlaneVorschau(); foFortschritt();
  });
  verdrahteListen(box, () => { foIds(); foZeichne(); foPlaneVorschau(); });
  box.addEventListener("click", foKlick);
  box.addEventListener("change", foAenderung);
  new ResizeObserver(() => skaliereVorschau()).observe($("#cv-rahmen"));
  foZeichne();
  foPlaneVorschau(0);
}

function foGehe(i) {
  if (i < 0 || i >= FO_SCHRITTE.length) return;
  FO.schritt = i;
  foZeichne();
  window.scrollTo(0, 0);
}

function foIds() {
  for (const k of ["stationen", "ausbildung", "extras"]) {
    FO.e.eingabe[k].forEach((x) => { if (!x.id) x.id = [...crypto.getRandomValues(new Uint8Array(5))].map((b) => b.toString(16).padStart(2, "0")).join(""); });
  }
}

async function foSpeichern() {
  foIds();
  const e = FO.e;
  const teile = { id: e.id, stelle: e.stelle, eingabe: e.eingabe, persoenlich: e.persoenlich, kurzprofil_zeilen: e.kurzprofil_zeilen };
  if (FO.cvGeaendert) teile.cv = e.cv;
  await api("/api/formulieren/speichern", teile);
  FO.cvGeaendert = false;
}

/* Ein Schritt ruft Claude: Felder zuerst sichern, danach den neuen Stand übernehmen. */
async function foAktion(name, daten, text) {
  FO.arbeit = text;
  foZeichne();
  try {
    await foSpeichern();
    const r = await api(`/api/formulieren/${name}`, { id: FO.e.id, ...daten });
    if (r.entwurf) FO.e = r.entwurf;
    return r;
  } catch (err) {
    toast(err.message, true);
    return null;
  } finally {
    FO.arbeit = "";
    if ($("#fo-inhalt")) { foKopfNeu(); foZeichne(); foPlaneVorschau(0); }
  }
}

function foKopfNeu() {
  const s = FO.e.stelle;
  if (s.position) $("#view-sub").textContent = `Für: ${s.position}${s.firma ? `, ${s.firma}` : ""}`;
}

function foStand() {
  const e = FO.e;
  const teile = [e.stelle.text.trim().length >= 80, CV.profil.persoenlich.vorname && CV.profil.kontakt.email,
    e.eingabe.stationen.length, e.eingabe.ausbildung.length, e.eingabe.it || e.eingabe.sprachen, e.fragen_fertig,
    e.kurzprofil.status !== "offen", e.cv, e.bericht];
  return Math.round((teile.filter(Boolean).length / teile.length) * 100);
}

function foFortschritt() {
  if (!$("#fo-name")) return;
  const q = foStand();
  $("#fo-name").textContent = [CV.profil.persoenlich.vorname, CV.profil.persoenlich.nachname].filter(Boolean).join(" ") || "Neuer Lebenslauf";
  $("#fo-stand").textContent = `${q} % geschafft`;
  $("#fo-balken").style.width = `${q}%`;
}

function foZeichne() {
  const box = $("#fo-inhalt");
  if (!box) return;
  const [id, name] = FO_SCHRITTE[FO.schritt];
  $$("[data-fo-schritt]").forEach((b) => b.classList.toggle("an", +b.dataset.foSchritt === FO.schritt));
  box.innerHTML = `<div class="schritt-kopf"><h2>${name}</h2><span class="muted small">Schritt ${FO.schritt + 1} von ${FO_SCHRITTE.length}</span></div>
    <p class="abschnitt-text">${FO_TEXT[id]}</p>
    ${FO.arbeit ? `<div class="fo-arbeit"><span class="spinner"></span><div>${esc(FO.arbeit)}</div></div>` : ""}
    ${FO_RENDER[id]()}`;
  $("#fo-zurueck").disabled = FO.schritt === 0;
  const letzter = FO.schritt === FO_SCHRITTE.length - 1;
  $("#fo-weiter").style.display = letzter ? "none" : "";
  if (!letzter) $("#fo-weiter").textContent = `Weiter: ${FO_SCHRITTE[FO.schritt + 1][1]}`;
  $("#fo-pdf").disabled = !FO.e.cv;
  foFortschritt();
}

const foGesperrt = () => (FO.arbeit ? "disabled" : "");
const foKnopf = (attr, text, art = "btn-primary") => `<button type="button" class="btn ${art}" ${attr} ${foGesperrt()}>${text}</button>`;
function foWoertlich(pfad, wert) {
  return `<label class="check"><input type="checkbox" data-f="${pfad}" ${wert ? "checked" : ""}> Wörtlich übernehmen, nichts umformulieren</label>`;
}

/* ---------- Die Schritte ---------- */
const FO_RENDER = {
  stelle() {
    const e = FO.e;
    return `${e.modus === "umformulieren" ? `<div class="card-innen">
        <div class="abschnitt-kopf"><h2>Dein CV-Entwurf</h2><span class="muted small" style="margin-left:auto">optional</span></div>
        <p class="abschnitt-text">Füllt die Felder der nächsten Schritte vor. Dein Profil und der ATS-Editor bleiben unverändert.</p>
        <label class="dropzone klein">${ICON_CV.upload}<span><b>Entwurf wählen</b> – PDF, Word, Markdown oder Bild</span>
          <input type="file" id="fo-cv-datei" accept=".pdf,.docx,.doc,.md,.txt,.png,.jpg,.jpeg" multiple hidden ${foGesperrt()}></label>
        ${foKnopf('data-fo-aus-editor', `${ICON.refresh}Aus dem ATS-Editor holen`, "btn-soft")}
      </div>` : ""}
      <div class="form-grid">
        ${feld("f", "stelle.position", "Position", { ph: "wird sonst aus der Anzeige übernommen" })}
        ${feld("f", "stelle.firma", "Unternehmen", { hilfe: "Wird an den PDF-Namen angehängt." })}
        ${feld("f", "stelle.text", "Stellenanzeige", { voll: true, zeilen: 12, ph: "Anzeigentext hier einfügen …" })}
      </div>
      <div class="knopf-reihe" style="margin-top:12px">
        <input type="url" id="fo-url" placeholder="oder Link zur Anzeige" value="${esc(e.stelle.url)}" style="flex:1;min-width:180px">
        ${foKnopf("data-fo-url", "Laden", "btn")}
        <label class="btn">${ICON_CV.upload}Datei<input type="file" id="fo-stelle-datei" accept=".pdf,.docx,.doc,.md,.txt,.png,.jpg,.jpeg" hidden></label>
      </div>`;
  },
  profil() {
    const p = CV.profil, w = FO.e.persoenlich;
    const schalter = (key, titel, wert) => `<label class="schalter-zeile"><div class="zeile-main"><b>${titel}</b><span class="muted small">${esc(wert || "im Profil nicht eingetragen")}</span></div>
      <span class="schalter"><input type="checkbox" data-f="persoenlich.${key}" ${w[key] ? "checked" : ""}><span></span></span></label>`;
    return `<div class="form-grid">
        ${feld("p", "persoenlich.vorname", "Vorname")}${feld("p", "persoenlich.nachname", "Nachname")}
        ${feld("p", "kontakt.email", "E-Mail", { typ: "email" })}${feld("p", "kontakt.telefon", "Telefon", { typ: "tel" })}
        ${feld("p", "kontakt.strasse", "Straße")}
        <div class="form-grid" style="grid-template-columns:90px 1fr;gap:10px">${feld("p", "kontakt.plz", "PLZ")}${feld("p", "kontakt.ort", "Ort")}</div>
        ${feld("p", "kontakt.linkedin", "LinkedIn", { voll: true })}
      </div>
      <h3 class="extra-titel">Angaben im Lebenslauf</h3>
      ${schalter("verfuegbar_ab", "Verfügbar ab", p.beruf.verfuegbar_ab)}
      ${schalter("geburtsdatum", "Geburtsdatum", p.persoenlich.geburtsdatum)}
      ${schalter("familienstand", "Familienstand", p.persoenlich.familienstand)}
      ${schalter("nationalitaet", "Nationalität", p.persoenlich.nationalitaet)}
      ${schalter("kinderbetreuung", "Kinderbetreuung: gesichert", "nur wenn es zutrifft und du es nennen möchtest")}
      <p class="muted small">Modul 4: Geburtsdatum, Familienstand und Nationalität sind freiwillig und daher aus.</p>
      <h3 class="extra-titel">Foto und Unterschrift</h3>
      <div class="fo-bilder">
        <label class="dropzone klein">${ICON_CV.upload}<span>${FO.e.foto ? "<b>Foto ersetzen</b>" : "<b>Bewerbungsfoto</b> PNG oder JPG"}</span><input type="file" data-fo-bild="foto" accept=".png,.jpg,.jpeg" hidden></label>
        <label class="dropzone klein">${ICON_CV.upload}<span>${FO.e.unterschrift ? "<b>Unterschrift ersetzen</b>" : "<b>Unterschrift</b> PNG oder JPG"}</span><input type="file" data-fo-bild="unterschrift" accept=".png,.jpg,.jpeg" hidden></label>
      </div>`;
  },
  erfahrung() {
    const l = FO.e.eingabe.stationen;
    return l.map((x, i) => `<div class="eintrag">
      ${eintragKopf("f", "eingabe.stationen", i, [x.titel, x.unternehmen].filter(Boolean).join(" · "), l.length)}
      <div class="form-grid">
        ${feld("f", `eingabe.stationen.${i}.titel`, "Position")}
        ${feld("f", `eingabe.stationen.${i}.unternehmen`, "Unternehmen")}
        ${feld("f", `eingabe.stationen.${i}.ort`, "Ort")}
        <div class="form-grid" style="gap:10px">${feld("f", `eingabe.stationen.${i}.von`, "Von", { ph: "MM/JJJJ" })}${feld("f", `eingabe.stationen.${i}.bis`, "Bis", { ph: "MM/JJJJ oder heute" })}</div>
        ${feld("f", `eingabe.stationen.${i}.notizen`, x.woertlich ? "Dein Text (eine Zeile pro Punkt)" : "Was hast du gemacht? Stichpunkte reichen", { voll: true, zeilen: 5, ph: x.woertlich ? "Bleibt genau so stehen" : "z. B. kunden am telefon, angebote schreiben, reklamationen, ca 30 stammkunden, neue kollegen eingearbeitet" })}
        <div class="voll fo-wahl">${foWoertlich(`eingabe.stationen.${i}.woertlich`, x.woertlich)}</div>
      </div></div>`).join("") + addKnopf("f", "eingabe.stationen", "Station hinzufügen");
  },
  bildung() {
    const l = FO.e.eingabe.ausbildung;
    return l.map((x, i) => `<div class="eintrag">
      ${eintragKopf("f", "eingabe.ausbildung", i, x.titel, l.length)}
      <div class="form-grid">
        ${feld("f", `eingabe.ausbildung.${i}.titel`, "Abschluss / Titel", { ph: "Ohne Abschluss? Bitte dazuschreiben" })}
        ${feld("f", `eingabe.ausbildung.${i}.institut`, "Schule / Institut")}
        ${feld("f", `eingabe.ausbildung.${i}.ort`, "Ort")}
        <div class="form-grid" style="gap:10px">${feld("f", `eingabe.ausbildung.${i}.von`, "Von", { ph: "MM/JJJJ" })}${feld("f", `eingabe.ausbildung.${i}.bis`, "Bis", { ph: "MM/JJJJ" })}</div>
        ${feld("f", `eingabe.ausbildung.${i}.notizen`, "Inhalte und Schwerpunkte (optional)", { voll: true, zeilen: 3 })}
        <div class="voll fo-wahl">${foWoertlich(`eingabe.ausbildung.${i}.woertlich`, x.woertlich)}</div>
      </div></div>`).join("") + addKnopf("f", "eingabe.ausbildung", "Bildung hinzufügen");
  },
  extras() {
    const g = FO.e.eingabe, l = g.extras;
    return `<div class="form-grid">
        ${feld("f", "eingabe.it", "IT-Kenntnisse (eine Zeile je Tool, mit Niveau, falls bekannt)", { voll: true, zeilen: 4, ph: "HubSpot: Grundkenntnisse\nSAP SD, gute Kenntnisse aus der Berufspraxis" })}
        ${feld("f", "eingabe.zertifikate", "Zertifikate (eine Zeile je Zertifikat, mit MM/JJJJ)", { voll: true, zeilen: 3 })}
        ${feld("f", "eingabe.sprachen", "Sprachen (eine Zeile je Sprache)", { voll: true, zeilen: 3, ph: "Deutsch: Muttersprache\nEnglisch: gute Kenntnisse in Wort und Schrift" })}
        <div class="voll fo-wahl">${foWoertlich("eingabe.kenntnisse_woertlich", g.kenntnisse_woertlich)}</div>
      </div>
      <h3 class="extra-titel">Projekte, Hobbies, Ehrenamt</h3>
      ${feld("f", "eingabe.extras_titel", "Überschrift", { voll: true, ph: "Hobbies, Ehrenamt oder Eigene Projekte" })}
      <div style="height:10px"></div>
      ${l.map((x, i) => `<div class="eintrag">
        ${eintragKopf("f", "eingabe.extras", i, x.titel, l.length)}
        <div class="form-grid">
          ${feld("f", `eingabe.extras.${i}.titel`, "Titel", { voll: true })}
          ${feld("f", `eingabe.extras.${i}.von`, "Von", { ph: "MM/JJJJ" })}${feld("f", `eingabe.extras.${i}.bis`, "Bis", { ph: "MM/JJJJ oder heute" })}
          ${feld("f", `eingabe.extras.${i}.notizen`, "Was steckt dahinter?", { voll: true, zeilen: 3 })}
          <div class="voll fo-wahl">${foWoertlich(`eingabe.extras.${i}.woertlich`, x.woertlich)}</div>
        </div></div>`).join("")}
      ${addKnopf("f", "eingabe.extras", "Eintrag hinzufügen")}`;
  },
  fragen() {
    const e = FO.e, a = e.analyse;
    if (!a) return `<div class="leer"><p>Wenn Stelle und Felder ausgefüllt sind, prüft Claude alles gegen die Anzeige und fragt nur, was wirklich fehlt.</p>
      ${foKnopf("data-fo-analysieren", `${ICON.spark}Mit der Stelle abgleichen`)}</div>`;
    const offen = e.fragen.length ? `${e.fragen.map(foFrageKarte).join("")}
        <div class="knopf-reihe">${foKnopf("data-fo-antworten", "Antworten absenden")}${foKnopf("data-fo-fragen-ende", "Rest überspringen", "btn")}</div>
        <p class="muted small">Unbeantwortetes wird weggelassen und im Prüfbericht als Lücke genannt. Größenordnungen reichen, aber nur, was du im Gespräch erklären kannst.</p>`
      : `<div class="hinweis info">${ICON.spark}<div>Rückfragen abgeschlossen${e.antworten.length ? `, ${e.antworten.length} Antworten übernommen` : ""}.</div>
        <button type="button" class="btn btn-sm" style="margin-left:auto" data-fo-gehe="6">Weiter zum Kurzprofil</button></div>`;
    return `${offen}${foAnalyseHtml(a)}
      <div class="knopf-reihe" style="margin-top:12px">${foKnopf("data-fo-analysieren", `${ICON.refresh}Neu abgleichen`, "btn")}</div>`;
  },
  kurzprofil() {
    const e = FO.e, kp = e.kurzprofil;
    if (!e.fragen_fertig) return `<div class="leer"><p>Das Kurzprofil kommt erst nach Prüfung und Rückfragen.</p><button type="button" class="btn" data-fo-gehe="5">Zu den Fragen</button></div>`;
    if (kp.status === "offen") return `<p><b>Die Prüfung deines Lebenslaufs ist abgeschlossen. Möchtest du ein Kurzprofil oben im Lebenslauf integrieren?</b></p>
      <div class="knopf-reihe">${foKnopf('data-fo-kp="ja"', "Ja")}${foKnopf('data-fo-kp="nein"', "Nein", "btn")}${foKnopf('data-fo-kp="spaeter"', "Später hinzufügen", "btn")}</div>`;
    if (kp.status !== "ja") return `<p class="muted">${kp.status === "nein" ? "Dein Lebenslauf bleibt ohne Kurzprofil." : "Der Lebenslauf entsteht vorerst ohne Kurzprofil."}</p>
      ${kp.fehlend ? `<div class="hinweis">${ICON.bell}<div>Für mindestens 3 belegte Zeilen fehlt noch: ${esc(kp.fehlend)}</div></div>` : ""}
      <div class="knopf-reihe">${foKnopf('data-fo-kp="ja"', "Kurzprofil jetzt hinzufügen", "btn-soft")}<button type="button" class="btn" data-fo-gehe="7">Weiter zum Ergebnis</button></div>`;
    if (e.kurzprofil_zeilen.length) return foKpFertig();
    if (kp.belegfragen.length || kp.vorschlaege) return foKpAuswahl();
    return `<p><b>Was soll in deinem Kurzprofil stehen?</b> Stichpunkte reichen, denk zum Beispiel an:</p>
      <ol class="schritte">
        <li>Was du genau machst (inkl. Tools, Branchen, Teamgrößen).</li>
        <li>Konkreter Erfolg oder Projekt, auf das du stolz bist (am besten mit einer Zahl: Zeit gespart, Umsatz gemacht, Fehlerquote gesenkt, Prozess beschleunigt).</li>
        <li>Eine Sache, die dich von anderen in deinem Job unterscheidet (z. B. ungewöhnliche Kombination aus zwei Fähigkeiten).</li>
      </ol>
      <label class="feld" style="margin-top:12px"><textarea id="fo-kp-text" rows="6" ${foGesperrt()}>${esc(kp.stichpunkte)}</textarea></label>
      <div class="knopf-reihe">${foKnopf("data-fo-kp-text", "Kurzprofil schreiben")}${foKnopf("data-fo-kp-vorschlaege", `${ICON.spark}Vorschläge machen`, "btn-soft")}${foKnopf('data-fo-kp="spaeter"', "Doch später", "btn")}</div>`;
  },
  ergebnis() {
    const e = FO.e, c = e.cv;
    if (!c) {
      const fehlt = !e.fragen_fertig ? ["Rückfragen abschließen", 5] : e.kurzprofil.status === "offen" ? ["Beim Kurzprofil entscheiden", 6] : null;
      return `<div class="leer"><p>${fehlt ? "Vorher noch offen:" : "Alles bereit. Claude schreibt jetzt den Lebenslauf und prüft jede Zeile gegen deine Angaben."}</p>
        ${fehlt ? `<button type="button" class="btn" data-fo-gehe="${fehlt[1]}">${fehlt[0]}</button>` : foKnopf("data-fo-formulieren", `${ICON.spark}Lebenslauf formulieren`)}</div>`;
    }
    const liste = (titel, pfad, feldname) => (c[pfad] || []).map((x, i) => `<div class="eintrag">
        <div class="eintrag-kopf"><b>${esc(x.titel)}${x[feldname] ? ` · ${esc(x[feldname])}` : ""}</b><span class="muted small">${esc([x.von, x.bis].filter(Boolean).join(" – "))}</span></div>
        ${x.punkte.length ? feld("f", `cv.${pfad}.${i}.punkte`, titel, { modus: "zeilen", zeilen: x.punkte.length + 2, voll: true }) : ""}
        ${x.unter.map((u, j) => `<p class="muted small">${esc(u.titel)}${u.zeilen.length ? `: ${esc(u.zeilen.join(" "))}` : ""}</p>${u.punkte.length ? feld("f", `cv.${pfad}.${i}.unter.${j}.punkte`, "Punkte", { modus: "zeilen", zeilen: u.punkte.length + 1, voll: true }) : ""}`).join("")}
      </div>`).join("");
    return `${e.bericht ? "" : `<div class="hinweis">${ICON.bell}<div>Der Faktencheck und der Prüfbericht fehlen noch.</div>${foKnopf("data-fo-pruefen", "Jetzt prüfen", "btn btn-sm")}</div>`}
      <div id="fo-pruefung">${foPruefungHtml()}</div>
      ${e.kurzprofil_zeilen.length ? `<h3 class="extra-titel">Kurzprofil</h3>${foKpFelder()}` : ""}
      ${c.berufserfahrung.length ? `<h3 class="extra-titel">Berufserfahrung</h3>${liste("Punkte (eine pro Zeile)", "berufserfahrung", "unternehmen")}` : ""}
      ${(c.weitere_stationen || []).some((x) => x.punkte.length) ? `<h3 class="extra-titel">Weitere Stationen</h3>${liste("Punkte", "weitere_stationen", "unternehmen")}` : ""}
      ${c.ausbildung.some((x) => x.punkte.length) ? `<h3 class="extra-titel">Ausbildung und Weiterbildung</h3>${liste("Punkte", "ausbildung", "institut")}` : ""}
      ${(c.interessen || []).length ? `<h3 class="extra-titel">${esc(c.interessen_titel || "Hobbies, Ehrenamt")}</h3>${liste("Punkte", "interessen", "ort")}` : ""}
      <h3 class="extra-titel">Kernkompetenzen</h3>${feld("f", "cv.kernkompetenzen", "Komma-getrennt", { modus: "komma", voll: true, zeilen: 2 })}
      ${e.bericht ? `<details class="card-innen" style="margin-top:12px"><summary><b>Prüfbericht</b></summary><div class="fo-bericht" style="margin-top:10px">${esc(e.bericht)}</div></details>` : ""}
      <div class="knopf-reihe" style="margin-top:12px">${foKnopf("data-fo-formulieren", `${ICON.refresh}Neu formulieren`, "btn")}</div>`;
  },
};

function foPruefungHtml() {
  const w = FO.e.warnungen || [], k = FO.e.keywords_ergebnis;
  return `${w.length ? `<div class="card-innen"><div class="abschnitt-kopf"><h2>Hinweise</h2></div><ul class="fo-warnungen">${w.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
    ${k ? `<div class="card-innen"><div class="abschnitt-kopf"><h2>Schlüsselbegriffe: ${k.gefunden} von ${k.gesamt}</h2></div>
      ${k.fehlend.length ? `<div class="kw-liste">${k.fehlend.map((x) => `<span class="chip bad">${esc(x)}</span>`).join("")}</div>
      <p class="muted small">Fehlende Begriffe kommen nur hinein, wenn du sie belegen kannst.</p>` : ""}</div>` : ""}`;
}

function foAnalyseHtml(a) {
  return `<details class="card-innen" style="margin-top:12px"><summary><b>Abgleich mit der Stelle</b>${a.eckdaten.rollentyp ? ` <span class="chip neu">${esc(a.eckdaten.rollentyp)}</span>` : ""}</summary>
    ${a.top3.length ? `<div class="an-h">Top-3-Aufgaben</div><ol class="an-liste">${a.top3.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>` : ""}
    ${a.muss_kann.length ? `<div class="an-h">Muss und Kann</div><div class="an-wahl">${a.muss_kann.map((m) => `<div class="ats-regel"><div class="ats-zeile"><span>${esc(m.anforderung)}</span><span class="chip ${/^ja/i.test(m.eignung) ? "ok" : /^nein/i.test(m.eignung) ? "bad" : "warn"}">${esc(m.art)}: ${esc(m.eignung)}</span></div>${m.beleg ? `<div class="muted small">${esc(m.beleg)}</div>` : ""}</div>`).join("")}</div>` : ""}
    ${a.diagnose.length ? `<div class="an-h">Befunde im Entwurf</div><ul class="an-liste">${a.diagnose.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
  </details>`;
}

function foFrageKarte(f) {
  const typ = f.mehrfach ? "checkbox" : "radio";
  return `<div class="fo-frage" data-fo-frage="${esc(f.id)}"><b>${esc(f.frage)}</b>
    ${f.optionen.map((o) => `<label class="fo-option"><input type="${typ}" name="fo-${esc(f.id)}" value="${esc(o.label)}"><span>${esc(o.label)}${o.beschreibung ? `<span class="muted small">${esc(o.beschreibung)}</span>` : ""}</span></label>`).join("")}
    <label class="feld"><input type="text" data-fo-frei placeholder="${esc(f.platzhalter || "Eigene Angabe")}" autocomplete="off"></label></div>`;
}

function foAntwortenLesen(root) {
  return $$("[data-fo-frage]", root).map((k) => ({ id: k.dataset.foFrage,
    wahl: $$("input:checked", k).map((x) => x.value), text: $("[data-fo-frei]", k).value.trim() }));
}

function foKpAuswahl() {
  const kp = FO.e.kurzprofil, v = kp.vorschlaege;
  const gruppe = (titel, liste) => liste?.length ? `<h3 class="extra-titel">${titel}</h3>${liste.map((x) => `<label class="fo-option"><input type="checkbox" data-fo-vorschlag value="${esc(x.aussage)}" checked><span>${esc(x.label || x.aussage)}<span class="muted small">Beleg: ${esc(x.beleg)} (${esc(x.quelle)})</span></span></label>`).join("")}` : "";
  return `${v ? `<p class="muted">Aus deinen Angaben, jeweils mit Beleg. Wähle aus, was hinein soll.</p>
      ${gruppe("Fähigkeiten", v.faehigkeiten)}${gruppe("Erfolge", v.erfolge)}${gruppe("Besonderheiten", v.besonderheiten)}
      <label class="feld" style="margin-top:10px">Eigene Ergänzung<textarea id="fo-kp-eigen" rows="2"></textarea></label>` : ""}
    ${kp.belegfragen.length ? `<h3 class="extra-titel">Noch ohne Beleg</h3><p class="muted small">Diese Aussagen kommen nur mit einem Beleg ins Kurzprofil.</p>${kp.belegfragen.map(foFrageKarte).join("")}` : ""}
    <div class="knopf-reihe">${foKnopf("data-fo-kp-belege", "Kurzprofil schreiben")}${foKnopf('data-fo-kp="spaeter"', "Doch später", "btn")}</div>`;
}

function foKpFelder() {
  const z = FO.e.kurzprofil_zeilen;
  return `${z.map((_, i) => `<div class="fo-kp-zeile">
      ${feld("f", `kurzprofil_zeilen.${i}.schlagwort`, i ? "" : "Schlagwort")}${feld("f", `kurzprofil_zeilen.${i}.fakt`, i ? "" : "Fakt", { zeilen: 2 })}
      <button type="button" class="icon-btn mini klein" data-fo-kp-weg="${i}" title="Zeile entfernen" ${z.length <= 3 ? "disabled" : ""}>${ICON.trash}</button></div>`).join("")}`;
}

function foKpFertig() {
  const kp = FO.e.kurzprofil;
  return `${foKpFelder()}
    ${kp.verworfen.length ? `<p class="muted small">Ohne Beleg weggelassen: ${kp.verworfen.map(esc).join(", ")}</p>` : ""}
    <div class="knopf-reihe">${foKnopf("data-fo-kp-neu", `${ICON.refresh}Noch einmal schreiben`, "btn")}<button type="button" class="btn btn-primary" data-fo-gehe="7">Weiter zum Ergebnis</button></div>`;
}

/* ---------- Aktionen ---------- */
async function foKlick(ev) {
  const b = ev.target.closest("button"); if (!b || b.disabled) return;
  const ds = b.dataset, box = $("#fo-inhalt");
  if (ds.foGehe !== undefined) return foGehe(+ds.foGehe);
  if (ds.foAusEditor !== undefined) {
    if (FO.e.eingabe.stationen.length && !confirm("Die eingetragenen Stationen, Bildung und Kenntnisse ersetzen?")) return;
    if (await foAktion("importieren", { aus_editor: true }, "Holt die Daten aus dem ATS-Editor …")) toast("Felder vorgefüllt");
  } else if (ds.foUrl !== undefined) {
    const url = $("#fo-url").value.trim();
    if (!url) return toast("Bitte einen Link eintragen", true);
    if (await foAktion("stelle", { url }, "Liest die Anzeige …")) toast("Anzeige übernommen");
  } else if (ds.foAnalysieren !== undefined) {
    await foAktion("analysieren", {}, "Claude gleicht deine Angaben mit der Stelle ab … das dauert meist 1–2 Minuten.");
  } else if (ds.foAntworten !== undefined) {
    await foAktion("antworten", { antworten: foAntwortenLesen(box) }, "Claude wertet deine Antworten aus …");
  } else if (ds.foFragenEnde !== undefined) {
    await foAktion("fragen_beenden", {}, "Speichert …");
  } else if (ds.foKp) {
    await foAktion("kp_status", { status: ds.foKp }, "Speichert …");
  } else if (ds.foKpText !== undefined) {
    const text = $("#fo-kp-text").value.trim();
    if (!text) return toast("Bitte Stichpunkte eintragen oder „Vorschläge machen“ wählen", true);
    FO.e.kurzprofil.stichpunkte = text;
    if (await foAktion("kp_stichpunkte", { text }, "Claude prüft, was belegt ist …") && !FO.e.kurzprofil.belegfragen.length) {
      await foAktion("kp_schreiben", {}, "Claude schreibt dein Kurzprofil …");
    }
  } else if (ds.foKpVorschlaege !== undefined) {
    await foAktion("kp_vorschlaege", {}, "Claude sucht belegte Fähigkeiten, Erfolge und Besonderheiten …");
  } else if (ds.foKpBelege !== undefined) {
    const daten = { antworten: foAntwortenLesen(box), auswahl: $$("[data-fo-vorschlag]:checked", box).map((x) => x.value), eigene: $("#fo-kp-eigen")?.value || "" };
    if (await foAktion("kp_belege", daten, "Speichert deine Auswahl …")) await foAktion("kp_schreiben", {}, "Claude schreibt dein Kurzprofil …");
  } else if (ds.foKpNeu !== undefined) {
    await foAktion("kp_schreiben", {}, "Claude schreibt dein Kurzprofil …");
  } else if (ds.foKpWeg !== undefined) {
    FO.e.kurzprofil_zeilen.splice(+ds.foKpWeg, 1);
    speichereSpaeter("formulieren"); foZeichne(); foPlaneVorschau();
  } else if (ds.foFormulieren !== undefined) {
    if (FO.e.cv && !confirm("Den Lebenslauf neu formulieren? Deine Änderungen im Ergebnis gehen dabei verloren.")) return;
    if (await foAktion("formulieren", {}, "Claude schreibt deinen Lebenslauf … das dauert meist 1–3 Minuten.")) await foAktion("pruefen", {}, "Faktencheck und Prüfbericht laufen …");
  } else if (ds.foPruefen !== undefined) {
    await foAktion("pruefen", {}, "Faktencheck und Prüfbericht laufen …");
  }
}

async function foAenderung(ev) {
  const el = ev.target;
  if (el.type === "checkbox" && el.dataset.f) {   // Schalter speichern schon per input; Beschriftung neu zeichnen
    if (el.dataset.f.endsWith("woertlich")) foZeichne();
    return;
  }
  if (el.id === "fo-cv-datei" && el.files.length) {
    if (FO.e.eingabe.stationen.length && !confirm("Die eingetragenen Stationen, Bildung und Kenntnisse ersetzen?")) { el.value = ""; return; }
    const dateien = await Promise.all([...el.files].map(async (f) => ({ name: f.name, b64: await alsBase64(f) })));
    if (await foAktion("importieren", { dateien }, "Claude liest deinen Entwurf … das dauert meist 30–90 Sekunden.")) toast("Felder vorgefüllt, bitte kurz prüfen");
  } else if (el.id === "fo-stelle-datei" && el.files[0]) {
    const f = el.files[0];
    if (await foAktion("stelle", { name: f.name, b64: await alsBase64(f) }, "Liest die Anzeige …")) toast("Anzeige übernommen");
  } else if (el.dataset.foBild && el.files[0]) {
    if (await foAktion("bild", { art: el.dataset.foBild, b64: await alsBase64(el.files[0]) }, "Lädt das Bild hoch …")) toast("Bild übernommen");
  }
}

async function foPdf() {
  const knopf = $("#fo-pdf");
  knopf.disabled = true;
  try {
    await foSpeichern();
    const r = await api("/api/formulieren/pdf", { id: FO.e.id });
    FO.e.pdf_pfad = r.pfad;
    toast(`In Unterlagen gespeichert: ${r.pfad}`);
    await sicher(() => api("/api/oeffnen", { pfad: r.pfad }));
  } catch (err) {
    toast(err.message, true);
  } finally {
    if ($("#fo-pdf")) knopf.disabled = !FO.e.cv;
  }
}

/* ---------- Vorschau: dasselbe PDF wie beim Export ---------- */
function foPlaneVorschau(ms = 1200) {
  clearTimeout(FO.vorschauTimer);
  FO.vorschauTimer = setTimeout(foZeichneVorschau, ms);
}

async function foZeichneVorschau() {
  const frame = $("#cv-vorschau"), info = $("#cv-seiten");
  if (!frame || !FO.e || FO.arbeit) return;   // nach einer Claude-Aktion wird neu geplant
  const nr = ++FO.vorschauNr;
  if (!FO.chrome) { if (info) info.textContent = "Für die Vorschau wird Google Chrome gebraucht."; return; }
  if (info) info.textContent = "Vorschau wird erstellt …";
  let r;
  try {
    await foSpeichern();
    r = await api("/api/formulieren/vorschau", { id: FO.e.id });
  } catch (err) {
    if (nr === FO.vorschauNr && info) info.textContent = `Vorschau nicht möglich: ${err.message}`;
    return;
  }
  if (nr !== FO.vorschauNr || !$("#cv-vorschau") || !FO.e) return;
  const bytes = Uint8Array.from(atob(r.pdf), (c) => c.charCodeAt(0));
  if (FO.pdfUrl) URL.revokeObjectURL(FO.pdfUrl);
  FO.pdfUrl = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  frame.style.height = `${r.seiten * A4_PX.h}px`;
  frame.src = `${FO.pdfUrl}#toolbar=0&navpanes=0&view=FitH`;
  skaliereVorschau();
  $("#fo-art").textContent = r.art === "roh" ? "Rohfassung: deine Felder" : "Formuliert";
  $("#fo-art").className = r.art === "roh" ? "chip" : "chip ok";
  if (info) info.textContent = `${r.seiten} Seite${r.seiten > 1 ? "n" : ""} · A4${r.seiten > 2 ? " · Ziel sind 2 Seiten" : ""}`;
  if (r.art !== "roh") {
    Object.assign(FO.e, { warnungen: r.warnungen, keywords_ergebnis: r.keywords });
    if ($("#fo-pruefung")) $("#fo-pruefung").innerHTML = foPruefungHtml();
  }
}

VIEWS.formulieren = renderFormulieren;
