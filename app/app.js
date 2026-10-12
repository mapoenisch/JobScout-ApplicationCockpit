/* JobScout Cockpit – Frontend (Vanilla JS, keine Abhängigkeiten) */
"use strict";

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const STATUS_FARBE = {
  vorbereitet: "#8b8fa8", beworben: "#2b7fff", "follow-up": "#d98a00",
  interview: "#8b5cf6", absage: "#e0445a", angebot: "#12a26b",
};
const STATUS_CHIP = {
  vorbereitet: "", beworben: "info", "follow-up": "warn",
  interview: "neu", absage: "bad", angebot: "ok",
};
const ICON = {
  doc: '<svg viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>',
  ext: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  finder: '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  spark: '<svg viewBox="0 0 24 24"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 17l.7 2 .3.3 2 .7-2 .7-.3.3-.7 2-.7-2-.3-.3-2-.7 2-.7.3-.3z"/></svg>',
  send: '<svg viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/></svg>',
  bell: '<svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
  brief: '<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/></svg>',
  pipe: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="11" rx="1.5"/><rect x="17" y="4" width="4" height="7" rx="1.5"/></svg>',
  term: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M13 15h4"/></svg>',
  refresh: '<svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>',
  chat: '<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>',
};

const state = {
  status: null, jobs: [], jobsStand: null, tracker: [], statuswerte: [],
  auswahl: new Map(), offen: new Set(),
  filter: { q: "", min: 40, nurNeu: false, remote: false, quelle: "", ohneTracker: true },
  limit: 60, pollTimer: null,
};

/* ---------- API ---------- */
async function api(pfad, daten) {
  const opt = daten === undefined ? {} : {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-JobScout": "1" },
    body: JSON.stringify(daten),
  };
  const res = await fetch(pfad, opt);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.fehler || `Fehler ${res.status}`);
  return json;
}

function toast(text, fehler = false) {
  const el = document.createElement("div");
  el.className = "toast" + (fehler ? " fehler" : "");
  el.textContent = text;
  $("#toasts").append(el);
  setTimeout(() => el.remove(), fehler ? 6000 : 3500);
}

async function sicher(fn, erfolg) {
  try {
    const r = await fn();
    if (erfolg) toast(erfolg);
    return r;
  } catch (e) {
    toast(e.message, true);
    return null;
  }
}

async function ladeAlles() {
  const [status, jobs, tracker] = await Promise.all([
    api("/api/status"), api("/api/jobs"), api("/api/tracker"),
  ]);
  state.status = status;
  state.jobs = jobs.jobs;
  state.jobsStand = jobs.stand;
  state.tracker = tracker.eintraege;
  state.statuswerte = tracker.statuswerte;
  aktualisiereSidebar();
}

async function ladeTracker() {
  const t = await api("/api/tracker");
  state.tracker = t.eintraege;
  state.status = await api("/api/status");
  aktualisiereSidebar();
}

function aktualisiereSidebar() {
  const s = state.status;
  $("#badge-neu").textContent = s.jobs_neu_top || "";
  $("#badge-faellig").textContent = s.faellig.length || "";
  const scout = s.tasks.scout;
  const dot = $("#lauf-dot");
  dot.className = "dot " + (scout.status === "läuft" ? "run" : "ok");
  $("#lauf-text").textContent = scout.status === "läuft"
    ? "Suche läuft …" : `Letzter Lauf: ${fmtDatum(s.letzter_lauf)}`;
}

/* ---------- Hilfen ---------- */
function fmtDatum(s) {
  if (!s) return "–";
  const [d, t] = String(s).split(" ");
  const [y, m, tag] = d.split("-");
  return esc(tag ? `${tag}.${m}.${y}${t ? " " + t : ""}` : s);
}
function tageSeit(iso) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso + "T00:00:00")) / 864e5);
}
const safeUrl = (u) => /^https?:\/\//i.test(u || "") ? esc(u) : "#";
function scoreKlasse(n) { return n >= 70 ? "hoch" : n >= 50 ? "mittel" : "niedrig"; }
function chipStatus(s) { return `<span class="chip ${STATUS_CHIP[s] ?? ""}">${esc(s)}</span>`; }

function setHeader(titel, sub, aktionen = "") {
  $("#view-title").textContent = titel;
  $("#view-sub").textContent = sub;
  $("#topbar-actions").innerHTML = aktionen;
}

/* ---------- Router ---------- */
const VIEWS = {
  dashboard: renderDashboard, stellen: renderStellen, pipeline: renderPipeline,
  dokumente: renderDokumente, interview: renderInterview, skills: renderSkills,
  automationen: renderAutomationen,
};

function route() {
  const name = (location.hash || "#dashboard").slice(1).split("?")[0];
  const view = VIEWS[name] ? name : "dashboard";
  $$("#nav a").forEach((a) => a.classList.toggle("active", a.dataset.view === view));
  $("#sidebar").classList.remove("offen");
  VIEWS[view]();
  window.scrollTo(0, 0);
}

/* ================================================================
   DASHBOARD
   ================================================================ */
