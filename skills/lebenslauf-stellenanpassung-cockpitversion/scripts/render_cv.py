#!/usr/bin/env python3
"""Rendert einen Lebenslauf aus JSON als ATS-taugliches Text-PDF (nur Standardbibliothek).

Aufruf:
    python3 render_cv.py lebenslauf.json --out ZIELORDNER [--html-only]
                         [--keywords keywords.txt]

- Layout nach DBA Modul 4 + ATS-Richtlinien: einspaltig, Datum links in derselben
  Zeile wie Position/Unternehmen/Ort, Kontaktdaten im Haupttext, keine Icons/Balken.
- Ränder wie Anschreiben (DIN 5008, online-Variante): links 25 mm, rechts 20 mm,
  unten 25 mm, oben 25 mm – nur wenn dadurch eine Seite gespart wird 20 mm.
- Läuft die Berufserfahrung über einen Seitenumbruch, wird vor dem ersten Eintrag
  auf der Folgeseite automatisch „Berufserfahrung (Fortsetzung)“ gesetzt.
- Danach Prüfung: Text extrahierbar (pdftotext, falls vorhanden), Seitenzahl,
  Reihenfolge, Weiterbildungs-Doppeleintrag, Tag-4-Regeln (Datumsformat,
  Sternchen/Balken, Überschriften, Zahlen-Bullets, ähnliche Stationen),
  Kurzprofil-Regeln, optional Keyword-Abdeckung. Ergebnis als JSON auf stdout.
"""
from __future__ import annotations

import argparse
import base64
import html as h
import json
import mimetypes
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata
from pathlib import Path

CHROME_PFADE = (
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
)

CSS = """
@page { size: A4; margin: __OBEN__mm 20mm 25mm 25mm; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; line-height: 1.15;
       color: #111; }
h1 { font-size: 20pt; margin: 0 0 4mm 0; font-weight: bold; }
h2 { font-size: 12.5pt; font-weight: bold; margin: 5mm 0 2mm 0; padding-bottom: 0.8mm;
     border-bottom: 0.6pt solid #444; break-after: avoid; }
.kopfblock { display: flex; justify-content: space-between; gap: 8mm; }
.kopfblock .daten { flex: 1; }
.foto { width: 35mm; height: 45mm; object-fit: cover; }
.zeile { margin: 0 0 0.8mm 0; }
.zeile .lbl { font-weight: bold; }
.zq { margin: 0 0 1.6mm 0; }
.eintrag { margin: 0 0 2.4mm 0; break-inside: avoid; }
.eintrag.kurz { margin-bottom: 1.2mm; }
.kopf { display: flex; }
.zeit { width: 38mm; flex: none; white-space: nowrap; }
.titel { flex: 1; }
.fett .zeit, .fett .titel { font-weight: bold; }
.inhalt { margin-left: 38mm; }
.inhalt p { margin: 0.6mm 0; }
.inhalt ul { margin: 0.8mm 0 0 0; padding-left: 4.5mm; }
.inhalt li { margin: 0 0 0.6mm 0; }
.unter { margin: 1.2mm 0 0 0; }
.unter .zeit { width: 34mm; }
.grund { font-style: italic; }
.profil { margin: 0; }
ul.profil { padding-left: 4.5mm; }
ul.profil li { margin: 0 0 1em 0; }
ul.profil li:last-child { margin-bottom: 0; }
.kompetenzen { margin: 0; }
.abschluss { margin-top: 4mm; break-inside: avoid; }
.unterschrift { height: 14mm; display: block; margin-top: 1mm;
  /* abfotografiertes Papier → weißer Hintergrund, Tinte bleibt dunkel */
  filter: grayscale(1) contrast(5) brightness(1.25); mix-blend-mode: multiply; }
.umbruch { break-before: page; }
"""


def esc(t) -> str:
    return h.escape(str(t or ""), quote=True)


def zeitraum(e: dict) -> str:
    von, bis = (e.get("von") or "").strip(), (e.get("bis") or "").strip()
    if von and bis:
        return f"{von} – {bis}"
    return von or bis


def kopfzeile(e: dict) -> str:
    teile = [e.get("titel"), e.get("unternehmen") or e.get("institut"), e.get("ort")]
    return ", ".join(t.strip() for t in teile if t and str(t).strip())


