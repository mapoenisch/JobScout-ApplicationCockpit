#!/usr/bin/env python3
"""
Job Scout – findet und priorisiert Stellenanzeigen passend zum eigenen Profil.

Quelle (v1): Bundesagentur für Arbeit – Jobsuche-API (offiziell, kostenlos,
keine Registrierung nötig). Weitere Quellen (Adzuna, Jooble) lassen sich
als zusätzliche Fetcher-Funktionen ergänzen.

Nutzung:
    pip install requests
    python3 job_scout.py

Ausgabe:
    jobs_ranked.csv   – alle Treffer, sortiert nach Score
    jobs_report.html  – klickbarer Report für den Browser
"""

from __future__ import annotations

import base64
import csv
import html
import os
import re
import sqlite3
import subprocess
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

import requests


def lade_env(pfad: str = ".env"):
    """Liest KEY=VALUE-Zeilen aus einer .env-Datei in os.environ."""
    p = Path(pfad)
    if not p.exists():
        return
    for zeile in p.read_text(encoding="utf-8").splitlines():
        zeile = zeile.strip()
        if zeile and not zeile.startswith("#") and "=" in zeile:
            k, _, v = zeile.partition("=")
            os.environ.setdefault(k.strip(), v.strip())


lade_env()

# ============================================================
# 1. KONFIGURATION – hier dein Profil anpassen
# ============================================================

PROFIL = {
    # Suchbegriffe, mit denen die API abgefragt wird (je Begriff eine Abfrage)
    "suchbegriffe": [
        "Sales Development Representative",
        "SDR",
        "Inside Sales",
        "Vertriebsinnendienst SaaS",
        "Business Development Representative",
        "Digital Sales",
    ],
    # Wunsch-Standort + Umkreis in km (für Vor-Ort-/Hybrid-Stellen)
    "ort": "Leipzig",
    "umkreis_km": 50,
    # Auch bundesweit nach Remote-Stellen suchen?
    "remote_suche": True,
    # Quellen an-/abschalten
    "quellen": {
        "arbeitsagentur": True,
        "arbeitnow": True,
        "adzuna": True,  # benötigt ADZUNA_APP_ID + ADZUNA_APP_KEY in .env
    },
    # Für die besten N BA-Treffer die Beschreibung nachladen (0 = aus)
    "ba_details_top_n": 40,
    # macOS-Benachrichtigung bei neuen Stellen ab diesem Score
    "benachrichtigung_ab_score": 60,
}

# Scoring: Welche Begriffe im Titel/Beschreibung sind wie viel wert?
SCORE_REGELN = {
    "titel_keywords": {
        # keyword (kleingeschrieben): punkte
        "sales development": 30,
        "sdr": 30,
        "sdm": 25,
        "business development representative": 25,
        "bdr": 25,
        "inside sales": 25,
        "vertriebsinnendienst": 20,
        "digital sales": 20,
        "customer success": 18,
        "account executive": 15,
        "account manager": 12,
        "sales manager": 8,
    },
    "text_keywords": {
        "saas": 15,
        "hubspot": 12,
        "salesforce": 12,
        "linkedin sales navigator": 12,
        "chatgpt": 10,
        "claude": 10,
        "quereinsteiger": 10,
        "ki": 8,
        "künstliche intelligenz": 8,
        "crm": 8,
        "b2b": 8,
        "ai": 6,
        "e-commerce": 6,
        "tech": 4,
    },
    # Abwertung (Stelle bleibt drin, rutscht aber nach unten)
    "malus_keywords": {
        "kaltakquise": -8,
        "hunter": -8,
        "cold calling": -6,
    },
    # Abwertung nur bei Treffern im Titel (nicht in der Beschreibung)
    "titel_malus_keywords": {
        "senior": -20,
        "head of": -25,
        "lead": -15,
        "teamleiter": -15,
        "director": -25,
    },
    "remote_bonus": 20,          # Stelle ist (teilweise) remote
    "leipzig_bonus": 15,         # Arbeitsort Leipzig/Umgebung
    "frische_bonus_max": 10,     # max. Bonus für sehr neue Anzeigen
    "frische_tage": 14,          # innerhalb dieser Frist gibt es Frische-Bonus
    # Ausschlusskriterien: Treffer → Stelle fliegt raus
    "blacklist": [
        "zeitarbeit",
        "personaldienstleist",
        "arbeitnehmerüberlassung",
        "provision ohne fixum",
        "d2d",
        "door to door",
    ],
}