function renderDashboard() {
  const s = state.status;
  const stunde = new Date().getHours();
  const gruss = stunde < 11 ? "Guten Morgen" : stunde < 18 ? "Hallo" : "Guten Abend";
  setHeader(s.vorname ? `${gruss}, ${s.vorname}` : gruss, `Stellen-Stand: ${fmtDatum(s.letzter_lauf)} · ${s.jobs_gesamt} Stellen bewertet`);

  const top = state.jobs.filter((j) => j.neu && !j.im_tracker)
    .sort((a, b) => b.score - a.score).slice(0, 6);
  const aktiv = state.tracker.filter((r) => !["absage", "angebot"].includes(r.Status));
  const summe = Object.values(s.pipeline).reduce((a, b) => a + b, 0) || 1;

  $("#view").innerHTML = `
    ${s.faellig.length ? `
      <div class="hinweis">${ICON.bell}
        <div><b>Follow-up fällig:</b> ${s.faellig.map((r) => esc(r.Firma)).join(", ")}
        – Bewerbung liegt mehr als ${12} Tage zurück, noch keine Rückmeldung.</div>
        <a class="btn btn-sm" href="#pipeline" style="margin-left:auto">Zur Pipeline</a>
      </div>` : ""}

    <div class="card hero">
      <div>
        <h2>${s.jobs_neu_top} neue Top-Stellen warten auf dich</h2>
        <p>Wähle Stellen aus – Claude recherchiert die Firma und erstellt Lebenslauf und Anschreiben.</p>
      </div>
      <div class="hero-actions">
        <a class="btn" href="#stellen">${ICON.brief}Stellen durchsehen</a>
        <button class="btn btn-ghost-light" data-task="scout">${ICON.refresh}Neu suchen</button>
      </div>
    </div>

    <div class="kpis">
      ${kpi(ICON.brief, "", s.jobs_neu, "Neue Stellen seit letztem Lauf")}
      ${kpi(ICON.star, "ok", s.jobs_top, "Stellen mit Score ≥ 50")}
      ${kpi(ICON.pipe, "info", aktiv.length, "Laufende Bewerbungen")}
      ${kpi(ICON.chat, "warn", s.pipeline.interview || 0, "Interviews")}
    </div>

    <div class="grid grid-2">
      <div class="card">
        <div class="card-head"><h2>Beste neue Stellen</h2><span class="spacer"></span>
          <a href="#stellen" class="small">Alle ansehen →</a></div>
        <div class="liste">
          ${top.length ? top.map(jobZeileKompakt).join("") :
            `<div class="leer">Keine neuen Stellen. Starte eine neue Suche.</div>`}
        </div>
      </div>
      <div class="grid" style="align-content:start">
        <div class="card">
          <div class="card-head"><h2>Bewerbungs-Pipeline</h2><span class="spacer"></span>
            <a href="#pipeline" class="small">Öffnen →</a></div>
          <div class="balken">${state.statuswerte.map((st) =>
            `<span style="width:${(s.pipeline[st] / summe) * 100}%;background:${STATUS_FARBE[st]}"></span>`).join("")}</div>
          <div class="legende">${state.statuswerte.map((st) =>
            `<div><i style="background:${STATUS_FARBE[st]}"></i>${esc(st)}<b>${s.pipeline[st]}</b></div>`).join("")}</div>
        </div>
        <div class="card">
          <div class="card-head"><h2>Schnellstart</h2></div>
          <div class="grid" style="gap:8px">
            <button class="btn" data-workflow="bewerbung_komplett">${ICON.term}Kompletten Bewerbungs-Workflow starten</button>
            <a class="btn" href="#interview">${ICON.chat}Interview vorbereiten</a>
            <a class="btn" href="#skills">${ICON.star}Skill-Lücken prüfen</a>
          </div>
        </div>
      </div>
    </div>`;
}

function kpi(icon, klasse, zahl, label) {
  return `<div class="card kpi"><div class="kpi-icon ${klasse}">${icon}</div>
    <div><div class="kpi-zahl">${zahl}</div><div class="kpi-label">${esc(label)}</div></div></div>`;
}

function jobZeileKompakt(j) {
  return `<div class="zeile">
    <div class="score ${scoreKlasse(j.score)}">${j.score}</div>
    <div class="zeile-main">
      <div class="zeile-titel">${esc(j.titel)}</div>
      <div class="zeile-meta"><span>${esc(j.firma)}</span><span>${esc(j.ort)}</span>
        ${j.remote ? '<span class="chip info">Remote</span>' : ""}</div>
    </div>
    <button class="btn btn-sm btn-soft" data-merken="${j.id}">${state.auswahl.has(j.id) ? "✓ Ausgewählt" : "Auswählen"}</button>
  </div>`;
}

/* ================================================================
   STELLEN
   ================================================================ */
function gefilterteJobs() {
  const f = state.filter;
  const q = f.q.toLowerCase().trim();
  return state.jobs.filter((j) =>
    j.score >= f.min &&
    (!f.nurNeu || j.neu) &&
    (!f.remote || j.remote) &&
    (!f.quelle || j.quelle === f.quelle) &&
    (!f.ohneTracker || !j.im_tracker) &&
    (!q || `${j.titel} ${j.firma} ${j.ort}`.toLowerCase().includes(q))
  ).sort((a, b) => (b.neu - a.neu) || (b.score - a.score));
}

