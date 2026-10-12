#!/usr/bin/env python3
"""
JobScout Cockpit – Profil, Lebenslauf-Editor, PDF-Import und PDF-Export.

    profil.json      persönliche Daten (eine Quelle für CV-Editor und Workflows)
    lebenslauf.json  Inhalte des Lebenslaufs (Stationen, Bildung, Skills …)

PDF-Import:  pdftotext (Poppler) extrahiert den Text, Claude Code (claude -p)
             strukturiert ihn als JSON. Ergebnis wird NICHT automatisch
             gespeichert – die UI zeigt es zur Übernahme an.
PDF-Export:  Google Chrome headless druckt die Vorschau als echtes Text-PDF
             (ATS-lesbar) nach bewerbungen/.

Nur Standardbibliothek.
"""

from __future__ import annotations

import base64
import json
import os
import re
import shutil
import subprocess
import tempfile
import unicodedata
from datetime import date
from pathlib import Path

BASIS = Path(__file__).resolve().parent
PROFIL_PFAD = BASIS / "profil.json"
LEBENSLAUF_PFAD = BASIS / "lebenslauf.json"
BEWERBUNGEN_DIR = BASIS / "bewerbungen"
UNTERLAGEN_DIR = BASIS / "unterlagen"
ZERT_DIR = UNTERLAGEN_DIR / "zertifikate"
VORSCHAU_DIR = UNTERLAGEN_DIR / ".vorschau"
NACHWEIS_DIR = UNTERLAGEN_DIR / "nachweise"
UPLOAD_ORDNER = {"zertifikate": ZERT_DIR, "nachweise": NACHWEIS_DIR}
UPLOAD_TYPEN = {b"%PDF": ".pdf", b"\x89PNG": ".png", b"\xff\xd8\xff": ".jpg"}
MAX_PDF_BYTES = 15 * 1024 * 1024

# ============================================================
# 1. DATENMODELL (Vorlage = Standardwerte + erlaubte Struktur)
#    Listen enthalten genau ein Muster-Element für ihre Einträge.
# ============================================================

PROFIL_STANDARD = {
    "persoenlich": {
        "vorname": "", "nachname": "", "titel": "", "geburtsdatum": "",
        "geburtsort": "", "nationalitaet": "", "familienstand": "",
    },
    "kontakt": {
        "email": "", "telefon": "", "strasse": "", "plz": "", "ort": "",
        "land": "Deutschland", "linkedin": "", "xing": "", "website": "",
    },
    "beruf": {
        "wunschrollen": [""], "verfuegbar_ab": "", "kuendigungsfrist": "",
        "gehaltswunsch": "", "arbeitsmodell": "", "reisebereitschaft": "",
        "fuehrerschein": "", "umzugsbereit": "",
    },
    "sprachen": [{"sprache": "", "niveau": ""}],
    "staerken": [""],
    "interessen": [""],
    "kurzprofil": "",
    "motivation": "",
}

LEBENSLAUF_STANDARD = {
    "headline": "",
    "zusammenfassung": "",
    "erfahrung": [{"rolle": "", "firma": "", "ort": "", "start": "",
                   "ende": "", "punkte": [""]}],
    "bildung": [{"abschluss": "", "institution": "", "ort": "", "start": "",
                 "ende": "", "punkte": [""]}],
    "skills": [{"gruppe": "", "eintraege": [""]}],
    "zertifikate": [{"name": "", "aussteller": "", "datum": "", "url": "",
                     "nummer": "", "skills": [""], "datei": "",
                     "vorschau": ""}],
    "projekte": [{"name": "", "beschreibung": ""}],
    "eigene": [{"titel": "", "punkte": [""]}],
    "zielstelle": {"rolle": "", "firma": "", "beschreibung": ""},
    "design": {
        "reihenfolge": ["zusammenfassung", "erfahrung", "bildung", "skills",
                        "sprachen", "zertifikate", "projekte", "eigene"],
        "akzent": "#1f2a44", "schrift": "sans", "eine_seite": True,
        "titel_de": True,
    },
}

ABSCHNITTE = set(LEBENSLAUF_STANDARD["design"]["reihenfolge"])


def _leer_wie(vorlage):
    """Standardwert einer Vorlage (Listen starten leer)."""
    if isinstance(vorlage, dict):
        return {k: _leer_wie(v) for k, v in vorlage.items()}
    if isinstance(vorlage, list):
        return []
    return vorlage


