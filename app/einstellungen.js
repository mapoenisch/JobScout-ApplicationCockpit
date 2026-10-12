/* JobScout Cockpit – Einstellungen: Suchprofil, Scoring-Engine, Ausschlüsse,
   Skill-Profil und Bewerbungsvorgaben. Nutzt die Helfer aus app.js. */
"use strict";

const EINST = {
  daten: null,        // Arbeitskopie (profil, score_regeln, skill_status, bewerbung)
  standard: null,
  katalog: {},
  gespeichert: "",    // JSON-Stand der letzten Speicherung
  tab: "suchprofil",
  vorschau: null,
  vorschauTimer: null,
  vorschauLaeuft: false,
};

const EINST_TABS = [
  ["suchprofil", "Suchprofil", '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>'],
  ["scoring", "Scoring-Engine", '<svg viewBox="0 0 24 24"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/></svg>'],
  ["ausschluesse", "Ausschlüsse", '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/></svg>'],
  ["skills", "Skill-Profil", '<svg viewBox="0 0 24 24"><path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/></svg>'],
  ["bewerbung", "Bewerbung", '<svg viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>'],
];

const QUELLEN_NAMEN = {
  arbeitsagentur: ["Bundesagentur für Arbeit", "Offizielle Jobsuche-API, inkl. Detailbeschreibungen"],
  arbeitnow: ["Arbeitnow", "Internationale Tech- und Startup-Jobs"],
  adzuna: ["Adzuna", "Braucht ADZUNA_APP_ID + ADZUNA_APP_KEY in .env"],
  himalayas: ["Himalayas", "Reine Remote-Jobs, ohne API-Key"],
};

/* ---------- Pfad-Helfer ---------- */
function einstGet(pfad) {
  return pfad.split(".").reduce((o, k) => o?.[k], EINST.daten);
}
function einstSet(pfad, wert) {
  const teile = pfad.split(".");
  const letzter = teile.pop();
  teile.reduce((o, k) => o[k], EINST.daten)[letzter] = wert;
  einstGeaendert(pfad);
}
function istUngespeichert() {
  return EINST.daten && JSON.stringify(EINST.daten) !== EINST.gespeichert;
}
function einstGeaendert(pfad) {
  const pill = $("#einst-status");
  if (pill) pill.hidden = !istUngespeichert();
  if (pfad.startsWith("score_regeln")) planeVorschau();
}

window.addEventListener("beforeunload", (e) => {
  if (istUngespeichert()) { e.preventDefault(); e.returnValue = ""; }
});

/* ---------- Laden / Speichern ---------- */
async function ladeEinstellungen(neu = false) {
  if (EINST.daten && !neu) return true;
  const e = await sicher(() => api("/api/einstellungen"));
  if (!e) return false;
  EINST.daten = { profil: e.profil, score_regeln: e.score_regeln, skill_status: e.skill_status, bewerbung: e.bewerbung, skill_katalog_eigen: e.skill_katalog_eigen || {} };
  EINST.standard = e.standard;
  EINST.katalogStandard = e.skill_katalog_standard;
  EINST.gespeichert = JSON.stringify(EINST.daten);
  return true;
}

async function speichereEinstellungen(neuBewerten) {
  const ok = await sicher(() => api("/api/einstellungen", EINST.daten));
  if (!ok) return;
  EINST.gespeichert = JSON.stringify(EINST.daten);
  if (neuBewerten) {
    toast("Gespeichert – bewerte Stellen neu …");
    const r = await sicher(() => api("/api/einstellungen/neu_bewerten", {}));
    if (r) {
      toast(`${r.bewertet} Stellen neu bewertet${r.ausgeschlossen ? `, ${r.ausgeschlossen} ausgeschlossen` : ""}`);
      await ladeAlles();
    }
  } else {
    toast("Einstellungen gespeichert");
  }
  await ladeEinstellungen(true);
  renderEinstellungen();
}