function renderStellen() {
  const quellen = [...new Set(state.jobs.map((j) => j.quelle))].filter(Boolean).sort();
  setHeader("Stellen", `Aus jobs_ranked.csv · Stand ${fmtDatum(state.jobsStand)}`,
    `<a class="btn" href="/report/jobs" target="_blank">${ICON.ext}HTML-Report</a>
     <button class="btn btn-primary" data-task="scout">${ICON.refresh}Neue Suche starten</button>`);
  const f = state.filter;
  $("#view").innerHTML = `
    <div class="card">
      <div class="filterbar">
        <input type="search" id="f-q" placeholder="Titel, Firma oder Ort suchen …" value="${esc(f.q)}">
        <label class="range">Score ≥ <input type="range" id="f-min" min="0" max="100" step="5" value="${f.min}"><b id="f-min-w">${f.min}</b></label>
        <select id="f-quelle"><option value="">Alle Quellen</option>${quellen.map((q) =>
          `<option ${q === f.quelle ? "selected" : ""}>${esc(q)}</option>`).join("")}</select>
        <label class="toggle"><input type="checkbox" id="f-neu" ${f.nurNeu ? "checked" : ""}>Nur neue</label>
        <label class="toggle"><input type="checkbox" id="f-remote" ${f.remote ? "checked" : ""}>Remote</label>
        <label class="toggle"><input type="checkbox" id="f-tracker" ${f.ohneTracker ? "checked" : ""}>Firmen im Tracker ausblenden</label>
      </div>
      <div id="job-liste"></div>
    </div>
    <div id="auswahl-bar"></div>`;

  const neu = () => { state.limit = 60; zeichneJobs(); };
  $("#f-q").addEventListener("input", (e) => { f.q = e.target.value; neu(); });
  $("#f-min").addEventListener("input", (e) => { f.min = +e.target.value; $("#f-min-w").textContent = f.min; neu(); });
  $("#f-quelle").addEventListener("change", (e) => { f.quelle = e.target.value; neu(); });
  $("#f-neu").addEventListener("change", (e) => { f.nurNeu = e.target.checked; neu(); });
  $("#f-remote").addEventListener("change", (e) => { f.remote = e.target.checked; neu(); });
  $("#f-tracker").addEventListener("change", (e) => { f.ohneTracker = e.target.checked; neu(); });
  zeichneJobs();
}

function zeichneJobs() {
  const jobs = gefilterteJobs();
  const sichtbar = jobs.slice(0, state.limit);
  $("#job-liste").innerHTML = `
    <div class="muted small" style="margin-bottom:10px">${jobs.length} Treffer</div>
    <div class="liste">${sichtbar.length ? sichtbar.map(jobZeile).join("") :
      '<div class="leer">Keine Stellen für diese Filter.</div>'}</div>
    ${jobs.length > state.limit ? `<div class="mehr"><button class="btn" id="mehr">Weitere ${Math.min(60, jobs.length - state.limit)} laden</button></div>` : ""}`;
  $("#mehr")?.addEventListener("click", () => { state.limit += 60; zeichneJobs(); });
  zeichneAuswahl();
}

function jobZeile(j) {
  const gewaehlt = state.auswahl.has(j.id);
  return `<div class="zeile job ${gewaehlt ? "gewaehlt" : ""} ${state.offen.has(j.id) ? "offen" : ""}" data-job="${j.id}">
    <input type="checkbox" data-merken="${j.id}" ${gewaehlt ? "checked" : ""} aria-label="Stelle auswählen">
    <div class="score ${scoreKlasse(j.score)}">${j.score}</div>
    <div class="zeile-main">
      <div class="zeile-titel">${esc(j.titel)}</div>
      <div class="zeile-meta">
        <span>${esc(j.firma)}</span><span>${esc(j.ort)}</span>
        ${j.neu ? '<span class="chip neu">NEU</span>' : ""}
        ${j.remote ? '<span class="chip info">Remote</span>' : ""}
        ${j.im_tracker ? '<span class="chip warn">schon im Tracker</span>' : ""}
        <span class="chip">${esc(j.quelle)}</span>
        ${j.datum ? `<span>${fmtDatum(j.datum)}</span>` : ""}
      </div>
      <ul class="gruende">${j.gruende.map((g) =>
        `<li class="${/\(\+/.test(g) ? "plus" : /\(-/.test(g) ? "minus" : ""}">${esc(g)}</li>`).join("")}</ul>
    </div>
    <button class="btn btn-sm" data-gruende="${j.id}">Warum?</button>
    <a class="btn btn-sm" href="${safeUrl(j.link)}" target="_blank" rel="noopener">${ICON.ext}Anzeige</a>
  </div>`;
}

