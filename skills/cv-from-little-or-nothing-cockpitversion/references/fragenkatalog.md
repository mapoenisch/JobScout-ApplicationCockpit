# Fragenkatalog – cv-from-little-or-nothing

Ergänzt `../lebenslauf-stellenanpassung-cockpitversion/references/fragenkatalog.md` (dort: Runde 1/2 Persönliches, 3 Lücken, 4 Beendigungsgründe, 5b Wirkung/Zahlen, K1–K4 Kurzprofil). Hier stehen nur die Vorlagen, die dieser Skill zusätzlich braucht.

Grenzen von AskUserQuestion: **1–4 Fragen pro Aufruf, 2–4 Optionen je Frage**, „Other“ (Freitext) kommt automatisch dazu. Jede Frage muss für sich verständlich sein → relevante Werte **in die Frage schreiben**. Empfohlene Option zuerst, mit „(empfohlen)“.

Option 2: Wo Dokumente Informationen liefern, diese als **Optionen** anbieten und den Dateinamen in die Beschreibung schreiben („Beleg: Zeugnis_Mueller.pdf“). Beispielwerte in Freitext-Fragen als Muster kennzeichnen („MM/JJJJ“ statt echt wirkender Daten); ist eine Antwort wortgleich mit dem Beispiel, einmal nachfragen.

---

## S – Start: Option wählen (Phase 0)

```json
{"questions": [
 {"header": "Ausgangslage", "multiSelect": false,
  "question": "Wie möchtest du deinen Basis-Lebenslauf aufbauen?",
  "options": [{"label": "Von 0 anfangen", "description": "Ich stelle dir Abschnitt für Abschnitt Fragen, bis dein Lebenslauf vollständig ist"},
              {"label": "Brainstorming mit Dokumenten", "description": "Du lädst alte Lebensläufe, Zeugnisse, Zertifikate oder Notizen hoch; ich filtere die Infos heraus und frage nur nach, was fehlt"}]},
 {"header": "Zielrichtung", "multiSelect": false,
  "question": "Gibt es Rollen oder Branchen, für die der Basis-CV besonders passen soll? (Er bleibt breit und ist keine Bewerbung auf eine konkrete Stelle.)",
  "options": [{"label": "Keine, möglichst breit (empfohlen)", "description": "Neutrale Begriffe, die zu vielen Rollen passen"},
              {"label": "Ja, Rollen/Branchen nennen", "description": "Über ‚Other‘ eintragen, z. B. Vertriebsinnendienst, SDR, Customer Success – steuert nur Wortwahl und Gewichtung, erfindet nichts"}]}
]}
```
Passt die Lage eher zur Cockpit-Ebene „CV-Entwurf umformulieren“ (aktueller, weitgehend vollständiger CV + konkrete Stellenanzeige liegen vor), das **vorher** sagen und die Wahl anbieten:
> Du hast schon einen aktuellen CV und eine Anzeige – dafür ist „CV-Entwurf umformulieren“ besser. „Basis-CV erstellen“ lohnt sich, wenn dein CV fehlt, veraltet ist oder nur lose Unterlagen existieren. Wechseln oder hier weitermachen?

## U – Upload-Bitte (nur Option 2, Phase 1)

Keine AskUserQuestion, sondern eine klare Chat-Nachricht, danach **warten**:
> Lade jetzt alle Dokumente in den Chat hoch, die mit deinem beruflichen Werdegang zu tun haben: alte oder unvollständige Lebensläufe, Zertifikate, Ausbildungs- und Schulungsnachweise, Arbeitszeugnisse, aber auch eigene Notizen oder Brainstorming-Texte (docx, pdf, md, txt, Google-Docs-Export, Bilder). Alles ist willkommen, auch unsortiert und doppelt. Schreib „fertig“, wenn alles hochgeladen ist.

Nach „fertig“: Einlesen, Kandidaten ins Faktenregister, Kurz-Zusammenfassung (siehe SKILL.md Phase 1).

## Z – Abschnitts-Bestätigung (nach jedem Abschnitt)