def data_uri(pfad: str | None) -> str | None:
    if not pfad:
        return None
    p = Path(pfad).expanduser()
    if not p.exists():
        print(f"WARNUNG: Bild nicht gefunden: {p}", file=sys.stderr)
        return None
    mime = mimetypes.guess_type(p.name)[0] or "image/jpeg"
    return f"data:{mime};base64,{base64.b64encode(p.read_bytes()).decode()}"


def inhalt(e: dict) -> str:
    teile = [f"<p>{esc(z)}</p>" for z in e.get("zeilen") or []]
    if e.get("punkte"):
        teile.append("<ul>" + "".join(f"<li>{esc(p)}</li>" for p in e["punkte"]) + "</ul>")
    if e.get("beendigungsgrund"):
        teile.append(f'<p class="grund">Beendigungsgrund: {esc(e["beendigungsgrund"])}</p>')
    for u in e.get("unter") or []:
        teile.append(
            f'<div class="unter"><div class="kopf"><span class="zeit">{esc(zeitraum(u))}</span>'
            f'<span class="titel">{esc(kopfzeile(u))}</span></div>'
            + "".join(f"<p>{esc(z)}</p>" for z in u.get("zeilen") or [])
            + ("<ul>" + "".join(f"<li>{esc(p)}</li>" for p in u["punkte"]) + "</ul>"
               if u.get("punkte") else "")
            + "</div>")
    # Unter-Einträge stehen bewusst eingerückt im Inhaltsbereich
    return f'<div class="inhalt">{"".join(teile)}</div>' if teile else ""


def eintrag(e: dict, fett: bool = True, idx: str = "") -> str:
    hat_inhalt = bool(e.get("zeilen") or e.get("punkte") or e.get("unter")
                      or e.get("beendigungsgrund"))
    klasse = "eintrag" + (" fett" if fett else "") + ("" if hat_inhalt else " kurz")
    return (f'<div class="{klasse}" data-idx="{idx}"><div class="kopf">'
            f'<span class="zeit">{esc(zeitraum(e))}</span>'
            f'<span class="titel">{esc(kopfzeile(e))}</span></div>{inhalt(e)}</div>')