def normalisiere(wert, vorlage, tiefe: int = 0):
    """Bringt beliebige Eingaben in die Form der Vorlage. Unbekannte
    Schlüssel fallen weg, falsche Typen werden zum Standardwert."""
    if tiefe > 6:
        return _leer_wie(vorlage)
    if isinstance(vorlage, dict):
        wert = wert if isinstance(wert, dict) else {}
        return {k: normalisiere(wert.get(k, _leer_wie(v)), v, tiefe + 1)
                for k, v in vorlage.items()}
    if isinstance(vorlage, list):
        if not isinstance(wert, list):
            return []
        muster = vorlage[0]
        out = [normalisiere(x, muster, tiefe + 1) for x in wert[:60]]
        if isinstance(muster, str):
            return [x for x in out if x]
        return [x for x in out if any(_nicht_leer(v) for v in x.values())]
    if isinstance(vorlage, bool):
        return wert if isinstance(wert, bool) else vorlage
    if wert is None:
        return ""
    return str(wert).strip()[:4000]


def _nicht_leer(v) -> bool:
    return bool(v) if not isinstance(v, (dict, list)) else bool(v)


def _lade(pfad: Path, vorlage: dict) -> dict:
    roh = {}
    if pfad.exists():
        try:
            roh = json.loads(pfad.read_text(encoding="utf-8"))
        except ValueError:
            roh = {}
    return normalisiere(roh, vorlage)


def _speichere(pfad: Path, daten: dict):
    tmp = pfad.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(daten, ensure_ascii=False, indent=2) + "\n",
                   encoding="utf-8")
    os.replace(tmp, pfad)


def lade_profil() -> dict:
    return _lade(PROFIL_PFAD, PROFIL_STANDARD)


def lade_lebenslauf() -> dict:
    cv = _lade(LEBENSLAUF_PFAD, LEBENSLAUF_STANDARD)
    rf = [a for a in cv["design"]["reihenfolge"] if a in ABSCHNITTE]
    rf += [a for a in LEBENSLAUF_STANDARD["design"]["reihenfolge"] if a not in rf]
    cv["design"]["reihenfolge"] = rf
    if not re.fullmatch(r"#[0-9a-fA-F]{6}", cv["design"]["akzent"]):
        cv["design"]["akzent"] = LEBENSLAUF_STANDARD["design"]["akzent"]
    return cv


def speichere_profil(daten: dict) -> dict:
    _speichere(PROFIL_PFAD, normalisiere(daten, PROFIL_STANDARD))
    return {"ok": True, "profil": lade_profil()}


def speichere_lebenslauf(daten: dict) -> dict:
    _speichere(LEBENSLAUF_PFAD, normalisiere(daten, LEBENSLAUF_STANDARD))
    return {"ok": True, "lebenslauf": lade_lebenslauf()}


def cv_api() -> dict:
    return {
        "profil": lade_profil(),
        "lebenslauf": lade_lebenslauf(),
        "pdfs": [{k: v for k, v in q.items() if k != "_echt"}
                 for q in pdf_quellen()],
        "chrome": bool(_chrome()),
        "claude": bool(_claude()),
    }


# ============================================================
# 2. PDF-IMPORT
# ============================================================

def pdf_quellen() -> list[dict]:
    """PDFs im Projektordner und in bewerbungen/ – zur Auswahl im Import."""
    out = []
    for ordner in (BASIS, BEWERBUNGEN_DIR):
        if not ordner.exists():
            continue
        for p in sorted(ordner.glob("*.pdf"), key=lambda x: -x.stat().st_mtime):
            rel = unicodedata.normalize("NFC", str(p.relative_to(BASIS)))
            out.append({"pfad": rel, "name": unicodedata.normalize("NFC", p.name),
                        "_echt": p})
    return out


def _werkzeug(name: str, extra: list[str]) -> str | None:
    gefunden = shutil.which(name)
    if gefunden:
        return gefunden
    for p in extra:
        if Path(p).exists():
            return p
    return None


def _pdftotext() -> str | None:
    return _werkzeug("pdftotext", ["/opt/homebrew/bin/pdftotext",
                                   "/usr/local/bin/pdftotext"])