# ============================================================
# 2. DATENMODELL
# ============================================================


@dataclass
class Job:
    titel: str
    firma: str
    ort: str
    veroeffentlicht: str  # ISO-Datum
    url: str
    quelle: str
    remote: bool = False
    beschreibung: str = ""  # sofern die Quelle sie liefert
    neu: bool = False       # erster Lauf, in dem diese Stelle auftaucht
    score: int = 0
    score_gruende: list = field(default_factory=list)

    @property
    def key(self) -> str:
        """Schlüssel zur Duplikat-Erkennung (Titel + Firma, normalisiert)."""
        norm = lambda s: re.sub(r"\W+", "", (s or "").lower())
        return f"{norm(self.titel)}|{norm(self.firma)}"


# ============================================================
# 3. FETCHER – Bundesagentur für Arbeit
# ============================================================

BA_URL = "https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v4/jobs"
BA_HEADERS = {"X-API-Key": "jobboerse-jobsuche"}  # öffentlicher Key der BA


def fetch_arbeitsagentur(was: str, wo: str | None, umkreis: int | None,
                         nur_remote: bool = False, max_seiten: int = 3) -> list[Job]:
    """Fragt die BA-Jobsuche-API ab und liefert Job-Objekte zurück."""
    jobs = []
    for seite in range(1, max_seiten + 1):
        params = {
            "was": was,
            "page": seite,
            "size": 50,
            "angebotsart": 1,  # 1 = Arbeitsstellen
        }
        if wo:
            params["wo"] = wo
            params["umkreis"] = umkreis or 25
        if nur_remote:
            params["arbeitszeit"] = "ho"  # Homeoffice-Filter der BA

        try:
            r = requests.get(BA_URL, headers=BA_HEADERS, params=params, timeout=15)
            r.raise_for_status()
        except requests.RequestException as e:
            print(f"  [WARN] BA-API-Fehler bei '{was}' (Seite {seite}): {e}",
                  file=sys.stderr)
            break

        data = r.json()
        angebote = data.get("stellenangebote", [])
        if not angebote:
            break

        for a in angebote:
            ref = a.get("refnr", "")
            jobs.append(Job(
                titel=a.get("titel") or a.get("beruf", ""),
                firma=a.get("arbeitgeber", "unbekannt"),
                ort=(a.get("arbeitsort") or {}).get("ort", ""),
                veroeffentlicht=a.get("aktuelleVeroeffentlichungsdatum", ""),
                url=f"https://www.arbeitsagentur.de/jobsuche/jobdetail/{ref}",
                quelle="Arbeitsagentur",
                remote=nur_remote,
            ))
    return jobs


# ============================================================
# 3b. FETCHER – Arbeitnow (kostenlos, kein API-Key)
# ============================================================

ARBEITNOW_URL = "https://www.arbeitnow.com/api/job-board-api"


def fetch_arbeitnow(max_seiten: int = 3) -> list[Job]:
    """Holt Stellen von Arbeitnow (Deutschland-Fokus, ATS-Quellen).

    Die API hat keinen Keyword-Parameter – gefiltert wird lokal über
    das Scoring. Remote-Flag und Tags liefert die API direkt mit.
    """
    jobs = []
    for seite in range(1, max_seiten + 1):
        try:
            r = requests.get(ARBEITNOW_URL, params={"page": seite}, timeout=15)
            r.raise_for_status()
        except requests.RequestException as e:
            print(f"  [WARN] Arbeitnow-Fehler (Seite {seite}): {e}",
                  file=sys.stderr)
            break

        for a in r.json().get("data", []):
            ts = a.get("created_at")
            datum = (datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()
                     if ts else "")
            jobs.append(Job(
                titel=a.get("title", ""),
                firma=a.get("company_name", "unbekannt"),
                ort=a.get("location", ""),
                veroeffentlicht=datum,
                url=a.get("url", ""),
                quelle="Arbeitnow",
                remote=bool(a.get("remote")),
                beschreibung=re.sub(r"<[^>]+>", " ",
                                    a.get("description", ""))[:3000],
            ))
    return jobs


