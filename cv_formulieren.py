#!/usr/bin/env python3
"""
JobScout Cockpit – Editor-Ebene „CV neu formulieren“.

Führt den Skill skills/lebenslauf-cockpit (Kopie von lebenslauf-stellenanpassung)
im Cockpit aus: Aus Feldern oder einem optionalen CV-Entwurf plus Stellenanzeige
entsteht ein bewerbungsfertiger Lebenslauf, gerendert mit derselben render_cv.py.

Was Claude nicht entscheidet, sondern dieses Modul erzwingt:
    - Persönliche Daten kommen nur aus dem Profil.
    - „Wörtlich“ markierte Einträge bleiben buchstabengetreu.
    - Keine Station geht verloren.
    - Nur beantwortete Rückfragen werden zu Fakten (Antwort R<n>).

Daten: formulieren/<id>/ (entwurf.json, lebenslauf.json, keywords.txt,
faktenregister.md, pruefbericht.md, PDF). Nur Standardbibliothek.
"""

from __future__ import annotations

import base64
import importlib.util
import json
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import unicodedata
import uuid
from datetime import date, datetime
from pathlib import Path

import analyse
import cv_editor as cv

ORDNER = cv.BASIS / "formulieren"
SKILL_DIR = cv.BASIS / "skills" / "lebenslauf-cockpit"
RENDERER = SKILL_DIR / "scripts" / "render_cv.py"
MAX_RUNDEN = 5
MAX_FRAGEN = 4
_lock = threading.Lock()

ENTWURF_FORM = {
    "stelle": {"text": "", "url": "", "firma": "", "position": ""},
    "eingabe": {
        "stationen": [{"id": "", "titel": "", "unternehmen": "", "ort": "", "von": "",
                       "bis": "", "notizen": "", "woertlich": False}],
        "ausbildung": [{"id": "", "titel": "", "institut": "", "ort": "", "von": "",
                        "bis": "", "notizen": "", "woertlich": False}],
        "it": "", "zertifikate": "", "sprachen": "", "kenntnisse_woertlich": False,
        "extras_titel": "",
        "extras": [{"id": "", "titel": "", "von": "", "bis": "", "notizen": "",
                    "woertlich": False}],
    },
    "persoenlich": {"geburtsdatum": False, "familienstand": False, "nationalitaet": False,
                    "verfuegbar_ab": True, "kinderbetreuung": False},
    "kurzprofil_zeilen": [{"schlagwort": "", "fakt": ""}],
}

FRAGE_FORM = {"id": "", "header": "", "frage": "", "mehrfach": False, "platzhalter": "",
              "optionen": [{"label": "", "beschreibung": "", "zaehlt": True, "freitext": False}]}
RUNDE_FORM = {
    "eckdaten": {"position": "", "unternehmen": "", "ort_modell": "", "branche": "",
                 "rollentyp": "", "umfeld": "", "bewerbungsweg": ""},
    "muss_kann": [{"anforderung": "", "art": "", "signalwort": "", "eignung": "", "beleg": ""}],
    "top3": [""], "keywords": [""], "diagnose": [""],
    "fragen": [FRAGE_FORM], "fertig": False,
}
EINTRAG_FORM = {"quelle_id": "", "von": "", "bis": "", "titel": "", "unternehmen": "",
                "institut": "", "ort": "", "zeilen": [""], "punkte": [""],
                "beendigungsgrund": "",
                "unter": [{"von": "", "bis": "", "titel": "", "zeilen": [""], "punkte": [""]}]}
CV_FORM = {
    "berufserfahrung": [EINTRAG_FORM], "weitere_stationen": [EINTRAG_FORM],
    "ausbildung": [EINTRAG_FORM],
    "zusatzqualifikationen": {"it": [""], "zertifikate": [""], "sprachen": [""],
                              "fuehrerschein": ""},
    "kernkompetenzen": [""], "interessen_titel": "", "interessen": [EINTRAG_FORM],
}
FORMULIER_FORM = {"cv": CV_FORM, "aenderungen": [""],
                  "wirkung": [{"station": "", "vorher": "", "jetzt": "", "quelle": ""}]}
PRUEF_FORM = {"verstoesse": [{"zeile": "", "grund": "", "neu": ""}], "bericht": ""}
VORSCHLAG_POSTEN = {"label": "", "aussage": "", "beleg": "", "quelle": ""}
VORSCHLAEGE_FORM = {"faehigkeiten": [VORSCHLAG_POSTEN], "erfolge": [VORSCHLAG_POSTEN],
                    "besonderheiten": [VORSCHLAG_POSTEN],
                    "unbelegt": [{"aussage": "", "fundstelle": "", "frage": ""}]}
STICHPUNKTE_FORM = {"unbelegt": [{"aussage": "", "fundstelle": "", "frage": ""}]}
KP_TEXT_FORM = {"zeilen": [{"schlagwort": "", "fakt": "", "quelle": ""}], "verworfen": [""],
                "fehlend": ""}


# ============================================================
# 1. ABLAGE
# ============================================================

def _ordner(eid: str) -> Path:
    if not re.fullmatch(r"[0-9a-f]{10}", str(eid or "")):
        raise ValueError("Entwurf nicht gefunden")
    return ORDNER / eid


def _lade(eid: str) -> dict:
    pfad = _ordner(eid) / "entwurf.json"
    if not pfad.exists():
        raise ValueError("Entwurf nicht gefunden")
    return json.loads(pfad.read_text(encoding="utf-8"))