function zeichneAuswahl() {
  const bar = $("#auswahl-bar");
  if (!bar) return;
  const n = state.auswahl.size;
  bar.innerHTML = n ? `<div class="auswahl-bar">
      <b>${n} Stelle${n > 1 ? "n" : ""} ausgewählt</b>
      <span class="small" style="opacity:.7">${[...state.auswahl.values()].map((j) => esc(j.firma)).join(" · ")}</span>
      <button class="btn btn-sm" id="auswahl-leeren" style="background:transparent;color:inherit">Leeren</button>
      <button class="btn btn-primary" id="bewerbung-starten">${ICON.spark}Unterlagen mit Claude erstellen</button>
    </div>` : "";
  $("#auswahl-leeren")?.addEventListener("click", () => { state.auswahl.clear(); zeichneJobs(); });
  $("#bewerbung-starten")?.addEventListener("click", bewerbungStarten);
}

function toggleAuswahl(id) {
  const j = state.jobs.find((x) => x.id === id);
  if (!j) return;
  if (state.auswahl.has(id)) state.auswahl.delete(id); else state.auswahl.set(id, j);
}

function bewerbungStarten() {
  const stellen = [...state.auswahl.values()];
  dialog(`
    <div class="dialog-body">
      <h2>Bewerbungsunterlagen erstellen</h2>
      <p class="muted" style="margin:0">Claude Code öffnet sich im Terminal und arbeitet für diese Stellen den Bewerbungs-Workflow ab:
      Anzeige lesen, Firmen-Homepage recherchieren, Lebenslauf + Anschreiben als Word-Datei in <code>bewerbungen/</code> anlegen und den Tracker ergänzen.</p>
      <div class="liste">${stellen.map((j) => `<div class="zeile"><div class="score ${scoreKlasse(j.score)}">${j.score}</div>
        <div class="zeile-main"><div class="zeile-titel">${esc(j.titel)}</div><div class="zeile-meta">${esc(j.firma)} · ${esc(j.ort)}</div></div></div>`).join("")}</div>
    </div>
    <div class="dialog-foot"><button class="btn" data-schliessen>Abbrechen</button>
      <button class="btn btn-primary" id="go">${ICON.term}Im Terminal starten</button></div>`, (d) => {
    $("#go", d).addEventListener("click", async () => {
      const r = await sicher(() => api("/api/claude/bewerbung", { stellen }),
        "Claude Code wurde im Terminal gestartet");
      if (r) { d.close(); state.auswahl.clear(); zeichneJobs(); }
    });
  });
}

/* ================================================================
   PIPELINE (Kanban)
   ================================================================ */
function renderPipeline() {
  setHeader("Bewerbungs-Pipeline", `bewerbungen_tracker.csv · ${state.tracker.length} Einträge · Karten per Drag & Drop verschieben`,
    `<button class="btn btn-primary" id="neu-eintrag">${ICON.plus}Bewerbung hinzufügen</button>`);
  const faellig = state.tracker.filter((r) => r.faellig);
  $("#view").innerHTML = `
    ${faellig.length ? `<div class="hinweis">${ICON.bell}<div><b>Follow-up fällig bei ${faellig.length} Bewerbung${faellig.length > 1 ? "en" : ""}.</b>
      Hak nach – oder verschiebe die Karte nach „follow-up“.</div></div>` : ""}
    <div class="kanban">${state.statuswerte.map((st) => {
      const karten = state.tracker.filter((r) => r.Status === st);
      return `<div class="spalte" data-status="${st}">
        <div class="spalte-kopf"><span class="farbe" style="background:${STATUS_FARBE[st]}"></span>${esc(st)}<span class="zahl">${karten.length}</span></div>
        ${karten.map(karte).join("") || '<div class="muted small" style="padding:8px 2px">Leer</div>'}
      </div>`;
    }).join("")}</div>`;

  $("#neu-eintrag").addEventListener("click", () => eintragDialog());
  $$(".karte").forEach((k) => {
    k.addEventListener("dragstart", (e) => e.dataTransfer.setData("text/plain", k.dataset.id));
  });
  $$(".spalte").forEach((sp) => {
    sp.addEventListener("dragover", (e) => { e.preventDefault(); sp.classList.add("drop"); });
    sp.addEventListener("dragleave", () => sp.classList.remove("drop"));
    sp.addEventListener("drop", async (e) => {
      e.preventDefault(); sp.classList.remove("drop");
      const id = +e.dataTransfer.getData("text/plain");
      const r = state.tracker.find((x) => x.id === id);
      if (!r || r.Status === sp.dataset.status) return;
      await trackerUpdate({ aktion: "update", id, Status: sp.dataset.status }, `${r.Firma} → ${sp.dataset.status}`);
    });
  });
}

function karte(r) {
  const tage = tageSeit(r["Beworben am"]);
  return `<div class="karte ${r.faellig ? "faellig" : ""}" draggable="true" data-id="${r.id}">
    <div class="karte-firma">${esc(r.Firma)}</div>
    <div class="karte-pos">${esc(r.Position)}</div>
    <div class="karte-daten">
      <span>Erstellt: ${fmtDatum(r["Erstellt am"])}</span>
      ${r["Beworben am"] ? `<span>Beworben: ${fmtDatum(r["Beworben am"])} (vor ${tage} T.)</span>` : ""}
      ${r["Follow-up am"] ? `<span>Follow-up: ${fmtDatum(r["Follow-up am"])}</span>` : ""}
      ${r.faellig ? '<span class="chip warn" style="justify-self:start;margin-top:4px">Follow-up fällig</span>' : ""}
      ${r.Notizen ? `<span style="margin-top:4px">📝 ${esc(r.Notizen)}</span>` : ""}
    </div>
    <div class="karte-aktionen">
      ${r.Status === "vorbereitet" ? `<button class="btn btn-sm btn-primary" data-raus="${r.id}">${ICON.send}Ist raus</button>` : ""}
      ${r.dokumente.length ? `<button class="btn btn-sm" data-docs="${r.id}">${ICON.doc}${r.dokumente.length}</button>` : ""}
      ${r.Link ? `<a class="btn btn-sm" href="${safeUrl(r.Link)}" target="_blank" rel="noopener" title="Anzeige">${ICON.ext}</a>` : ""}
      <button class="btn btn-sm" data-bearbeiten="${r.id}">Bearbeiten</button>
    </div>
  </div>`;
}