async function setzeZurueck() {
  if (!confirm("Alle Einstellungen auf die Standardwerte aus job_scout.py zurücksetzen?\nDie bisherige Datei bleibt als einstellungen.json.bak erhalten.")) return;
  const ok = await sicher(() => api("/api/einstellungen/zuruecksetzen", {}), "Auf Standard zurückgesetzt");
  if (!ok) return;
  await ladeEinstellungen(true);
  EINST.vorschau = null;
  renderEinstellungen();
}

/* ---------- Seite ---------- */
async function renderEinstellungen() {
  setHeader("Einstellungen", "Jobrollen, Keywords, Scoring und Bewerbungsvorgaben",
    `<span class="ungespeichert" id="einst-status" hidden>Ungespeicherte Änderungen</span>
     <button class="btn" id="einst-reset">Standard wiederherstellen</button>
     <button class="btn btn-primary" id="einst-speichern">Speichern</button>`);
  if (!(await ladeEinstellungen())) return;
  $("#einst-status").hidden = !istUngespeichert();
  $("#einst-reset").onclick = setzeZurueck;
  $("#einst-speichern").onclick = () => speichereEinstellungen(EINST.tab === "scoring" || EINST.tab === "ausschluesse");

  $("#view").innerHTML = `
    <div class="tabs" role="tablist">${EINST_TABS.map(([id, name, icon]) =>
      `<button class="tab ${EINST.tab === id ? "active" : ""}" data-tab="${id}" role="tab">${icon}${name}</button>`).join("")}</div>
    <div id="einst-inhalt"></div>`;
  $$(".tab").forEach((t) => t.addEventListener("click", () => { EINST.tab = t.dataset.tab; renderEinstellungen(); }));
  // Einfache Felder: einmal pro Seitenaufbau am Container registrieren
  const inhalt = $("#einst-inhalt");
  inhalt.addEventListener("input", (e) => {
    const t = e.target;
    if (t.dataset.zahl && t.value !== "") einstSet(t.dataset.zahl, Math.round(+t.value));
    else if (t.dataset.text) einstSet(t.dataset.text, t.value);
  });
  inhalt.addEventListener("change", (e) => {
    if (e.target.dataset.bool) einstSet(e.target.dataset.bool, e.target.checked);
  });
  zeichneTab();
}

function zeichneTab() {
  const ziel = $("#einst-inhalt");
  const tabs = { suchprofil: tabSuchprofil, scoring: tabScoring, ausschluesse: tabAusschluesse, skills: tabSkills, bewerbung: tabBewerbung };
  ziel.innerHTML = tabs[EINST.tab]();
  verdrahte(ziel);
  if (EINST.tab === "scoring") { zeichneVorschau(); if (!EINST.vorschau) planeVorschau(0); }
}

function abschnitt(titel, text, inhalt, effekt = "") {
  return `<div class="card">
    <div class="abschnitt-kopf"><h2>${titel}</h2>${effekt}</div>
    ${text ? `<p class="abschnitt-text">${text}</p>` : ""}
    ${inhalt}</div>`;
}
const effektGross = '<span class="effekt">Großer Effekt</span>';
const effektSuche = '<span class="effekt info">Wirkt beim nächsten Suchlauf</span>';

/* ---------- Bausteine ---------- */
function tagEditor(pfad, platzhalter) {
  const werte = einstGet(pfad) || [];
  return `<div class="tags" data-tags="${pfad}">
    ${werte.map((w, i) => `<span class="tag">${esc(w)}<button type="button" data-tag-weg="${i}" aria-label="${esc(w)} entfernen">×</button></span>`).join("")}
    <input type="text" placeholder="${esc(platzhalter)}" aria-label="${esc(platzhalter)}">
  </div>`;
}

