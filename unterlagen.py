#!/usr/bin/env python3
"""
JobScout Cockpit – Zeugnisse & Nachweise sowie Bewerbungsmappe.

    nachweise.json   Arbeitszeugnisse, Abschlusszeugnisse, Referenzen …
                     (Dateien in unterlagen/nachweise/)
Bewerbungsmappe:     Deckblatt + ausgewählte Dokumente als EIN PDF nach
                     bewerbungen/Bewerbungsmappe_<Firma>.pdf
                     PDF bleibt PDF, Bilder und DOCX werden umgewandelt
                     (DOCX: Microsoft Word, sonst textutil + Chrome),
                     zusammengeführt mit pdfunite (Poppler).
"""

from __future__ import annotations

import html as htmlmod
import json
import shutil
import subprocess
import tempfile
import unicodedata
from datetime import date
from pathlib import Path

import cv_editor as cv

NACHWEISE_PFAD = cv.BASIS / "nachweise.json"

# ============================================================
# 1. ZEUGNISSE & NACHWEISE
# ============================================================

NACHWEIS_TYPEN = ["Arbeitszeugnis", "Abschlusszeugnis", "Schulzeugnis",
                  "Weiterbildungsnachweis", "Referenz", "Bewerbungsfoto",
                  "Arbeitsprobe", "Sonstiges"]

NACHWEIS_STANDARD = [{
    "typ": "", "titel": "", "aussteller": "", "datum": "", "note": "",
    "notiz": "", "auswertung": "", "kontakt_name": "", "kontakt_position": "",
    "kontakt_email": "", "kontakt_telefon": "", "datei": "", "vorschau": "",
}]


def lade_nachweise() -> list:
    roh = []
    if NACHWEISE_PFAD.exists():
        try:
            roh = json.loads(NACHWEISE_PFAD.read_text(encoding="utf-8"))
        except ValueError:
            roh = []
    return cv.normalisiere(roh, NACHWEIS_STANDARD)


def speichere_nachweise(daten: dict) -> dict:
    cv._speichere(NACHWEISE_PFAD,
                  cv.normalisiere(daten.get("nachweise"), NACHWEIS_STANDARD))
    return {"ok": True}


NACHWEIS_PROMPT = """Lies die Datei {DATEI} (Bild oder PDF) mit dem Read-Tool.
Dokumenttyp laut Nutzer: {TYP}. Erfinde nichts; Unbekanntes = "".

Liefere:
- "titel": kurzer Titel, z. B. "Arbeitszeugnis OBI Jena" oder "IHK-Abschlusszeugnis"
- "aussteller": Firma, Schule oder Institution
- "datum": Ausstellungsdatum als MM/JJJJ
- "note": bei Arbeitszeugnissen die entschlüsselte Gesamtnote ("sehr gut (1)",
  "gut (2)" …), bei Schul-/Abschlusszeugnissen die Gesamtnote, sonst ""
- "auswertung": 3–8 kurze Zeilen, jede beginnt mit "- ". Bei Arbeitszeugnissen:
  Zeugnissprache entschlüsseln (Leistung, Verhalten, Schlussformel mit Dank,
  Bedauern, Zukunftswünschen), versteckte negative Codes oder fehlende
  Standardbausteine klar benennen, Stärken für Bewerbungen nennen.
  Sonst: Kerninhalt und was davon für Vertriebsbewerbungen nützlich ist.
Antworte AUSSCHLIESSLICH mit JSON:
{"titel": "", "aussteller": "", "datum": "", "note": "", "auswertung": ""}
{TEXT}"""


def nachweis_auswerten(daten: dict) -> dict:
    datei = cv._in_unterlagen(daten.get("datei") or "")
    typ = str(daten.get("typ") or "unbekannt")[:40]
    erg = cv.claude_datei(datei, NACHWEIS_PROMPT.replace("{TYP}", typ))
    if isinstance(erg.get("auswertung"), list):
        erg["auswertung"] = "\n".join(f"- {x}" for x in erg["auswertung"])
    muster = {"titel": "", "aussteller": "", "datum": "", "note": "",
              "auswertung": ""}
    return {"ok": True, "nachweis": cv.normalisiere(erg, muster)}


# ============================================================
# 2. BEWERBUNGSMAPPE
# ============================================================

ENDUNGEN = (".pdf", ".png", ".jpg", ".jpeg", ".docx")


