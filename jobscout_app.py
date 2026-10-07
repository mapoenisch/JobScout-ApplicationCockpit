#!/usr/bin/env python3
"""
JobScout Cockpit – lokale Weboberfläche für den kompletten Bewerbungsprozess.

Bündelt alle bestehenden Bausteine an einem Ort:
    - Stellen aus jobs_ranked.csv durchsuchen, filtern, auswählen
    - Bewerbungs-Workflow (Claude Code) für ausgewählte Stellen starten
    - Bewerbungs-Pipeline (bewerbungen_tracker.csv) als Kanban pflegen
    - Unterlagen im Ordner "bewerbungen" öffnen
    - Interview-Prep per Formular starten
    - Scraping-Lauf (job_scout.py) und Skill-Radar (skill_radar.py) anstoßen

Start:  python3 jobscout_app.py      (oder Doppelklick auf run_cockpit.command)
Dann:   http://127.0.0.1:8765

Nur Standardbibliothek, keine zusätzlichen Pakete. Der Server lauscht
ausschließlich auf 127.0.0.1 und nimmt schreibende Aufrufe nur mit dem
Header "X-JobScout: 1" von localhost an (Schutz gegen Fremd-Webseiten).
"""

from __future__ import annotations

import csv
import io
import json
import os
import re
import subprocess
import sys
import threading
import time
import webbrowser
from datetime import date, datetime, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

# ============================================================
# 1. KONFIGURATION
# ============================================================

BASIS = Path(__file__).resolve().parent
APP_DIR = BASIS / "app"
LAUFZEIT_DIR = BASIS / ".cockpit"          # Logs + generierte Prompts
PORT = int(os.environ.get("JOBSCOUT_PORT", "8765"))

TRACKER_PFAD = BASIS / "bewerbungen_tracker.csv"
JOBS_PFAD = BASIS / "jobs_ranked.csv"
BEWERBUNGEN_DIR = BASIS / "bewerbungen"
LAUF_LOG = BASIS / "lauf.log"

TRACKER_FELDER = ["Firma", "Position", "Link", "Status", "Erstellt am",
                  "Beworben am", "Follow-up am", "Ergebnis", "Notizen"]
STATUSWERTE = ["vorbereitet", "beworben", "follow-up", "interview",
               "absage", "angebot"]
FOLLOWUP_TAGE = 12

# Python mit installiertem "requests" (wie in run_job_scout.sh)
PYTHON_SCOUT = ("/Library/Developer/CommandLineTools/Library/Frameworks/"
                "Python3.framework/Versions/3.9/bin/python3.9")
if not Path(PYTHON_SCOUT).exists():
    PYTHON_SCOUT = sys.executable

_tracker_lock = threading.Lock()


# ============================================================
# 2. DATEN: STELLEN + TRACKER
# ============================================================


def _norm_firma(name: str) -> str:
    return re.sub(r"[^a-z0-9äöüß]", "", (name or "").lower())


def ist_beispielzeile(row: dict) -> bool:
    return "(zeile löschen)" in (row.get("Firma") or "").lower()


def lade_tracker() -> list[dict]:
    if not TRACKER_PFAD.exists():
        return []
    with open(TRACKER_PFAD, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f, delimiter=";"))
    for i, r in enumerate(rows):
        r["id"] = i
        for feld in TRACKER_FELDER:
            r[feld] = (r.get(feld) or "").strip()
    return rows


def speichere_tracker(rows: list[dict]):
    puffer = io.StringIO()
    w = csv.DictWriter(puffer, fieldnames=TRACKER_FELDER, delimiter=";",
                       extrasaction="ignore", lineterminator="\r\n")
    w.writeheader()
    for r in rows:
        w.writerow({k: r.get(k, "") for k in TRACKER_FELDER})
    tmp = TRACKER_PFAD.with_suffix(".csv.tmp")
    with open(tmp, "w", encoding="utf-8-sig", newline="") as f:
        f.write(puffer.getvalue())
    os.replace(tmp, TRACKER_PFAD)


def followup_faellig(r: dict, heute: date | None = None) -> bool:
    """Gleiche Regel wie im Bewerbungs-Workflow: beworben, länger als
    12 Tage her, noch kein Ergebnis."""
    heute = heute or date.today()
    if r["Status"] != "beworben" or r["Ergebnis"] or not r["Beworben am"]:
        return False
    try:
        beworben = date.fromisoformat(r["Beworben am"][:10])
    except ValueError:
        return False
    return (heute - beworben).days > FOLLOWUP_TAGE