function gewichtTabelle(pfad, negativ = false) {
  const obj = einstGet(pfad) || {};
  const eintraege = Object.entries(obj).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const max = Math.max(1, ...eintraege.map(([, p]) => Math.abs(p)));
  return `<div class="gewichte" data-gewichte="${pfad}">
    ${eintraege.map(([kw, p]) => `<div class="gewicht ${p < 0 ? "minus" : ""}">
      <input type="text" value="${esc(kw)}" data-kw-alt="${esc(kw)}" aria-label="Keyword">
      <input type="number" value="${p}" min="-100" max="100" data-kw-punkte="${esc(kw)}" aria-label="Punkte für ${esc(kw)}">
      <button type="button" class="icon-btn klein" data-kw-weg="${esc(kw)}" title="Entfernen">${ICON.trash}</button>
      <div class="balken-mini"><span style="width:${(Math.abs(p) / max) * 100}%"></span></div>
    </div>`).join("") || '<div class="muted small">Noch keine Einträge.</div>'}
    <div class="gewicht-neu">
      <input type="text" placeholder="Neues Keyword …" data-neu-kw>
      <input type="number" value="${negativ ? -10 : 10}" min="-100" max="100" data-neu-punkte aria-label="Punkte">
      <button type="button" class="btn" data-neu-add>${ICON.plus}Hinzufügen</button>
    </div>
  </div>`;
}

function zahlFeld(pfad, label, min, max, einheit = "") {
  return `<label class="feld">${label}
    <input type="number" data-zahl="${pfad}" value="${einstGet(pfad)}" min="${min}" max="${max}">
    ${einheit ? `<span class="muted small" style="font-weight:500">${einheit}</span>` : ""}</label>`;
}

function schalter(pfad, titel, text) {
  return `<label class="schalter-zeile">
    <div class="zeile-main"><b>${titel}</b><span class="muted small">${text}</span></div>
    <span class="schalter"><input type="checkbox" data-bool="${pfad}" ${einstGet(pfad) ? "checked" : ""}><span></span></span>
  </label>`;
}

/* ---------- Tabs ---------- */
function tabSuchprofil() {
  const p = EINST.daten.profil;
  return `<div class="einst-spalte" style="max-width:920px">
    ${abschnitt("Jobrollen & Suchbegriffe", "Für jeden Begriff fragt der Scraper alle aktiven Quellen ab. Mehr Begriffe bedeuten mehr Treffer, aber auch einen längeren Lauf.",
      tagEditor("profil.suchbegriffe", "Rolle hinzufügen, z. B. Inside Sales – Enter"), effektSuche)}
    ${abschnitt("Standort", "Vor-Ort- und Hybrid-Stellen werden rund um diesen Ort gesucht.",
      `<div class="form-grid">
        <label class="feld">Ort<input type="text" data-text="profil.ort" value="${esc(p.ort)}"></label>
        ${zahlFeld("profil.umkreis_km", "Umkreis in km", 0, 200)}
        <label class="feld">Land für Himalayas<input type="text" data-text="profil.himalayas_land" value="${esc(p.himalayas_land)}"></label>
      </div>
      <div style="margin-top:10px">${schalter("profil.remote_suche", "Bundesweit nach Remote-Stellen suchen", "Zusätzliche Abfrage ohne Ortsbindung")}</div>`, effektSuche)}
    ${abschnitt("Quellen", "Welche Jobbörsen abgefragt werden.",
      Object.keys(p.quellen).map((q) => schalter(`profil.quellen.${q}`, QUELLEN_NAMEN[q]?.[0] || q, QUELLEN_NAMEN[q]?.[1] || "")).join(""), effektSuche)}
    ${abschnitt("Feintuning", "",
      `<div class="zahlen">
        ${zahlFeld("profil.ba_details_top_n", "BA-Beschreibungen nachladen für Top", 0, 200, "0 = aus")}
        ${zahlFeld("profil.benachrichtigung_ab_score", "macOS-Mitteilung ab Score", 0, 100)}
      </div>`)}
  </div>`;
}

