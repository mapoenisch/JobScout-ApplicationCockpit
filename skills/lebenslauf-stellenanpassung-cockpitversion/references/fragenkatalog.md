# Fragenkatalog für AskUserQuestion

Grenzen des Tools: **1–4 Fragen pro Aufruf, 2–4 Optionen je Frage**, „Other“ (Freitext) wird automatisch ergänzt. Jede Frage muss für sich verständlich sein (der Anwender sieht oft nur den Dialog) → den gefundenen Wert **in die Frage schreiben**.
Empfohlene Option zuerst, mit „(empfohlen)“ markieren.

---

## Runde 1 – Pflichtangaben bestätigen (immer)

Eine Frage je Pflichtfeld, Wert aus dem CV im Fragetext. Fehlt der Wert: „Im CV ist keine <Feld> zu finden – bitte über ‚Other‘ eintragen.“

```json
{"questions": [
 {"header": "Name", "multiSelect": false,
  "question": "Name laut CV: „Max Mustermann“. Stimmt das so?",
  "options": [{"label": "Stimmt so", "description": "Name wird unverändert übernommen"},
              {"label": "Korrigieren", "description": "Korrekte Schreibweise über ‚Other‘ eingeben"}]},
 {"header": "Adresse", "multiSelect": false,
  "question": "Adresse laut CV: „Musterstraße 1, 04109 Leipzig“. Stimmt das so?",
  "options": [{"label": "Stimmt so", "description": "..."}, {"label": "Korrigieren", "description": "..."}]},
 {"header": "E-Mail", "...": "analog – Hinweis, wenn die Adresse unprofessionell wirkt (z. B. Spitzname): Option 'Andere Adresse nutzen'"},
 {"header": "Telefon", "...": "analog – Format +49 … oder 0… beibehalten, nur Leerzeichen vereinheitlichen"}
]}
```
Wählt der Anwender „Korrigieren“ ohne Freitext → einmal nachfragen. Pflichtfeld bleibt leer → **im CV leer lassen und im Lückenbericht als kritisch markieren** (ohne Kontaktdaten keine Einladung möglich).

## Runde 2 – Freiwillige und hilfreiche Angaben (immer)

```json
{"questions": [
 {"header": "Freiwillig", "multiSelect": true,
  "question": "Welche freiwilligen Angaben sollen in den Lebenslauf? Im CV gefunden: Geburtsdatum 22.05.1988, Familienstand –, Nationalität deutsch. Sie sind keine Pflicht mehr (Modul 4, Tag 1).",
  "options": [{"label": "Keine (empfohlen)", "description": "Weglassen – laut Modul 4 kein Pflichtbestandteil, AGG-neutral"},
              {"label": "Geburtsdatum", "description": "Wert aus CV bzw. über ‚Other‘ angeben"},
              {"label": "Familienstand", "description": "Wert über ‚Other‘ angeben, falls nicht im CV"},
              {"label": "Nationalität", "description": "Sinnvoll z. B. bei Arbeitserlaubnis-Fragen"}]},
 {"header": "Verfügbar", "multiSelect": false,
  "question": "Ab wann bist du verfügbar? (Modul 4: immer den 1. oder 15. eines Monats angeben)",
  "options": [{"label": "01.12.2026", "description": "nächster möglicher Monatsanfang"},
              {"label": "15.12.2026", "description": "Monatsmitte"},
              {"label": "01.01.2027", "description": "..."},
              {"label": "Nicht angeben", "description": "Zeile entfällt"}]},
 {"header": "Kinder", "multiSelect": false,
  "question": "Soll „Kinderbetreuung: gesichert“ im Lebenslauf stehen? Nur sinnvoll, wenn du Kinder hast und die Betreuung organisiert ist.",
  "options": [{"label": "Nicht angeben", "description": "Keine Kinder oder lieber nicht erwähnen"},
              {"label": "Ja, gesichert", "description": "Zeile ‚Kinderbetreuung: gesichert‘ aufnehmen"}]},
 {"header": "Foto", "multiSelect": false,
  "question": "Hast du ein Bewerbungsfoto (aktuell, neutraler Hintergrund, Blick in die Kamera, branchenpassende Kleidung)?",
  "options": [{"label": "Ja, Pfad angeben", "description": "Dateipfad über ‚Other‘ eintragen"},
              {"label": "Ohne Foto", "description": "Kein Foto – im Bericht als Hinweis vermerkt"}]}
]}
```
**Verfügbar-ab-Optionen berechnen:** ab heute + 14 Tage die nächsten drei Termine, die auf den 1. oder 15. fallen. Freitext-Datum, das kein 1./15. ist → **nie still ändern**, sondern einmal nachfragen:
```json
{"header": "Verfügbar", "multiSelect": false,
 "question": "Du hast „20.01.2027“ angegeben. Modul 4 empfiehlt den 1. oder 15. eines Monats. Welches Datum soll in den Lebenslauf?",
 "options": [{"label": "15.01.2027", "description": "nächster Termin davor"},
             {"label": "01.02.2027", "description": "nächster Termin danach"},
             {"label": "20.01.2027 lassen", "description": "Dein Datum bleibt, Hinweis im Bericht"}]}
```
Ins CV kommt nur das bestätigte Datum. Ohne Antwort bleibt das ursprünglich angegebene Datum stehen (Hinweis im Bericht).
Ist ein Datum im CV vorhanden, dieses als erste Option „(laut CV)“ anbieten.