def _erlaubt() -> dict:
    """NFC-Pfad -> echte Datei für alles, was in eine Mappe darf."""
    dateien = []
    for ordner in (cv.BEWERBUNGEN_DIR, cv.UNTERLAGEN_DIR):
        if ordner.exists():
            dateien += [p for p in ordner.rglob("*")
                        if p.is_file() and ".vorschau" not in p.parts
                        and not p.name.startswith((".", "~$", "Bewerbungsmappe_"))
                        and p.suffix.lower() in ENDUNGEN]
    dateien += list(cv.BASIS.glob("*.pdf")) + list(cv.BASIS.glob("*.docx"))
    return {unicodedata.normalize("NFC", str(p.relative_to(cv.BASIS))): p
            for p in dateien}


def mappe_quellen() -> list[dict]:
    out = []
    for rel, p in sorted(_erlaubt().items(), key=lambda x: x[0].lower()):
        st = p.stat()
        out.append({"pfad": rel, "name": unicodedata.normalize("NFC", p.name),
                    "groesse": st.st_size,
                    "geaendert": date.fromtimestamp(st.st_mtime).isoformat()})
    return out


def _html_zu_pdf(html: str, ziel: Path):
    chrome = cv._chrome()
    if not chrome:
        raise RuntimeError("Für die Mappe wird Google Chrome gebraucht")
    cv._drucke(chrome, html, ziel)


def _bild_zu_pdf(bild: Path, ziel: Path):
    _html_zu_pdf(
        '<!doctype html><html><head><meta charset="utf-8"><style>'
        "@page { size: A4; margin: 0; } html, body { margin: 0; }"
        ".s { width: 210mm; height: 296mm; display: flex; align-items: center;"
        " justify-content: center; padding: 12mm; box-sizing: border-box; }"
        "img { max-width: 100%; max-height: 100%; object-fit: contain; }"
        f'</style></head><body><div class="s"><img src="{bild.resolve().as_uri()}">'
        "</div></body></html>", ziel)


WORD_SKRIPT = """on run argv
  tell application "Microsoft Word"
    set dok to open file name (POSIX file (item 1 of argv) as text) with read only
    save as dok file name (POSIX file (item 2 of argv) as text) file format format PDF
    close dok saving no
  end tell
end run"""


def _docx_zu_pdf(docx: Path, ziel: Path):
    """Erst Microsoft Word (originalgetreu), sonst textutil + Chrome."""
    if Path("/Applications/Microsoft Word.app").exists():
        try:
            subprocess.run(["osascript", "-e", WORD_SKRIPT, str(docx), str(ziel)],
                           capture_output=True, timeout=90)
        except subprocess.TimeoutExpired:
            pass
        if ziel.exists() and ziel.stat().st_size > 500:
            return
    r = subprocess.run(["textutil", "-convert", "html", "-stdout", str(docx)],
                       capture_output=True, timeout=60)
    if r.returncode != 0:
        raise RuntimeError(f"{docx.name} konnte nicht umgewandelt werden")
    html = r.stdout.decode("utf-8", "replace").replace(
        "</head>", "<style>@page { size: A4; margin: 20mm 22mm; } body { "
        "font-family: Helvetica, Arial, sans-serif; font-size: 10.5pt; }"
        "</style></head>", 1)
    _html_zu_pdf(html, ziel)