function tabScoring() {
  return `<div class="einst-grid">
    <div class="einst-spalte">
      ${abschnitt("Rollen im Titel", "Punkte, wenn der Begriff im Stellentitel steht. Es zählt nur der beste Treffer, damit sich Synonyme wie „SDR“ und „Sales Development“ nicht stapeln.",
        gewichtTabelle("score_regeln.titel_keywords"), effektGross)}
      ${abschnitt("Keywords in der Anzeige", "Punkte für Begriffe in Titel oder Beschreibung. Diese Treffer stapeln sich. Kurze Begriffe wie „KI“ matchen nur als ganzes Wort.",
        gewichtTabelle("score_regeln.text_keywords"), effektGross)}
      ${abschnitt("Abwertung (Malus)", "Stelle bleibt drin, rutscht aber nach unten. Steht der Begriff verneint in der Anzeige („keine Kaltakquise“), wird daraus automatisch ein Bonus.",
        gewichtTabelle("score_regeln.malus_keywords", true), effektGross)}
      ${abschnitt("Abwertung nur im Titel", "Greift nur, wenn der Begriff im Stellentitel steht – z. B. für Rollen über deinem Level.",
        gewichtTabelle("score_regeln.titel_malus_keywords", true))}
      ${abschnitt("Boni für Standort & Frische", "",
        `<div class="zahlen">
          ${zahlFeld("score_regeln.remote_bonus", "Remote-Bonus", 0, 100)}
          ${zahlFeld("score_regeln.lokal_bonus", "Lokal-Bonus", 0, 100)}
          ${zahlFeld("score_regeln.frische_bonus_max", "Frische-Bonus (max.)", 0, 100)}
          ${zahlFeld("score_regeln.frische_tage", "Frische-Zeitraum in Tagen", 1, 90)}
        </div>
        <div class="vorschau-titel">Orte mit Lokal-Bonus</div>
        ${tagEditor("score_regeln.lokale_orte", "Ort hinzufügen – Enter")}`)}
    </div>
    <div class="einst-spalte sticky" id="vorschau-box"></div>
  </div>`;
}

function tabAusschluesse() {
  return `<div class="einst-spalte" style="max-width:920px">
    ${abschnitt("Ausschluss-Begriffe", "Taucht einer dieser Begriffe irgendwo in der Anzeige auf, fliegt die Stelle komplett raus. Teilwörter zählen, z. B. trifft „personaldienstleist“ auch „Personaldienstleister“.",
      tagEditor("score_regeln.blacklist", "Begriff hinzufügen – Enter"), effektGross)}
    ${abschnitt("Gesperrte Firmen", "Stellen dieser Firmen tauchen nicht mehr auf. Es reicht ein Teil des Firmennamens.",
      tagEditor("score_regeln.firmen_blacklist", "Firma hinzufügen – Enter"), effektGross)}
    <div class="hinweis info">${ICON.refresh}<div>„Speichern“ bewertet die vorhandenen Stellen sofort neu. Stellen, die früher ausgeschlossen wurden, kommen erst mit dem nächsten Suchlauf zurück.</div></div>
  </div>`;
}

/* Standard-Katalog + eigene Skills -> {Kategorie: [Skill, …]} */
function skillKatalog() {
  const out = {};
  for (const [k, v] of Object.entries(EINST.katalogStandard || {})) out[k] = Object.keys(v);
  for (const [k, v] of Object.entries(EINST.daten.skill_katalog_eigen || {})) out[k] = [...(out[k] || []), ...Object.keys(v)];
  return out;
}
const istEigenerSkill = (kat, s) => !!EINST.daten.skill_katalog_eigen?.[kat]?.[s];