def baue_html(cv: dict, oben_mm: int = 25, umbruch_vor: int | None = None) -> str:
    p = cv.get("person") or {}
    zeilen = []
    for lbl, key in (("Adresse", "adresse"), ("Telefon", "telefon"), ("E-Mail", "email"),
                     ("LinkedIn", "linkedin"), ("Geburtsdatum", "geburtsdatum"),
                     ("Familienstand", "familienstand"), ("Nationalität", "nationalitaet"),
                     ("Verfügbar ab", "verfuegbar_ab"), ("Kinderbetreuung", "kinderbetreuung")):
        if p.get(key):
            # Feldname und Wert als EIN Textlauf – keine Spaltenausrichtung, die
            # Parser als zwei Spalten lesen könnten
            zeilen.append(f'<div class="zeile"><span class="lbl">{lbl}:</span> {esc(p[key])}</div>')
    foto = data_uri(p.get("foto"))
    # Name + persönliche Daten links, Foto rechts daneben (spart Höhe)
    teile = ['<div class="kopfblock"><div class="daten">'
             f"<h1>{esc(p.get('name'))}</h1>"
             '<h2 style="margin-top:0">Persönliche Daten</h2>'
             + "".join(zeilen) + "</div>"
             + (f'<img class="foto" src="{foto}" alt="Bewerbungsfoto">' if foto else "")
             + "</div>"]

    kp = cv.get("kurzprofil")
    if kp:
        if isinstance(kp, str):
            teile.append(f'<h2>Kurzprofil</h2><p class="profil">{esc(kp)}</p>')
        else:
            # 3–4 Zeilen {"schlagwort", "fakt"}; ältere CVs: String oder {"fett", "text"}
            li = []
            for x in kp:
                if isinstance(x, dict) and "schlagwort" in x:
                    li.append(f"<li><b>{esc(x['schlagwort'])}</b> – {esc(x.get('fakt', ''))}</li>")
                elif isinstance(x, dict):
                    li.append(f"<li><b>{esc(x.get('fett', ''))}</b> {esc(x.get('text', ''))}</li>")
                else:
                    li.append(f"<li>{esc(x)}</li>")
            teile.append(f'<h2>Kurzprofil</h2><ul class="profil">{"".join(li)}</ul>')

    be = cv.get("berufserfahrung") or []
    if be:
        teile.append("<h2>Berufserfahrung</h2>")
        for i, e in enumerate(be):
            if umbruch_vor is not None and i == umbruch_vor:
                teile.append('<h2 class="umbruch">Berufserfahrung (Fortsetzung)</h2>')
            teile.append(eintrag(e, fett=e.get("fett", True), idx=f"be{i}"))

    ws = cv.get("weitere_stationen") or []
    if ws:
        teile.append("<h2>Weitere Stationen</h2>"
                     + "".join(eintrag(e, fett=False) for e in ws))

    aus = cv.get("ausbildung") or []
    if aus:
        teile.append("<h2>Ausbildung und Weiterbildung</h2>"
                     + "".join(eintrag(e, fett=e.get("fett", False)) for e in aus))

    zq = cv.get("zusatzqualifikationen") or {}
    zq_teile = []
    for lbl, key in (("IT-Kenntnisse", "it"), ("Zertifikate", "zertifikate"),
                     ("Sprachkenntnisse", "sprachen"), ("Führerschein", "fuehrerschein")):
        werte = zq.get(key)
        if not werte:
            continue
        if isinstance(werte, str):
            werte = [werte]
        # Bezeichnung und Werte als fortlaufender Text (keine Spalten → ATS-sicher)
        zq_teile.append(f'<p class="zq"><b>{lbl}:</b> ' + esc(" · ".join(werte)) + "</p>")
    if zq_teile:
        teile.append("<h2>Zusatzqualifikationen</h2>" + "".join(zq_teile))

    if cv.get("kernkompetenzen"):
        teile.append('<h2>Kernkompetenzen</h2><p class="kompetenzen">'
                     + esc(" · ".join(cv["kernkompetenzen"])) + "</p>")

    inter = cv.get("interessen") or []
    if inter:
        teile.append("<h2>" + esc(cv.get("interessen_titel") or "Hobbies, Ehrenamt") + "</h2>")
        for e in inter:
            teile.append(eintrag(e, fett=True))

    ab = cv.get("abschluss") or {}
    if ab.get("ort") or ab.get("datum"):
        sig = data_uri(ab.get("unterschrift"))
        teile.append('<div class="abschluss">'
                     f"<div>{esc(', '.join(x for x in (ab.get('ort'), ab.get('datum')) if x))}</div>"
                     + (f'<img class="unterschrift" src="{sig}" alt="Unterschrift">' if sig else "")
                     + "</div>")

    css = CSS.replace("__OBEN__", str(oben_mm))
    titel = f"Lebenslauf {p.get('name', '')}".strip()
    return (f'<!doctype html><html lang="de"><head><meta charset="utf-8"><title>{esc(titel)}</title>'
            f"<style>{css}</style></head><body>{''.join(teile)}</body></html>")


def chrome() -> str | None:
    for c in CHROME_PFADE:
        if Path(c).exists():
            return c
    return shutil.which("google-chrome") or shutil.which("chromium")


def drucke(browser: str, html: str, ziel: Path) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        quelle = Path(tmp) / "cv.html"
        quelle.write_text(html, encoding="utf-8")
        if ziel.exists():
            ziel.unlink()
        r = subprocess.run([browser, "--headless=new", "--disable-gpu", "--no-first-run",
                            "--no-default-browser-check", f"--user-data-dir={tmp}/profil",
                            "--no-pdf-header-footer", f"--print-to-pdf={ziel}", quelle.as_uri()],
                           capture_output=True, timeout=120)
    if r.returncode != 0 or not ziel.exists():
        raise RuntimeError("PDF-Export fehlgeschlagen: " + r.stderr.decode("utf-8", "replace")[-300:])


def seiten(pdf: Path) -> int:
    return max(1, len(re.findall(rb"/Type\s*/Page[^s]", pdf.read_bytes())))


def seitentexte(pdf: Path) -> list[str] | None:
    if not shutil.which("pdftotext"):
        return None
    r = subprocess.run(["pdftotext", "-layout", str(pdf), "-"], capture_output=True)
    if r.returncode != 0:
        return None
    return r.stdout.decode("utf-8", "replace").split("\f")


def norm(t: str) -> str:
    t = unicodedata.normalize("NFKC", t).lower()
    return re.sub(r"\s+", " ", t)


def dateiname(name: str) -> str:
    t = re.sub(r"[^\wÄÖÜäöüß-]+", "_", (name or "").strip(), flags=re.UNICODE).strip("_")
    return t or "Lebenslauf"


