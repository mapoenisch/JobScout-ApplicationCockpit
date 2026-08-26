#!/usr/bin/env python3
"""
LinkedIn-Brücke für Job Scout.

Der LinkedIn-MCP-Server ist nur innerhalb einer laufenden Claude-Session
aufrufbar, job_scout.py läuft aber auch unabhängig davon (z.B. per
launchd-Zeitplan). Deshalb läuft LinkedIn nie automatisch mit, sondern nur
wenn Claude manuell darum gebeten wird:

    1. Claude ruft mcp__mcp-server-linkedin__search_jobs /
       get_job_details live auf.
    2. Claude reicht die rohen Text-Antworten hier durch parse_job_posting()
       und speichert das Ergebnis mit speichere_treffer() in
       linkedin_treffer.json.
    3. job_scout.py liest diese Datei beim nächsten Lauf ein (Funktion
       lade_linkedin_datei in job_scout.py) und löscht sie danach, damit ein
       späterer, rein automatischer Lauf keine veralteten LinkedIn-Daten
       nochmal verwendet.

Das MCP-Tool liefert keine sauberen Einzelfelder, sondern rohen,
gescrapten Seitentext. parse_job_posting() extrahiert daraus die Felder,
die job_scout.py für ein Job-Objekt braucht.
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

TREFFER_PFAD = "linkedin_treffer.json"

_ZEIT_PATTERN = re.compile(
    r"Vor (\d+) (Tag|Tage|Woche|Wochen|Monat|Monate|Stunde|Stunden)")


def _extrahiere_datum(zeitangabe: str, heute: datetime | None = None) -> str:
    """Wandelt LinkedIns relative Zeitangaben ('Vor 2 Wochen') in ein
    ISO-Datum um, damit der Frische-Bonus im Scoring greift."""
    heute = heute or datetime.now(timezone.utc)
    m = _ZEIT_PATTERN.search(zeitangabe)
    if not m:
        return ""
    n = int(m.group(1))
    einheit = m.group(2)
    if einheit.startswith("Tag"):
        delta = timedelta(days=n)
    elif einheit.startswith("Woche"):
        delta = timedelta(weeks=n)
    elif einheit.startswith("Monat"):
        delta = timedelta(days=n * 30)
    else:
        delta = timedelta(hours=n)
    return (heute - delta).date().isoformat()


def parse_job_posting(text: str, job_id: str) -> dict:
    """Extrahiert Titel/Firma/Ort/Datum/Remote/Beschreibung aus dem rohen
    'job_posting'-Textblock, den get_job_details liefert.

    Aufbau des LinkedIn-Texts (durch Leerzeilen getrennte Blöcke):
    Firma / Titel / "Ort · Vor N Wochen ... · N Bewerber:innen" / ... /
    eine Zeile "Remote"/"Hybrid"/"Vor Ort" / ... / "Details zum
    Jobangebot" / Beschreibung / "… mehr" / Footer-Statistiken.
    """
    bloecke = [b.strip() for b in text.split("\n\n") if b.strip()]
    firma = bloecke[0] if bloecke else "unbekannt"
    titel = bloecke[1] if len(bloecke) > 1 else ""

    ort = ""
    veroeffentlicht = ""
    for b in bloecke[2:6]:
        erste_zeile = b.splitlines()[0]
        if " · " in erste_zeile:
            teile = erste_zeile.split(" · ")
            ort = teile[0].strip()
            for teil in teile[1:]:
                datum = _extrahiere_datum(teil)
                if datum:
                    veroeffentlicht = datum
            break

    remote = bool(re.search(r"(?m)^Remote$", text))
    hybrid = bool(re.search(r"(?m)^Hybrid$", text))

    beschreibung = ""
    start = text.find("Details zum Jobangebot")
    if start != -1:
        rest = text[start + len("Details zum Jobangebot"):]
        ende = rest.find("… mehr")
        if ende == -1:
            ende = rest.find("Anforderungen, die Jobinserent")
        if ende == -1:
            ende = rest.find("Benachrichtigung für ähnliche")
        beschreibung = rest[:ende if ende != -1 else None].strip()

    return {
        "titel": titel,
        "firma": firma,
        "ort": ort,
        "veroeffentlicht": veroeffentlicht,
        "remote": remote or hybrid,
        "beschreibung": beschreibung[:3000],
        "url": f"https://www.linkedin.com/jobs/view/{job_id}/",
        "quelle": "LinkedIn",
    }


def speichere_treffer(eintraege: list[dict], pfad: str = TREFFER_PFAD) -> int:
    """Schreibt normalisierte LinkedIn-Treffer als JSON-Liste, die
    job_scout.py beim nächsten Lauf automatisch mit einliest."""
    Path(pfad).write_text(
        json.dumps(eintraege, ensure_ascii=False, indent=2), encoding="utf-8")
    return len(eintraege)