function skillEditor() {
  const kats = Object.keys(skillKatalog());
  return abschnitt("Skill-Editor", "Neue Skills landen im Katalog des Skill-Radars. Synonyme sind die Begriffe, nach denen in Stellenanzeigen gesucht wird – kurze Begriffe zählen nur als ganzes Wort.",
    `<div class="form-grid skill-neu">
      <label class="feld">Skill<input type="text" id="sk-name" placeholder="z. B. Pipedrive, Verhandlungsführung"></label>
      <label class="feld">Kategorie<input type="text" id="sk-kat" list="sk-kats" placeholder="Bestehende wählen oder neue eintippen"></label>
      <datalist id="sk-kats">${kats.map((k) => `<option value="${esc(k)}">`).join("")}</datalist>
      <label class="feld" style="grid-column:1/-1">Synonyme (Komma-getrennt)<input type="text" id="sk-syn" placeholder="z. B. verhandlung, verhandlungsgeschick, negotiation"></label>
    </div>
    <div class="einst-fuss" style="border:0;padding-top:4px">
      <div class="segment" id="sk-status">
        <button type="button" data-wert="vorhanden" class="an ok">Vorhanden</button>
        <button type="button" data-wert="weiterbildung">Weiterbildung</button>
        <button type="button" data-wert="luecke">Lücke</button>
      </div>
      <button type="button" class="btn btn-primary" id="sk-add">${ICON.plus}Skill hinzufügen</button>
    </div>`, '<span class="effekt info">Speichern nicht vergessen</span>');
}

function skillHinzufuegen() {
  const name = $("#sk-name").value.trim();
  const kat = $("#sk-kat").value.trim() || "Eigene Skills";
  const syn = $("#sk-syn").value.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
  if (!name) { toast("Bitte einen Skill-Namen eintragen", true); return; }
  const alle = Object.values(skillKatalog()).flat().map((x) => x.toLowerCase());
  if (alle.includes(name.toLowerCase())) { toast(`„${name}“ gibt es schon`, true); return; }
  const eigen = EINST.daten.skill_katalog_eigen;
  (eigen[kat] ||= {})[name] = syn.length ? syn : [name.toLowerCase()];
  const status = $("#sk-status .an")?.dataset.wert || "vorhanden";
  if (status !== "luecke") EINST.daten.skill_status[status].push(name);
  einstGeaendert("skill_katalog_eigen");
  toast(`„${name}“ hinzugefügt – jetzt speichern`);
  zeichneTab();
}

function skillEntfernen(kat, name) {
  const eigen = EINST.daten.skill_katalog_eigen;
  delete eigen[kat]?.[name];
  if (eigen[kat] && !Object.keys(eigen[kat]).length) delete eigen[kat];
  const st = EINST.daten.skill_status;
  st.vorhanden = st.vorhanden.filter((s) => s !== name);
  st.weiterbildung = st.weiterbildung.filter((s) => s !== name);
  einstGeaendert("skill_katalog_eigen");
  zeichneTab();
}

function tabSkills() {
  const st = EINST.daten.skill_status;
  const status = (s) => st.vorhanden.includes(s) ? "vorhanden" : st.weiterbildung.includes(s) ? "weiterbildung" : "luecke";
  const katalog = skillKatalog();
  const anzahl = (k) => Object.values(katalog).flat().filter((s) => status(s) === k).length;
  return `<div class="einst-spalte" style="max-width:920px">
    <div class="hinweis info">${ICON.star}<div>Das Skill-Radar vergleicht die Marktnachfrage mit diesem Profil. Alles auf „Lücke“ taucht im Report als Lücke auf.
      Aktuell: <b>${anzahl("vorhanden")}</b> vorhanden · <b>${anzahl("weiterbildung")}</b> in Weiterbildung · <b>${anzahl("luecke")}</b> Lücken.</div></div>
    ${skillEditor()}
    ${Object.entries(katalog).map(([kat, skills]) => abschnitt(esc(kat), "",
      skills.map((s) => {
        const a = status(s);
        const eigen = istEigenerSkill(kat, s);
        return `<div class="skill-zeile"><span>${esc(s)}${eigen ? ` <span class="chip neu">eigen</span>
            <span class="muted small">${esc(EINST.daten.skill_katalog_eigen[kat][s].join(", "))}</span>` : ""}</span>
          <span class="skill-aktionen">${eigen ? `<button type="button" class="icon-btn klein" data-skill-weg="${esc(s)}" data-kat="${esc(kat)}" title="Skill entfernen">${ICON.trash}</button>` : ""}
          <div class="segment" data-skill="${esc(s)}">
            <button type="button" data-wert="vorhanden" class="${a === "vorhanden" ? "an ok" : ""}">Vorhanden</button>
            <button type="button" data-wert="weiterbildung" class="${a === "weiterbildung" ? "an" : ""}">Weiterbildung</button>
            <button type="button" data-wert="luecke" class="${a === "luecke" ? "an bad" : ""}">Lücke</button>
          </div></span></div>`;
      }).join(""))).join("")}
  </div>`;
}