def dokumente_fuer(firma: str) -> list[dict]:
    """Alle Dateien in bewerbungen/ (und Interview-Briefings im
    Projektordner), deren Name die Firma enthält."""
    schluessel = _norm_firma(firma)
    if not schluessel:
        return []
    treffer = []
    for p in _alle_dokumente():
        if schluessel in _norm_firma(p.stem):
            treffer.append(_datei_info(p))
    return treffer


def _alle_dokumente() -> list[Path]:
    dateien = []
    if BEWERBUNGEN_DIR.exists():
        dateien += [p for p in BEWERBUNGEN_DIR.iterdir()
                    if p.is_file() and not p.name.startswith((".", "~$"))]
    dateien += list(BASIS.glob("Interview_Briefing_*.docx"))
    return sorted(dateien, key=lambda p: p.name.lower())


def _datei_info(p: Path) -> dict:
    st = p.stat()
    return {"name": p.name,
            "pfad": str(p.relative_to(BASIS)),
            "groesse": st.st_size,
            "geaendert": datetime.fromtimestamp(st.st_mtime)
                                 .strftime("%Y-%m-%d %H:%M")}


def tracker_api() -> dict:
    rows = [r for r in lade_tracker() if not ist_beispielzeile(r)]
    for r in rows:
        r["faellig"] = followup_faellig(r)
        r["dokumente"] = dokumente_fuer(r["Firma"])
    return {"eintraege": rows, "statuswerte": STATUSWERTE,
            "followup_tage": FOLLOWUP_TAGE}


def lade_jobs() -> list[dict]:
    if not JOBS_PFAD.exists():
        return []
    tracker_firmen = {_norm_firma(r["Firma"]) for r in lade_tracker()
                      if not ist_beispielzeile(r)}
    with open(JOBS_PFAD, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f, delimiter=";"))
    jobs = []
    for i, r in enumerate(rows):
        try:
            score = int(float(r.get("Score") or 0))
        except ValueError:
            score = 0
        jobs.append({
            "id": i,
            "neu": (r.get("Neu") or "").strip().upper() == "NEU",
            "score": score,
            "titel": (r.get("Titel") or "").strip(),
            "firma": (r.get("Firma") or "").strip(),
            "ort": (r.get("Ort") or "").strip(),
            "remote": (r.get("Remote") or "").strip().lower() == "ja",
            "datum": (r.get("Veröffentlicht") or "").strip(),
            "gruende": [g.strip() for g in (r.get("Gründe") or "").split("|")
                        if g.strip()],
            "link": (r.get("Link") or "").strip(),
            "quelle": (r.get("Quelle") or "").strip(),
            "im_tracker": _norm_firma(r.get("Firma") or "") in tracker_firmen,
        })
    return jobs


def _mtime(p: Path) -> str | None:
    if not p.exists():
        return None
    return datetime.fromtimestamp(p.stat().st_mtime).strftime("%Y-%m-%d %H:%M")


def status_api() -> dict:
    """Kennzahlen für das Dashboard."""
    jobs = lade_jobs()
    tracker = tracker_api()["eintraege"]
    pipeline = {s: 0 for s in STATUSWERTE}
    for r in tracker:
        pipeline[r["Status"] if r["Status"] in pipeline else "vorbereitet"] += 1
    return {
        "jobs_gesamt": len(jobs),
        "jobs_neu": sum(j["neu"] for j in jobs),
        "jobs_top": sum(j["score"] >= 50 for j in jobs),
        "jobs_neu_top": sum(j["neu"] and j["score"] >= 50 for j in jobs),
        "pipeline": pipeline,
        "bewerbungen": len(tracker),
        "faellig": [r for r in tracker if r["faellig"]],
        "letzter_lauf": _mtime(JOBS_PFAD),
        "skill_report": _mtime(BASIS / "skill_report.html"),
        "tasks": {k: _task_info(k) for k in TASKS},
    }


# ============================================================
# 3. HINTERGRUND-AUFGABEN (Scraping, Skill-Radar)
# ============================================================

TASKS = {
    "scout": {"titel": "Job-Scraping (job_scout.py)",
              "cmd": ["/bin/bash", str(BASIS / "run_job_scout.sh")],
              "log": LAUF_LOG},
    "radar": {"titel": "Skill-Radar (skill_radar.py)",
              "cmd": [PYTHON_SCOUT, str(BASIS / "skill_radar.py")],
              "log": LAUFZEIT_DIR / "skill_radar.log"},
}
_laufend: dict[str, dict] = {}