def _claude() -> str | None:
    return _werkzeug("claude", ["/opt/homebrew/bin/claude",
                                "/usr/local/bin/claude",
                                str(Path.home() / ".claude/local/claude"),
                                str(Path.home() / ".local/bin/claude")])


def _chrome() -> str | None:
    for p in ("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
              "/Applications/Chromium.app/Contents/MacOS/Chromium",
              "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
              "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"):
        if Path(p).exists():
            return p
    return None


# Typische Ligatur-/Kodierungsfehler aus PDF-Exporten (Word, Canva …)
_REPARATUR = [
    ("ﬁ", "fi"), ("ﬂ", "fl"), ("ﬀ", "ff"), ("ﬃ", "ffi"), ("ﬄ", "ffl"),
    ("­", ""), ("", "•"), ("•", "•"),
]


def pdf_text(pdf: Path) -> str:
    tool = _pdftotext()
    if not tool:
        raise RuntimeError("pdftotext fehlt – installieren mit: brew install poppler")
    r = subprocess.run([tool, "-layout", "-enc", "UTF-8", str(pdf), "-"],
                       capture_output=True, timeout=60)
    if r.returncode != 0:
        raise RuntimeError("PDF konnte nicht gelesen werden: "
                           + r.stderr.decode("utf-8", "replace").strip()[:300])
    text = r.stdout.decode("utf-8", "replace")
    for alt, neu in _REPARATUR:
        text = text.replace(alt, neu)
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    if len(text) < 40:
        raise RuntimeError("Im PDF steht kaum Text – vermutlich ein Scan/Bild. "
                           "Für ATS brauchst du ein PDF mit echtem Text.")
    return text[:60000]


IMPORT_PROMPT = """Du bekommst den Rohtext eines oder mehrerer Lebenslauf-PDFs
(per pdftotext extrahiert, Layout teils zerschossen). Strukturiere ihn als JSON.

Regeln:
- Erfinde NICHTS. Nur übernehmen, was im Text steht. Fehlendes = "" bzw. [].
- Repariere offensichtliche Extraktionsfehler: kaputte Ligaturen/Umlaute
  (z. B. "KommunikaQonsstärke" -> "Kommunikationsstärke", "Mu^ersprache" ->
  "Muttersprache", "Microso`" -> "Microsoft"), getrennte Wörter, Silbentrennung.
- Die Zeile direkt unter dem Namen ist die berufliche Überschrift: in
  profil.persoenlich.titel UND lebenslauf.headline eintragen. Der
  Profil-/Summary-Text gehört in lebenslauf.zusammenfassung UND profil.kurzprofil.
- Datumsformat MM/JJJJ oder JJJJ; laufende Stationen: ende = "heute".
- Aufzählungspunkte als einzelne Strings in "punkte", ohne Bullet-Zeichen.
- Ausbildung/Studium/Schule/Weiterbildung -> "bildung" (eine IHK-Ausbildung
  darf zusätzlich als Berufserfahrung stehen, wenn sie dort aufgeführt ist).
- "Weitere Stationen" mit mehreren Jobs: wenn möglich in Einzel-Einträge
  aufteilen, sonst als ein Eintrag mit Punkten.
- Skills in sinnvolle Gruppen (z. B. "Vertrieb & Digital", "Tools",
  "Stärken"). Sprachen NICHT in skills, sondern in profil.sprachen.
- Kommen mehrere Dokumente vor (z. B. CV + LinkedIn-Export), führe sie
  zusammen und entferne Dubletten; bei Widersprüchen gilt der Lebenslauf.
- Antworte AUSSCHLIESSLICH mit einem JSON-Objekt, ohne Markdown, ohne Text davor/danach.

Schema:
{SCHEMA}

----- PDF-TEXT -----
{TEXT}
"""


def _schema_beispiel() -> str:
    profil = _kopie(PROFIL_STANDARD)
    cv = {k: v for k, v in _kopie(LEBENSLAUF_STANDARD).items()
          if k not in ("design", "zielstelle")}
    return json.dumps({"profil": profil, "lebenslauf": cv},
                      ensure_ascii=False, indent=1)


def _kopie(x):
    return json.loads(json.dumps(x))