## Runde 3 – Lücken (nur wenn Lücken gefunden)

Pro Lücke eine Frage (max. 4 je Aufruf, sonst weitere Runde):
```json
{"header": "Lücke 1", "multiSelect": false,
 "question": "Zwischen „POCO, Erfurt“ (bis 11/2018) und „Ausbildung“ (ab 08/2019) liegen 12/2018 – 07/2019. Was war in dieser Zeit?",
 "options": [{"label": "Auf Jobsuche", "description": "Beispiel A"},
             {"label": "Gesundheit/Reha", "description": "Beispiel E – ohne Details"},
             {"label": "Eltern-/Pflegezeit", "description": "Beispiel B oder D – Details über ‚Other‘"},
             {"label": "Sabbatical/Reise", "description": "Beispiel C – Länder über ‚Other‘"}]}
```
Weitere Optionen (Weiterbildung, Selbstständigkeit, Nebenjob) kommen über „Other“. **Keine Antwort → Zeitraum trotzdem sichtbar lassen** (nur „MM/JJJJ – MM/JJJJ“ ohne Erklärung) und im Lückenbericht nennen.

## Runde 4 – Beendigungsgründe (nur bei ≥ 3 Stationen < 2 Jahre, oder wenn Anwender es möchte)

```json
{"header": "Wechsel", "multiSelect": false,
 "question": "Warum endete „Fachberater, OBI, Jena (01/2025 – 10/2025)“?",
 "options": [{"label": "Befristet", "description": "..."},{"label": "Arbeitnehmerüberl.", "description": "Einsatz beendet"},
             {"label": "Betriebsbedingt", "description": "wirtschaftliche Gründe / Übernahme"},
             {"label": "Nicht angeben", "description": "Zeile entfällt"}]}
```

## Runde 5 – Belege für Top-3-Aufgaben und offene Anforderungen (Transfer-Checkliste)

Für jede **Top-3-Aufgabe** der Anzeige und jedes **Muss-Kriterium mit Eignung „Nein“/„Teilweise“**:
```json
{"header": "Beleg", "multiSelect": false,
 "question": "Die Anzeige fordert „Erfahrung mit Salesforce“ (Muss). Im CV steht dazu nichts. Hast du damit gearbeitet – wo und wie intensiv?",
 "options": [{"label": "Ja, Details", "description": "Station + Umfang über ‚Other‘ beschreiben"},
             {"label": "Nur Weiterbildung", "description": "Kenntnisse aus Kurs/Zertifikat – wird so gekennzeichnet"},
             {"label": "Nein", "description": "Wird nicht behauptet – im Bericht als Lücke vermerkt"}]}
```
## Runde 5b – Wirkung und Zahlen (Tag 4, für die 2–3 relevantesten Stationen)

