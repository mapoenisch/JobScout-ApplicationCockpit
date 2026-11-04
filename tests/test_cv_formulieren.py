#!/usr/bin/env python3
"""Tests für die Ebene „CV neu formulieren“. Claude ist ersetzt, Daten liegen im Temp-Ordner.

Start:  python3 tests/test_cv_formulieren.py
"""
import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import cv_editor as cv  # noqa: E402
import cv_formulieren as fo  # noqa: E402

ANZEIGE = "Wir suchen einen Inside Sales Manager (m/w/d) mit CRM-Erfahrung und Kundenkontakt. " * 3
GETRENNT = ["Fehler vor Buchung erkannt", "Ca. 30 Stammkunden betreut"]


def runde(**ueber):
    r = {"eckdaten": {"position": "Inside Sales Manager", "unternehmen": "Muster AG"},
         "muss_kann": [], "top3": ["Kunden betreuen"], "keywords": ["CRM", "Kundenkontakt"],
         "diagnose": [], "fragen": [], "fertig": True}
    r.update(ueber)
    return r


def frage(**ueber):
    f = {"frage": "Wie viele Kunden?", "optionen": [
        {"label": "Zahl nennen", "beschreibung": "", "freitext": True},
        {"label": "Keine Zahl", "beschreibung": "", "zaehlt": False},
        {"label": "Täglich", "beschreibung": "am Telefon"}]}
    f.update(ueber)
    return f


class Grundlage(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.tmp)
        for ziel, wert in ((fo, ("ORDNER", self.tmp / "formulieren")),
                           (cv, ("PROFIL_PFAD", self.tmp / "profil.json")),
                           (cv, ("LEBENSLAUF_PFAD", self.tmp / "lebenslauf.json")),
                           (cv, ("BEWERBUNGEN_DIR", self.tmp / "bewerbungen")),
                           (cv, ("BASIS", self.tmp))):
            p = mock.patch.object(ziel, wert[0], wert[1])
            p.start()
            self.addCleanup(p.stop)
        cv.speichere_profil({
            "persoenlich": {"vorname": "Max", "nachname": "Mustermann", "geburtsdatum": "22.05.1988"},
            "kontakt": {"email": "max@example.com", "telefon": "+49 151 1", "strasse": "Weg 1",
                        "plz": "04109", "ort": "Leipzig"},
            "beruf": {"verfuegbar_ab": "20.01.2027", "fuehrerschein": "Klasse B"}})
        self.id = fo.anlegen({"modus": "neu"})["entwurf"]["id"]
        fo.speichern({"id": self.id, "stelle": {"text": ANZEIGE},
                      "eingabe": {"stationen": [
                          {"id": "aaaaaaaaaa", "titel": "Kaufmann", "unternehmen": "Raiffeisen", "von": "01/2022",
                           "bis": "10/2025", "notizen": "kunden betreut\nca 30 stammkunden", "woertlich": False},
                          {"id": "bbbbbbbbbb", "titel": "Verkäufer", "unternehmen": "OBI", "von": "01/2020",
                           "bis": "12/2021", "notizen": "- Mein eigener Satz bleibt genau so.\nZweite Zeile", "woertlich": True},
                      ], "ausbildung": [{"id": "cccccccccc", "titel": "Abitur", "bis": "06/2007"}]}})

    def fertig_bis_formulieren(self):
        with mock.patch.object(fo, "_frage", return_value=runde()):
            fo.analysieren({"id": self.id})
        fo.kp_status({"id": self.id, "status": "nein"})


class Felder(Grundlage):
    def test_lange_anzeige_bleibt_vollstaendig(self):
        text = "x" * 9000
        fo.speichern({"id": self.id, "stelle": {"text": text}})
        self.assertEqual(len(fo._lade(self.id)["stelle"]["text"]), 9000)

    def test_ids_ungueltig_abgelehnt(self):
        with self.assertRaises(ValueError):
            fo._lade("../../etc")

    def test_import_aus_editor_aendert_profil_und_editor_nicht(self):
        cv.speichere_lebenslauf({"erfahrung": [{"rolle": "Rolle", "firma": "F", "punkte": ["a", "b"]}]})
        vorher = (cv.PROFIL_PFAD.read_text(), cv.LEBENSLAUF_PFAD.read_text())
        e = fo.importieren({"id": self.id, "aus_editor": True})["entwurf"]
        self.assertEqual(e["eingabe"]["stationen"][0]["notizen"], "a\nb")
        self.assertEqual(vorher, (cv.PROFIL_PFAD.read_text(), cv.LEBENSLAUF_PFAD.read_text()))


