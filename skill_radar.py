#!/usr/bin/env python3
"""
Skill-Gap-Radar – gleicht die Anforderungen des Arbeitsmarkts mit dem
eigenen Profil ab.

Datenbasis: die Stellenbeschreibungen, die job_scout.py in der lokalen
Datenbank (jobs_gesehen.db) sammelt. Je öfter der Job Scout läuft, desto
aussagekräftiger wird das Radar.

Nutzung:
    python3 skill_radar.py

Ausgabe:
    skill_report.html  – Report mit Nachfrage-Balken, Status und Trend
    Konsole            – Top-Lücken auf einen Blick

Jeder Lauf speichert einen Monats-Schnappschuss in der Datenbank, sodass
spätere Läufe Trends anzeigen (steigt oder fällt die Nachfrage?).
"""

from __future__ import annotations

import sqlite3
import sys
from datetime import date, datetime

from job_scout import DB_PFAD, enthaelt_wort, lade_einstellungen

# ============================================================
# 1. SKILL-KATALOG – was der Markt fordern könnte
#    (Synonyme je Skill; Matching über ganze Wörter)
# ============================================================

SKILL_KATALOG = {
    "CRM & Tools": {
        "HubSpot": ["hubspot"],
        "Salesforce": ["salesforce"],
        "Pipedrive": ["pipedrive"],
        "MS Dynamics": ["dynamics 365", "ms dynamics", "microsoft dynamics"],
        "LinkedIn Sales Navigator": ["sales navigator"],
        "MS Office / Excel": ["ms office", "microsoft office", "excel"],
        "SAP": ["sap"],
    },
    "Vertriebsmethoden": {
        "Kaltakquise / Outbound": ["kaltakquise", "cold calling",
                                   "cold call", "outbound"],
        "Inbound Sales": ["inbound"],
        "Lead-Qualifizierung": ["lead-qualifizierung", "lead qualifizierung",
                                "qualifizierung von leads", "bant", "meddic"],
        "Social Selling": ["social selling"],
        "Neukundenakquise": ["neukundenakquise", "neukundengewinnung",
                             "akquise"],
        "Bestandskundenbetreuung": ["bestandskunden", "kundenbetreuung",
                                    "kundenbindung"],
        "Angebotserstellung": ["angebotserstellung", "angebote erstellen",
                               "angebotskalkulation"],
        "Forecasting / Pipeline": ["forecast", "forecasting", "pipeline"],
    },
    "Fachwissen": {
        "SaaS": ["saas"],
        "B2B-Vertrieb": ["b2b"],
        "E-Commerce": ["e-commerce", "ecommerce"],
        "KI im Vertrieb": ["ki", "künstliche intelligenz", "ai", "chatgpt"],
        "Datenanalyse / Reporting": ["datenanalyse", "reporting", "kpi",
                                     "analytics"],
        "Online Marketing / SEO": ["seo", "sea", "online marketing",
                                   "google ads"],
        "Projektmanagement": ["projektmanagement", "agil", "scrum"],
    },
    "Sprachen": {
        "Englisch": ["englisch", "english"],
        "Weitere Fremdsprachen": ["französisch", "spanisch", "italienisch",
                                  "niederländisch", "polnisch"],
    },
}

# ============================================================
# 2. MEIN PROFIL – Status je Skill
#    WICHTIG: Diese Listen selbst pflegen! Alles, was in keiner
#    der beiden Listen steht, gilt im Report als LÜCKE.
#    (z. B. "Englisch": selbst einschätzen und ggf. eintragen)
# ============================================================

MEIN_STATUS = {
    # Kann ich nachweislich (Ausbildung + Berufserfahrung Groß-/Außenhandel)
    "vorhanden": [
        "SAP",
        "MS Office / Excel",
        "B2B-Vertrieb",
        "Bestandskundenbetreuung",
        "Angebotserstellung",
    ],
    # Lerne ich gerade (Weiterbildung Digital Sales Manager, seit 18.05.2026)
    "weiterbildung": [
        "HubSpot",
        "Salesforce",
        "LinkedIn Sales Navigator",
        "Social Selling",
        "Lead-Qualifizierung",
        "Inbound Sales",
        "KI im Vertrieb",
        "Datenanalyse / Reporting",
        "Online Marketing / SEO",
        "Projektmanagement",
        "Forecasting / Pipeline",
    ],
    # "Englisch" bewusst NICHT eingetragen: kein fließendes oder
    # verhandlungssicheres Englisch vorhanden -> zählt im Report zu Recht
    # als LÜCKE. Erst eintragen, wenn sich das ändert (z. B. nach einem
    # Sprachkurs oder Zertifikat).
}

# Eigene Skills aus dem Cockpit (Einstellungen > Skill-Profil > Skill-Editor)
STANDARD_KATALOG = {k: dict(v) for k, v in SKILL_KATALOG.items()}