function tabBewerbung() {
  const b = EINST.daten.bewerbung;
  const seg = (pfad, optionen) => `<div class="segment" data-segment="${pfad}">${optionen.map(([w, l]) =>
    `<button type="button" data-wert="${w}" class="${einstGet(pfad) === w ? "an" : ""}">${l}</button>`).join("")}</div>`;
  return `<div class="einst-spalte" style="max-width:920px">
    ${abschnitt("Anschreiben & Lebenslauf", "Diese Vorgaben hängt das Cockpit an jeden Bewerbungs-Workflow, den du hier startest. Erfunden wird weiterhin nichts – das bleibt fest im Workflow.",
      `<div class="schalter-zeile"><div class="zeile-main"><b>Tonfall</b><span class="muted small">Standard: an den Stil der Anzeige anlehnen</span></div>
        ${seg("bewerbung.tonfall", [["anzeige", "Wie die Anzeige"], ["foermlich", "Förmlich"], ["locker", "Locker"]])}</div>
       <div class="schalter-zeile"><div class="zeile-main"><b>Sprache</b><span class="muted small">Bei englischen Anzeigen auf Englisch schreiben?</span></div>
        ${seg("bewerbung.sprache", [["deutsch", "Immer Deutsch"], ["anzeige", "Wie die Anzeige"]])}</div>
       <label class="feld" style="margin-top:10px">Eigene Anweisungen
         <textarea data-text="bewerbung.zusatz" rows="4" placeholder="z. B. Weiterbildung zum Digital Sales Manager immer im ersten Absatz erwähnen. Keine Floskeln wie „hiermit bewerbe ich mich“.">${esc(b.zusatz)}</textarea></label>`)}
    ${abschnitt("Kompletter Workflow", "Gilt für „Kompletten Bewerbungs-Workflow starten“, bei dem Claude dir zuerst eine Kurzliste zeigt.",
      `<div class="zahlen">
        ${zahlFeld("bewerbung.min_score", "Kurzliste ab Score", 0, 100)}
        ${zahlFeld("bewerbung.max_stellen", "Maximal Stellen", 1, 50)}
      </div>`)}
    ${abschnitt("Follow-up", "Nach so vielen Tagen ohne Rückmeldung markiert das Cockpit eine Bewerbung als „Follow-up fällig“. „Ist raus“ setzt das Follow-up-Datum entsprechend.",
      `<div class="zahlen">${zahlFeld("bewerbung.followup_tage", "Follow-up nach Tagen", 1, 90)}</div>`)}
  </div>`;
}