class Rueckfragen(Grundlage):
    def test_nur_beantwortete_fragen_werden_fakten(self):
        erste = runde(fragen=[frage(), frage(frage="Reklamationen?"), frage(frage="Team?"),
                              frage(frage="Umsatz?")], fertig=False)
        with mock.patch.object(fo, "_frage", return_value=erste):
            e = fo.analysieren({"id": self.id})["entwurf"]
        a, b, c, d = e["fragen"]
        antworten = [{"id": a["id"], "wahl": ["Zahl nennen"], "text": "ca. 30"},
                     {"id": b["id"], "wahl": ["Zahl nennen"], "text": ""},   # versprochener Text fehlt
                     {"id": c["id"], "wahl": ["Keine Zahl"], "text": ""},
                     {"id": d["id"], "wahl": ["Täglich"], "text": ""}]
        with mock.patch.object(fo, "_frage", return_value=runde()):
            e = fo.antworten({"id": self.id, "antworten": antworten})["entwurf"]
        self.assertEqual([x["antwort"] for x in e["antworten"]], ["ca. 30", "Täglich (am Telefon)"])
        self.assertTrue(all(x["quelle"] == "Antwort R1" for x in e["antworten"]))
        self.assertEqual(e["nicht_beantwortet"], ["Reklamationen?", "Team?"])
        self.assertTrue(e["fragen_fertig"])
        self.assertIn("Reklamationen?", fo._daten(e))   # wird nicht erneut gefragt

    def test_nach_maximalen_runden_ist_schluss(self):
        offen = runde(fragen=[frage()], fertig=False)
        with mock.patch.object(fo, "_frage", return_value=offen) as m:
            e = fo.analysieren({"id": self.id})["entwurf"]
            for _ in range(fo.MAX_RUNDEN - 1):
                e = fo.antworten({"id": self.id, "antworten": []})["entwurf"]
            self.assertTrue(e["fragen"])
            e = fo.antworten({"id": self.id, "antworten": []})["entwurf"]
        self.assertEqual(m.call_count, fo.MAX_RUNDEN)
        self.assertTrue(e["fragen_fertig"])


class Kurzprofil(Grundlage):
    GUT = [{"schlagwort": "Erfahrung", "fakt": "4 Jahre B2B-Innendienst.", "quelle": "Eingabe"},
           {"schlagwort": "Kunden", "fakt": "Ca. 30 Stammkunden betreut.", "quelle": "Eingabe"},
           {"schlagwort": "Weiterbildung", "fakt": "Digital Sales Manager.", "quelle": "Eingabe"}]

    def setUp(self):
        super().setUp()
        with mock.patch.object(fo, "_frage", return_value=runde()):
            fo.analysieren({"id": self.id})

    def test_erst_nach_den_rueckfragen(self):
        fo._aendere(self.id, lambda e: e.update(fragen_fertig=False))
        with self.assertRaises(ValueError):
            fo.kp_status({"id": self.id, "status": "ja"})

    def test_regelverstoss_wird_einmal_nachgebessert(self):
        schlecht = {"zeilen": [{**self.GUT[0], "fakt": "Ich habe erfolgreich gearbeitet."}, *self.GUT[1:]]}
        with mock.patch.object(fo, "_frage", side_effect=[schlecht, {"zeilen": self.GUT}]) as m:
            e = fo.kp_schreiben({"id": self.id})["entwurf"]
        self.assertEqual(m.call_count, 2)
        self.assertEqual(e["kurzprofil_zeilen"][0]["fakt"], self.GUT[0]["fakt"])

    def test_unter_drei_zeilen_wird_nichts_aufgefuellt(self):
        fo.kp_status({"id": self.id, "status": "ja"})
        with mock.patch.object(fo, "_frage", return_value={"zeilen": self.GUT[:2], "fehlend": "Ergebnis"}):
            e = fo.kp_schreiben({"id": self.id})["entwurf"]
        self.assertEqual(e["kurzprofil"]["status"], "spaeter")
        self.assertEqual(e["kurzprofil_zeilen"], [])
        self.assertEqual(e["kurzprofil"]["fehlend"], "Ergebnis")

    def test_beleg_fehlt_aussage_faellt_weg(self):
        fo.kp_status({"id": self.id, "status": "ja"})
        r = {"faehigkeiten": [{"label": "CRM", "aussage": "CRM-Pflege", "beleg": "Station", "quelle": "Eingabe"}],
             "unbelegt": [{"aussage": "kommunikationsstark", "fundstelle": "CV", "frage": "Woran?"},
                          {"aussage": "Umsatz gesteigert", "fundstelle": "CV", "frage": "Wie viel?"}]}
        with mock.patch.object(fo, "_frage", return_value=r):
            e = fo.kp_vorschlaege({"id": self.id})["entwurf"]
        f1, f2 = e["kurzprofil"]["belegfragen"]
        e = fo.kp_belege({"id": self.id, "auswahl": ["CRM-Pflege", "erfunden"], "antworten": [
            {"id": f1["id"], "wahl": ["Streichen"]}, {"id": f2["id"], "wahl": ["Beleg nennen"], "text": "um 10 %"}]})["entwurf"]
        self.assertEqual(e["kurzprofil"]["verworfen"], ["kommunikationsstark"])
        self.assertEqual([x["aussage"] for x in e["kurzprofil"]["auswahl"]], ["CRM-Pflege"])
        self.assertEqual(e["antworten"][-1]["antwort"], "um 10 %")