# ============================================================
# 3c. FETCHER – Adzuna (kostenloser API-Key nötig)
# ============================================================

ADZUNA_URL = "https://api.adzuna.com/v1/api/jobs/de/search/{page}"


def fetch_adzuna(was: str, wo: str | None, umkreis_km: int | None,
                 max_seiten: int = 2) -> list[Job]:
    """Fragt die Adzuna-API (Deutschland) ab.

    Benötigt in der .env-Datei:
        ADZUNA_APP_ID=deine_app_id
        ADZUNA_APP_KEY=dein_app_key
    Beides gibt es nach Registrierung unter developer.adzuna.com
    (Dashboard -> API Access Details).
    """
    app_id = os.environ.get("ADZUNA_APP_ID")
    app_key = os.environ.get("ADZUNA_APP_KEY")
    if not app_id or not app_key:
        print("  [INFO] Adzuna übersprungen: ADZUNA_APP_ID/ADZUNA_APP_KEY "
              "fehlen in der .env-Datei.", file=sys.stderr)
        return []

    jobs = []
    for seite in range(1, max_seiten + 1):
        params = {
            "app_id": app_id,
            "app_key": app_key,
            "what": was,
            "results_per_page": 50,
            "sort_by": "date",
            "content-type": "application/json",
        }
        if wo:
            params["where"] = wo
            params["distance"] = umkreis_km or 25

        try:
            r = requests.get(ADZUNA_URL.format(page=seite),
                             params=params, timeout=15)
            r.raise_for_status()
        except requests.RequestException as e:
            print(f"  [WARN] Adzuna-Fehler bei '{was}' (Seite {seite}): {e}",
                  file=sys.stderr)
            break

        ergebnisse = r.json().get("results", [])
        if not ergebnisse:
            break

        for a in ergebnisse:
            jobs.append(Job(
                titel=a.get("title", "").replace("<strong>", "")
                                         .replace("</strong>", ""),
                firma=(a.get("company") or {}).get("display_name",
                                                   "unbekannt"),
                ort=(a.get("location") or {}).get("display_name", ""),
                veroeffentlicht=a.get("created", ""),
                url=a.get("redirect_url", ""),
                quelle="Adzuna",
                beschreibung=a.get("description", "")[:3000],
            ))
    return jobs


# ============================================================
# 3d. BA-DETAILS – Beschreibung für Top-Treffer nachladen
# ============================================================

BA_DETAIL_URL = ("https://rest.arbeitsagentur.de/jobboerse/"
                 "jobsuche-service/pc/v2/jobdetails/{ref}")


def lade_ba_beschreibung(job: Job) -> bool:
    """Lädt die Stellenbeschreibung einer BA-Anzeige nach.

    Die Detail-API erwartet die Referenznummer base64-kodiert.
    Gibt True zurück, wenn eine Beschreibung gefunden wurde.
    """
    refnr = job.url.rstrip("/").rsplit("/", 1)[-1]
    if not refnr:
        return False
    ref_b64 = base64.b64encode(refnr.encode()).decode()
    try:
        r = requests.get(BA_DETAIL_URL.format(ref=ref_b64),
                         headers=BA_HEADERS, timeout=15)
        r.raise_for_status()
        text = r.json().get("stellenbeschreibung", "")
        if text:
            job.beschreibung = re.sub(r"<[^>]+>", " ", text)[:3000]
            return True
    except (requests.RequestException, ValueError):
        pass
    return False


# ============================================================
# 3e. GESEHEN-SPEICHER – SQLite merkt sich jede Stelle
# ============================================================

DB_PFAD = "jobs_gesehen.db"