def umbruch_finden(cv: dict, texte: list[str]) -> int | None:
    """Index des ersten Berufserfahrungs-Eintrags, der auf Seite 2+ beginnt, wenn
    Berufserfahrung auf Seite 1 beginnt und auf der Folgeseite weiterläuft."""
    be = cv.get("berufserfahrung") or []
    if len(texte) < 2 or not be:
        return None
    s1 = norm(texte[0])
    for i, e in enumerate(be):
        merkmal = norm(zeitraum(e))
        kopf = norm(kopfzeile(e))[:25]
        if merkmal and merkmal in s1 and kopf.split(",")[0] in s1:
            continue
        return i if i > 0 else None
    return None


def pruefe_weiterbildung(cv: dict) -> list[str]:
    """Modul 4 (Musterbeispiel Starter, Tag 2): Laufende Weiterbildung steht in der
    Berufserfahrung (– heute, ohne Träger) UND in Ausbildung und Weiterbildung
    (voller Zeitraum, Träger, Ort)."""
    w: list[str] = []
    rx = re.compile(r"^Weiterbildung (?:zum|zur|als)\s+(.+?)(?:[,(]|$)", re.I)
    be_titel = []
    for e in cv.get("berufserfahrung") or []:
        for x in [e, *(e.get("unter") or [])]:
            m = rx.match((x.get("titel") or "").strip())
            if m:
                be_titel.append((m.group(1).strip(), x, e))
    aus = cv.get("ausbildung") or []
    for name, x, block in be_titel:
        if (block.get("bis") or x.get("bis") or "").lower() != "heute":
            w.append(f"Weiterbildung „{name}“ in der Berufserfahrung endet nicht auf „heute“.")
        treffer = [a for a in aus if name.lower() in (a.get("titel") or "").lower()]
        if not treffer:
            w.append(f"Weiterbildung „{name}“ fehlt unter „Ausbildung und Weiterbildung“ (Doppeleintrag).")
            continue
        a = treffer[0]
        if aus and aus[0] is not a:
            w.append(f"„{name}“ ist nicht der erste Eintrag unter „Ausbildung und Weiterbildung“.")
        if (a.get("titel") or "").lower().startswith("weiterbildung"):
            w.append(f"Ausbildungsteil: „{name}“ ohne „Weiterbildung zum“ benennen.")
        if not (a.get("bis") and a["bis"].lower() != "heute"):
            w.append(f"Ausbildungsteil: „{name}“ braucht das geplante Enddatum (MM/JJJJ).")
        if not a.get("institut"):
            w.append(f"Ausbildungsteil: Bildungsträger für „{name}“ fehlt.")
        if not a.get("ort"):
            w.append(f"Ausbildungsteil: Ort für „{name}“ fehlt (nachfragen).")
    return w


DATUM = re.compile(r"^(\d{2}/\d{4}|heute)$")
# Sternchen, Balken, Punkte-Skalen, Icons (ATS-Regel 3, Tag 4)
SONDERZEICHEN = re.compile("[\u2605\u2606\u25A0-\u25FF\u2580-\u259F\u2700-\u27BF\U0001F300-\U0001FAFF]")
INTERESSEN_OK = re.compile(r"hobb|ehrenamt|interessen|projekt|engagement", re.I)


def alle_eintraege(cv: dict):
    for teil in ("berufserfahrung", "weitere_stationen", "ausbildung", "interessen"):
        for e in cv.get(teil) or []:
            yield teil, e
            for u in e.get("unter") or []:
                yield teil, u


def texte_aus(o) -> list[str]:
    if isinstance(o, str):
        return [o]
    if isinstance(o, dict):
        return [s for k, v in o.items() if not k.startswith("_") and k not in ("foto", "unterschrift")
                for s in texte_aus(v)]
    if isinstance(o, list):
        return [s for v in o for s in texte_aus(v)]
    return []