def mische_katalog(eigen: dict | None) -> dict:
    """Standard-Katalog + eigene Skills {Kategorie: {Skill: [Synonyme]}}."""
    out = {k: dict(v) for k, v in STANDARD_KATALOG.items()}
    for kat, skills in (eigen or {}).items():
        if isinstance(skills, dict):
            out.setdefault(kat, {}).update(
                {s: list(syn) for s, syn in skills.items() if syn})
    return out


SKILL_KATALOG = mische_katalog(lade_einstellungen().get("skill_katalog_eigen"))

# Überschreibung aus einstellungen.json (Tab "Skill-Profil" im Cockpit)
STANDARD_STATUS = {k: list(v) for k, v in MEIN_STATUS.items()}
_skill_status = lade_einstellungen().get("skill_status") or {}
for _k in ("vorhanden", "weiterbildung"):
    if isinstance(_skill_status.get(_k), list):
        MEIN_STATUS[_k] = _skill_status[_k]

# Nur Stellen ab diesem Score fließen in die Analyse ein
# (damit z. B. fachfremde Arbeitnow-Treffer die Statistik nicht verzerren)
MIN_SCORE = 20

REPORT_PFAD = "skill_report.html"


# ============================================================
# 3. ANALYSE
# ============================================================


def lade_jobs() -> list[tuple[str, str]]:
    """Lädt (titel, beschreibung) aller relevanten Stellen aus der DB."""
    con = sqlite3.connect(DB_PFAD)
    try:
        rows = con.execute(
            "SELECT titel, beschreibung FROM gesehen "
            "WHERE beschreibung IS NOT NULL AND beschreibung != '' "
            "AND COALESCE(score, 0) >= ?", (MIN_SCORE,)).fetchall()
    except sqlite3.OperationalError:
        rows = []
    con.close()
    return rows


def analysiere(jobs: list[tuple[str, str]]) -> list[dict]:
    """Zählt je Skill, in wie vielen Stellen er gefordert wird."""
    n = len(jobs)
    texte = [f"{t} {b}".lower() for t, b in jobs]
    ergebnisse = []
    for kategorie, skills in SKILL_KATALOG.items():
        for skill, keywords in skills.items():
            anzahl = sum(
                1 for text in texte
                if any(enthaelt_wort(kw, text) for kw in keywords))
            if skill in MEIN_STATUS["vorhanden"]:
                status = "vorhanden"
            elif skill in MEIN_STATUS["weiterbildung"]:
                status = "weiterbildung"
            else:
                status = "luecke"
            ergebnisse.append({
                "kategorie": kategorie,
                "skill": skill,
                "anzahl": anzahl,
                "anteil": round(100 * anzahl / n, 1) if n else 0.0,
                "status": status,
            })
    return ergebnisse


# ============================================================
# 4. TREND – Monats-Schnappschüsse in der Datenbank
# ============================================================


def speichere_snapshot(ergebnisse: list[dict]) -> dict[str, float]:
    """Speichert den heutigen Stand und liefert den vorherigen zurück."""
    con = sqlite3.connect(DB_PFAD)
    con.execute("""CREATE TABLE IF NOT EXISTS radar_snapshot (
        datum TEXT, skill TEXT, anteil REAL,
        PRIMARY KEY (datum, skill))""")
    heute = date.today().isoformat()

    # Letzten Schnappschuss VOR heute laden (für den Trendvergleich)
    vorher_datum = con.execute(
        "SELECT MAX(datum) FROM radar_snapshot WHERE datum < ?",
        (heute,)).fetchone()[0]
    vorher = {}
    if vorher_datum:
        vorher = dict(con.execute(
            "SELECT skill, anteil FROM radar_snapshot WHERE datum = ?",
            (vorher_datum,)).fetchall())

    for e in ergebnisse:
        con.execute(
            "INSERT OR REPLACE INTO radar_snapshot VALUES (?, ?, ?)",
            (heute, e["skill"], e["anteil"]))
    con.commit()
    con.close()
    return vorher


# ============================================================
# 5. REPORT
# ============================================================

STATUS_INFO = {
    "vorhanden": ("#1D9E75", "✔ vorhanden"),
    "weiterbildung": ("#185FA5", "◐ in Weiterbildung"),
    "luecke": ("#C0392B", "✘ Lücke"),
}


def trend_symbol(skill: str, anteil: float, vorher: dict[str, float]) -> str:
    if skill not in vorher:
        return ""
    delta = round(anteil - vorher[skill], 1)
    if delta >= 2:
        return f' <span style="color:#1D9E75">▲ +{delta} Pp.</span>'
    if delta <= -2:
        return f' <span style="color:#C0392B">▼ {delta} Pp.</span>'
    return ' <span style="color:#999">→ stabil</span>'