def markiere_neue_jobs(jobs: list[Job]) -> int:
    """Gleicht Jobs mit der lokalen Datenbank ab.

    Noch unbekannte Stellen bekommen job.neu = True und werden mit allen
    Daten gespeichert. Bekannte Stellen werden aktualisiert (Score immer,
    Beschreibung nur, wenn die neue länger ist). Die gespeicherten
    Beschreibungen sind die Datenbasis für skill_radar.py.
    Rückgabe: Anzahl neuer Stellen.
    """
    con = sqlite3.connect(DB_PFAD)
    con.execute("""CREATE TABLE IF NOT EXISTS gesehen (
        key TEXT PRIMARY KEY,
        erster_lauf TEXT,
        titel TEXT,
        firma TEXT)""")

    # Migration: fehlende Spalten in älteren Datenbanken ergänzen
    spalten = {r[1] for r in con.execute("PRAGMA table_info(gesehen)")}
    for spalte, typ in [("ort", "TEXT"), ("url", "TEXT"), ("quelle", "TEXT"),
                        ("score", "INTEGER"), ("beschreibung", "TEXT")]:
        if spalte not in spalten:
            con.execute(f"ALTER TABLE gesehen ADD COLUMN {spalte} {typ}")

    bekannt = {row[0] for row in con.execute("SELECT key FROM gesehen")}

    neue = 0
    jetzt = datetime.now(timezone.utc).isoformat(timespec="seconds")
    for j in jobs:
        if j.key not in bekannt:
            j.neu = True
            neue += 1
            con.execute(
                "INSERT OR IGNORE INTO gesehen "
                "(key, erster_lauf, titel, firma, ort, url, quelle, "
                "score, beschreibung) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (j.key, jetzt, j.titel, j.firma, j.ort, j.url,
                 j.quelle, j.score, j.beschreibung))
        else:
            con.execute(
                "UPDATE gesehen SET score = ?, beschreibung = CASE "
                "WHEN length(COALESCE(beschreibung, '')) < length(?) "
                "THEN ? ELSE beschreibung END WHERE key = ?",
                (j.score, j.beschreibung, j.beschreibung, j.key))
    con.commit()
    con.close()
    return neue


def macos_benachrichtigung(titel: str, text: str):
    """Zeigt eine macOS-Mitteilung (wird auf anderen Systemen übersprungen)."""
    if sys.platform != "darwin":
        return
    try:
        subprocess.run(
            ["osascript", "-e",
             f'display notification "{text}" with title "{titel}"'],
            check=False, capture_output=True, timeout=10)
    except (OSError, subprocess.SubprocessError):
        pass


# ============================================================
# 4. SCORING
# ============================================================


def enthaelt_wort(kw: str, text: str) -> bool:
    """Prüft auf ganze Wörter/Phrasen statt Substrings.

    Verhindert Fehltreffer wie 'ki' in 'Logistik' oder
    'hunter' in 'Headhunter'.
    """
    return re.search(rf"(?<!\w){re.escape(kw)}(?!\w)", text) is not None


