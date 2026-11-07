"""BA-Remote-Suche: Die API v6 filtert über homeoffice, nicht mehr über arbeitszeit=ho."""
import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import job_scout as js  # noqa: E402


def _antwort(eintraege):
    r = mock.Mock()
    r.raise_for_status.return_value = None
    r.json.return_value = {"ergebnisliste": eintraege}
    return r


def _eintrag(ref="1", **felder):
    return {"referenznummer": ref, "stellenangebotsTitel": "Account Manager",
            "firma": "Firma", **felder}


class BaRemoteFilter(unittest.TestCase):
    def _params(self, **kwargs):
        with mock.patch.object(js.requests, "get",
                               return_value=_antwort([])) as get:
            js.fetch_arbeitsagentur("Sales", max_seiten=1, **kwargs)
        return get.call_args.kwargs["params"]

    def test_remote_suche_nutzt_homeoffice_filter(self):
        params = self._params(wo=None, umkreis=None, nur_remote=True)
        self.assertEqual(params["homeoffice"], js.BA_HOMEOFFICE_FILTER)
        self.assertNotIn("arbeitszeit", params)

    def test_ortssuche_filtert_nicht_auf_homeoffice(self):
        params = self._params(wo="Leipzig", umkreis=50)
        self.assertNotIn("homeoffice", params)
        self.assertNotIn("arbeitszeit", params)


class BaRemoteKennzeichen(unittest.TestCase):
    def _job(self, nur_remote, **felder):
        with mock.patch.object(js.requests, "get", side_effect=[
                _antwort([_eintrag(**felder)]), _antwort([])]):
            return js.fetch_arbeitsagentur(
                "Sales", wo=None, umkreis=None, nur_remote=nur_remote,
                max_seiten=2)[0]

    def test_treffer_der_remote_suche_ist_remote(self):
        self.assertTrue(self._job(True).remote)

    def test_ortssuche_uebernimmt_homeoffice_angabe_der_ba(self):
        self.assertTrue(self._job(False, homeofficemoeglich=True).remote)
        self.assertFalse(self._job(False, homeofficemoeglich=False).remote)
        self.assertFalse(self._job(False).remote)


if __name__ == "__main__":
    unittest.main()