def _schreibe(e: dict):
    e["geaendert"] = datetime.now().strftime("%Y-%m-%d %H:%M")
    ordner = _ordner(e["id"])
    ordner.mkdir(parents=True, exist_ok=True)
    tmp = ordner / "entwurf.json.tmp"
    tmp.write_text(json.dumps(e, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    tmp.replace(ordner / "entwurf.json")


def _aendere(eid: str, fn) -> dict:
    """Lesen, ändern, schreiben als Einheit – Claude-Aufrufe laufen außerhalb."""
    with _lock:
        e = _lade(eid)
        fn(e)
        _schreibe(e)
        return e


def _neue_id() -> str:
    return uuid.uuid4().hex[:10]


def _vergib_ids(eingabe: dict):
    for liste in ("stationen", "ausbildung", "extras"):
        for x in eingabe[liste]:
            x["id"] = x["id"] or _neue_id()


def _info(e: dict) -> dict:
    s = e["stelle"]
    return {"id": e["id"], "modus": e["modus"], "firma": s["firma"], "position": s["position"],
            "geaendert": e.get("geaendert", ""), "fertig": bool(e.get("cv")),
            "pdf": e.get("pdf_pfad", "")}


def uebersicht() -> dict:
    eintraege = []
    if ORDNER.exists():
        for p in ORDNER.glob("*/entwurf.json"):
            try:
                eintraege.append(_info(json.loads(p.read_text(encoding="utf-8"))))
            except (ValueError, KeyError):
                continue
    eintraege.sort(key=lambda x: x["geaendert"], reverse=True)
    return {"entwuerfe": eintraege, "claude": bool(cv._claude()), "chrome": bool(cv._chrome())}


def entwurf_lesen(eid: str) -> dict:
    return {"entwurf": _lade(eid)}


def anlegen(daten: dict) -> dict:
    modus = daten.get("modus")
    if modus not in ("umformulieren", "neu"):
        raise ValueError("Unbekannter Modus")
    e = {"id": _neue_id(), "modus": modus, "erstellt": date.today().isoformat(),
         **cv.normalisiere({}, ENTWURF_FORM),
         "analyse": None, "fragen": [], "antworten": [], "runden": 0, "fragen_fertig": False,
         "kurzprofil": {"status": "offen", "stichpunkte": "", "vorschlaege": None, "auswahl": [],
                        "belegfragen": [], "verworfen": [], "fehlend": ""},
         "cv": None, "bericht": "", "aenderungen": [], "wirkung": [], "warnungen": [],
         "foto": "", "unterschrift": "", "pdf_pfad": ""}
    e["persoenlich"]["verfuegbar_ab"] = True
    with _lock:
        _schreibe(e)
    return {"ok": True, "entwurf": e}


def speichern(daten: dict) -> dict:
    """Automatisches Speichern der Felder; das Ergebnis nur, wenn es mitkommt."""
    teile = cv.normalisiere(daten, ENTWURF_FORM)
    if isinstance(daten.get("stelle"), dict):   # Anzeigen sind länger als normale Felder
        teile["stelle"]["text"] = str(daten["stelle"].get("text") or "").strip()[:analyse.MAX_STELLEN_TEXT]

    def anwenden(e):
        for k in ("stelle", "eingabe", "persoenlich", "kurzprofil_zeilen"):
            if k in daten:
                e[k] = teile[k]
        _vergib_ids(e["eingabe"])
        if isinstance(daten.get("cv"), dict) and e.get("cv"):
            e["cv"] = _setze_feste_daten(cv.normalisiere(daten["cv"], CV_FORM), e)
    e = _aendere(daten.get("id"), anwenden)
    return {"ok": True, "eingabe": e["eingabe"]}


def loeschen(daten: dict) -> dict:
    ordner = _ordner(daten.get("id"))
    with _lock:
        shutil.rmtree(ordner, ignore_errors=True)
    return {"ok": True}


# ============================================================
# 2. EINGABEN VORFÜLLEN
# ============================================================

def _zeilen(text: str) -> list[str]:
    return [z for z in (re.sub(r"^[\s•●▪◦*\-–]+", "", x).strip()
                        for x in (text or "").splitlines()) if z]


def _eingabe_aus_lebenslauf(c: dict, sprachen: list[dict]) -> dict:
    stationen = [{"id": _neue_id(), "titel": x["rolle"], "unternehmen": x["firma"], "ort": x["ort"],
                  "von": x["start"], "bis": x["ende"], "notizen": "\n".join(x["punkte"]),
                  "woertlich": False} for x in c["erfahrung"]]
    bildung = [{"id": _neue_id(), "titel": x["abschluss"], "institut": x["institution"], "ort": x["ort"],
                "von": x["start"], "bis": x["ende"], "notizen": "\n".join(x["punkte"]),
                "woertlich": False} for x in c["bildung"]]
    it = [f"{g['gruppe']}: {', '.join(g['eintraege'])}" if g["gruppe"] else ", ".join(g["eintraege"])
          for g in c["skills"]]
    zert = [", ".join(t for t in (z["name"], z["aussteller"], z["datum"]) if t) for z in c["zertifikate"]]
    extras = [{"id": _neue_id(), "titel": x["name"], "von": "", "bis": "", "notizen": x["beschreibung"],
               "woertlich": False} for x in c["projekte"]]
    extras += [{"id": _neue_id(), "titel": x["titel"], "von": "", "bis": "",
                "notizen": "\n".join(x["punkte"]), "woertlich": False} for x in c["eigene"]]
    return {"stationen": stationen, "ausbildung": bildung, "it": "\n".join(it),
            "zertifikate": "\n".join(zert),
            "sprachen": "\n".join(f"{s['sprache']}: {s['niveau']}".rstrip(": ") for s in sprachen),
            "kenntnisse_woertlich": False, "extras_titel": "", "extras": extras}


def importieren(daten: dict) -> dict:
    """Entwurf aus Datei(en) oder aus dem ATS-Editor. Profil und ATS-Editor bleiben unberührt."""
    if daten.get("aus_editor"):
        neu = _eingabe_aus_lebenslauf(cv.lade_lebenslauf(), cv.lade_profil()["sprachen"])
    else:
        r = cv.importiere_pdfs({"dateien": daten.get("dateien") or []})
        neu = _eingabe_aus_lebenslauf(r["lebenslauf"], r["profil"]["sprachen"])
    e = _aendere(daten.get("id"), lambda x: x.update(eingabe=neu))
    return {"ok": True, "entwurf": e}


def stelle_laden(daten: dict) -> dict:
    """Stellenanzeige aus URL oder Datei in das Textfeld holen."""
    url = (daten.get("url") or "").strip()
    if url:
        text = analyse._text_von_url(url)
        if len(text) < 200:
            raise ValueError("Die Seite ließ sich nicht auslesen. Bitte den Anzeigentext einfügen.")
    else:
        try:
            roh = base64.b64decode(daten.get("b64") or "", validate=True)
        except ValueError:
            raise ValueError("Datei beschädigt")
        if not roh or len(roh) > cv.MAX_PDF_BYTES:
            raise ValueError("Datei fehlt oder ist größer als 15 MB")
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "stelle.pdf"
            p.write_bytes(cv.als_pdf_bytes(roh, daten.get("name") or "Datei"))
            text = cv.pdf_text(p)

    def anwenden(e):
        e["stelle"]["text"] = text[:analyse.MAX_STELLEN_TEXT]
        e["stelle"]["url"] = url
    return {"ok": True, "entwurf": _aendere(daten.get("id"), anwenden)}


def bild_hochladen(daten: dict) -> dict:
    art = daten.get("art")
    if art not in ("foto", "unterschrift"):
        raise ValueError("Unbekannte Bildart")
    try:
        roh = base64.b64decode(daten.get("b64") or "", validate=True)
    except ValueError:
        raise ValueError("Datei beschädigt")
    endung = {b"\x89PNG": ".png", b"\xff\xd8\xff": ".jpg"}.get(roh[:4]) or {
        b"\xff\xd8\xff": ".jpg"}.get(roh[:3])
    if not endung:
        raise ValueError("Bitte ein PNG oder JPG wählen")
    if len(roh) > cv.MAX_PDF_BYTES:
        raise ValueError("Datei größer als 15 MB")
    eid = daten.get("id")
    ziel = _ordner(eid) / f"{art}{endung}"
    ziel.write_bytes(roh)
    return {"ok": True, "entwurf": _aendere(eid, lambda e: e.update({art: str(ziel)}))}


# ============================================================
# 3. PROMPTS UND CLAUDE
# ============================================================

def _frage(prompt: str, timeout: int = 420) -> dict:
    return analyse._frage_claude(prompt, timeout=timeout)


def _skill_text(*dateien: str) -> str:
    teile = [(SKILL_DIR / "COCKPIT.md").read_text(encoding="utf-8"), "\n\n",
             (SKILL_DIR / "SKILL.md").read_text(encoding="utf-8")]
    teile += [f"\n\n===== {d} =====\n" + (SKILL_DIR / d).read_text(encoding="utf-8") for d in dateien]
    return "".join(teile)


def _gefuellt(eingabe: dict) -> dict:
    """Eingabe ohne frisch angelegte, leere Einträge."""
    g = dict(eingabe)
    for k in ("stationen", "ausbildung", "extras"):
        g[k] = [x for x in eingabe[k]
                if any(v for f, v in x.items() if f not in ("id", "woertlich"))]
    return g


def _daten(e: dict) -> str:
    """Alles, was der Anwender angegeben hat – ohne Kontaktdaten."""
    p = cv.lade_profil()
    return json.dumps({
        "eingabe": _gefuellt(e["eingabe"]),
        "antworten": [{"quelle": a["quelle"], "frage": a["frage"], "antwort": a["antwort"]}
                      for a in e["antworten"]],
        "nicht_beantwortet_nicht_erneut_fragen": e.get("nicht_beantwortet", []),
        "aus_profil": {"wunschrollen": p["beruf"]["wunschrollen"], "sprachen": p["sprachen"],
                       "fuehrerschein": p["beruf"]["fuehrerschein"], "staerken": p["staerken"],
                       "interessen": p["interessen"], "motivation": p["motivation"]},
    }, ensure_ascii=False, indent=1)


def _kontext(e: dict) -> str:
    return (f"{analyse.DATEN_HINWEIS}\nHeutiges Datum: {date.today().strftime('%d.%m.%Y')}\n\n"
            f"<<<DATEN STELLENANZEIGE\n{e['stelle']['text']}\n>>>\n\n"
            f"<<<DATEN ANGABEN DES ANWENDERS\n{_daten(e)}\n>>>")


RUNDE_PROMPT = """Du führst den folgenden Skill im JobScout-Cockpit aus.

{SKILL}

----- AUFGABE -----
Führe Phase 2 (Stellenanzeige analysieren), Phase 3 (CV-Diagnose) und Phase 4 (fehlende
Informationen erfragen) aus. Dies ist Fragerunde {RUNDE} von höchstens {MAX}.
Frage nur echte Lücken, die weder in den Angaben noch in bisherigen Antworten stehen.
Was der Anwender schon offen gelassen hat ("nicht_beantwortet_nicht_erneut_fragen"), gilt als
Lücke: nicht noch einmal fragen, auch nicht anders formuliert.
Persönliche Daten, Foto, Unterschrift und das Kurzprofil NICHT erfragen.
Höchstens {MAXF} Fragen in dieser Runde, je Frage 2–4 Optionen nach dem Fragenkatalog.
Jede Frage muss für sich verständlich sein. Keine Zahl als Antwort vorgeben.
Option mit eigener Angabe: "freitext": true. Option wie „Nein“, „Keine Zahl“ oder „Nicht
angeben“: "zaehlt": false. Sind keine Fragen mehr nötig: "fragen": [] und "fertig": true.

{KONTEXT}

Antworte AUSSCHLIESSLICH mit JSON:
{FORM}"""

STICHPUNKTE_PROMPT = """Du prüfst Stichpunkte für ein Kurzprofil gegen das Faktenregister.

Quelle sind nur die Angaben und Antworten des Anwenders, nie die Stellenanzeige.
Melde jede Aussage aus den Stichpunkten, die weder durch konkrete Angaben noch durch die
Stichpunkte selbst belegt ist (z. B. „kommunikationsstark“ ohne Beispiel). Eine konkrete
Tätigkeit, ein Tool oder eine Zahl des Anwenders gilt als belegt. Formuliere je Aussage eine
Belegfrage: wo, wie oft, wie viele, mit welchem Ergebnis. Keine Zahl vorgeben.

<<<DATEN STICHPUNKTE
{STICHPUNKTE}
>>>

{KONTEXT}

Antworte AUSSCHLIESSLICH mit JSON:
{FORM}"""

VORSCHLAG_PROMPT = """Du führst Schritt K3 und K4 aus Phase 4b dieses Skills aus.

{SKILL}

----- AUFGABE -----
Schlage dem Anwender Inhalte für sein Kurzprofil vor, passend zur Stellenanzeige:
- "faehigkeiten", "erfolge", "besonderheiten": je höchstens 4, nur mit Beleg aus den Angaben
  (quelle "Eingabe") oder Antworten (quelle "Antwort R<n>"). "beleg" nennt die Fundstelle.
- "unbelegt": Für jede Kategorie ohne belegten Vorschlag eine unbewiesene Fähigkeit, einen
  Erfolg oder eine Besonderheit mit "fundstelle" und einer gezielten "frage" nach dem Beleg.
  Kandidaten: Selbstzuschreibungen, Tätigkeiten ohne Ergebnis, Anforderungen der Anzeige.
  Die Anzeige liefert nur die Frage, nie den Fakt. Keine Zahl vorgeben.

{KONTEXT}

Antworte AUSSCHLIESSLICH mit JSON:
{FORM}"""

KP_TEXT_PROMPT = """Du agierst als kompromissloser Lektor und Executive Recruiter und schreibst
das Kurzprofil strikt nach den verbindlichen Schreibregeln. Inhalte stammen nur aus den Angaben,
Antworten und der Auswahl des Anwenders. Nichts erfinden, nichts auffüllen.

{REGELN}

<<<DATEN AUSWAHL UND STICHPUNKTE
{AUSWAHL}
>>>

{KONTEXT}
{FEHLER}
"quelle" je Zeile: "Eingabe" oder "Antwort R<n>". Gibt es keine 3 belegten Zeilen: nur die
belegten liefern und in "fehlend" nennen, welche Belege fehlen. Verworfene Aussagen in "verworfen".
Antworte AUSSCHLIESSLICH mit JSON:
{FORM}"""

FORMULIER_PROMPT = """Du führst Phase 5 des folgenden Skills im JobScout-Cockpit aus.

{SKILL}

----- AUFGABE -----
Baue aus den Angaben den fertigen Lebenslauf für genau diese Stelle.
Lose Stichpunkte und unsortierte Tätigkeiten in "notizen" werden zu bewerbungsfertigen Bullets
nach Tätigkeits- und Wirkungsformel. Neue Fakten sind verboten.
- Jeder Eintrag aus "stationen", "ausbildung" und "extras" trägt seine id als "quelle_id".
- Ein neuer Block für eine laufende Weiterbildung oder Neuorientierung hat leere "quelle_id".
- Alle Stationen bleiben im CV. Ältere ohne Bezug kommen einzeilig in "weitere_stationen".
- Einträge mit "woertlich": true nicht umformulieren; das Cockpit setzt sie danach selbst ein.
- Stehen "kenntnisse_woertlich": true, übernimm IT, Zertifikate und Sprachen zeilenweise.
- Datumsangaben im Format MM/JJJJ bzw. „heute“. Unbekannte Monate nicht ergänzen.
- Persönliche Daten, Kurzprofil, Ort/Datum und Unterschrift setzt das Cockpit. Nicht ausgeben.
- "aenderungen": 5–10 Punkte, was gegenüber den Angaben geändert wurde.
- "wirkung": Tabelle für den Prüfbericht.
{FEHLER}

Analyse aus den vorigen Phasen:
{ANALYSE}

{KONTEXT}

Antworte AUSSCHLIESSLICH mit JSON:
{FORM}"""

PRUEF_PROMPT = """Du führst den Faktencheck aus Phase 6 und den Prüfbericht aus Phase 7 des
folgenden Skills aus.

{SKILL}

----- AUFGABE -----
1. Prüfe jede Zeile des fertigen Lebenslaufs gegen die Angaben und Antworten. Die Stellenanzeige
   ist keine Quelle. Einträge mit "woertlich": true gelten als belegt.
   Prüfe auch Kurzprofil, Kernkompetenzen und Kenntnisse. Unbelegte Aussagen in "verstoesse":
   "zeile" zeichengenau der ganze Listeneintrag bzw. beim Kurzprofil das Feld "fakt", "grund",
   "neu" mit der belegten Fassung oder "" zum Streichen. Keine Geschmacksfragen melden.
   Im Bericht nur Korrekturen nennen, die in "verstoesse" stehen.
2. Schreibe "bericht" als Markdown mit den 8 Abschnitten aus Phase 7, kurz und scanbar.
   Abschnitt Kurzprofil: Tabelle Zeile | Quelle, verworfene Aussagen, sonst nur der Status.
   Liegt „Verfügbar ab“ nicht auf dem 1. oder 15., weise darauf hin.

Status Kurzprofil: {KP_STATUS}; verworfen: {KP_VERWORFEN}; fehlend: {KP_FEHLEND}
Renderer: {RENDER}
Analyse: {ANALYSE}
Änderungen: {AENDERUNGEN}
Wirkung: {WIRKUNG}

<<<DATEN FERTIGER LEBENSLAUF
{CV}
>>>

{KONTEXT}

Antworte AUSSCHLIESSLICH mit JSON:
{FORM}"""


def _json(x) -> str:
    return json.dumps(x, ensure_ascii=False, indent=1)


def _voraussetzungen(e: dict):
    if len(e["stelle"]["text"].strip()) < 80:
        raise ValueError("Bitte zuerst die Stellenanzeige eintragen (Schritt „Stelle“)")
    g = _gefuellt(e["eingabe"])
    if not g["stationen"] and not g["ausbildung"]:
        raise ValueError("Bitte mindestens eine Station oder Ausbildung eintragen")


# ============================================================
# 4. PHASEN 2–4: ANALYSE UND RÜCKFRAGEN
# ============================================================

def _fragerunde(e: dict) -> dict:
    prompt = (RUNDE_PROMPT.replace("{SKILL}", _skill_text("references/best-practices-modul4.md",
                                                          "references/formulierungen.md",
                                                          "references/fragenkatalog.md"))
              .replace("{RUNDE}", str(e["runden"] + 1)).replace("{MAX}", str(MAX_RUNDEN))
              .replace("{MAXF}", str(MAX_FRAGEN)).replace("{FORM}", _json(RUNDE_FORM))
              .replace("{KONTEXT}", _kontext(e)))
    r = cv.normalisiere(_frage(prompt), RUNDE_FORM)
    fragen = []
    for f in r["fragen"][:MAX_FRAGEN]:
        if not f["frage"]:
            continue
        f["id"] = _neue_id()
        if not f["optionen"]:
            f["optionen"] = [{"label": "Antworten", "beschreibung": "", "zaehlt": True, "freitext": True},
                             {"label": "Nicht angeben", "beschreibung": "", "zaehlt": False, "freitext": False}]
        fragen.append(f)
    r["fragen"] = fragen
    return r


def _uebernimm_runde(e: dict, r: dict):
    e["analyse"] = {k: r[k] for k in ("eckdaten", "muss_kann", "top3", "keywords", "diagnose")}
    if not e["stelle"]["firma"]:
        e["stelle"]["firma"] = r["eckdaten"]["unternehmen"]
    if not e["stelle"]["position"]:
        e["stelle"]["position"] = r["eckdaten"]["position"]
    e["fragen"] = r["fragen"]
    e["runden"] += 1
    e["fragen_fertig"] = not r["fragen"] or r["fertig"]
    if e["fragen_fertig"]:
        e["fragen"] = []


def analysieren(daten: dict) -> dict:
    e = _lade(daten.get("id"))
    _voraussetzungen(e)
    e["runden"] = 0   # neue Analyse, bisherige Antworten bleiben als Fakten erhalten
    r = _fragerunde(e)

    def anwenden(x):
        x["runden"] = 0
        _uebernimm_runde(x, r)
    return {"ok": True, "entwurf": _aendere(e["id"], anwenden)}


def _antwort_text(frage: dict, antwort: dict) -> str | None:
    """Text der Antwort oder None, wenn sie nicht als Fakt zählt."""
    wahl = [str(x) for x in (antwort.get("wahl") or [])]
    frei = str(antwort.get("text") or "").strip()[:2000]
    optionen = {o["label"]: o for o in frage["optionen"]}
    gewaehlt = [optionen[w] for w in wahl if w in optionen]
    if not gewaehlt:
        return frei or None
    zaehlen = [o for o in gewaehlt if o["zaehlt"]]
    if not zaehlen:
        return frei or None
    # Option verspricht eigene Angabe, die fehlt -> nicht beantwortet
    if any(o["freitext"] for o in zaehlen) and not frei:
        rest = [o for o in zaehlen if not o["freitext"]]
        if not rest:
            return None
        zaehlen = rest
    teile = [o["label"] + (f" ({o['beschreibung']})" if o["beschreibung"] else "")
             for o in zaehlen if not o["freitext"]]
    if frei:
        teile.append(frei)
    return "; ".join(teile)


def _werte_aus(fragen: list[dict], antworten: list[dict], nummer: int) -> tuple[list[dict], list[dict]]:
    nach_id = {a.get("id"): a for a in antworten if isinstance(a, dict)}
    fakten, offen = [], []
    for f in fragen:
        text = _antwort_text(f, nach_id.get(f["id"], {}))
        if text:
            fakten.append({"quelle": f"Antwort R{nummer}", "frage": f["frage"], "antwort": text})
        else:
            offen.append(f)
    return fakten, offen


def _naechste_nummer(e: dict) -> int:
    return e.get("antwort_nummer", 0) + 1


def antworten(daten: dict) -> dict:
    eid = daten.get("id")
    e = _lade(eid)
    if not e["fragen"]:
        raise ValueError("Es sind keine Fragen offen")
    nummer = _naechste_nummer(e)
    fakten, offen = _werte_aus(e["fragen"], daten.get("antworten") or [], nummer)

    def merken(x):
        x["antworten"].extend(fakten)
        x["antwort_nummer"] = nummer
        x["nicht_beantwortet"] = x.get("nicht_beantwortet", []) + [f["frage"] for f in offen]
        x["fragen"] = []
    e = _aendere(eid, merken)
    if e["runden"] >= MAX_RUNDEN:
        return {"ok": True, "entwurf": _aendere(eid, lambda x: x.update(fragen_fertig=True))}
    r = _fragerunde(e)
    return {"ok": True, "entwurf": _aendere(eid, lambda x: _uebernimm_runde(x, r))}


def fragen_beenden(daten: dict) -> dict:
    def anwenden(x):
        x["nicht_beantwortet"] = x.get("nicht_beantwortet", []) + [f["frage"] for f in x["fragen"]]
        x["fragen"] = []
        x["fragen_fertig"] = True
    return {"ok": True, "entwurf": _aendere(daten.get("id"), anwenden)}


# ============================================================
# 5. PHASE 4b: KURZPROFIL
# ============================================================

def _renderer_modul():
    spec = importlib.util.spec_from_file_location("render_cv_cockpit", RENDERER)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def pruefe_kurzprofil(zeilen: list[dict]) -> list[str]:
    return _renderer_modul().pruefe_kurzprofil({"kurzprofil": zeilen})


def _belegfrage(u: dict) -> dict:
    return {"id": _neue_id(), "header": "Beleg", "mehrfach": False, "aussage": u["aussage"],
            "platzhalter": "Wo, wie oft, wie viele, mit welchem Ergebnis?",
            "frage": u["frage"] or f"Woran lässt sich „{u['aussage']}“ zeigen?",
            "fundstelle": u["fundstelle"],
            "optionen": [{"label": "Beleg nennen", "beschreibung": "Größenordnung reicht", "zaehlt": True, "freitext": True},
                         {"label": "Streichen", "beschreibung": "Kommt nicht ins Kurzprofil", "zaehlt": False, "freitext": False}]}


def kp_status(daten: dict) -> dict:
    status = daten.get("status")
    if status not in ("ja", "nein", "spaeter"):
        raise ValueError("Unbekannter Status")

    def anwenden(e):
        if not e["fragen_fertig"]:
            raise ValueError("Bitte zuerst die Rückfragen abschließen")
        e["kurzprofil"]["status"] = status
        if status != "ja":
            e["kurzprofil_zeilen"] = []
            _setze_kurzprofil_im_cv(e)
    return {"ok": True, "entwurf": _aendere(daten.get("id"), anwenden)}


def kp_stichpunkte(daten: dict) -> dict:
    eid, text = daten.get("id"), (daten.get("text") or "").strip()[:4000]
    if not text:
        raise ValueError("Bitte Stichpunkte eintragen oder Vorschläge anfordern")
    e = _lade(eid)
    nummer = _naechste_nummer(e)
    fakt = {"quelle": f"Antwort R{nummer}", "frage": "Was soll im Kurzprofil stehen?", "antwort": text}

    def merken(x):
        x["antworten"].append(fakt)
        x["antwort_nummer"] = nummer
        x["kurzprofil"]["stichpunkte"] = text
    e = _aendere(eid, merken)
    prompt = (STICHPUNKTE_PROMPT.replace("{STICHPUNKTE}", text).replace("{FORM}", _json(STICHPUNKTE_FORM))
              .replace("{KONTEXT}", _kontext(e)))
    r = cv.normalisiere(_frage(prompt), STICHPUNKTE_FORM)
    fragen = [_belegfrage(u) for u in r["unbelegt"] if u["aussage"]]
    return {"ok": True, "entwurf": _aendere(eid, lambda x: x["kurzprofil"].update(belegfragen=fragen))}


def kp_vorschlaege(daten: dict) -> dict:
    eid = daten.get("id")
    e = _lade(eid)
    prompt = (VORSCHLAG_PROMPT.replace("{SKILL}", _skill_text("references/formulierungen.md",
                                                              "references/fragenkatalog.md"))
              .replace("{FORM}", _json(VORSCHLAEGE_FORM)).replace("{KONTEXT}", _kontext(e)))
    r = cv.normalisiere(_frage(prompt), VORSCHLAEGE_FORM)
    vorschlaege = {k: [x for x in r[k] if x["aussage"]][:4]
                   for k in ("faehigkeiten", "erfolge", "besonderheiten")}
    fragen = [_belegfrage(u) for u in r["unbelegt"] if u["aussage"]]

    def anwenden(x):
        x["kurzprofil"].update(vorschlaege=vorschlaege, belegfragen=fragen, auswahl=[])
    return {"ok": True, "entwurf": _aendere(eid, anwenden)}


def kp_belege(daten: dict) -> dict:
    """Auswahl aus K3 und Antworten aus K4 merken; danach schreibt kp_schreiben den Text."""
    eid = daten.get("id")
    e = _lade(eid)
    fragen = e["kurzprofil"]["belegfragen"]
    nummer = _naechste_nummer(e)
    fakten, offen = _werte_aus(fragen, daten.get("antworten") or [], nummer)
    erlaubt = {x["aussage"]: x for v in (e["kurzprofil"]["vorschlaege"] or {}).values() for x in v}
    auswahl = [erlaubt[a] for a in (daten.get("auswahl") or []) if a in erlaubt]
    eigene = (daten.get("eigene") or "").strip()[:2000]
    if eigene:
        fakten.append({"quelle": f"Antwort R{nummer}", "frage": "Eigene Ergänzung zum Kurzprofil",
                       "antwort": eigene})

    def anwenden(x):
        x["antworten"].extend(fakten)
        if fragen or eigene:
            x["antwort_nummer"] = nummer
        kp = x["kurzprofil"]
        kp["belegfragen"] = []
        kp["auswahl"] = auswahl
        kp["verworfen"] = kp["verworfen"] + [f.get("aussage") or f["frage"] for f in offen]
    return {"ok": True, "entwurf": _aendere(eid, anwenden)}


def kp_schreiben(daten: dict) -> dict:
    eid = daten.get("id")
    e = _lade(eid)
    kp = e["kurzprofil"]
    regeln = (SKILL_DIR / "references/formulierungen.md").read_text(encoding="utf-8")
    regeln = regeln[regeln.index("## Kurzprofil – verbindliche Schreibregeln"):]
    auswahl = _json({"stichpunkte": kp["stichpunkte"], "auswahl": kp["auswahl"],
                     "verworfen_nicht_verwenden": kp["verworfen"]})
    fehler = ""
    r = None
    for _ in range(2):   # bei Regelverstoß genau einmal nachbessern lassen
        prompt = (KP_TEXT_PROMPT.replace("{REGELN}", regeln).replace("{AUSWAHL}", auswahl)
                  .replace("{KONTEXT}", _kontext(e)).replace("{FEHLER}", fehler)
                  .replace("{FORM}", _json(KP_TEXT_FORM)))
        r = cv.normalisiere(_frage(prompt), KP_TEXT_FORM)
        zeilen = [{"schlagwort": z["schlagwort"], "fakt": z["fakt"]} for z in r["zeilen"]]
        verstoesse = pruefe_kurzprofil(zeilen) if len(zeilen) >= 3 else []
        if not verstoesse:
            break
        fehler = "\nDer vorige Versuch verstieß gegen die Regeln. Behebe das:\n- " + "\n- ".join(verstoesse) + "\n"

    def anwenden(x):
        bisher = x["kurzprofil"]["verworfen"]
        x["kurzprofil"]["verworfen"] = bisher + [v for v in r["verworfen"]
                                                 if not any(v.startswith(b) for b in bisher)]
        x["kurzprofil"]["fehlend"] = r["fehlend"]
        x["kurzprofil"]["quellen"] = [{"zeile": f"{z['schlagwort']} – {z['fakt']}", "quelle": z["quelle"]}
                                      for z in r["zeilen"]]
        if len(zeilen) < 3:
            # unter 3 belegten Zeilen wird nichts aufgefüllt
            x["kurzprofil"]["status"] = "spaeter"
            x["kurzprofil_zeilen"] = []
        else:
            x["kurzprofil_zeilen"] = zeilen[:4]
        _setze_kurzprofil_im_cv(x)
    return {"ok": True, "entwurf": _aendere(eid, anwenden)}


# ============================================================
# 6. PHASE 5–7: LEBENSLAUF BAUEN, RENDERN, PRÜFEN
# ============================================================

def _person(e: dict) -> dict:
    p = cv.lade_profil()
    k, pe, b, w = p["kontakt"], p["persoenlich"], p["beruf"], e["persoenlich"]
    ort = " ".join(x for x in (k["plz"], k["ort"]) if x)
    person = {"name": " ".join(x for x in (pe["vorname"], pe["nachname"]) if x),
              "adresse": ", ".join(x for x in (k["strasse"], ort) if x),
              "telefon": k["telefon"], "email": k["email"], "linkedin": k["linkedin"]}
    if w["geburtsdatum"]:
        person["geburtsdatum"] = pe["geburtsdatum"]
    if w["familienstand"]:
        person["familienstand"] = pe["familienstand"]
    if w["nationalitaet"]:
        person["nationalitaet"] = pe["nationalitaet"]
    if w["verfuegbar_ab"]:
        person["verfuegbar_ab"] = b["verfuegbar_ab"]
    if w["kinderbetreuung"]:
        person["kinderbetreuung"] = "gesichert"
    if e.get("foto"):
        person["foto"] = e["foto"]
    return person


def _setze_kurzprofil_im_cv(e: dict):
    if e.get("cv"):
        e["cv"]["kurzprofil"] = e["kurzprofil_zeilen"]


def _setze_feste_daten(c: dict, e: dict) -> dict:
    """Was nie von Claude oder aus dem Browser kommt."""
    c = dict(c)
    p = cv.lade_profil()
    c["person"] = _person(e)
    c["kurzprofil"] = e["kurzprofil_zeilen"]
    c["abschluss"] = {"ort": p["kontakt"]["ort"], "datum": date.today().strftime("%d.%m.%Y"),
                      "unterschrift": e.get("unterschrift", "")}
    c["dateizusatz"] = e["stelle"]["firma"]
    if not c["zusatzqualifikationen"]["fuehrerschein"]:
        c["zusatzqualifikationen"]["fuehrerschein"] = p["beruf"]["fuehrerschein"]
    return c


def _rohfassung(e: dict) -> dict:
    """Vorschau vor dem Formulieren: die Felder, genau wie eingetragen."""
    g = _gefuellt(e["eingabe"])

    def eintrag(x):
        return {**x, "quelle_id": x["id"], "punkte": _zeilen(x["notizen"])}
    c = cv.normalisiere({
        "berufserfahrung": [eintrag(x) for x in g["stationen"]],
        "ausbildung": [eintrag(x) for x in g["ausbildung"]],
        "interessen": [eintrag(x) for x in g["extras"]],
        "interessen_titel": g["extras_titel"],
        "zusatzqualifikationen": {"it": _zeilen(g["it"]), "zertifikate": _zeilen(g["zertifikate"]),
                                  "sprachen": _zeilen(g["sprachen"])},
    }, CV_FORM)
    return _setze_feste_daten(c, e)


def _setze_woertlich(c: dict, e: dict) -> list[str]:
    """Wörtliche Einträge setzen und fehlende Einträge ergänzen. Gibt Hinweise zurück."""
    hinweise = []
    gruppen = (("stationen", ("berufserfahrung", "weitere_stationen"), "berufserfahrung", "unternehmen"),
               ("ausbildung", ("ausbildung",), "ausbildung", "institut"),
               ("extras", ("interessen",), "interessen", ""))
    g = _gefuellt(e["eingabe"])
    for quelle, ziele, standard, firma_feld in gruppen:
        for x in g[quelle]:
            treffer = next((t for z in ziele for t in c[z] if t.get("quelle_id") == x["id"]), None)
            if treffer is None:
                treffer = cv.normalisiere({"quelle_id": x["id"]}, EINTRAG_FORM)
                treffer.update(von=x["von"], bis=x["bis"], titel=x["titel"], ort=x.get("ort", ""),
                               punkte=_zeilen(x["notizen"]))
                if firma_feld:
                    treffer[firma_feld] = x[firma_feld]
                c[standard].append(treffer)
                hinweise.append(f"„{x['titel'] or x['id']}“ fehlte in der Formulierung und wurde wie eingetragen ergänzt.")
            elif x["woertlich"]:
                treffer.update(von=x["von"], bis=x["bis"], titel=x["titel"], ort=x.get("ort", ""),
                               punkte=_zeilen(x["notizen"]), zeilen=[], unter=[])
                if firma_feld:
                    treffer[firma_feld] = x[firma_feld]
    if e["eingabe"]["kenntnisse_woertlich"]:
        z = c["zusatzqualifikationen"]
        for k in ("it", "zertifikate", "sprachen"):
            z[k] = _zeilen(e["eingabe"][k])
    return hinweise


def _render(c: dict, ziel: Path, keywords: list[str] | None = None) -> dict:
    if not cv._chrome():
        raise RuntimeError("Für das PDF wird Google Chrome gebraucht")
    ziel.mkdir(parents=True, exist_ok=True)
    jpfad = ziel / "lebenslauf.json"
    jpfad.write_text(json.dumps(c, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    befehl = [sys.executable, str(RENDERER), str(jpfad), "--out", str(ziel)]
    if keywords:
        kpfad = ziel / "keywords.txt"
        kpfad.write_text("\n".join(keywords) + "\n", encoding="utf-8")
        befehl += ["--keywords", str(kpfad)]
    r = subprocess.run(befehl, capture_output=True, timeout=240)
    if r.returncode != 0:
        raise RuntimeError("Rendern fehlgeschlagen: " + r.stderr.decode("utf-8", "replace")[-300:])
    return json.loads(r.stdout.decode("utf-8"))


def _alle_punkte(c: dict):
    for teil in ("berufserfahrung", "weitere_stationen", "ausbildung", "interessen"):
        for x in c.get(teil) or []:
            for u in [x, *(x.get("unter") or [])]:
                yield x, u


def _zahlen_warnungen(c: dict, e: dict) -> list[str]:
    """Zahlen im CV, die in keiner Angabe vorkommen – Hinweis, keine Änderung."""
    quelle = _daten(e) + json.dumps(e["kurzprofil"]["stichpunkte"], ensure_ascii=False)
    bekannt = set(re.findall(r"\d+(?:[.,]\d+)?", quelle))
    texte = [p for _, u in _alle_punkte(c) for p in u.get("punkte") or []]
    texte += [z["fakt"] for z in c.get("kurzprofil") or []]
    return [f"Zahl {n} in „{t}“ steht nicht in deinen Angaben – nur rechnerisch abgeleitet oder prüfen."
            for t in texte for n in re.findall(r"\d+(?:[.,]\d+)?", t) if n not in bekannt]


def _faktenregister(e: dict, c: dict) -> str:
    zeilen = ["# Faktenregister", "", f"Stelle: {e['stelle']['position']}, {e['stelle']['firma']}", "",
              "## Persönliche Daten (Quelle: Profil)", ""]
    zeilen += [f"- {k}: {v}" for k, v in c["person"].items() if v and k not in ("foto",)]
    g = _gefuellt(e["eingabe"])
    for titel, liste in (("Stationen", g["stationen"]), ("Ausbildung", g["ausbildung"]),
                         ("Extras", g["extras"])):
        zeilen += ["", f"## {titel} (Quelle: Eingabe)", ""]
        for x in liste:
            kopf = ", ".join(t for t in (x.get("titel"), x.get("unternehmen") or x.get("institut"), x.get("ort")) if t)
            zeilen.append(f"- {kopf} ({x['von']} – {x['bis']})" + (" [wörtlich]" if x["woertlich"] else ""))
            zeilen += [f"  - {z}" for z in _zeilen(x["notizen"])]
    zeilen += ["", "## Antworten", ""]
    zeilen += [f"- {a['quelle']}: {a['frage']} → {a['antwort']}" for a in e["antworten"]] or ["- keine"]
    if e.get("nicht_beantwortet"):
        zeilen += ["", "## Nicht beantwortet", ""] + [f"- {f}" for f in e["nicht_beantwortet"]]
    status = e["kurzprofil"]["status"]
    zeilen += ["", f"## Kurzprofil: {'später' if status == 'spaeter' else status}", ""]
    zeilen += [f"- {q['zeile']} (Quelle: {q['quelle']})" for q in e["kurzprofil"].get("quellen", [])]
    return "\n".join(zeilen) + "\n"


def formulieren(daten: dict) -> dict:
    eid = daten.get("id")
    e = _lade(eid)
    _voraussetzungen(e)
    if not e["fragen_fertig"]:
        raise ValueError("Bitte zuerst die Rückfragen beantworten oder beenden")
    if e["kurzprofil"]["status"] == "offen":
        raise ValueError("Bitte zuerst im Schritt „Kurzprofil“ entscheiden")
    keywords = (e["analyse"] or {}).get("keywords") or []
    fehler, c, r, render, hinweise = "", None, None, None, []
    for _ in range(2):
        prompt = (FORMULIER_PROMPT.replace("{SKILL}", _skill_text("references/best-practices-modul4.md",
                                                                  "references/formulierungen.md"))
                  .replace("{FEHLER}", fehler).replace("{ANALYSE}", _json(e["analyse"]))
                  .replace("{FORM}", _json(FORMULIER_FORM)).replace("{KONTEXT}", _kontext(e)))
        r = cv.normalisiere(_frage(prompt), FORMULIER_FORM)
        c = r["cv"]
        hinweise = _setze_woertlich(c, e)
        c = _setze_feste_daten(c, e)
        render = _render(c, _ordner(eid) / "ausgabe", keywords)
        probleme = [w for w in render["warnungen"] if "Weiterbildung" in w or "Ausbildungsteil" in w]
        if render["seiten"] > 2:
            probleme.append(f"Der Lebenslauf hat {render['seiten']} Seiten, Ziel sind 2. Kürze nach der Reihenfolge aus Phase 5, Punkt 7.")
        if not probleme:
            break
        fehler = "\nDer vorige Versuch hatte diese Probleme, behebe sie:\n- " + "\n- ".join(probleme)

    def anwenden(x):
        x.update(cv=c, aenderungen=r["aenderungen"], wirkung=r["wirkung"], bericht="",
                 warnungen=render["warnungen"] + hinweise + _zahlen_warnungen(c, x),
                 keywords_ergebnis=render.get("keywords"), seiten=render["seiten"], hinweise=hinweise)
    return {"ok": True, "entwurf": _aendere(eid, anwenden)}


def _ersetze_zeile(c: dict, e: dict, v: dict) -> bool:
    woertliche = {x["id"] for g in ("stationen", "ausbildung", "extras")
                  for x in e["eingabe"][g] if x["woertlich"]}
    for z in list(e["kurzprofil_zeilen"]):
        ganz = f"{z['schlagwort']} – {z['fakt']}"
        if v["zeile"] in (z["fakt"], ganz):
            if v["neu"]:
                z["fakt"] = v["neu"].removeprefix(f"{z['schlagwort']} – ")
            else:
                e["kurzprofil_zeilen"].remove(z)
            c["kurzprofil"] = e["kurzprofil_zeilen"]
            return True
    listen = [u.get(feld) or [] for kopf, u in _alle_punkte(c)
              if kopf.get("quelle_id") not in woertliche for feld in ("punkte", "zeilen")]
    listen.append(c.get("kernkompetenzen") or [])
    if not e["eingabe"]["kenntnisse_woertlich"]:
        listen += [c["zusatzqualifikationen"].get(k) or [] for k in ("it", "zertifikate", "sprachen")]
    for liste in listen:
        if v["zeile"] in liste:
            i = liste.index(v["zeile"])
            if v["neu"]:
                liste[i] = v["neu"]
            else:
                liste.pop(i)
            return True
    return False


def pruefen(daten: dict) -> dict:
    """Phase 6/7: Faktencheck korrigieren, neu rendern, Prüfbericht und Register schreiben."""
    eid = daten.get("id")
    e = _lade(eid)
    if not e.get("cv"):
        raise ValueError("Es gibt noch keinen formulierten Lebenslauf")
    kp = e["kurzprofil"]
    prompt = (PRUEF_PROMPT.replace("{SKILL}", _skill_text("references/best-practices-modul4.md"))
              .replace("{KP_STATUS}", kp["status"]).replace("{KP_VERWORFEN}", _json(kp["verworfen"]))
              .replace("{KP_FEHLEND}", kp["fehlend"]).replace("{RENDER}", _json(e.get("warnungen")))
              .replace("{ANALYSE}", _json(e["analyse"])).replace("{AENDERUNGEN}", _json(e["aenderungen"]))
              .replace("{WIRKUNG}", _json(e["wirkung"])).replace("{CV}", _json(e["cv"]))
              .replace("{FORM}", _json(PRUEF_FORM)).replace("{KONTEXT}", _kontext(e)))
    roh = _frage(prompt)
    r = cv.normalisiere(roh, PRUEF_FORM)
    r["bericht"] = str(roh.get("bericht") or "")[:40000]   # länger als normale Felder
    c = e["cv"]
    korrigiert, offen = [], []
    for v in r["verstoesse"]:
        (korrigiert if v["zeile"] and _ersetze_zeile(c, e, v) else offen).append(v)
    hinweise = [f"Faktencheck, bitte selbst prüfen: „{v['zeile']}“ ({v['grund']})" for v in offen]
    if len(e["kurzprofil_zeilen"]) < 3 and e["kurzprofil"]["status"] == "ja" and korrigiert:
        hinweise.append("Das Kurzprofil hat nach dem Faktencheck weniger als 3 belegte Zeilen.")
    keywords = (e["analyse"] or {}).get("keywords") or []
    render = _render(c, _ordner(eid) / "ausgabe", keywords)
    ordner = _ordner(eid)
    (ordner / "pruefbericht.md").write_text(r["bericht"] + "\n", encoding="utf-8")
    (ordner / "faktenregister.md").write_text(_faktenregister(e, c), encoding="utf-8")

    def anwenden(x):
        x["kurzprofil_zeilen"] = e["kurzprofil_zeilen"]
        x["hinweise"] = x.get("hinweise", []) + hinweise
        x.update(cv=c, bericht=r["bericht"], faktencheck=korrigiert, seiten=render["seiten"],
                 keywords_ergebnis=render.get("keywords"),
                 warnungen=render["warnungen"] + x["hinweise"] + _zahlen_warnungen(c, x))
    return {"ok": True, "entwurf": _aendere(eid, anwenden)}


def vorschau(daten: dict) -> dict:
    """PDF für die Vorschau: das Ergebnis oder, davor, die Felder wie eingetragen."""
    e = _lade(daten.get("id"))
    c = _setze_feste_daten(e["cv"], e) if e.get("cv") else _rohfassung(e)
    keywords = (e["analyse"] or {}).get("keywords") or None
    with tempfile.TemporaryDirectory() as tmp:
        r = _render(c, Path(tmp), keywords)
        pdf = Path(r["pdf"]).read_bytes()
    return {"ok": True, "pdf": base64.b64encode(pdf).decode(), "seiten": r["seiten"],
            "warnungen": r["warnungen"] + e.get("hinweise", []) + _zahlen_warnungen(c, e),
            "keywords": r.get("keywords"),
            "art": "formuliert" if e.get("cv") else "roh"}


def pdf_speichern(daten: dict) -> dict:
    """Rendert das Ergebnis und legt es unter bewerbungen/ ab, ohne Fremdes zu überschreiben."""
    eid = daten.get("id")
    e = _lade(eid)
    if not e.get("cv"):
        raise ValueError("Es gibt noch keinen formulierten Lebenslauf")
    c = _setze_feste_daten(e["cv"], e)
    if not c["person"]["name"]:
        raise ValueError("Bitte zuerst im Profil deinen Namen eintragen")
    r = _render(c, _ordner(eid) / "ausgabe", (e["analyse"] or {}).get("keywords") or None)
    quelle = Path(r["pdf"])
    cv.BEWERBUNGEN_DIR.mkdir(exist_ok=True)
    bisher = e.get("pdf_pfad") and cv.BASIS / e["pdf_pfad"]
    ziel = cv.BEWERBUNGEN_DIR / unicodedata.normalize("NFC", quelle.name)
    n = 2
    while ziel.exists() and ziel != bisher:
        ziel = cv.BEWERBUNGEN_DIR / f"{quelle.stem}_{n}.pdf"
        n += 1
    shutil.copyfile(quelle, ziel)
    rel = str(ziel.relative_to(cv.BASIS))
    _aendere(eid, lambda x: x.update(pdf_pfad=rel))
    return {"ok": True, "pfad": rel, "seiten": r["seiten"], "warnungen": r["warnungen"]}


AKTIONEN = {
    "anlegen": anlegen, "speichern": speichern, "loeschen": loeschen,
    "importieren": importieren, "stelle": stelle_laden, "bild": bild_hochladen,
    "analysieren": analysieren, "antworten": antworten, "fragen_beenden": fragen_beenden,
    "kp_status": kp_status, "kp_stichpunkte": kp_stichpunkte, "kp_vorschlaege": kp_vorschlaege,
    "kp_belege": kp_belege, "kp_schreiben": kp_schreiben,
    "formulieren": formulieren, "pruefen": pruefen, "vorschau": vorschau, "pdf": pdf_speichern,
}


def aktion(name: str, daten: dict) -> dict:
    fn = AKTIONEN.get(name)
    if not fn:
        raise ValueError("Unbekannte Aktion")
    return fn(daten)