def _task_info(name: str) -> dict:
    info = _laufend.get(name)
    log = TASKS[name]["log"]
    tail = ""
    if log.exists():
        with open(log, encoding="utf-8", errors="replace") as f:
            tail = "".join(f.readlines()[-25:])
    if not info:
        return {"status": "bereit", "log": tail}
    proc = info["proc"]
    rc = proc.poll()
    return {"status": "läuft" if rc is None else
            ("fertig" if rc == 0 else f"fehler (Code {rc})"),
            "gestartet": info["gestartet"], "log": tail}


def starte_task(name: str) -> dict:
    if name not in TASKS:
        raise ValueError("Unbekannte Aufgabe")
    info = _laufend.get(name)
    if info and info["proc"].poll() is None:
        return {"ok": True, "hinweis": "Läuft bereits"}
    LAUFZEIT_DIR.mkdir(exist_ok=True)
    t = TASKS[name]
    if name == "scout":
        # run_job_scout.sh schreibt selbst nach lauf.log
        proc = subprocess.Popen(t["cmd"], cwd=BASIS,
                                stdout=subprocess.DEVNULL,
                                stderr=subprocess.DEVNULL)
    else:
        log = open(t["log"], "w", encoding="utf-8")
        proc = subprocess.Popen(t["cmd"], cwd=BASIS, stdout=log,
                                stderr=subprocess.STDOUT)
    _laufend[name] = {"proc": proc,
                      "gestartet": datetime.now().strftime("%H:%M:%S")}
    return {"ok": True}


# ============================================================
# 4. CLAUDE-WORKFLOWS IM TERMINAL STARTEN
# ============================================================


def _applescript_string(s: str) -> str:
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


def _shell_quote(s: str) -> str:
    return "'" + s.replace("'", "'\\''") + "'"


def oeffne_claude_im_terminal(prompt: str, kennung: str) -> dict:
    """Schreibt den Prompt in eine Datei und startet Claude Code damit in
    einem neuen Terminal-Fenster (wie die run_*-Skripte)."""
    LAUFZEIT_DIR.mkdir(exist_ok=True)
    datei = LAUFZEIT_DIR / f"prompt_{kennung}_{int(time.time())}.txt"
    datei.write_text(prompt, encoding="utf-8")
    shell = (f"cd {_shell_quote(str(BASIS))} && "
             f"claude \"$(cat {_shell_quote(str(datei))})\"")
    script = ('tell application "Terminal"\n'
              '  activate\n'
              f'  do script {_applescript_string(shell)}\n'
              'end tell')
    subprocess.run(["osascript", "-e", script], check=True,
                   capture_output=True, timeout=20)
    return {"ok": True, "prompt_datei": str(datei.relative_to(BASIS))}


def prompt_bewerbung(stellen: list[dict]) -> str:
    basis = (BASIS / "prompt_bewerbungs_workflow.txt").read_text(
        encoding="utf-8")
    liste = "\n".join(
        f"{i}. {s.get('titel', '')} – {s.get('firma', '')} "
        f"({s.get('ort', '')}, Score {s.get('score', '?')})\n   {s.get('link', '')}"
        for i, s in enumerate(stellen, 1))
    return (
        "Ich habe im JobScout-Cockpit bereits folgende Stellen für eine "
        "Bewerbung ausgewählt:\n\n" + liste + "\n\n"
        "Die Auswahl ist damit erledigt: Überspringe das Anzeigen der "
        "Kurzliste und das Warten auf meine Auswahl. Prüfe aber trotzdem "
        "kurz die Follow-up-Erinnerungen im Tracker und ob eine dieser "
        "Firmen schon im Tracker steht. Führe anschließend für genau diese "
        "Stellen die übrigen Schritte des folgenden Workflows aus "
        "(Ausschreibung lesen, Homepage-Recherche, Lebenslauf + "
        "Anschreiben, Tracker-Eintrag):\n\n"
        "----- WORKFLOW -----\n" + basis)


def prompt_interview(firma: str, position: str, datum: str, name: str) -> str:
    vorlage = (BASIS / "prompt_interview_prep_template.txt").read_text(
        encoding="utf-8")
    return (vorlage.replace("__FIRMA__", firma)
                   .replace("__POSITION__", position)
                   .replace("__DATUM__", datum)
                   .replace("__NAME__", name or "unbekannt"))