Zusammenfassung zuerst als Text/Tabelle im Chat, so wie die Angaben im CV stehen würden, dann:
```json
{"questions": [
 {"header": "Bestätigung", "multiSelect": false,
  "question": "Berufserfahrung – stimmt diese Zusammenfassung so? (Stationen, Zeiträume, Tätigkeiten, Zahlen siehe oben)",
  "options": [{"label": "Stimmt so", "description": "Abschnitt gilt als bestätigt, weiter zum nächsten"},
              {"label": "Korrigieren", "description": "Was falsch ist, über ‚Other‘ nennen"},
              {"label": "Noch etwas ergänzen", "description": "Fehlendes über ‚Other‘ nennen"}]}
]}
```
Bei „Korrigieren“/„Ergänzen“ ohne Freitext → einmal gezielt nachfragen. Nach der Änderung die Zusammenfassung **erneut** bestätigen lassen.

---

## P – Persönliche Angaben (Phase 2)

Option 1: Werte erfragen. Fehlt der Wert in der Antwort → Pflichtfeld bleibt leer, im Lückenbericht als kritisch markieren (ohne Kontaktdaten keine Einladung möglich).
```json
{"questions": [
 {"header": "Name", "multiSelect": false,
  "question": "Wie lautet dein vollständiger Name, so wie er im Lebenslauf stehen soll? (Vorname Nachname über ‚Other‘ eintragen.)",
  "options": [{"label": "Name eintragen", "description": "Über ‚Other‘ eingeben"},
              {"label": "Später nachtragen", "description": "Feld bleibt leer, im Bericht als kritisch markiert"}]},
 {"header": "Adresse", "multiSelect": false,
  "question": "Wie lautet deine Adresse (Straße Nr., PLZ Ort)? Sie gehört in den Haupttext der ersten Seite.",
  "options": [{"label": "Adresse eintragen", "description": "Über ‚Other‘ eingeben"},
              {"label": "Nicht angeben", "description": "Nur Ort (Wohnort) im CV – Hinweis im Bericht"}]},
 {"header": "E-Mail", "multiSelect": false,
  "question": "Welche E-Mail-Adresse soll im Lebenslauf stehen? (Seriöse Adresse, kein Spitzname.)",
  "options": [{"label": "E-Mail eintragen", "description": "Über ‚Other‘ eingeben"},
              {"label": "Später nachtragen", "description": "Feld bleibt leer, im Bericht kritisch"}]},
 {"header": "Telefon", "multiSelect": false,
  "question": "Unter welcher Telefonnummer bist du für Recruiter erreichbar?",
  "options": [{"label": "Nummer eintragen", "description": "Über ‚Other‘ eingeben"},
              {"label": "Später nachtragen", "description": "Feld bleibt leer, im Bericht kritisch"}]}
]}
```
Option 2: wie Runde 1 im Original – gefundenen Wert in die Frage, „Stimmt so“ / „Korrigieren“; bei mehreren abweichenden Werten (alte vs. neue Adresse) beide als Optionen.

Danach **Runde 2 des Original-Katalogs** (freiwillig / Verfügbar ab nur 1. oder 15. / Kinderbetreuung / Foto), dazu optional *LinkedIn/Xing-Profil*. Dann Z-Bestätigung.

## B – Berufserfahrung (Phase 3)

**B1 – Stationen-Inventar (Freitext im Chat oder per ‚Other‘).** Option 1:
> Liste alle beruflichen Stationen auf, von der aktuellsten rückwärts: Zeitraum (MM/JJJJ – MM/JJJJ), Position, Arbeitgeber, Ort. Denk auch an Nebenjobs, Praktika, Selbstständigkeit, Minijobs und Zeitarbeit. Genaue Tätigkeiten kommen gleich.