class Formulieren(Grundlage):
    def antwort(self):
        return {"cv": {"berufserfahrung": [
            {"quelle_id": "aaaaaaaaaa", "titel": "Kaufmann", "unternehmen": "Raiffeisen", "von": "01/2022", "bis": "10/2025",
             "punkte": ["Ca. 30 Stammkunden betreut", "Umsatz um 99 % gesteigert"]},
            {"quelle_id": "bbbbbbbbbb", "titel": "UMFORMULIERT", "unternehmen": "OBI", "punkte": ["Umformuliert"]}],
            # Abitur fehlt absichtlich
            "kernkompetenzen": ["CRM"], "zusatzqualifikationen": {"it": ["HubSpot"]},
            "person": {"name": "Erfunden"}}, "aenderungen": ["x"], "wirkung": []}

    def test_feste_regeln_gelten_auch_wenn_claude_abweicht(self):
        self.fertig_bis_formulieren()
        with mock.patch.object(fo, "_frage", return_value=self.antwort()), \
                mock.patch.object(fo, "_render", return_value={"seiten": 2, "warnungen": [], "pdf": ""}) as render:
            e = fo.formulieren({"id": self.id})["entwurf"]
        c = e["cv"]
        obi = c["berufserfahrung"][1]
        self.assertEqual(obi["titel"], "Verkäufer")
        self.assertEqual(obi["punkte"], ["Mein eigener Satz bleibt genau so.", "Zweite Zeile"])
        self.assertEqual(c["person"]["name"], "Max Mustermann")
        self.assertEqual(c["person"]["verfuegbar_ab"], "20.01.2027")   # unverändert aus dem Profil
        self.assertNotIn("geburtsdatum", c["person"])                  # freiwillig, nicht eingeschaltet
        self.assertEqual(c["zusatzqualifikationen"]["fuehrerschein"], "Klasse B")
        self.assertEqual(c["ausbildung"][0]["titel"], "Abitur")        # fehlende Station ergänzt
        self.assertTrue(any("Abitur" in w for w in e["warnungen"]))
        self.assertTrue(any("99" in w for w in e["warnungen"]))        # unbekannte Zahl gemeldet
        self.assertEqual(render.call_count, 1)

    def test_zu_lang_loest_einen_kuerzungslauf_aus(self):
        self.fertig_bis_formulieren()
        with mock.patch.object(fo, "_frage", return_value=self.antwort()) as m, \
                mock.patch.object(fo, "_render", side_effect=[{"seiten": 3, "warnungen": []},
                                                              {"seiten": 2, "warnungen": []}]):
            fo.formulieren({"id": self.id})
        self.assertEqual(m.call_count, 2)
        self.assertIn("3 Seiten", m.call_args_list[1].args[0])

    def test_faktencheck_ersetzt_nicht_in_woertlichen_eintraegen(self):
        self.fertig_bis_formulieren()
        with mock.patch.object(fo, "_frage", return_value=self.antwort()), \
                mock.patch.object(fo, "_render", return_value={"seiten": 2, "warnungen": []}):
            fo.formulieren({"id": self.id})
        pruefung = {"bericht": "B" * 6000, "verstoesse": [
            {"zeile": "Umsatz um 99 % gesteigert", "grund": "unbelegt", "neu": ""},
            {"zeile": "Zweite Zeile", "grund": "unbelegt", "neu": ""}]}
        with mock.patch.object(fo, "_frage", return_value=pruefung), \
                mock.patch.object(fo, "_render", return_value={"seiten": 2, "warnungen": []}):
            e = fo.pruefen({"id": self.id})["entwurf"]
        self.assertEqual(e["cv"]["berufserfahrung"][0]["punkte"], ["Ca. 30 Stammkunden betreut"])
        self.assertIn("Zweite Zeile", e["cv"]["berufserfahrung"][1]["punkte"])
        self.assertEqual(len(e["bericht"]), 6000)
        register = (fo._ordner(self.id) / "faktenregister.md").read_text()
        self.assertIn("[wörtlich]", register)

    def test_faktencheck_korrigiert_kurzprofil_und_meldet_unzuordenbares(self):
        self.fertig_bis_formulieren()
        zeilen = [{"schlagwort": "Ausbildung", "fakt": "IHK, abgeschlossen 01/2018."},
                  {"schlagwort": "Kunden", "fakt": "Ca. 30 Stammkunden."},
                  {"schlagwort": "Angebote", "fakt": "Ca. 20 pro Woche."}]
        fo.speichern({"id": self.id, "kurzprofil_zeilen": zeilen})
        with mock.patch.object(fo, "_frage", return_value=self.antwort()), \
                mock.patch.object(fo, "_render", return_value={"seiten": 2, "warnungen": []}):
            fo.formulieren({"id": self.id})
        pruefung = {"bericht": "B", "verstoesse": [
            {"zeile": "Ausbildung – IHK, abgeschlossen 01/2018.", "grund": "unbelegt", "neu": "Ausbildung – IHK, 01/2018."},
            {"zeile": "Gibt es nicht", "grund": "unbelegt", "neu": ""}]}
        with mock.patch.object(fo, "_frage", return_value=pruefung), \
                mock.patch.object(fo, "_render", return_value={"seiten": 2, "warnungen": []}):
            e = fo.pruefen({"id": self.id})["entwurf"]
        self.assertEqual(e["kurzprofil_zeilen"][0]["fakt"], "IHK, 01/2018.")
        self.assertEqual(e["cv"]["kurzprofil"][0]["fakt"], "IHK, 01/2018.")
        self.assertTrue(any("Gibt es nicht" in w for w in e["warnungen"]))

    def test_browser_kann_persoenliche_daten_nicht_ueberschreiben(self):
        self.fertig_bis_formulieren()
        with mock.patch.object(fo, "_frage", return_value=self.antwort()), \
                mock.patch.object(fo, "_render", return_value={"seiten": 2, "warnungen": []}):
            e = fo.formulieren({"id": self.id})["entwurf"]
        c = json.loads(json.dumps(e["cv"]))
        c["person"] = {"name": "Falsch"}
        fo.speichern({"id": self.id, "cv": c})
        self.assertEqual(fo._lade(self.id)["cv"]["person"]["name"], "Max Mustermann")