def schreibe_report(ergebnisse: list[dict], n_jobs: int,
                    vorher: dict[str, float], pfad: str = REPORT_PFAD):
    # Top-Lücken: fehlende Skills mit der höchsten Marktnachfrage
    luecken = sorted((e for e in ergebnisse if e["status"] == "luecke"),
                     key=lambda e: e["anteil"], reverse=True)
    top_luecken = [e for e in luecken if e["anteil"] > 0][:5]

    luecken_html = "".join(
        f"<li><b>{e['skill']}</b> – gefordert in {e['anteil']} % "
        f"der Stellen</li>" for e in top_luecken) or \
        "<li>Keine nennenswerten Lücken – stark! 🎉</li>"

    bloecke = []
    for kategorie in SKILL_KATALOG:
        zeilen = []
        eintraege = sorted((e for e in ergebnisse
                            if e["kategorie"] == kategorie),
                           key=lambda e: e["anteil"], reverse=True)
        for e in eintraege:
            farbe, label = STATUS_INFO[e["status"]]
            trend = trend_symbol(e["skill"], e["anteil"], vorher)
            zeilen.append(f"""
            <tr>
              <td style="width:220px">{e['skill']}</td>
              <td style="width:150px;color:{farbe};font-weight:600">
                  {label}</td>
              <td>
                <div style="background:#eee;border-radius:6px;height:18px;
                     position:relative;min-width:200px">
                  <div style="background:{farbe};width:{e['anteil']}%;
                       height:18px;border-radius:6px"></div>
                </div>
              </td>
              <td style="width:140px;white-space:nowrap">
                  {e['anteil']} % ({e['anzahl']}×){trend}</td>
            </tr>""")
        bloecke.append(f"<h2>{kategorie}</h2><table>{''.join(zeilen)}</table>")

    doc = f"""<!doctype html><html lang="de"><head><meta charset="utf-8">
<title>Skill-Gap-Radar – {datetime.now():%d.%m.%Y}</title>
<style>
 body{{font-family:system-ui,sans-serif;margin:2rem;max-width:1000px}}
 table{{border-collapse:collapse;width:100%;margin-bottom:1.5rem}}
 td{{padding:6px 10px;border-bottom:1px solid #eee;vertical-align:middle}}
 h2{{margin-top:2rem;border-bottom:2px solid #f0f0eb;padding-bottom:4px}}
 .box{{background:#FBF3EA;border-left:4px solid #C0392B;padding:12px 18px;
      border-radius:6px;margin:1rem 0}}
</style></head><body>
<h1>Skill-Gap-Radar</h1>
<p>Basis: <b>{n_jobs} Stellenbeschreibungen</b> aus deiner Job-Scout-Datenbank
(Score ≥ {MIN_SCORE}) · Stand {datetime.now():%d.%m.%Y %H:%M}</p>
<div class="box"><b>🎯 Deine Top-Lücken (nach Marktnachfrage):</b>
<ul>{luecken_html}</ul>
<small>Tipp: Statuslisten in skill_radar.py (MEIN_STATUS) aktuell halten –
z. B. Englisch selbst einschätzen und eintragen.</small></div>
{''.join(bloecke)}
<p style="color:#888;font-size:13px">Legende: ✔ vorhanden ·
◐ in Weiterbildung · ✘ Lücke · Trend vs. letztem Radar-Lauf in
Prozentpunkten (Pp.)</p>
</body></html>"""
    with open(pfad, "w", encoding="utf-8") as f:
        f.write(doc)


# ============================================================
# 6. MAIN
# ============================================================


def main():
    jobs = lade_jobs()
    if len(jobs) < 10:
        print(f"Nur {len(jobs)} Stellen mit Beschreibung in der Datenbank "
              f"(Score >= {MIN_SCORE}).")
        print("Lass zuerst job_scout.py ein paar Mal laufen – je mehr "
              "Daten, desto aussagekräftiger das Radar.")
        if not jobs:
            sys.exit(1)

    ergebnisse = analysiere(jobs)
    vorher = speichere_snapshot(ergebnisse)
    schreibe_report(ergebnisse, len(jobs), vorher)

    print(f"Analysiert: {len(jobs)} Stellenbeschreibungen")
    print(f"Report geschrieben: {REPORT_PFAD}\n")
    print("Top-Lücken (Skill fehlt, Markt fordert ihn):")
    luecken = sorted((e for e in ergebnisse
                      if e["status"] == "luecke" and e["anteil"] > 0),
                     key=lambda e: e["anteil"], reverse=True)[:5]
    if luecken:
        for e in luecken:
            print(f"  [{e['anteil']:5.1f} %] {e['skill']}")
    else:
        print("  Keine – Profil deckt die Marktnachfrage ab.")


if __name__ == "__main__":
    main()