WORKFLOWS = {
    "bewerbung_komplett": ("Bewerbungs-Workflow (mit Auswahl im Terminal)",
                           lambda d: (BASIS / "prompt_bewerbungs_workflow.txt")
                           .read_text(encoding="utf-8")),
    "skill_gap": ("Skill-Gap-Analyse + Kurssuche",
                  lambda d: (BASIS / "prompt_skill_gap_analyse.txt")
                  .read_text(encoding="utf-8")),
}


# ============================================================
# 5. TRACKER-AKTIONEN
# ============================================================


def tracker_aktion(daten: dict) -> dict:
    aktion = daten.get("aktion")
    heute = date.today().isoformat()
    with _tracker_lock:
        rows = lade_tracker()
        if aktion == "neu":
            firma = (daten.get("Firma") or "").strip()
            if not firma:
                raise ValueError("Firma fehlt")
            rows.append({
                "Firma": firma,
                "Position": (daten.get("Position") or "").strip(),
                "Link": (daten.get("Link") or "").strip(),
                "Status": daten.get("Status") or "vorbereitet",
                "Erstellt am": heute, "Beworben am": "", "Follow-up am": "",
                "Ergebnis": "", "Notizen": (daten.get("Notizen") or "").strip(),
            })
            speichere_tracker(rows)
            return {"ok": True}

        idx = int(daten.get("id", -1))
        if not 0 <= idx < len(rows):
            raise ValueError("Eintrag nicht gefunden")
        r = rows[idx]
        if aktion == "beworben":
            # "Bewerbung bei X ist raus" aus dem Workflow-Hinweis
            r["Status"] = "beworben"
            r["Beworben am"] = heute
            r["Follow-up am"] = (date.today()
                                 + timedelta(days=FOLLOWUP_TAGE)).isoformat()
        elif aktion == "update":
            for feld in TRACKER_FELDER:
                if feld in daten:
                    r[feld] = str(daten[feld]).strip()
            if r["Status"] not in STATUSWERTE:
                raise ValueError("Ungültiger Status")
            if r["Status"] == "beworben" and not r["Beworben am"]:
                r["Beworben am"] = heute
                r["Follow-up am"] = (date.today()
                                     + timedelta(days=FOLLOWUP_TAGE)).isoformat()
        elif aktion == "loeschen":
            rows.pop(idx)
        else:
            raise ValueError("Unbekannte Aktion")
        speichere_tracker(rows)
    return {"ok": True}


def oeffne_datei(rel: str, im_finder: bool = False) -> dict:
    ziel = (BASIS / rel).resolve()
    erlaubt = {p.resolve() for p in _alle_dokumente()}
    erlaubt |= {p.resolve() for p in BASIS.glob("kurs_empfehlungen_*.md")}
    erlaubt |= {(BASIS / n).resolve() for n in
                ("Lebenslauf_Master.docx", "CV_Marc_Pönisch.pdf",
                 "jobs_report.html", "skill_report.html",
                 "bewerbungen_tracker.csv", "jobs_ranked.csv")}
    if ziel not in erlaubt or not ziel.exists():
        raise ValueError("Datei nicht freigegeben")
    subprocess.run(["open", "-R", str(ziel)] if im_finder
                   else ["open", str(ziel)], check=True)
    return {"ok": True}


def dokumente_api() -> dict:
    gruppen: dict[str, list] = {}
    for p in _alle_dokumente():
        m = re.match(r"(Lebenslauf|Anschreiben|Interview_Briefing)_+(.+)",
                     p.stem)
        firma = m.group(2).replace("_", " ") if m else "Sonstiges"
        info = _datei_info(p)
        info["typ"] = m.group(1).replace("_", "-") if m else "Datei"
        gruppen.setdefault(firma, []).append(info)
    kurse = [_datei_info(p) | {"inhalt": p.read_text(encoding="utf-8")}
             for p in sorted(BASIS.glob("kurs_empfehlungen_*.md"),
                             reverse=True)]
    stamm = [_datei_info(BASIS / n) for n in
             ("Lebenslauf_Master.docx", "CV_Marc_Pönisch.pdf")
             if (BASIS / n).exists()]
    return {"gruppen": gruppen, "kurse": kurse, "stamm": stamm}


# ============================================================
# 6. HTTP-SERVER
# ============================================================

STATISCH = {
    "/": (APP_DIR / "index.html", "text/html; charset=utf-8"),
    "/app.css": (APP_DIR / "app.css", "text/css; charset=utf-8"),
    "/app.js": (APP_DIR / "app.js", "application/javascript; charset=utf-8"),
    "/report/jobs": (BASIS / "jobs_report.html", "text/html; charset=utf-8"),
    "/report/skills": (BASIS / "skill_report.html", "text/html; charset=utf-8"),
}