/* ---------- Ereignisse ---------- */
function verdrahte(root) {
  // Tag-Editoren
  $$("[data-tags]", root).forEach((box) => {
    const pfad = box.dataset.tags;
    const input = $("input", box);
    const hinzu = () => {
      const werte = input.value.split(",").map((w) => w.trim()).filter(Boolean);
      if (!werte.length) return;
      const liste = einstGet(pfad);
      werte.forEach((w) => { if (!liste.some((x) => x.toLowerCase() === w.toLowerCase())) liste.push(w); });
      einstGeaendert(pfad);
      zeichneTab();
      $(`[data-tags="${pfad}"] input`)?.focus();
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === ",") { e.preventDefault(); hinzu(); }
      if (e.key === "Backspace" && !input.value && einstGet(pfad).length) {
        einstGet(pfad).pop(); einstGeaendert(pfad); zeichneTab(); $(`[data-tags="${pfad}"] input`)?.focus();
      }
    });
    input.addEventListener("blur", () => { if (input.value.trim()) hinzu(); });
    box.addEventListener("click", (e) => {
      const weg = e.target.closest("[data-tag-weg]");
      if (weg) { einstGet(pfad).splice(+weg.dataset.tagWeg, 1); einstGeaendert(pfad); zeichneTab(); }
      else if (e.target === box) input.focus();
    });
  });

  // Gewichtungstabellen
  $$("[data-gewichte]", root).forEach((box) => {
    const pfad = box.dataset.gewichte;
    const obj = () => einstGet(pfad);
    box.addEventListener("input", (e) => {
      const kw = e.target.dataset.kwPunkte;
      if (kw !== undefined && e.target.value !== "") {
        obj()[kw] = Math.max(-100, Math.min(100, Math.round(+e.target.value)));
        einstGeaendert(pfad);
      }
    });
    box.addEventListener("change", (e) => {
      const alt = e.target.dataset.kwAlt;
      if (alt === undefined) return;
      const neu = e.target.value.trim().toLowerCase();
      if (!neu || neu === alt) { e.target.value = alt; return; }
      if (neu in obj()) { toast(`„${neu}“ gibt es schon`, true); e.target.value = alt; return; }
      const umbenannt = Object.fromEntries(Object.entries(obj()).map(([k, v]) => [k === alt ? neu : k, v]));
      einstSet(pfad, umbenannt);
      zeichneTab();
    });
    box.addEventListener("click", (e) => {
      const weg = e.target.closest("[data-kw-weg]");
      if (weg) { delete obj()[weg.dataset.kwWeg]; einstGeaendert(pfad); zeichneTab(); return; }
      if (e.target.closest("[data-neu-add]")) neuesKeyword(box, pfad);
    });
    $("[data-neu-kw]", box).addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); neuesKeyword(box, pfad); } });
  });

  // Segment-Schalter (Bewerbung) und Skill-Status
  $$("[data-segment]", root).forEach((seg) => seg.addEventListener("click", (e) => {
    const b = e.target.closest("[data-wert]");
    if (!b) return;
    einstSet(seg.dataset.segment, b.dataset.wert);
    $$("button", seg).forEach((x) => x.classList.toggle("an", x === b));
  }));
  $("#sk-add", root)?.addEventListener("click", skillHinzufuegen);
  $$("#sk-name, #sk-syn", root).forEach((i) => i.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); skillHinzufuegen(); } }));
  $("#sk-status", root)?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-wert]");
    if (b) $$("#sk-status button").forEach((x) => x.className = x === b ? "an" + ({ vorhanden: " ok", luecke: " bad" }[b.dataset.wert] || "") : "");
  });
  $$("[data-skill-weg]", root).forEach((b) => b.addEventListener("click", () => {
    if (confirm(`„${b.dataset.skillWeg}“ aus dem Katalog entfernen?`)) skillEntfernen(b.dataset.kat, b.dataset.skillWeg);
  }));
  $$("[data-skill]", root).forEach((seg) => seg.addEventListener("click", (e) => {
    const b = e.target.closest("[data-wert]");
    if (!b) return;
    const skill = seg.dataset.skill;
    const st = EINST.daten.skill_status;
    st.vorhanden = st.vorhanden.filter((s) => s !== skill);
    st.weiterbildung = st.weiterbildung.filter((s) => s !== skill);
    if (b.dataset.wert !== "luecke") st[b.dataset.wert].push(skill);
    einstGeaendert("skill_status");
    zeichneTab();
  }));
}