def score_job(job: Job) -> Job:
    """Bewertet einen Job nach den SCORE_REGELN (0–100, gekappt)."""
    titel_text = f"{job.titel} {job.firma}".lower()
    voll_text = f"{titel_text} {job.beschreibung}".lower()
    punkte = 0
    gruende = []

    # Blacklist zuerst (Substring reicht hier, Begriffe sind lang genug)
    for bad in SCORE_REGELN["blacklist"]:
        if bad in voll_text:
            job.score = -1
            job.score_gruende = [f"Ausschluss: '{bad}'"]
            return job

    # Titel-Keywords (nur der beste Treffer zählt, sonst stapeln sich Synonyme)
    best = max(
        ((kw, p) for kw, p in SCORE_REGELN["titel_keywords"].items()
         if enthaelt_wort(kw, titel_text)),
        key=lambda x: x[1], default=None,
    )
    if best:
        punkte += best[1]
        gruende.append(f"Titel-Match '{best[0]}' (+{best[1]})")

    # Kontext-Keywords (stapeln sich; durchsuchen auch die Beschreibung)
    for kw, p in SCORE_REGELN["text_keywords"].items():
        if enthaelt_wort(kw, voll_text):
            punkte += p
            gruende.append(f"Keyword '{kw}' (+{p})")

    # Malus-Keywords (Abwertung, kein Ausschluss)
    for kw, p in SCORE_REGELN["malus_keywords"].items():
        if enthaelt_wort(kw, voll_text):
            punkte += p
            gruende.append(f"Malus '{kw}' ({p})")

    # Titel-Malus (nur wenn der Begriff im Stellentitel steht)
    for kw, p in SCORE_REGELN["titel_malus_keywords"].items():
        if enthaelt_wort(kw, titel_text):
            punkte += p
            gruende.append(f"Titel-Malus '{kw}' ({p})")

    # Remote
    if (job.remote or enthaelt_wort("remote", voll_text)
            or "home office" in voll_text or "homeoffice" in voll_text):
        punkte += SCORE_REGELN["remote_bonus"]
        gruende.append(f"Remote (+{SCORE_REGELN['remote_bonus']})")

    # Standort
    if PROFIL["ort"].lower() in (job.ort or "").lower():
        punkte += SCORE_REGELN["leipzig_bonus"]
        gruende.append(f"Standort {PROFIL['ort']} (+{SCORE_REGELN['leipzig_bonus']})")

    # Frische
    try:
        datum = datetime.fromisoformat(job.veroeffentlicht.replace("Z", "+00:00"))
        if datum.tzinfo is None:  # Datum ohne Zeitzone -> als UTC werten
            datum = datum.replace(tzinfo=timezone.utc)
        alter_tage = (datetime.now(timezone.utc) - datum).days
        if alter_tage <= SCORE_REGELN["frische_tage"]:
            bonus = round(SCORE_REGELN["frische_bonus_max"]
                          * (1 - alter_tage / SCORE_REGELN["frische_tage"]))
            if bonus > 0:
                punkte += bonus
                gruende.append(f"Neu ({alter_tage} Tage, +{bonus})")
    except (ValueError, AttributeError):
        pass

    job.score = max(min(punkte, 100), 0)
    job.score_gruende = gruende
    return job


# ============================================================
# 5. AUSGABE
# ============================================================


def schreibe_csv(jobs: list[Job], pfad: str = "jobs_ranked.csv"):
    with open(pfad, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["Neu", "Score", "Titel", "Firma", "Ort", "Remote",
                    "Veröffentlicht", "Gründe", "Link", "Quelle"])
        for j in jobs:
            w.writerow(["NEU" if j.neu else "", j.score, j.titel, j.firma,
                        j.ort, "ja" if j.remote else "?",
                        j.veroeffentlicht[:10],
                        " | ".join(j.score_gruende), j.url, j.quelle])
    print(f"  CSV geschrieben: {pfad}")


def schreibe_html(jobs: list[Job], pfad: str = "jobs_report.html"):
    zeilen = []
    for j in jobs:
        farbe = "#1D9E75" if j.score >= 60 else "#BA7517" if j.score >= 35 else "#888"
        neu_badge = ('<span style="background:#185FA5;color:#fff;'
                     'border-radius:12px;padding:2px 8px;font-size:11px;'
                     'font-weight:700">NEU</span>' if j.neu else "")
        zeilen.append(f"""
        <tr>
          <td>{neu_badge}</td>
          <td><span style="background:{farbe};color:#fff;border-radius:12px;
              padding:2px 10px;font-weight:600">{j.score}</span></td>
          <td><a href="{html.escape(j.url)}" target="_blank">
              {html.escape(j.titel)}</a></td>
          <td>{html.escape(j.firma)}</td>
          <td>{html.escape(j.ort)}</td>
          <td>{j.veroeffentlicht[:10]}</td>
          <td style="font-size:12px;color:#666">
              {html.escape(', '.join(j.score_gruende))}</td>
        </tr>""")
    anzahl_neu = sum(1 for j in jobs if j.neu)
    doc = f"""<!doctype html><html lang="de"><head><meta charset="utf-8">
<title>Job Scout Report – {datetime.now():%d.%m.%Y}</title>
<style>
 body{{font-family:system-ui,sans-serif;margin:2rem;max-width:1100px}}
 table{{border-collapse:collapse;width:100%}}
 th,td{{padding:8px 10px;border-bottom:1px solid #ddd;text-align:left;
       vertical-align:top}}
 th{{background:#f5f5f0;position:sticky;top:0}}
 tr:hover{{background:#fafaf5}}
 a{{color:#185FA5;text-decoration:none}} a:hover{{text-decoration:underline}}
</style></head><body>
<h1>Job Scout – {len(jobs)} Treffer, davon {anzahl_neu} NEU
    ({datetime.now():%d.%m.%Y %H:%M})</h1>
<table><thead><tr><th></th><th>Score</th><th>Titel</th><th>Firma</th>
<th>Ort</th><th>Datum</th><th>Bewertungsgründe</th></tr></thead>
<tbody>{''.join(zeilen)}</tbody></table></body></html>"""
    with open(pfad, "w", encoding="utf-8") as f:
        f.write(doc)
    print(f"  HTML-Report geschrieben: {pfad}")