def pruefe_tag4(cv: dict) -> list[str]:
    """Modul 4, Tag 4: einheitliches Datum, keine Sternchen/Balken/Icons, klare
    Überschriften, Wirkung/Zahlen sichtbar, ähnliche Stationen nicht leer."""
    w: list[str] = []
    falsch = sorted({f"{e.get(k)}" for _, e in alle_eintraege(cv) for k in ("von", "bis")
                     if e.get(k) and not DATUM.match(str(e[k]).strip())})
    if falsch:
        w.append(f"Datumsformat uneinheitlich (Soll MM/JJJJ bzw. „heute“): {falsch}")
    zeichen = sorted({m for s in texte_aus(cv) for m in SONDERZEICHEN.findall(s)})
    if zeichen:
        w.append(f"Sternchen/Balken/Icons im Text (ATS): {zeichen}")
    if cv.get("interessen") and cv.get("interessen_titel") and not INTERESSEN_OK.search(cv["interessen_titel"]):
        w.append(f"Überschrift „{cv['interessen_titel']}“ unklar – z. B. „Hobbies, Ehrenamt“ oder „Eigene Projekte“.")
    punkte = [x for e in cv.get("berufserfahrung") or []
              for x in [*(e.get("punkte") or []), *(p for u in e.get("unter") or [] for p in u.get("punkte") or [])]]
    mit_zahl = [x for x in punkte if re.search(r"\d", x)]
    if punkte and len(mit_zahl) < 2:
        w.append(f"Nur {len(mit_zahl)} Bullet(s) mit Zahl in der Berufserfahrung – Tag 4: Wirkung/Zahlen "
                 "erfragen (Kunden, Gespräche, Aufgaben, Verantwortung, Ergebnisse); sonst im Bericht als Lücke.")
    gruppen: dict[str, list[dict]] = {}
    for e in cv.get("berufserfahrung") or []:
        if e.get("unternehmen"):
            gruppen.setdefault(norm(e.get("titel") or ""), []).append(e)
    for titel, es in gruppen.items():
        if len(es) > 1 and any(e.get("punkte") for e in es) and not all(e.get("punkte") for e in es):
            leer = [f"{e.get('unternehmen')}, {e.get('ort', '')}".strip(", ") for e in es if not e.get("punkte")]
            w.append(f"Ähnliche Station ohne Unterpunkte: {leer} – Tag 4: jedes Ergebnis zur Station, "
                     "wo es passiert ist (eigenes Ergebnis erfragen).")
    return w


# Schreibregeln Kurzprofil (references/formulierungen.md)
KP_FLOSKELN = re.compile(
    r"\b(leidenschaftlich\w*|dynamisch\w*|nahtlos\w*|synergie\w*|maßgeblich\w*|schnittstelle\w*"
    r"|fokus auf|brückenbauer\w*|proaktiv\w*|ergebnisorientiert\w*|hands-on\S*|ganzheitlich\w*"
    r"|vorantreib\w*|vorangetrieben|treib\w* voran|meilenstein\w*|erfolgreich\w*|verantwortlich für"
    r"|kommunikationsst(?:ark|ärk)\w*|teamfähig\w*|sozialkompetenz\w*|lösungsorientiert\w*"
    r"|verantwortungsbewusst\w*)\b", re.I)
KP_SATZBAU = re.compile(r"\b(ich|mein\w*|mir|mich|habe|hatte|bin|war|wurde|wurden)\b", re.I)
KP_MAX_ZEICHEN = 120
KP_MAX_SCHLAGWORT = 3