function neuesKeyword(box, pfad) {
  const kw = $("[data-neu-kw]", box).value.trim().toLowerCase();
  const punkte = Math.max(-100, Math.min(100, Math.round(+$("[data-neu-punkte]", box).value || 0)));
  if (!kw) return;
  if (kw in einstGet(pfad)) { toast(`„${kw}“ gibt es schon`, true); return; }
  einstGet(pfad)[kw] = punkte;
  einstGeaendert(pfad);
  zeichneTab();
  $(`[data-gewichte="${pfad}"] [data-neu-kw]`)?.focus();
}

/* ---------- Live-Vorschau ---------- */
function planeVorschau(ms = 600) {
  clearTimeout(EINST.vorschauTimer);
  EINST.vorschauTimer = setTimeout(holeVorschau, ms);
}

async function holeVorschau() {
  if (EINST.vorschauLaeuft) { planeVorschau(300); return; }
  EINST.vorschauLaeuft = true;
  const box = $("#vorschau-box");
  if (box) box.style.opacity = ".6";
  try {
    EINST.vorschau = await api("/api/einstellungen/vorschau", { score_regeln: EINST.daten.score_regeln });
  } catch (e) {
    toast(e.message, true);
  } finally {
    EINST.vorschauLaeuft = false;
    zeichneVorschau();
  }
}

function deltaChip(alt, neu) {
  const d = neu - alt;
  return d ? `<span class="delta ${d > 0 ? "plus" : "minus"}">${d > 0 ? "+" : ""}${d}</span>` : "";
}

function vorschauZeile(j) {
  return `<div class="zeile" title="${esc(j.gruende.join(" · "))}">
    <div class="score ${scoreKlasse(j.score)}">${j.score}</div>
    <div class="zeile-main"><div class="zeile-titel">${esc(j.titel)}</div>
      <div class="zeile-meta"><span>${esc(j.firma)}</span>${j.neu ? '<span class="chip neu">NEU</span>' : ""}</div></div>
    ${deltaChip(j.alt, j.score)}
  </div>`;
}

function zeichneVorschau() {
  const box = $("#vorschau-box");
  if (!box) return;
  box.style.opacity = "";
  const v = EINST.vorschau;
  if (!v) { box.innerHTML = '<div class="card leer">Berechne Vorschau …</div>'; return; }
  box.innerHTML = `
    <div class="card">
      <div class="abschnitt-kopf"><h2>Deine neuen Top-Treffer</h2></div>
      <p class="abschnitt-text">So sähe deine Liste mit diesen Regeln aus – verglichen mit den gespeicherten Regeln. Noch nichts ist übernommen.</p>
      <div class="vorschau-zahlen">
        <div class="vz"><div class="muted small">Stellen mit Score ≥ 50</div>
          <b>${v.top_nachher}</b> <span class="pfeil">vorher ${v.top_vorher}</span></div>
        <div class="vz"><div class="muted small">Ausgeschlossen</div>
          <b>${v.ausgeschlossen}</b> <span class="pfeil">vorher ${v.ausgeschlossen_vorher}</span></div>
      </div>
      <div class="liste vorschau-liste">${v.top.map(vorschauZeile).join("")}</div>
      ${v.aufsteiger.length ? `<div class="vorschau-titel">Größte Aufsteiger</div><div class="liste vorschau-liste">${v.aufsteiger.map(vorschauZeile).join("")}</div>` : ""}
      ${v.absteiger.length ? `<div class="vorschau-titel">Größte Absteiger</div><div class="liste vorschau-liste">${v.absteiger.map(vorschauZeile).join("")}</div>` : ""}
      <div class="einst-fuss">
        <span class="muted small" style="margin-right:auto">Basis: ${v.gesamt} Stellen aus dem letzten Lauf</span>
        <button class="btn btn-primary" id="vorschau-uebernehmen">Speichern & neu bewerten</button>
      </div>
    </div>`;
  $("#vorschau-uebernehmen").onclick = () => speichereEinstellungen(true);
}

VIEWS.einstellungen = renderEinstellungen;