Erst **Wirkung**, dann **Zahl** – je Station. Optionen aus `formulierungen.md` (Tabelle Situation → Wirkung) passend zu Rolle **und** belegten Tätigkeiten der Station wählen; sie sind Vorschläge, die der Anwender bestätigt.
```json
{"header": "Wirkung", "multiSelect": true,
 "question": "Bei „Fachberater, OBI, Jena“ steht „Reklamationen bearbeitet“ und „Kunden beraten“. Was hat sich durch deine Arbeit verbessert? (Kleine Erfolge zählen – Recruiter erwarten keine Riesenerfolge.)",
 "options": [{"label": "Kunden gehalten", "description": "Verärgerte Kunden nach Reklamationen zurückgewonnen"},
             {"label": "Zusatzverkäufe", "description": "Durch gezielte Beratung zusätzliche Verkäufe erzielt"},
             {"label": "Kollegen eingearbeitet", "description": "Neue Kollegen schneller einsatzfähig gemacht – wie viele über ‚Other‘"},
             {"label": "Nichts davon", "description": "Eigenes Beispiel über ‚Other‘ oder Bullet bleibt ohne Wirkung"}]}
```
Weitere Leitfragen über „Other“ anbieten: Wo hast du geholfen, Verantwortung übernommen, Probleme gelöst, unter Stress gut gearbeitet?

**Ähnliche Stationen** (gleicher Titel/Branche): für **jede** Station einzeln fragen – „Was war bei <Station B> anders als bei <Station A>?“ – Ergebnisse nie von einer Station zur anderen übertragen.

Und für die passende Station nach Zahlen fragen – Kategorien Kunden · Gespräche · Aufgaben · Verantwortung · Ergebnisse (Tag 4) bzw. Umfang / Häufigkeit / Verantwortung / Schwierigkeit / Wirkung (Tag 3). Hinweis in die Frage: „Größenordnung reicht, nur was du im Gespräch erklären kannst“:
```json
{"header": "Zahlen", "multiSelect": false,
 "question": "Für „Kaufmann im Großhandel, Raiffeisen (2022–2024)“: Kannst du eine Größe nennen – z. B. Anzahl betreuter Kunden, Angebote pro Woche, Auftragsvolumen?",
 "options": [{"label": "Ja, Zahl nennen", "description": "Über ‚Other‘ eintragen (ca.-Werte erlaubt)"},
             {"label": "Vertraulich", "description": "Nur Größenordnung oder %-Entwicklung angeben"},
             {"label": "Keine Zahl", "description": "Bullet bleibt ohne Zahl"}]}
```

## Runde 6 – Optionales (nur wenn sinnvoll)

- **Hobbys/Ehrenamt** mit Zielbezug vorhanden? (T3 Beispiel C)
- **Unterschrift** als Bilddatei vorhanden? Ort für „Ort, Datum“ (Standard: Wohnort aus Adresse)

## Kurzprofil-Block K1–K4 (Phase 4b, nach Runde 6)

**K1 – Entscheidung (immer).** „(empfohlen)“ an „Ja“ nur bei Quereinstieg oder wenn der stärkste Beleg sonst erst auf Seite 2 stünde.
```json
{"questions": [
 {"header": "Kurzprofil", "multiSelect": false,
  "question": "Die Prüfung deines Lebenslaufs ist abgeschlossen. Möchtest du ein Kurzprofil oben im Lebenslauf integrieren?",
  "options": [{"label": "Ja", "description": "Wir erstellen es jetzt gemeinsam"},
              {"label": "Nein", "description": "Lebenslauf ohne Kurzprofil"},
              {"label": "Später hinzufügen", "description": "Lebenslauf jetzt ohne Kurzprofil, du kannst es jederzeit ergänzen lassen"}]}
]}
```