def _json_aus_antwort(text: str) -> dict:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text)
    start, ende = text.find("{"), text.rfind("}")
    if start < 0 or ende <= start:
        raise RuntimeError("Claude hat kein JSON geliefert")
    return json.loads(text[start:ende + 1])


def strukturiere_mit_claude(text: str) -> dict:
    claude = _claude()
    if not claude:
        raise RuntimeError("Claude Code (claude) wurde nicht gefunden")
    prompt = (IMPORT_PROMPT.replace("{SCHEMA}", _schema_beispiel())
              .replace("{TEXT}", text))
    env = dict(os.environ)
    env["PATH"] = "/opt/homebrew/bin:/usr/local/bin:" + env.get("PATH", "")
    with tempfile.TemporaryDirectory() as tmp:   # kein Projekt-Kontext laden
        r = subprocess.run(
            [claude, "-p", "--output-format", "json", "--model", "sonnet"],
            input=prompt.encode("utf-8"), capture_output=True, timeout=300,
            cwd=tmp, env=env)
    roh = r.stdout.decode("utf-8", "replace")
    if r.returncode != 0:
        fehler = (r.stderr.decode("utf-8", "replace") or roh).strip()[:400]
        raise RuntimeError(f"Claude-Aufruf fehlgeschlagen: {fehler}")
    try:
        antwort = json.loads(roh).get("result", "")
    except ValueError:
        antwort = roh
    daten = _json_aus_antwort(antwort)
    return {
        "profil": normalisiere(daten.get("profil"), PROFIL_STANDARD),
        "lebenslauf": normalisiere(daten.get("lebenslauf"), LEBENSLAUF_STANDARD),
    }


def importiere_pdfs(daten: dict) -> dict:
    """daten = {"dateien": [{"name", "b64"}], "pfade": ["CV.pdf", …]}"""
    texte = []
    with tempfile.TemporaryDirectory() as tmp:
        for i, d in enumerate((daten.get("dateien") or [])[:5]):
            try:
                roh = base64.b64decode(d.get("b64") or "", validate=True)
            except ValueError:
                raise ValueError(f"{d.get('name')}: Datei beschädigt")
            if len(roh) > MAX_PDF_BYTES:
                raise ValueError(f"{d.get('name')}: größer als 15 MB")
            if not roh.startswith(b"%PDF"):
                raise ValueError(f"{d.get('name')}: keine PDF-Datei")
            p = Path(tmp) / f"upload_{i}.pdf"
            p.write_bytes(roh)
            texte.append((d.get("name") or p.name, pdf_text(p)))
        erlaubt = {q["pfad"]: q["_echt"] for q in pdf_quellen()}
        for rel in (daten.get("pfade") or [])[:5]:
            rel = unicodedata.normalize("NFC", str(rel))
            if rel not in erlaubt:
                raise ValueError(f"{rel}: nicht erlaubt")
            texte.append((Path(rel).name, pdf_text(erlaubt[rel])))
    if not texte:
        raise ValueError("Keine PDF ausgewählt")
    gesamt = "\n\n".join(f"===== DOKUMENT: {n} =====\n{t}" for n, t in texte)
    ergebnis = strukturiere_mit_claude(gesamt)
    ergebnis["quellen"] = [n for n, _ in texte]
    return ergebnis


# ============================================================
# 3. PDF-EXPORT
# ============================================================

def _dateiname(text: str) -> str:
    t = re.sub(r"[^\w\- ]+", "", text, flags=re.UNICODE).strip()
    return re.sub(r"\s+", "_", t)[:60] or "Lebenslauf"


def exportiere_pdf(daten: dict) -> dict:
    """Druckt das von der UI erzeugte CV-HTML mit Chrome headless als PDF."""
    html = daten.get("html") or ""
    if "<html" not in html[:300].lower() or len(html) > 2_000_000:
        raise ValueError("Ungültiges Lebenslauf-HTML")
    chrome = _chrome()
    if not chrome:
        raise RuntimeError("Kein Chrome gefunden – nutze „Drucken → Als PDF sichern“")
    BEWERBUNGEN_DIR.mkdir(exist_ok=True)
    zusatz = _dateiname(daten.get("zusatz") or "")
    name = f"Lebenslauf_{_dateiname(daten.get('name') or '')}"
    if zusatz:
        name += f"_{zusatz}"
    ziel = BEWERBUNGEN_DIR / f"{name}.pdf"
    zoom = _zoom_aus(html)
    for _ in range(6):
        _drucke(chrome, html, ziel)
        seiten = _seiten(ziel)
        if not daten.get("eine_seite") or seiten <= 1 or zoom <= 0.62:
            break
        zoom = round(zoom * 0.95, 3)
        html = re.sub(r"zoom: [0-9.]+;", f"zoom: {zoom};", html, count=1)
    return {"ok": True, "pfad": str(ziel.relative_to(BASIS)), "seiten": seiten,
            "datum": date.today().isoformat()}