def _deckblatt(daten: dict, inhalt: list[str]) -> str:
    e = htmlmod.escape
    p = cv.lade_profil()
    k = p["kontakt"]
    name = " ".join(x for x in (p["persoenlich"]["vorname"],
                                p["persoenlich"]["nachname"]) if x)
    ort = " ".join(x for x in (k["plz"], k["ort"]) if x)
    zeilen = [x for x in (", ".join(y for y in (k["strasse"], ort) if y),
                          k["telefon"], k["email"], k["linkedin"]) if x]
    akzent = cv.lade_lebenslauf()["design"]["akzent"]
    rolle = e(daten.get("rolle") or "") or "Bewerbungsunterlagen"
    firma = e(daten.get("firma") or "")
    return f"""<!doctype html><html lang="de"><head><meta charset="utf-8"><style>
@page {{ size: A4; margin: 0; }} html, body {{ margin: 0; }}
body {{ font-family: Helvetica, Arial, sans-serif; color: #1d2130; }}
.s {{ width: 210mm; height: 296mm; padding: 40mm 25mm 25mm; box-sizing: border-box; display: flex; flex-direction: column; }}
.bar {{ width: 22mm; height: 3px; background: {akzent}; margin-bottom: 14mm; }}
.k {{ font-size: 11pt; letter-spacing: .18em; text-transform: uppercase; color: {akzent}; font-weight: 700; }}
h1 {{ font-size: 28pt; margin: 6mm 0 3mm; line-height: 1.15; }}
.f {{ font-size: 14pt; color: #4a4f63; }}
h2 {{ font-size: 10pt; letter-spacing: .12em; text-transform: uppercase; color: {akzent}; margin: 22mm 0 4mm; }}
ol {{ margin: 0; padding-left: 5mm; font-size: 11pt; line-height: 1.8; }}
.n {{ margin-top: auto; font-size: 11pt; line-height: 1.6; }}
.n b {{ font-size: 15pt; display: block; margin-bottom: 2mm; }}
</style></head><body><div class="s">
<div class="bar"></div><div class="k">Bewerbung</div>
<h1>{rolle}</h1>{f'<div class="f">bei {firma}</div>' if firma else ''}
<h2>Inhalt</h2><ol>{"".join(f"<li>{e(x)}</li>" for x in inhalt)}</ol>
<div class="n"><b>{e(name)}</b>{"<br>".join(e(z) for z in zeilen)}</div>
</div></body></html>"""


def baue_mappe(daten: dict) -> dict:
    """daten = {firma, rolle, deckblatt, cv_html,
    teile: [{art: "datei", pfad, titel} | {art: "cv", titel}]}"""
    unite = cv._werkzeug("pdfunite", ["/opt/homebrew/bin/pdfunite",
                                      "/usr/local/bin/pdfunite"])
    if not unite:
        raise RuntimeError("pdfunite fehlt – installieren mit: brew install poppler")
    teile = (daten.get("teile") or [])[:40]
    if not teile:
        raise ValueError("Bitte mindestens ein Dokument auswählen")
    erlaubt = _erlaubt()
    cv.BEWERBUNGEN_DIR.mkdir(exist_ok=True)
    zusatz = cv._dateiname(daten.get("firma") or "") or date.today().isoformat()
    ausgabe = cv.BEWERBUNGEN_DIR / f"Bewerbungsmappe_{zusatz}.pdf"
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        pdfs, inhalt = [], []
        for i, t in enumerate(teile):
            ziel = tmp / f"{i:02d}.pdf"
            titel = str(t.get("titel") or "").strip()[:120]
            if t.get("art") == "cv":
                html = daten.get("cv_html") or ""
                if "<html" not in html[:300].lower():
                    raise ValueError("Lebenslauf aus dem Editor fehlt")
                _html_zu_pdf(html, ziel)
                titel = titel or "Lebenslauf"
            else:
                rel = unicodedata.normalize("NFC", str(t.get("pfad") or ""))
                quelle = erlaubt.get(rel)
                if not quelle:
                    raise ValueError(f"{rel}: nicht gefunden oder nicht erlaubt")
                endung = quelle.suffix.lower()
                if endung == ".pdf":
                    shutil.copyfile(quelle, ziel)
                elif endung == ".docx":
                    _docx_zu_pdf(quelle, ziel)
                else:
                    _bild_zu_pdf(quelle, ziel)
                titel = titel or quelle.stem.replace("_", " ")
            pdfs.append(ziel)
            inhalt.append(titel)
        if daten.get("deckblatt", True):
            deck = tmp / "deckblatt.pdf"
            _html_zu_pdf(_deckblatt(daten, inhalt), deck)
            pdfs.insert(0, deck)
        if len(pdfs) == 1:
            shutil.copyfile(pdfs[0], ausgabe)
        else:
            r = subprocess.run([unite, *map(str, pdfs), str(ausgabe)],
                               capture_output=True, timeout=120)
            if r.returncode != 0:
                raise RuntimeError("Zusammenführen fehlgeschlagen: "
                                   + r.stderr.decode("utf-8", "replace")[:300])
    groesse = ausgabe.stat().st_size
    return {"ok": True, "pfad": str(ausgabe.relative_to(cv.BASIS)),
            "seiten": cv._seiten(ausgabe), "groesse": groesse,
            "warnung": "Größer als 5 MB – viele Bewerbungsportale lehnen das ab."
                       if groesse > 5 * 1024 * 1024 else ""}


def unterlagen_api() -> dict:
    return {"nachweise": lade_nachweise(), "typen": NACHWEIS_TYPEN,
            "quellen": mappe_quellen()}