Option 2: gefundene Stationen als Tabelle zeigen und fragen:
```json
{"questions": [
 {"header": "Stationen", "multiSelect": true,
  "question": "Diese Stationen habe ich in deinen Dokumenten gefunden. Welche sollen in den Lebenslauf? (Monate/Daten prüfen wir danach.)",
  "options": [{"label": "Vertriebsinnendienst, Muster GmbH, Leipzig (2019–2022)", "description": "Beleg: Zeugnis_Muster.pdf; Monate fehlen"},
              {"label": "Aushilfe Verkauf, Beispiel AG, Erfurt (2017–2018)", "description": "Beleg: alter_CV.docx"}]},
 {"header": "Fehlt etwas", "multiSelect": false,
  "question": "Fehlen Stationen, die in den Dokumenten nicht auftauchen (Nebenjobs, Praktika, Selbstständigkeit)?",
  "options": [{"label": "Nein, vollständig", "description": "Keine weiteren Stationen"},
              {"label": "Ja, ergänzen", "description": "Über ‚Other‘ nennen: Zeitraum, Position, Arbeitgeber, Ort"}]}
]}
```
Dann pro Station fehlende **Monate** und **Zeiträume** nachfragen (Jahr ohne Monat ist unzulässig; ohne Antwort Jahr stehen lassen und im Bericht nennen).

**B2 – Tätigkeiten je Station.**
```json
{"header": "Tätigkeiten", "multiSelect": true,
  "question": "Was hast du bei „<Position>, <Arbeitgeber>“ konkret gemacht? Wähle zu, was stimmt – ergänze eigene Punkte über ‚Other‘ (Tools, Kundengruppen, Häufigkeit).",
  "options": [{"label": "<Tätigkeit 1 aus Dokument>", "description": "Beleg: <Datei> – ‚<Originalformulierung>‘"},
              {"label": "<Tätigkeit 2 aus Dokument>", "description": "Beleg: <Datei>"},
              {"label": "Keine davon / anderes", "description": "Eigene Tätigkeiten über ‚Other‘ eintragen"}]}
```
Option 1: Freitext-Frage im Chat („Beschreib in Stichpunkten, was du bei <Station> gemacht hast: Aufgaben, Kunden, Tools.“), danach Rückfragen zu Vagem („Kunden betreut“ → welche, wie viele, wie oft?).

**B3 – Wirkung und Zahlen:** Runde 5b des Original-Katalogs, hier für **jede Station mit Substanz** (Wirkung erst, dann Zahl). Ähnliche Stationen einzeln.

**B4 – Beendigungsgrund / Lücken:** Runde 4 und 3 des Original-Katalogs.

Danach Z-Bestätigung für den ganzen Abschnitt (Tabelle: Zeitraum | Position, Arbeitgeber, Ort | Bullets).

## A – Ausbildung und Weiterbildung (Phase 4)

```json
{"questions": [
 {"header": "Schule", "multiSelect": false,
  "question": "Was ist dein höchster Schulabschluss, und wann (MM/JJJJ) und wo hast du ihn gemacht?",
  "options": [{"label": "Angaben machen", "description": "Über ‚Other‘: Abschluss, Schule, Ort, Zeitraum"},
              {"label": "Nicht aufführen", "description": "Schulabschluss bleibt weg – Hinweis im Bericht"}]},
 {"header": "Berufsausbildung", "multiSelect": false,
  "question": "Hast du eine Berufsausbildung, ein Studium oder einen Abbruch davon? (Bei Abbruch: „ohne Abschluss“ wird immer angegeben.)",
  "options": [{"label": "Ja, Angaben machen", "description": "Über ‚Other‘: Bezeichnung, Institut, Ort, Zeitraum MM/JJJJ, mit/ohne Abschluss"},
              {"label": "Nein", "description": "Keine Berufsausbildung/kein Studium"}]},
 {"header": "Weiterbildung", "multiSelect": false,
  "question": "Welche Weiterbildungen, Umschulungen oder Kurse hast du gemacht oder machst du gerade? Laufende Weiterbildung bitte mit geplantem Ende, Bildungsträger und Ort.",
  "options": [{"label": "Ja, Angaben machen", "description": "Über ‚Other‘: Titel, Träger, Ort, Zeitraum MM/JJJJ – MM/JJJJ"},
              {"label": "Nein", "description": "Keine Weiterbildungen"}]}
]}
```
Der Name des Bildungsträgers aus Mustervorlagen darf nur als Antwortvorschlag zur Bestätigung erscheinen. Danach Z-Bestätigung.