async function trackerUpdate(daten, meldung) {
  const r = await sicher(() => api("/api/tracker", daten), meldung);
  if (r) { await ladeTracker(); route(); }
  return r;
}

function eintragDialog(r) {
  const neu = !r;
  r = r || { Firma: "", Position: "", Link: "", Status: "vorbereitet", Notizen: "", Ergebnis: "", "Beworben am": "", "Follow-up am": "" };
  dialog(`
    <form class="dialog-body" id="eintrag-form">
      <h2>${neu ? "Bewerbung hinzufügen" : esc(r.Firma)}</h2>
      <div class="form-grid">
        <label class="feld">Firma<input name="Firma" required value="${esc(r.Firma)}"></label>
        <label class="feld">Position<input name="Position" value="${esc(r.Position)}"></label>
        <label class="feld voll">Link zur Anzeige<input name="Link" type="url" value="${esc(r.Link)}"></label>
        <label class="feld">Status<select name="Status">${state.statuswerte.map((s) =>
          `<option ${s === r.Status ? "selected" : ""}>${s}</option>`).join("")}</select></label>
        ${neu ? "" : `
        <label class="feld">Ergebnis<input name="Ergebnis" value="${esc(r.Ergebnis)}" placeholder="z. B. Absage per Mail"></label>
        <label class="feld">Beworben am<input name="Beworben am" type="date" value="${esc(r["Beworben am"])}"></label>
        <label class="feld">Follow-up am<input name="Follow-up am" type="date" value="${esc(r["Follow-up am"])}"></label>`}
        <label class="feld voll">Notizen<textarea name="Notizen">${esc(r.Notizen)}</textarea></label>
      </div>
    </form>
    <div class="dialog-foot">
      ${neu ? "" : `<button class="btn btn-danger" id="loeschen" style="margin-right:auto">${ICON.trash}Löschen</button>`}
      <button class="btn" data-schliessen>Abbrechen</button>
      <button class="btn btn-primary" id="speichern">Speichern</button>
    </div>`, (d) => {
    $("#speichern", d).addEventListener("click", async () => {
      const form = $("#eintrag-form", d);
      if (!form.reportValidity()) return;
      const daten = Object.fromEntries(new FormData(form));
      const ok = await trackerUpdate(neu ? { aktion: "neu", ...daten } : { aktion: "update", id: r.id, ...daten },
        neu ? "Bewerbung angelegt" : "Gespeichert");
      if (ok) d.close();
    });
    $("#loeschen", d)?.addEventListener("click", async () => {
      if (!confirm(`Eintrag „${r.Firma}“ wirklich aus dem Tracker löschen? Die Dokumente bleiben erhalten.`)) return;
      const ok = await trackerUpdate({ aktion: "loeschen", id: r.id }, "Eintrag gelöscht");
      if (ok) d.close();
    });
  });
}

function dokumenteDialog(r) {
  dialog(`<div class="dialog-body"><h2>Unterlagen – ${esc(r.Firma)}</h2>
    <div>${r.dokumente.map(docZeile).join("")}</div></div>
    <div class="dialog-foot"><button class="btn" data-schliessen>Schließen</button></div>`);
}

/* ================================================================
   UNTERLAGEN
   ================================================================ */
async function renderDokumente() {
  setHeader("Unterlagen", "Lebensläufe, Anschreiben und Interview-Briefings aus dem Ordner bewerbungen/");
  $("#view").innerHTML = '<div class="leer">Lade …</div>';
  const d = await sicher(() => api("/api/dokumente"));
  if (!d) return;
  const firmen = Object.keys(d.gruppen).sort((a, b) => a.localeCompare(b, "de"));
  $("#view").innerHTML = `
    <div class="card" style="margin-bottom:18px">
      <div class="card-head"><h2>Stammdaten</h2><span class="spacer"></span>
        <span class="muted small">Grundlage für jede neue Bewerbung</span></div>
      <div class="doc-grid">${d.stamm.map(docZeile).join("")}</div>
    </div>
    <div class="doc-grid">
      ${firmen.length ? firmen.map((f) => {
        const t = state.tracker.find((r) => r.Firma.toLowerCase().replace(/\s/g, "") === f.toLowerCase().replace(/\s/g, ""));
        return `<div class="card"><div class="card-head"><h2>${esc(f)}</h2><span class="spacer"></span>${t ? chipStatus(t.Status) : ""}</div>
          ${d.gruppen[f].map(docZeile).join("")}</div>`;
      }).join("") : '<div class="card leer">Noch keine Unterlagen erstellt.</div>'}
    </div>`;
}