def _zoom_aus(html: str) -> float:
    m = re.search(r"zoom: ([0-9.]+);", html)
    return float(m.group(1)) if m else 1.0


def _seiten(pdf: Path) -> int:
    return max(1, len(re.findall(rb"/Type\s*/Page[^s]", pdf.read_bytes())))


def _drucke(chrome: str, html: str, ziel: Path):
    with tempfile.TemporaryDirectory() as tmp:
        quelle = Path(tmp) / "cv.html"
        quelle.write_text(html, encoding="utf-8")
        if ziel.exists():
            ziel.unlink()
        r = subprocess.run(
            [chrome, "--headless=new", "--disable-gpu", "--no-first-run",
             "--no-default-browser-check", f"--user-data-dir={tmp}/profil",
             "--no-pdf-header-footer", f"--print-to-pdf={ziel}",
             quelle.as_uri()],
            capture_output=True, timeout=90)
    if r.returncode != 0 or not ziel.exists():
        raise RuntimeError("PDF-Export fehlgeschlagen: "
                           + r.stderr.decode("utf-8", "replace").strip()[-300:])


# ============================================================
# 4. UNTERLAGEN: ZERTIFIKAT-DATEIEN
# ============================================================

def _sicherer_name(name: str, endung: str, ordner: Path = ZERT_DIR) -> str:
    stamm = _dateiname(Path(name).stem) or "Dokument"
    ziel = ordner / f"{stamm}{endung}"
    n = 2
    while ziel.exists():
        ziel = ordner / f"{stamm}_{n}{endung}"
        n += 1
    return ziel.name


def _vorschau(datei: Path) -> str:
    """Miniatur (PNG, max. 480 px) – PDF: erste Seite via pdftoppm."""
    VORSCHAU_DIR.mkdir(parents=True, exist_ok=True)
    ziel = VORSCHAU_DIR / f"{datei.stem}.png"
    if datei.suffix == ".pdf":
        tool = _werkzeug("pdftoppm", ["/opt/homebrew/bin/pdftoppm",
                                      "/usr/local/bin/pdftoppm"])
        if not tool:
            return ""
        subprocess.run([tool, "-png", "-f", "1", "-l", "1", "-scale-to", "480",
                        "-singlefile", str(datei), str(ziel.with_suffix(""))],
                       capture_output=True, timeout=60)
    else:
        r = subprocess.run(["sips", "-Z", "480", "-s", "format", "png",
                            str(datei), "--out", str(ziel)],
                           capture_output=True, timeout=60)
        if r.returncode != 0:
            shutil.copyfile(datei, ziel)
    return str(ziel.relative_to(BASIS)) if ziel.exists() else ""


def lade_hoch(daten: dict) -> dict:
    """daten = {"name": "...", "b64": "..."} -> speichert unter
    unterlagen/zertifikate/ und erzeugt eine Miniatur."""
    try:
        roh = base64.b64decode(daten.get("b64") or "", validate=True)
    except ValueError:
        raise ValueError("Datei beschädigt")
    if len(roh) > MAX_PDF_BYTES:
        raise ValueError("Datei größer als 15 MB")
    endung = next((e for sig, e in UPLOAD_TYPEN.items() if roh.startswith(sig)), None)
    if not endung:
        raise ValueError("Nur PDF, PNG oder JPG erlaubt")
    ordner = UPLOAD_ORDNER.get(daten.get("ordner") or "zertifikate", ZERT_DIR)
    ordner.mkdir(parents=True, exist_ok=True)
    ziel = ordner / _sicherer_name(daten.get("name") or "", endung, ordner)
    ziel.write_bytes(roh)
    return {"ok": True, "datei": str(ziel.relative_to(BASIS)),
            "vorschau": _vorschau(ziel)}