## K – Kompetenzen (Phase 5)

```json
{"questions": [
 {"header": "IT/Tools", "multiSelect": false,
  "question": "Welche IT-Programme und Tools beherrschst du (z. B. Office, CRM, ERP) – jeweils mit Niveau: Grundkenntnisse, gute Kenntnisse oder sehr gute Kenntnisse?",
  "options": [{"label": "Angaben machen", "description": "Über ‚Other‘: Tool + Niveau + Herkunft (Berufspraxis/Weiterbildung)"},
              {"label": "Keine nennenswerten", "description": "Rubrik IT entfällt"}]},
 {"header": "Sprachen", "multiSelect": false,
  "question": "Welche Sprachen sprichst du, und auf welchem Niveau? Ist Deutsch deine Muttersprache?",
  "options": [{"label": "Angaben machen", "description": "Über ‚Other‘: Sprache + Niveau (z. B. Muttersprache, verhandlungssicher, gute Kenntnisse, Grundkenntnisse)"},
              {"label": "Nur Deutsch (Muttersprache)", "description": "Deutsch: Muttersprache"}]},
 {"header": "Zertifikate", "multiSelect": false,
  "question": "Welche Zertifikate oder Nachweise hast du (Bezeichnung, Aussteller, Datum MM/JJJJ)? Führerschein?",
  "options": [{"label": "Angaben machen", "description": "Über ‚Other‘ eintragen"},
              {"label": "Keine", "description": "Rubrik entfällt"}]},
 {"header": "Optional", "multiSelect": true,
  "question": "Was soll zusätzlich in den Lebenslauf? Nur aufnehmen, wenn es später für Rollen nützlich ist (Alltagserfahrungen mit Bezug sind erlaubt).",
  "options": [{"label": "Hobbies, Ehrenamt", "description": "Nur mit erkennbarem Berufsbezug"},
              {"label": "Eigene Projekte", "description": "z. B. Automatisierung, Portfolio – nur Inhalte, die du beschreibst"},
              {"label": "Unterschrift (Bild)", "description": "Dateipfad über ‚Other‘"},
              {"label": "Nichts davon", "description": "Rubriken entfallen"}]}
]}
```
Option 2: Zertifikate aus den Dokumenten als Auswahl mit Datum und Dateiname anbieten. Danach Z-Bestätigung.

## G – Gesamtprüfung (Phase 6)

Offene Punkte nur dort fragen, wo die Prüfung etwas findet (Lücken Runde 3, fehlende Monate, Doppeleintrag-Weiterbildung, fehlende Wirkung). Dann ein kurzes **Gesamtresümee** (Anzahl Stationen, Zeiträume lückenlos?, offene Punkte) mit Z-Bestätigung.

## K1–K4 – Kurzprofil (Phase 7, zuletzt)

Vorlagen K1–K4 stehen im Original-`fragenkatalog.md` (Abschnitt „Kurzprofil-Block K1–K4“) und gelten unverändert. Unterschied hier: Da es keine Zielstelle gibt, wird das Kurzprofil **breit** formuliert (Kernkompetenz, stärkster Beleg, Besonderheit). Vorschläge in K3 stammen ausschließlich aus dem **bestätigten** Faktenregister. In K1 bei „Ja (empfohlen)“ nur empfehlen, wenn der stärkste Beleg sonst erst auf Seite 2 stünde oder bei Quereinstieg.

---

## Regeln

- Antworten sofort ins Faktenregister mit `Antwort R<n>`; Option-2-Kandidaten erst nach Bestätigung mit `Antwort R<n> (bestätigt, Dokument <Name>)`.
- Nichts fragen, was eindeutig und bestätigt vorliegt.
- Unbeantwortet/„Nein“ → nicht notieren, im Lückenbericht aufführen.
- Pro Abschnitt beliebig viele Runden bis zur Vollständigkeit, aber jede Runde max. 4 Fragen und gezielt.
- Kein Abschnitt ohne Z-Bestätigung abschließen; Kurzprofil immer als letzter Abschnitt.