function docZeile(doc) {
  const pdf = doc.name.toLowerCase().endsWith(".pdf");
  const brief = doc.name.startsWith("Interview");
  return `<div class="doc">
    <div class="doc-icon ${pdf ? "pdf" : brief ? "brief" : ""}">${ICON.doc}</div>
    <div class="zeile-main"><div class="doc-name" title="${esc(doc.name)}">${esc(doc.name)}</div>
      <div class="muted small">${fmtDatum(doc.geaendert)} · ${Math.round(doc.groesse / 1024)} KB</div></div>
    <button class="btn btn-sm" data-oeffnen="${esc(doc.pfad)}">Öffnen</button>
    <button class="icon-btn" style="width:30px;height:30px" title="Im Finder zeigen" data-finder="${esc(doc.pfad)}">${ICON.finder}</button>
  </div>`;
}

/* ================================================================
   INTERVIEW-PREP
   ================================================================ */
async function renderInterview() {
  setHeader("Interview-Prep", "Firmenrecherche, 10 wahrscheinliche Fragen mit Antwortgerüst, Rückfragen und Checkliste");
  const kandidaten = state.tracker.filter((r) => !["absage"].includes(r.Status));
  const d = await sicher(() => api("/api/dokumente")) || { gruppen: {} };
  const briefings = Object.values(d.gruppen).flat().filter((x) => x.name.startsWith("Interview_Briefing"));
  $("#view").innerHTML = `
    <div class="grid grid-2">
      <div class="card">
        <div class="card-head"><h2>Einladung erhalten? Vorbereitung starten</h2></div>
        <form id="iv-form" class="form-grid">
          <label class="feld voll">Aus dem Tracker übernehmen
            <select id="iv-vorlage"><option value="">– manuell eingeben –</option>
              ${kandidaten.map((r) => `<option value="${r.id}">${esc(r.Firma)} – ${esc(r.Position)}</option>`).join("")}
            </select></label>
          <label class="feld">Firma<input name="firma" required></label>
          <label class="feld">Position<input name="position" required></label>
          <label class="feld">Gesprächsdatum<input name="datum" required placeholder="z. B. 14.10.2026, 10:00 Uhr"></label>
          <label class="feld">Gesprächspartner<input name="name" placeholder="leer = unbekannt"></label>
        </form>
        <div style="display:flex;gap:10px;margin-top:16px;align-items:center">
          <span class="muted small">Ergebnis: <code>Interview_Briefing_[Firma].docx</code>, Tracker-Status → interview</span>
          <button class="btn btn-primary" id="iv-start" style="margin-left:auto">${ICON.term}Mit Claude vorbereiten</button>
        </div>
      </div>
      <div class="card">
        <div class="card-head"><h2>Vorhandene Briefings</h2></div>
        ${briefings.length ? briefings.map(docZeile).join("") : '<div class="leer">Noch keine Interview-Briefings.</div>'}
        <div class="card-head" style="margin:18px 0 8px"><h2>Was im Briefing steckt</h2></div>
        <ol class="schritte">
          <li>Firmenprofil auf einer Seite (mit Quellen)</li>
          <li>10 Fragen inkl. Quereinsteiger-, Kaltakquise- und Rollenspielfrage</li>
          <li>Antwortgerüste nach STAR – nur aus deinem Lebenslauf</li>
          <li>5 starke Rückfragen an die Firma</li>
          <li>Organisatorische Checkliste</li>
        </ol>
      </div>
    </div>`;
  const form = $("#iv-form");
  $("#iv-vorlage").addEventListener("change", (e) => {
    const r = state.tracker.find((x) => x.id === +e.target.value);
    form.firma.value = r ? r.Firma : "";
    form.position.value = r ? r.Position : "";
  });
  $("#iv-start").addEventListener("click", async () => {
    if (!form.reportValidity()) return;
    await sicher(() => api("/api/claude/interview", Object.fromEntries(new FormData(form))),
      "Interview-Prep läuft im Terminal");
  });
}

/* ================================================================
   SKILL-RADAR
   ================================================================ */
async function renderSkills() {
  const s = state.status;
  setHeader("Skill-Radar", s.skill_report ? `Letzte Auswertung: ${fmtDatum(s.skill_report)}` : "Noch keine Auswertung vorhanden",
    `<button class="btn" data-task="radar">${ICON.refresh}Radar neu berechnen</button>
     <button class="btn btn-primary" data-workflow="skill_gap">${ICON.spark}Kurse mit Claude suchen</button>`);
  const d = await sicher(() => api("/api/dokumente")) || { kurse: [] };
  $("#view").innerHTML = `
    <div class="hinweis info">${ICON.star}<div>Das Radar zählt, wie oft der Markt welche Skills fordert, und gleicht das mit deinem Profil ab.
      „Kurse mit Claude suchen“ recherchiert für die Top-3-Lücken passende (möglichst kostenlose) Zertifikate.</div></div>
    ${d.kurse.length ? `<div class="card" style="margin-bottom:18px">
      <div class="card-head"><h2>Kurs-Empfehlungen</h2><span class="spacer"></span>
        <select id="kurs-wahl">${d.kurse.map((k, i) => `<option value="${i}">${esc(k.name)}</option>`).join("")}</select></div>
      <div class="md" id="kurs-inhalt"></div></div>` : ""}
    ${s.skill_report ? '<iframe class="report-frame" src="/report/skills" title="Skill-Report"></iframe>' :
      '<div class="card leer">Noch kein skill_report.html – klick auf „Radar neu berechnen“.</div>'}`;
  if (d.kurse.length) {
    const zeige = (i) => { $("#kurs-inhalt").innerHTML = markdown(d.kurse[i].inhalt); };
    $("#kurs-wahl").addEventListener("change", (e) => zeige(+e.target.value));
    zeige(0);
  }
}