class Render(Grundlage):
    @unittest.skipUnless(cv._chrome(), "Chrome fehlt")
    def test_rohfassung_und_pdf_ablage_ueberschreiben_nichts(self):
        self.fertig_bis_formulieren()
        v = fo.vorschau({"id": self.id})
        self.assertEqual(v["art"], "roh")
        fo._aendere(self.id, lambda e: e.update(cv=fo._rohfassung(e)))
        r1 = fo.pdf_speichern({"id": self.id})
        self.assertTrue(r1["pfad"].endswith("Max_Mustermann_Lebenslauf_Muster_AG.pdf"))
        r2 = fo.pdf_speichern({"id": self.id})
        self.assertEqual(r1["pfad"], r2["pfad"])                       # eigener Stand wird ersetzt
        anderer = fo.anlegen({"modus": "neu"})["entwurf"]["id"]
        fo._aendere(anderer, lambda e: (e["stelle"].update(firma="Muster AG"), e.update(cv=fo._rohfassung(e))))
        r3 = fo.pdf_speichern({"id": anderer})
        self.assertNotEqual(r1["pfad"], r3["pfad"])                    # fremde Datei bleibt


class SkillKopie(unittest.TestCase):
    def test_renderer_und_regeln_entsprechen_dem_original(self):
        original = Path.home() / ".claude/skills/lebenslauf-stellenanpassung"
        if not original.exists():
            self.skipTest("Original-Skill nicht vorhanden")
        for rel in ("SKILL.md", "scripts/render_cv.py", "references/best-practices-modul4.md",
                    "references/formulierungen.md", "references/fragenkatalog.md"):
            self.assertEqual((original / rel).read_text(), (fo.SKILL_DIR / rel).read_text(), rel)


if __name__ == "__main__":
    unittest.main()
