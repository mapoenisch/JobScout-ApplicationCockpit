"""Verbindliches Schema der Job-Coach: Weiterbildung + Neuorientierung oben."""
import copy
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import cv_editor as cv  # noqa: E402


def _cv():
    return {
        "erfahrung": [
            {"rolle": "Fachberater", "firma": "OBI", "ort": "Jena", "start": "01/2025",
             "ende": "10/2025", "punkte": ["Kundenberatung."]},
            {"rolle": "Kaufmann", "firma": "Raiffeisen", "ort": "Erfurt", "start": "01/2022",
             "ende": "01/2024", "punkte": []},
        ],
        "bildung": [
            {"abschluss": "Weiterbildung zum Digital Sales Manager", "institution": "DBA",
             "ort": "Remote", "start": "05/2026", "ende": "heute",
             "punkte": ["Beginn 18.05.2026; Dauer 8,5 Monate.",
                        "CRM-Vertrieb mit HubSpot und Salesforce.",
                        "KI im Vertrieb.",
                        "Vorbereitung auf die Zertifizierung IHK (Abschluss noch ausstehend)."]},
            {"abschluss": "Ausbildung: Kaufmann", "institution": "X", "ort": "Y", "start": "2019",
             "ende": "2022", "punkte": []},
        ],
        "zielstelle": {"rolle": "Presales Consultant (gn) MultiVendor Premium Support",
                       "firma": "SoftwareOne", "beschreibung": ""},
    }


class SchemaTest(unittest.TestCase):
    def test_weiterbildung_und_neuorientierung_werden_ergaenzt(self):
        c = cv.wende_schema_an(_cv())
        rollen = [e["rolle"] for e in c["erfahrung"]]
        self.assertIn("Weiterbildung zum Digital Sales Manager, remote", rollen)
        neu = next(e for e in c["erfahrung"] if e["rolle"].startswith("Berufliche Neuorientierung"))
        self.assertEqual(neu["start"], "11/2025")           # Monat nach der letzten Anstellung
        self.assertEqual(neu["ende"], "heute")
        self.assertIn("Positionierung als Presales Consultant MultiVendor Premium Support", neu["rolle"])
        wb = next(e for e in c["erfahrung"] if e["rolle"].startswith("Weiterbildung zu"))
        self.assertEqual(wb["start"], "05/2026")             # echter Start, kein Beispieldatum
        self.assertTrue(wb["punkte"][0].startswith("Schwerpunkte: CRM-Vertrieb"))
        self.assertNotIn("Beginn", wb["punkte"][0])

    def test_bildung_bleibt_einzeilig(self):
        b = cv.wende_schema_an(_cv())["bildung"][0]
        self.assertEqual(b["abschluss"], "Digital Sales Manager")
        self.assertEqual(len(b["punkte"]), 1)
        self.assertTrue(b["punkte"][0].startswith("Vorbereitung"))

    def test_idempotent(self):
        einmal = cv.wende_schema_an(_cv())
        zweimal = cv.wende_schema_an(copy.deepcopy(einmal))
        self.assertEqual(einmal, zweimal)

    def test_ohne_laufende_weiterbildung_passiert_nichts(self):
        c = _cv()
        c["bildung"][0]["ende"] = "01/2026"
        vorher = copy.deepcopy(c)
        self.assertEqual(cv.wende_schema_an(c), vorher)

    def test_neuorientierung_ohne_zielstelle_hat_standardziel(self):
        c = _cv()
        c["zielstelle"] = {"rolle": "", "firma": "", "beschreibung": ""}
        neu = next(e for e in cv.wende_schema_an(c)["erfahrung"]
                   if e["rolle"].startswith("Berufliche Neuorientierung"))
        self.assertIn("Positionierung als Berater im digitalen Vertrieb", neu["rolle"])

    def test_regeln_stehen_in_den_prompts(self):
        import analyse as an
        import cv_formulieren as fo
        self.assertIn("{SCHEMA}", an.VORSCHLAG_PROMPT)
        self.assertIn("{SCHEMA}", fo.FORMULIER_PROMPT)
        self.assertIn("ECHTEN Zeiträume", cv.SCHEMA_REGELN)


if __name__ == "__main__":
    unittest.main()