**K2 – Inhalte (nach „Ja“).** Eigene Stichpunkte kommen über „Other“.
```json
{"questions": [
 {"header": "Inhalte", "multiSelect": false,
  "question": "Was soll in deinem Kurzprofil stehen? Stichpunkte reichen, denk zum Beispiel an: 1. Was du genau machst (inkl. Tools, Branchen, Teamgrößen). 2. Konkreter Erfolg oder Projekt, auf das du stolz bist (am besten mit einer Zahl: Zeit gespart, Umsatz gemacht, Fehlerquote gesenkt, Prozess beschleunigt). 3. Eine Sache, die dich von anderen in deinem Job unterscheidet (z. B. ungewöhnliche Kombination aus zwei Fähigkeiten). Trage deine Stichpunkte über ‚Other‘ ein.",
  "options": [{"label": "Vorschläge machen", "description": "Ich schlage dir Fähigkeiten, Erfolge und Besonderheiten aus deinem Lebenslauf vor"},
              {"label": "Doch später", "description": "Lebenslauf jetzt ohne Kurzprofil"}]}
]}
```

**K3 – Vorschläge (nach „Vorschläge machen“).** Je Kategorie eine Frage, nur belegte Einträge aus dem Faktenregister, Beleg in die Beschreibung. Kategorie ohne belegten Eintrag entfällt hier und geht zu K4. Bei nur einem Vorschlag zusätzlich „Keiner davon“ anbieten (Tool verlangt mindestens 2 Optionen).
```json
{"questions": [
 {"header": "Fähigkeiten", "multiSelect": true,
  "question": "Welche Fähigkeiten aus deinem Lebenslauf sollen ins Kurzprofil? Eigene Ergänzungen über ‚Other‘.",
  "options": [{"label": "Stammkundenbetreuung", "description": "Beleg: „Ca. 30 Stammkunden betreut“, Muster Handels GmbH (CV)"},
              {"label": "SAP SD", "description": "Beleg: Stammdatenpflege im SAP, Muster Handels GmbH (CV)"}]},
 {"header": "Erfolge", "multiSelect": true,
  "question": "Welche Erfolge aus deinem Lebenslauf sollen ins Kurzprofil?",
  "options": [{"label": "...", "description": "Beleg: ... (CV oder Antwort R<n>)"}, {"label": "Keiner davon", "description": "Kein Erfolg aus dieser Liste"}]},
 {"header": "Besonderheit", "multiSelect": true,
  "question": "Was unterscheidet dich laut deinem Lebenslauf von anderen in deinem Job?",
  "options": [{"label": "...", "description": "Beleg: ..."}, {"label": "Keiner davon", "description": "Keine Besonderheit aus dieser Liste"}]}
]}
```

**K4 – Belege (nur für unbewiesene Aussagen).** Eine Frage je Aussage, höchstens 4 je Aufruf; die wichtigsten zuerst. Aussage und Fundstelle in die Frage schreiben, keine Zahl vorgeben.
```json
{"header": "Beleg", "multiSelect": false,
 "question": "In deinem Lebenslauf steht „kommunikationsstark“, aber kein Beispiel dazu. Woran lässt sich das zeigen? Zum Beispiel: Wie viele Gespräche pro Tag, welche schwierige Situation, welches Ergebnis? Größenordnung reicht, nur was du im Gespräch erklären kannst.",
 "options": [{"label": "Beleg nennen", "description": "Über ‚Other‘ eintragen, die Zeile nennt dann den Beleg statt des Schlagworts"},
             {"label": "Streichen", "description": "Aussage kommt nicht ins Kurzprofil, Hinweis im Bericht"}]}
```
„Beleg nennen“ ohne Text gilt als nicht beantwortet → Aussage entfällt.

## Regeln

- Max. **7 Runden** für Runde 1–6; Runden 3–6 zusammenlegen, wenn ≤ 4 Fragen übrig sind. Wirkung/Zahlen (5b) nie streichen, sondern auf die relevantesten Stationen begrenzen. Der Kurzprofil-Block K1–K4 kommt zusätzlich und läuft immer zuletzt.
- Nichts fragen, was eindeutig in CV oder Anzeige steht.
- Antworten des Anwenders sofort ins Faktenregister mit Quelle `Antwort R<n>` übernehmen.
- Unbeantwortet/„Nein“ → **nicht notieren**, im Lückenbericht aufführen.
- Beispielwerte in Freitext-Fragen als Muster kennzeichnen (z. B. „MM/JJJJ – MM/JJJJ“ statt echt wirkender Daten). Ist eine Antwort **wortgleich mit dem Beispiel**, einmal nachfragen, ob das wirklich die eigenen Daten sind.