class Handler(BaseHTTPRequestHandler):
    server_version = "JobScoutCockpit/1.0"

    def log_message(self, fmt, *args):  # ruhige Konsole
        if "/api/" in (args[0] if args else ""):
            return
        sys.stderr.write("[cockpit] " + fmt % args + "\n")

    # --- Hilfen ---
    def _host_ok(self) -> bool:
        host = (self.headers.get("Host") or "").split(":")[0]
        return host in ("127.0.0.1", "localhost")

    def _json(self, daten, code: int = 200):
        body = json.dumps(daten, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _datei(self, pfad: Path, typ: str):
        if not pfad.exists():
            self._json({"fehler": f"{pfad.name} existiert noch nicht"}, 404)
            return
        body = pfad.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", typ)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    # --- GET ---
    def do_GET(self):
        if not self._host_ok():
            return self._json({"fehler": "Host nicht erlaubt"}, 403)
        url = urlparse(self.path)
        try:
            if url.path in STATISCH:
                return self._datei(*STATISCH[url.path])
            if url.path == "/api/status":
                return self._json(status_api())
            if url.path == "/api/jobs":
                return self._json({"jobs": lade_jobs(),
                                   "stand": _mtime(JOBS_PFAD)})
            if url.path == "/api/tracker":
                return self._json(tracker_api())
            if url.path == "/api/dokumente":
                return self._json(dokumente_api())
            if url.path == "/api/task":
                name = parse_qs(url.query).get("name", [""])[0]
                return self._json(_task_info(name) if name in TASKS
                                  else {"fehler": "unbekannt"})
            self._json({"fehler": "Nicht gefunden"}, 404)
        except Exception as e:  # noqa: BLE001 – Fehler an die UI melden
            self._json({"fehler": str(e)}, 500)

    # --- POST ---
    def do_POST(self):
        if not self._host_ok() or self.headers.get("X-JobScout") != "1":
            return self._json({"fehler": "Nicht erlaubt"}, 403)
        laenge = int(self.headers.get("Content-Length") or 0)
        try:
            daten = json.loads(self.rfile.read(laenge) or b"{}")
        except json.JSONDecodeError:
            return self._json({"fehler": "Ungültiges JSON"}, 400)
        pfad = urlparse(self.path).path
        try:
            if pfad == "/api/tracker":
                return self._json(tracker_aktion(daten))
            if pfad == "/api/task":
                return self._json(starte_task(daten.get("name", "")))
            if pfad == "/api/oeffnen":
                return self._json(oeffne_datei(daten.get("pfad", ""),
                                               bool(daten.get("finder"))))
            if pfad == "/api/claude/bewerbung":
                stellen = daten.get("stellen") or []
                if not stellen:
                    raise ValueError("Keine Stellen ausgewählt")
                return self._json(oeffne_claude_im_terminal(
                    prompt_bewerbung(stellen), "bewerbung"))
            if pfad == "/api/claude/interview":
                firma = (daten.get("firma") or "").strip()
                position = (daten.get("position") or "").strip()
                datum = (daten.get("datum") or "").strip()
                if not (firma and position and datum):
                    raise ValueError("Firma, Position und Datum ausfüllen")
                return self._json(oeffne_claude_im_terminal(
                    prompt_interview(firma, position, datum,
                                     (daten.get("name") or "").strip()),
                    "interview"))
            if pfad == "/api/claude/workflow":
                name = daten.get("name", "")
                if name not in WORKFLOWS:
                    raise ValueError("Unbekannter Workflow")
                return self._json(oeffne_claude_im_terminal(
                    WORKFLOWS[name][1](daten), name))
            self._json({"fehler": "Nicht gefunden"}, 404)
        except subprocess.CalledProcessError as e:
            msg = (e.stderr or b"").decode("utf-8", "replace").strip()
            self._json({"fehler": f"Start fehlgeschlagen: {msg or e}"}, 500)
        except Exception as e:  # noqa: BLE001
            self._json({"fehler": str(e)}, 400)


def main():
    LAUFZEIT_DIR.mkdir(exist_ok=True)
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    url = f"http://127.0.0.1:{PORT}"
    print(f"JobScout Cockpit läuft auf {url}  (Strg+C beendet)")
    if "--kein-browser" not in sys.argv:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nBeendet.")


if __name__ == "__main__":
    main()