def pruefe_kurzprofil(cv: dict) -> list[str]:
    """Format und Wortwahl des Kurzprofils. Ob eine Zeile belegt ist, prüft der Faktencheck."""
    kp = cv.get("kurzprofil")
    if not kp:
        return []
    if isinstance(kp, str):
        return ["Kurzprofil als Fließtext – Soll: 3–4 Zeilen {schlagwort, fakt}."]
    w: list[str] = []
    if not 3 <= len(kp) <= 4:
        w.append(f"Kurzprofil hat {len(kp)} Zeile(n) – Soll: 3, maximal 4.")
    for x in kp:
        if not (isinstance(x, dict) and x.get("schlagwort") and x.get("fakt")):
            w.append(f"Kurzprofil-Zeile nicht im Format {{schlagwort, fakt}}: {x}")
            continue
        schlagwort, fakt = str(x["schlagwort"]), str(x["fakt"])
        zeile = f"{schlagwort} – {fakt}"
        if len(schlagwort.split()) > KP_MAX_SCHLAGWORT:
            w.append(f"Kurzprofil: Schlagwort zu lang: „{schlagwort}“.")
        if len(zeile) > KP_MAX_ZEICHEN:
            w.append(f"Kurzprofil: Zeile zu lang ({len(zeile)} Zeichen, Soll ≤ {KP_MAX_ZEICHEN}): „{zeile}“.")
        for rx, art in ((KP_FLOSKELN, "Verbotene Floskel"), (KP_SATZBAU, "Kein Telegramm-Stil")):
            treffer = sorted({m.group(0) for m in rx.finditer(zeile)})
            if treffer:
                w.append(f"Kurzprofil: {art} {treffer} in „{zeile}“.")
    return w


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("json")
    ap.add_argument("--out", default=".")
    ap.add_argument("--html-only", action="store_true")
    ap.add_argument("--keywords", help="Datei mit einem Schlüsselwort pro Zeile")
    a = ap.parse_args()

    cv = json.loads(Path(a.json).read_text(encoding="utf-8"))
    out = Path(a.out).expanduser()
    out.mkdir(parents=True, exist_ok=True)
    stamm = dateiname(cv.get("person", {}).get("name", "")) + "_Lebenslauf"
    if cv.get("dateizusatz"):
        stamm += "_" + dateiname(cv["dateizusatz"])
    html_pfad, pdf_pfad = out / f"{stamm}.html", out / f"{stamm}.pdf"

    browser = chrome()
    if a.html_only or not browser:
        html_pfad.write_text(baue_html(cv), encoding="utf-8")
        print(json.dumps({"ok": True, "html": str(html_pfad), "pdf": None,
                          "hinweis": None if browser else
                          "Kein Chrome gefunden – HTML öffnen und ‚Drucken → Als PDF sichern‘"},
                         ensure_ascii=False, indent=2))
        return 0

    # 1) Je Rand (oben 25 mm, sonst 20 mm): drucken, „Berufserfahrung (Fortsetzung)“
    #    vor dem ersten Eintrag der Folgeseite setzen, Seiten zählen.
    def variante(oben_mm: int) -> tuple[int, int | None]:
        drucke(browser, baue_html(cv, oben_mm), pdf_pfad)
        t = seitentexte(pdf_pfad)
        u = umbruch_finden(cv, t) if t else None
        if u is not None:
            drucke(browser, baue_html(cv, oben_mm, u), pdf_pfad)
        return seiten(pdf_pfad), u

    oben = 25
    n, umbruch = variante(25)
    if n > 1:
        n20, u20 = variante(20)
        if n20 < n:
            oben, n, umbruch = 20, n20, u20
        else:
            variante(25)
    texte = seitentexte(pdf_pfad)
    html_pfad.write_text(baue_html(cv, oben, umbruch), encoding="utf-8")

    # 3) Prüfungen
    bericht: dict = {"ok": True, "pdf": str(pdf_pfad), "html": str(html_pfad), "seiten": n,
                     "rand_oben_mm": oben, "fortsetzung_vor_eintrag": umbruch,
                     "groesse_kb": round(pdf_pfad.stat().st_size / 1024), "warnungen": []}
    if n < 2:
        bericht["warnungen"].append("Nur 1 Seite – Modul 4: oft zu kurz; relevante Stationen ausbauen, falls belegt.")
    if n > 3:
        bericht["warnungen"].append("Mehr als 3 Seiten – zu lang; irrelevante Stationen kürzen.")
    bericht["warnungen"].extend(pruefe_weiterbildung(cv))
    bericht["warnungen"].extend(pruefe_tag4(cv))
    bericht["warnungen"].extend(pruefe_kurzprofil(cv))
    if texte is None:
        bericht["warnungen"].append("pdftotext fehlt – Textextraktion nicht geprüft.")
    else:
        voll = norm(" ".join(texte))
        p = cv.get("person") or {}
        fehlend = [k for k in ("name", "email", "telefon") if p.get(k) and norm(p[k]) not in voll]
        if fehlend:
            bericht["warnungen"].append(f"Nicht als Text extrahierbar: {fehlend}")
        pos = [voll.find(norm(x)) for x in ("Berufserfahrung", "Ausbildung und Weiterbildung")]
        if all(x >= 0 for x in pos) and pos[0] > pos[1]:
            bericht["warnungen"].append("Ausbildung steht vor Berufserfahrung.")
        if a.keywords:
            kws = [k.strip() for k in Path(a.keywords).read_text(encoding="utf-8").splitlines() if k.strip()]
            treffer = [k for k in kws if norm(k) in voll]
            bericht["keywords"] = {"gesamt": len(kws), "gefunden": len(treffer),
                                   "fehlend": [k for k in kws if k not in treffer]}
    print(json.dumps(bericht, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