def _in_unterlagen(rel: str) -> Path:
    p = (BASIS / unicodedata.normalize("NFC", rel or "")).resolve()
    if UNTERLAGEN_DIR.resolve() not in p.parents or not p.is_file():
        raise ValueError("Datei nicht gefunden")
    return p


def loesche_datei(daten: dict) -> dict:
    for rel in (daten.get("datei"), daten.get("vorschau")):
        if rel:
            try:
                _in_unterlagen(rel).unlink()
            except ValueError:
                pass
    return {"ok": True}


def datei_lesen(rel: str) -> tuple[bytes, str]:
    p = _in_unterlagen(rel)
    typ = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
           ".pdf": "application/pdf"}.get(p.suffix.lower())
    if not typ:
        raise ValueError("Dateityp nicht erlaubt")
    return p.read_bytes(), typ


ZERT_PROMPT = """Lies die Zertifikatsdatei {DATEI} (Bild oder PDF) mit dem Read-Tool.
Extrahiere NUR, was dort steht – nichts erfinden, Unbekanntes = "" bzw. [].
"skills": 3–8 konkrete Fähigkeiten, die das Zertifikat belegt (aus Titel/Inhalt
ableitbar, kurz, deutsch). Datum als MM/JJJJ.
Antworte AUSSCHLIESSLICH mit JSON:
{"name": "", "aussteller": "", "datum": "", "nummer": "", "url": "", "skills": []}
{TEXT}"""


def claude_datei(datei: Path, prompt: str) -> dict:
    """Lässt Claude eine Datei (Bild/PDF) per Read-Tool lesen; JSON-Antwort."""
    claude = _claude()
    if not claude:
        raise RuntimeError("Claude Code (claude) wurde nicht gefunden")
    text = ""
    if datei.suffix == ".pdf":
        try:
            text = "Extrahierter Text (falls hilfreich):\n" + pdf_text(datei)[:12000]
        except RuntimeError:
            text = ""
    prompt = prompt.replace("{DATEI}", str(datei)).replace("{TEXT}", text)
    env = dict(os.environ)
    env["PATH"] = "/opt/homebrew/bin:/usr/local/bin:" + env.get("PATH", "")
    r = subprocess.run(
        [claude, "-p", "--output-format", "json", "--model", "sonnet",
         "--allowedTools", "Read"],
        input=prompt.encode("utf-8"), capture_output=True, timeout=240,
        cwd=str(datei.parent), env=env)
    roh = r.stdout.decode("utf-8", "replace")
    if r.returncode != 0:
        raise RuntimeError("Claude-Aufruf fehlgeschlagen: "
                           + (r.stderr.decode("utf-8", "replace") or roh)[:300])
    try:
        antwort = json.loads(roh).get("result", "")
    except ValueError:
        antwort = roh
    return _json_aus_antwort(antwort)


def zertifikat_auslesen(daten: dict) -> dict:
    datei = _in_unterlagen(daten.get("datei") or "")
    muster = {k: v for k, v in LEBENSLAUF_STANDARD["zertifikate"][0].items()
              if k not in ("datei", "vorschau")}
    return {"ok": True,
            "zertifikat": normalisiere(claude_datei(datei, ZERT_PROMPT), muster)}


# ============================================================
# 5. KONTEXT FÜR CLAUDE-WORKFLOWS
# ============================================================

def workflow_hinweis() -> str:
    """Hängt an Bewerbungs-/Interview-Prompts einen Verweis auf die
    gepflegten Stammdaten an – nur wenn sie existieren."""
    teile = []
    if PROFIL_PFAD.exists():
        teile.append(f"- Persönliche Daten und Rahmenbedingungen: {PROFIL_PFAD}")
    if LEBENSLAUF_PFAD.exists():
        teile.append(f"- Strukturierter Lebenslauf (Stationen, Bildung, Skills, "
                     f"Zertifikate): {LEBENSLAUF_PFAD}")
    if not teile:
        return ""
    return ("\n\n----- MEINE STAMMDATEN (aus dem Cockpit gepflegt) -----\n"
            "Diese Dateien sind die aktuelle, primäre Quelle für Kontaktdaten, "
            "Stationen und Skills. Lies sie vor dem Schreiben. Bei Widerspruch "
            "zu älteren Dokumenten gelten diese Dateien.\n" + "\n".join(teile))