/* Minimaler Markdown-Renderer für die Kurs-Notizen (Text wird vorher escaped) */
function markdown(md) {
  const zeilen = esc(md).split("\n");
  let html = "", inListe = false, inTabelle = false;
  const inline = (t) => t
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/\*(.+?)\*/g, "<i>$1</i>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\[(.+?)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  const schliessen = () => {
    if (inListe) { html += "</ul>"; inListe = false; }
    if (inTabelle) { html += "</table>"; inTabelle = false; }
  };
  for (const z of zeilen) {
    const h = z.match(/^(#{1,3})\s+(.*)/);
    if (h) { schliessen(); html += `<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`; continue; }
    if (/^\s*[-*]\s+/.test(z)) {
      if (!inListe) { schliessen(); html += "<ul>"; inListe = true; }
      html += `<li>${inline(z.replace(/^\s*[-*]\s+/, ""))}</li>`; continue;
    }
    if (/^\s*\|/.test(z)) {
      if (/^\s*\|[\s:|-]+\|\s*$/.test(z)) continue;
      if (!inTabelle) { schliessen(); html += "<table>"; inTabelle = true; }
      html += "<tr>" + z.trim().replace(/^\||\|$/g, "").split("|").map((c) => `<td>${inline(c.trim())}</td>`).join("") + "</tr>";
      continue;
    }
    schliessen();
    if (z.trim()) html += `<p>${inline(z)}</p>`;
  }
  schliessen();
  return html;
}

/* ================================================================
   AUTOMATISIERUNGEN
   ================================================================ */
function renderAutomationen() {
  const t = state.status.tasks;
  setHeader("Automatisierungen", "Alle Bausteine des Bewerbungsprozesses – direkt hier startbar");
  $("#view").innerHTML = `
    <div class="auto-grid">
      ${autoKarte(ICON.refresh, "", "Job-Scraping", "job_scout.py",
        "Holt Stellen von Arbeitsagentur, Adzuna, Arbeitnow und Himalayas, bewertet sie mit der Scoring-Engine und erkennt neue Treffer.",
        `<button class="btn btn-primary" data-task="scout">${ICON.refresh}Jetzt starten</button>
         <a class="btn" href="/report/jobs" target="_blank">${ICON.ext}Report</a>`, "scout", t.scout)}
      ${autoKarte(ICON.spark, "ok", "Bewerbungs-Workflow", "Claude Code · prompt_bewerbungs_workflow.txt",
        "Follow-ups prüfen, Top-Stellen zeigen, Firma recherchieren, Lebenslauf + Anschreiben erstellen, Tracker ergänzen. Tipp: Stellen vorher unter „Stellen“ auswählen.",
        `<a class="btn btn-primary" href="#stellen">${ICON.brief}Stellen auswählen</a>
         <button class="btn" data-workflow="bewerbung_komplett">${ICON.term}Kompletter Ablauf</button>`)}
      ${autoKarte(ICON.chat, "warn", "Interview-Prep", "Claude Code · prompt_interview_prep_template.txt",
        "Briefing-Dokument mit Firmenprofil, 10 Fragen, STAR-Antwortgerüsten, Rückfragen und Checkliste.",
        `<a class="btn btn-primary" href="#interview">${ICON.chat}Formular öffnen</a>`)}
      ${autoKarte(ICON.star, "info", "Skill-Radar", "skill_radar.py",
        "Misst die Marktnachfrage je Skill über alle gesammelten Stellen und zeigt Lücken samt Trend.",
        `<button class="btn btn-primary" data-task="radar">${ICON.refresh}Neu berechnen</button>
         <a class="btn" href="#skills">Ansehen</a>`, "radar", t.radar)}
      ${autoKarte(ICON.brief, "", "Skill-Gap + Kurssuche", "Claude Code · prompt_skill_gap_analyse.txt",
        "Startet das Radar, recherchiert passende Kurse für die Top-3-Lücken und schreibt kurs_empfehlungen_[Monat].md.",
        `<button class="btn btn-primary" data-workflow="skill_gap">${ICON.term}Im Terminal starten</button>`)}
      ${autoKarte(ICON.bell, "warn", "Follow-up-Erinnerung", "bewerbungen_tracker.csv",
        "Bewerbungen ohne Rückmeldung nach 12 Tagen werden im Dashboard und in der Pipeline markiert. „Ist raus“ setzt Datum und Follow-up automatisch.",
        `<a class="btn btn-primary" href="#pipeline">${ICON.pipe}Zur Pipeline</a>`)}
    </div>
    <p class="muted small" style="margin-top:18px">Claude-Workflows öffnen sich in einem neuen Terminal-Fenster, damit du Rückfragen beantworten und Tool-Freigaben bestätigen kannst.
    Die zeitgesteuerten LaunchAgents sind derzeit stillgelegt (siehe <code>launchagents-archiv/</code>).</p>`;
}

function autoKarte(icon, klasse, titel, technik, text, buttons, taskName, task) {
  return `<div class="card auto">
    <div class="auto-kopf"><div class="kpi-icon ${klasse}">${icon}</div>
      <div><h2>${titel}</h2><div class="muted small">${esc(technik)}</div></div>
      ${task ? `<span class="chip ${task.status === "läuft" ? "warn" : task.status.startsWith("fehler") ? "bad" : "ok"}" style="margin-left:auto" data-task-status="${taskName}">${esc(task.status)}</span>` : ""}
    </div>
    <p>${text}</p>
    ${task ? `<details><summary class="small muted" style="cursor:pointer">Log anzeigen</summary><pre class="log" data-task-log="${taskName}">${esc(task.log || "– noch kein Log –")}</pre></details>` : ""}
    <div class="btn-reihe">${buttons}</div>
  </div>`;
}

/* ---------- Hintergrund-Aufgaben ---------- */
async function starteTask(name) {
  const r = await sicher(() => api("/api/task", { name }),
    name === "scout" ? "Stellensuche gestartet – dauert ein paar Minuten" : "Skill-Radar gestartet");
  if (r) beobachteTask(name);
}

function beobachteTask(name) {
  clearInterval(state.pollTimer);
  state.pollTimer = setInterval(async () => {
    const info = await api(`/api/task?name=${name}`).catch(() => null);
    if (!info) return;
    const chip = $(`[data-task-status="${name}"]`);
    if (chip) chip.textContent = info.status;
    const log = $(`[data-task-log="${name}"]`);
    if (log) { log.textContent = info.log; log.scrollTop = log.scrollHeight; }
    if (name === "scout") {
      $("#lauf-dot").className = "dot " + (info.status === "läuft" ? "run" : "ok");
      if (info.status === "läuft") $("#lauf-text").textContent = "Suche läuft …";
    }
    if (info.status !== "läuft") {
      clearInterval(state.pollTimer);
      if (info.status === "fertig") {
        toast(name === "scout" ? "Stellensuche fertig – Liste aktualisiert" : "Skill-Radar aktualisiert");
        await ladeAlles();
        route();
      } else {
        toast(`${name === "scout" ? "Stellensuche" : "Skill-Radar"}: ${info.status}`, true);
      }
    }
  }, 2500);
}

/* ---------- Dialog ---------- */
function dialog(html, init) {
  const d = $("#dialog");
  d.innerHTML = html;
  $$("[data-schliessen]", d).forEach((b) => b.addEventListener("click", () => d.close()));
  init?.(d);
  d.showModal();
}

/* ---------- Globale Klicks ---------- */
document.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-merken],[data-gruende],[data-task],[data-workflow],[data-oeffnen],[data-finder],[data-raus],[data-bearbeiten],[data-docs]");
  if (!el) return;
  const ds = el.dataset;
  if (ds.merken !== undefined) {
    toggleAuswahl(+ds.merken);
    if ($("#job-liste")) zeichneJobs(); else route();
  } else if (ds.gruende !== undefined) {
    const id = +ds.gruende;
    state.offen.has(id) ? state.offen.delete(id) : state.offen.add(id);
    el.closest(".job").classList.toggle("offen");
  } else if (ds.task) {
    starteTask(ds.task);
  } else if (ds.workflow) {
    await sicher(() => api("/api/claude/workflow", { name: ds.workflow }), "Claude Code wurde im Terminal gestartet");
  } else if (ds.oeffnen) {
    await sicher(() => api("/api/oeffnen", { pfad: ds.oeffnen }));
  } else if (ds.finder) {
    await sicher(() => api("/api/oeffnen", { pfad: ds.finder, finder: true }));
  } else if (ds.raus) {
    const r = state.tracker.find((x) => x.id === +ds.raus);
    await trackerUpdate({ aktion: "beworben", id: +ds.raus }, `${r?.Firma}: beworben – Follow-up in 12 Tagen`);
  } else if (ds.bearbeiten) {
    eintragDialog(state.tracker.find((x) => x.id === +ds.bearbeiten));
  } else if (ds.docs) {
    dokumenteDialog(state.tracker.find((x) => x.id === +ds.docs));
  }
});

$("#menu-btn").addEventListener("click", () => $("#sidebar").classList.toggle("offen"));
window.addEventListener("hashchange", route);

(async function start() {
  try {
    await ladeAlles();
    route();
    if (state.status.tasks.scout.status === "läuft") beobachteTask("scout");
  } catch (e) {
    $("#view").innerHTML = `<div class="card leer">Server nicht erreichbar: ${esc(e.message)}<br>Starte <code>python3 jobscout_app.py</code>.</div>`;
  }
})();