# ============================================================
# 6. MAIN
# ============================================================


def main():
    print("Job Scout startet...\n")
    alle: dict[str, Job] = {}
    q = PROFIL["quellen"]

    for begriff in PROFIL["suchbegriffe"]:
        if q.get("arbeitsagentur"):
            print(f"[BA] Suche: '{begriff}' rund um {PROFIL['ort']}...")
            for job in fetch_arbeitsagentur(begriff, PROFIL["ort"],
                                            PROFIL["umkreis_km"]):
                alle.setdefault(job.key, job)

            if PROFIL["remote_suche"]:
                print(f"[BA] Suche: '{begriff}' remote (bundesweit)...")
                for job in fetch_arbeitsagentur(begriff, wo=None,
                                                umkreis=None,
                                                nur_remote=True):
                    alle.setdefault(job.key, job)

        if q.get("adzuna"):
            print(f"[Adzuna] Suche: '{begriff}'...")
            for job in fetch_adzuna(begriff, PROFIL["ort"],
                                    PROFIL["umkreis_km"]):
                alle.setdefault(job.key, job)
            if PROFIL["remote_suche"]:
                for job in fetch_adzuna(f"{begriff} remote", wo=None,
                                        umkreis_km=None):
                    alle.setdefault(job.key, job)

    if q.get("arbeitnow"):
        print("[Arbeitnow] Lade aktuelle Stellen (Filter über Scoring)...")
        for job in fetch_arbeitnow():
            alle.setdefault(job.key, job)

    print(f"\n{len(alle)} eindeutige Stellen gefunden. Bewerte...")
    bewertet = [score_job(j) for j in alle.values()]
    relevant = sorted((j for j in bewertet if j.score >= 0),
                      key=lambda j: j.score, reverse=True)
    aussortiert = len(bewertet) - len(relevant)
    if aussortiert:
        print(f"  {aussortiert} Stellen durch Blacklist aussortiert.")

    # BA-Beschreibungen für die Top-Treffer nachladen und neu bewerten
    top_n = PROFIL.get("ba_details_top_n", 0)
    if top_n:
        kandidaten = [j for j in relevant[:top_n]
                      if j.quelle == "Arbeitsagentur" and not j.beschreibung]
        if kandidaten:
            print(f"Lade Beschreibungen für {len(kandidaten)} "
                  f"BA-Top-Treffer nach...")
            for j in kandidaten:
                if lade_ba_beschreibung(j):
                    score_job(j)  # mit Beschreibung neu bewerten
                time.sleep(0.2)  # API nicht fluten
            relevant.sort(key=lambda j: j.score, reverse=True)

    # Mit Gesehen-Datenbank abgleichen
    anzahl_neu = markiere_neue_jobs(relevant)
    print(f"  {anzahl_neu} Stellen sind NEU seit dem letzten Lauf.")

    schreibe_csv(relevant)
    schreibe_html(relevant)

    # Benachrichtigung bei neuen Top-Treffern
    schwelle = PROFIL.get("benachrichtigung_ab_score", 60)
    top_neu = [j for j in relevant if j.neu and j.score >= schwelle]
    if top_neu:
        bester = top_neu[0]
        macos_benachrichtigung(
            f"Job Scout: {len(top_neu)} neue Top-Treffer",
            f"[{bester.score}] {bester.titel[:60]} – {bester.firma[:40]}")

    print("\nTop 5:")
    for j in relevant[:5]:
        marker = " NEU" if j.neu else ""
        print(f"  [{j.score:3d}]{marker} {j.titel} – {j.firma} ({j.ort})")


if __name__ == "__main__":
    main()
