---
name: lebenslauf-stellenanpassung-cockpitversion
description: >-
  Cockpit-Version des Skills lebenslauf-stellenanpassung. Gilt ausschließlich im
  JobScout-Cockpit (Lebenslauf-Editor, Ebene „CV neu formulieren“) und wird nur dort
  vom Backend (cv_formulieren.py) geladen. Gehört nicht in die globale Skill-Bibliothek
  und wird nicht außerhalb des Cockpits aufgerufen. Erstellt aus den Eingabefeldern
  des Anwenders (oder einem optionalen CV-Entwurf) und einer Stellenanzeige einen auf
  genau diese Stelle zugeschnittenen, ATS-tauglichen Lebenslauf als Text-PDF – nach den
  Best Practices aus DBA Modul 4 und den ATS-/DIN-5008-Richtlinien. Erfindet nichts,
  holt fehlende Informationen über gezielte Rückfragen ein und weist auf verbleibende
  Lücken hin.
---

# Lebenslauf passend zur Stellenanzeige – Cockpit-Version

> **Eigenständiger Skill für das JobScout-Cockpit.** Entstanden als Kopie von
> `lebenslauf-stellenanpassung`, danach umbenannt und für die Oberfläche des
> CV-Editors angepasst. Er wird nicht mit dem globalen Skill synchronisiert und gilt
> ausschließlich im Cockpit. Wo dieser Abschnitt von den Phasen weiter unten abweicht,
> **gilt dieser Abschnitt**.

## Anpassungen für das Cockpit (gehen den Phasen unten vor)

- **Eingaben:** Der Anwender trägt Stationen, Bildung und Kenntnisse in Felder ein. Ein hochgeladener CV-Entwurf ist optional und füllt nur diese Felder vor. Die Felder ersetzen den Rohentwurf; Quelle `Eingabe` im Faktenregister ersetzt `CV`.
- **Lose Stichpunkte:** Feldinhalte dürfen lose Wortgruppen und unsortierte Tätigkeiten sein. Daraus entstehen bewerbungsfertige Formulierungen, ohne neue Fakten.
- **Wörtlich übernehmen:** Ist ein Eintrag so markiert, bleibt jede Zeile buchstabengetreu. Das Cockpit erzwingt das, auch für Position, Unternehmen, Ort und Zeitraum.
- **Persönliche Daten (Phase 1) entfallen als Rückfrage:** Sie kommen aus dem Cockpit-Profil und werden vom Cockpit eingesetzt. Freiwillige Angaben erscheinen nur, wenn der Anwender sie im Schritt „Profil“ einschaltet.
- **Verfügbar ab:** Der Wert aus dem Profil bleibt unverändert. Liegt ein Datum nicht auf dem 1. oder 15., im Prüfbericht darauf hinweisen.
- **Rückfragen:** Statt AskUserQuestion zeigt das Cockpit Fragekarten mit Optionen und Freitextfeld. Der Fragenkatalog gilt inhaltlich weiter. Runden 1 und 2 entfallen, daher höchstens 5 Runden mit je höchstens 4 Fragen; der Kurzprofil-Block zählt nicht dazu.
- **Kurzprofil (Phase 4b):** Ablauf K1–K4 läuft im Schritt „Kurzprofil“. „Vorschläge machen“ ist dort eine echte Schaltfläche.
- **Rendern:** `scripts/render_cv.py` erzeugt dasselbe PDF wie beim Original. Das Cockpit speichert es zusätzlich unter `bewerbungen/`.
- **Übergabe:** Prüfbericht und Faktenregister liegen im Ordner des Entwurfs unter `formulieren/` und erscheinen im Schritt „Ergebnis“.
- **Schema der Job-Coach (verbindlich):** Eine laufende Weiterbildung und die berufliche Neuorientierung (`Ziel: Positionierung als …`) stehen oben in der Berufserfahrung, die Weiterbildung zusätzlich einzeilig unter „Ausbildung & Weiterbildung“. Es gelten die echten Zeiträume, nie Beispieldaten. Lücken über 2 Monate bekommen einen eigenen Eintrag mit dem vom Anwender genannten Grund. Der Wortlaut steht in `cv_editor.SCHEMA_REGELN`, die Umsetzung für die Analyse-Ebene in `cv_editor.wende_schema_an`.

## Grundlage: Modul-4-Standard

Aus **Rohentwurf-CV + Stellenanzeige** entsteht ein Lebenslauf, der in 30 Sekunden zeigt, warum die Person zur Stelle passt – nicht nur *was* sie gemacht hat (Tag 3), sondern *was es bewirkt hat* (Tag 4). Ergebnis: `Vorname_Nachname_Lebenslauf.pdf` + Prüfbericht mit offenen Lücken.

**Vor dem Arbeiten lesen:**
- `references/best-practices-modul4.md` – alle Regeln (Aufbau, Format, 7 ATS-Regeln, Lücken, Muss/Kann, Bullet-Formel, Wirkung §8a, Kurzprofil §8b, Rollen + ATS-Begriffe) mit Quellenkürzel
- `references/formulierungen.md` – Bausteine A–G, Bullet-Vorher/Nachher, Wirkungs- und Zahlenmuster je Rolle, Niveaus, verbindliche Kurzprofil-Schreibregeln
- `references/fragenkatalog.md` – fertige AskUserQuestion-Runden inkl. Kurzprofil-Block K1–K4

Kommunikation mit dem Anwender: Deutsch, duzen, kurz.

## Die eiserne Regel: Nichts erfinden

Jede Aussage im fertigen CV muss im **Faktenregister** eine Quelle haben:
`CV` (Rohentwurf) · `Antwort R<n>` (Antwort des Anwenders) · `abgeleitet` (rein rechnerisch, z. B. Dauer aus Daten).

- Die **Stellenanzeige ist nie Quelle für Fakten über die Person** – sie liefert nur Wortwahl, Schlüsselwörter, Priorisierung und Zielposition.
- Erlaubt: umformulieren (Bullet-Formel), Fachbegriff der Anzeige verwenden, **wenn derselbe Sachverhalt belegt ist** (CV: „Kunden am Telefon beraten“ + Anzeige: „Bedarfsanalyse“ → „Telefonische Bedarfsanalyse und Beratung von Kunden“ ✔), umsortieren, kürzen, betonen.
- Verboten: neue Zahlen, Tools, Kunden, Erfolge, Verantwortung, Niveaus, Abschlüsse; Zahlen runden über „ca.“ hinaus; Niveau einer Kenntnis anheben („Grundkenntnisse“ → „sehr gut“); eine Wirkung („Kundenbindung gesichert“) ohne Bestätigung ergänzen, nur weil sie zur Tätigkeit passen würde; Ergebnisse einer Station auf eine ähnliche Station übertragen.
- Zahlen dürfen Größenordnungen sein („ca. 30“, „bis zu 20 pro Woche“) – aber nur, was der Anwender im Gespräch **erklären und begründen** kann. Glaubwürdig statt übertreiben.
- Fehlt etwas Nötiges/Hilfreiches → **fragen**. Keine Antwort / „Nein“ → **weglassen** und im Lückenbericht nennen. Nie Platzhalter wie „XXX“ im CV.

## Ablauf

### Phase 0 – Eingaben einlesen

1. **CV-Rohentwurf** lesen, je nach Format:
   - PDF: `pdftotext -layout datei.pdf -`; kommt kaum Text heraus (Scan) → Datei mit dem Read-Tool als Bild/PDF ansehen
   - .docx/.doc/.rtf/.pages: `textutil -convert txt -stdout datei.docx` (macOS)
   - .md/.txt: Read-Tool · Bilder (png/jpg): Read-Tool (visuell)
2. **Stellenanzeige**: Datei wie oben; URL → WebFetch; eingefügter Text direkt.
3. Fehlt eins von beiden → einmal danach fragen, sonst nicht starten.
4. **Faktenregister** anlegen (intern, als Datei `faktenregister.md` im Ausgabeordner): je Station Zeitraum, Position, Unternehmen, Ort, Tätigkeiten wörtlich, Zahlen, Tools, Abschlüsse, Sprachen, Zertifikate, persönliche Daten – jeweils mit Quelle.
5. **Ausgabeordner**: neben dem CV-Rohentwurf `Lebenslauf_<Unternehmen>/` (Unternehmen aus der Anzeige, Dateinamen-tauglich) – sofern der Anwender nichts anderes sagt.

### Phase 1 – Persönliche Daten bestätigen (immer, per AskUserQuestion)

Runde 1 und 2 aus `fragenkatalog.md`:
- **Pflicht:** Name, Adresse, E-Mail, Telefon – gefundenen Wert in die Frage schreiben, „Stimmt so“ / „Korrigieren“.
- **Freiwillig:** Geburtsdatum, Familienstand, Nationalität – multiSelect, Empfehlung „Keine“ (laut Modul 4 keine Pflichtangaben mehr).
- **Hilfreich:** *Verfügbar ab* – nur Termine am **1. oder 15.** eines Monats anbieten (nächste drei ab heute + 14 Tage, Datum aus dem CV zuerst). Gibt der Anwender ein anderes Datum an, einmal mit den beiden nächsten 1./15.-Terminen und „Datum so lassen“ nachfragen – nie selbst umrechnen; *Kinderbetreuung gesichert* – nur auf ausdrücklichen Wunsch.
- **Foto:** vorhanden? (Kriterien: aktuell, neutraler Hintergrund, Blick in die Kamera, branchenpassende Kleidung).

Wählt der Anwender eine freiwillige Angabe ohne Wert (in multiSelect-Fragen wird „Other“ oft nicht genutzt), den Wert in der nächsten Runde **gezielt nachfragen**. Erst wenn der Anwender bestätigt hat, weiter.

**Andere Unterlagen des Anwenders** (z. B. eine ältere CV-Version, Projekt-READMEs) dürfen nur als **Antwortvorschlag** in einer Frage auftauchen („steht so in deinem CV v3 – stimmt das?“). Ins Faktenregister kommen sie erst nach Bestätigung. Wählt der Anwender eine Option, gibt den versprochenen Freitext aber nicht an (z. B. „Monate angeben“ ohne Monate), gilt das als **nicht beantwortet**.

### Phase 2 – Stellenanzeige analysieren

Schriftlich (für den Prüfbericht), nicht in den CV:
1. **Eckdaten:** Position (ohne „(m/w/d)“), Unternehmen, Ort/Modell, Branche, **Rollentyp** (SDR/BDR, Inbound, AE, KAM, Customer Success, Vertriebsinnendienst, Partner, Sales Ops/RevOps – Tabelle §9 in best-practices), Umfeld (Startup/Corporate, SMB/Enterprise), Bewerbungsweg (Portal → strikt ATS).
2. **Muss-/Kann-Tabelle** für jede Anforderung, mit Signalwort (§7). Gemischte Anforderungen aufteilen.
3. **Top-3-Aufgaben** – was braucht der Arbeitgeber am dringendsten (Transfer-Checkliste Frage 2).
4. **Schlüsselwortliste** (10–25 Begriffe: Tools, Methoden, Branchen, Soft Skills in der Schreibweise der Anzeige) → `keywords.txt` im Ausgabeordner.
5. **Eignung** je Anforderung Ja / Nein / Teilweise **nur auf Basis des Faktenregisters**, mit Beleg.

### Phase 3 – CV-Diagnose gegen Modul-4-Regeln

Prüfe den Rohentwurf und notiere Befunde:
- Top-10-Fehler (§2), Reihenfolge, Datumsformat, Datum/Position/Unternehmen/Ort in einer Zeile
- **Jahresangaben ohne Monat** (auch Abitur, Projekte, Zertifikate) → Monat in Phase 4 erfragen; ohne Antwort Jahr stehen lassen und im Bericht nennen (der Renderer warnt)
- **Lücken** ≥ 2 Monate (inkl. Lücke vor laufender Weiterbildung), Stationen ohne Beendigungsgrund bei vielen kurzen Wechseln, Ausbildungen ohne Hinweis „(ohne Abschluss)“
- laufende Weiterbildung → **Doppeleintrag** prüfen: steht sie in Berufserfahrung (`– heute`) UND in Ausbildung und Weiterbildung (voller Zeitraum + Bildungsträger + Ort)? Enddatum und Ort bekannt? Sonst in Phase 4 nachfragen
- Deutsch als Muttersprache angegeben? Kenntnisse mit Niveau?
- **ATS (7 Regeln, best-practices §5):** unklare/kreative Überschriften, Tabellen, Icons, Sternchen, Balken, Bewertungsskalen, uneinheitliche Datumsformate im Rohentwurf notieren – im neuen CV entfallen sie automatisch, im Bericht als „geändert“ nennen.
- **Wirkung (Tag 4, §8a):** Welche Bullets beschreiben nur Tätigkeiten? Wo stecken Wirkung oder Zahlen (Kunden, Gespräche, Aufgaben, Verantwortung, Ergebnisse) schon im Rohentwurf? **Ähnliche Stationen** mit leeren Unterpunkten („dieselben Aufgaben“)? Ziel festhalten: mindestens 3 Wirkungs-Kandidaten erkennen, um mindestens 2 im CV zu belegen.
- Relevanz jeder Station für die Top-3-Aufgaben: **hoch** (3–5 Bullets), **mittel** (1–2), **gering** (nur Kopfzeile; ggf. unter „Weitere Stationen“). Alle Stationen bleiben drin.
- Transfer-Checkliste Fragen 3–6: Wo wurde jede Top-3-Aufgabe schon gemacht? Gibt es Zahlen (Umfang, Häufigkeit, Verantwortung, Schwierigkeit, Wirkung)? Steht der stärkste Beleg oben auf Seite 1?

### Phase 4 – Fehlende Informationen erfragen

Runden 3–6 aus `fragenkatalog.md`, nur für echte Lücken – nichts fragen, was schon in CV oder Anzeige steht:
- Was war in jeder Lücke? (A–G)
- Beendigungsgründe (bei vielen Wechseln)
- Belege für Top-3-Aufgaben und für Muss-Kriterien mit „Nein“/„Teilweise“
- **Wirkung und Zahlen** für die 2–3 relevantesten Stationen (Runde 5b): erst „Was hat sich durch deine Arbeit verbessert?“ mit rollenpassenden Vorschlägen aus `formulierungen.md`, dann die Zahl (Kategorie + Größenordnung). Bei ähnlichen Stationen jede einzeln fragen. Dem Anwender sagen, dass kleine Erfolge zählen.
- optional: Hobbys/Ehrenamt mit Zielbezug? Unterschrift als Bild? Ort für die Datumszeile?

Höchstens 7 Runden gesamt, je Runde max. 4 Fragen; der Kurzprofil-Block zählt nicht dazu. Jede Antwort sofort ins Faktenregister (`Antwort R<n>`). Unbeantwortetes → Lückenbericht.

### Phase 4b – Kurzprofil

Erst hier, nach Prüfung und Auswertung (Phasen 1–4), Block K1–K4 aus `fragenkatalog.md`:

1. **K1 – Entscheidung:** Kurzprofil integrieren? „Ja“ / „Nein“ / „Später hinzufügen“.
   - **Nein:** kein Kurzprofil, Thema erledigt.
   - **Später hinzufügen:** CV ohne Kurzprofil bauen, im Faktenregister `Kurzprofil: später` notieren, in Phase 7 daran erinnern. Sagt der Anwender später „Kurzprofil jetzt hinzufügen“, bei K2 einsteigen, Ausgabeordner und Faktenregister weiterverwenden, neu rendern und Phase 6 wiederholen.
2. **K2 – Inhalte:** Anwender nach seinen Stichpunkten fragen, darunter die Schaltfläche **„Vorschläge machen“**. Eigene Stichpunkte → ins Faktenregister (`Antwort R<n>`), dann direkt zu K4 bzw. Schritt 5.
3. **K3 – Vorschläge** (nach Klick): **Fähigkeiten, Erfolge, Besonderheiten** aus dem Faktenregister vorschlagen, nur mit Beleg (`CV` oder `Antwort R<n>`), Beleg in die Optionsbeschreibung schreiben. Anwender wählt aus.
4. **K4 – Belege:** Gibt es in einer Kategorie keinen belegten Vorschlag oder bringen die Stichpunkte aus K2 Aussagen ohne Beleg, die **unbewiesene Fähigkeit/Erfolg/Besonderheit** nehmen und gezielt nach dem Beleg fragen (wo, wie oft, wie viele, mit welchem Ergebnis). Kandidaten kommen aus Selbstzuschreibungen im CV, Tätigkeiten ohne Ergebnis oder Anforderungen der Anzeige – die Anzeige liefert nur die Frage, nie den Fakt. Kommt kein Beleg → nicht ins Kurzprofil, im Bericht nennen.
5. **Text schreiben** strikt nach den Schreibregeln in `formulierungen.md` → „Kurzprofil“: 3, maximal 4 Zeilen `**Schlagwort** – Fakt`, Telegramm-Stil, keine Floskeln. Jede Zeile bekommt im Faktenregister einen Abschnitt *Kurzprofil* mit Quelle. Bei unter 3 belegten Zeilen: nichts auffüllen, `Kurzprofil: später` notieren und im Bericht nennen, welche Belege fehlen.

### Phase 5 – Lebenslauf bauen

`lebenslauf.json` im Ausgabeordner nach dem Schema in `assets/beispiel_lebenslauf.json` erstellen:

1. **Reihenfolge und Überschriften** (genau diese Begriffe, ATS-Regel 1): Name → Persönliche Daten (+ Foto) → *Kurzprofil* → Berufserfahrung → *Weitere Stationen* → Ausbildung und Weiterbildung → Zusatzqualifikationen → Kernkompetenzen → *Hobbies, Ehrenamt* bzw. *Eigene Projekte* → Ort, Datum (+ Unterschrift). Keine kreativen Überschriften.
2. **Berufserfahrung** antichronologisch, lückenlos.
   **Laufende Weiterbildung: immer an zwei Stellen** (Musterbeispiel Starter + Tag 2, Details in best-practices §6):
   - **Berufserfahrung, 1. Eintrag:** `MM/JJJJ – heute`, ohne Bildungsträger. Ohne Lücke davor: „Weiterbildung zum Digital Sales Manager“. Mit Lücke: Block „Berufliche Neuorientierung, Zielposition: <Position aus der Anzeige>“ mit Unter-Eintrag „Weiterbildung zum Digital Sales Manager“. Jeweils 3–5 rollenpassende **Schwerpunkte**, nur belegte Inhalte.
   - **Ausbildung und Weiterbildung, 1. Eintrag:** `MM/JJJJ – MM/JJJJ` mit geplantem Ende, „Digital Sales Manager, <Bildungsträger>, <Ort>“, ohne „Weiterbildung zum“ und ohne Schwerpunkte.
   - Der Renderer warnt, wenn einer der beiden Einträge fehlt.
3. **Bullets** – zwei Formeln kombinieren:
   - *Tätigkeit* (Tag 3): „Was gemacht → welche Fähigkeit → relevant für die Stelle“, Partizip-Stil, ohne „ich“, max. ~1,5 Zeilen.
   - *Wirkung* (Tag 4): bei den 1–2 wichtigsten Bullets jeder relevanten Station „Gemacht → Beitrag → was sich für Kunden/Team/Unternehmen verbessert hat“, mit Zahl, wenn bestätigt (Muster: `formulierungen.md` → Wirkungs-Bullets).
   - **Mindestens 2 Wirkungs-Bullets** im CV, wenn der Anwender Wirkungen bestätigt hat; sonst im Bericht als Lücke.
   - Reihenfolge innerhalb der Station: Bullet mit Bezug zur wichtigsten Top-3-Aufgabe zuerst, Zahlen nach vorn.
   - Jedes Ergebnis steht bei **der Station, wo es passiert ist** – ähnliche Stationen bekommen ihre eigenen Ergebnisse, keine bleibt leer, nur weil die Aufgaben gleich waren.
   - Begriffe der Anzeige (und rollentypische ATS-Begriffe, best-practices §9) **in den Tätigkeiten** verwenden, wo der Sachverhalt belegt ist – nicht nur unter Kernkompetenzen.
4. **Lücken** mit Baustein A–G; Beendigungsgründe im Feld `beendigungsgrund` (erscheint kursiv unter den Bullets).
5. **Kernkompetenzen:** 6–10 Schlüsselwörter der Anzeige, die durch das Faktenregister gedeckt sind, in Schreibweise der Anzeige.
6. **Zusatzqualifikationen:** IT mit Niveau-Wort und ggf. „(zertifiziert: MM/JJJJ)“, Herkunft „(Weiterbildung)“ vs. „(Berufspraxis)“ kennzeichnen, wenn bekannt; Sprachen inkl. **Deutsch: Muttersprache** (nur wenn belegt bzw. bestätigt).
7. **Länge:** Ziel 2 Seiten (1 = zu kurz, > 3 = zu lang). Kürzen über die Relevanz-Stufen, nicht über Weglassen von Stationen. Bewährte Reihenfolge, wenn es mehr als 2 Seiten werden:
   1. doppelte Einträge streichen (z. B. Ausbildung nicht zusätzlich in der Berufserfahrung)
   2. ältere Stationen ohne Bezug zur Stelle einzeilig unter „Weitere Stationen“ (sie bleiben im CV)
   3. Zertifikate auf 3–5 zielstellenrelevante kürzen, den Rest im Bericht erwähnen
   4. lange Kenntnis- oder Projektzeilen straffen, mehrere Projekte zu einem Eintrag mit Bullets bündeln
   5. Bullets geringer Relevanz streichen
8. **Kurzprofil** (nur nach „Ja“ in Phase 4b) mit dem Text aus Phase 4b ins JSON übernehmen: `"kurzprofil": [{"schlagwort": "…", "fakt": "…"}, …]`.
9. **Eigene Projekte** (z. B. Automatisierungen, Portfolio) als Rubrik über `interessen` mit `interessen_titel`, z. B. „Eigene Projekte (Prozessautomatisierung)“. Inhalte nur aus der Beschreibung des Anwenders oder aus Projekt-READMEs, die er genannt hat.
10. Datumszeile: Wohnort aus Adresse + heutiges Datum `TT.MM.JJJJ`.
11. **Foto und Unterschrift** (vom Anwender geliefert) in den Ausgabeordner kopieren und mit absolutem Pfad in `person.foto` bzw. `abschluss.unterschrift` eintragen. Das Foto steht rechts neben Name und Kontaktdaten. Vorher prüfen: Kriterien aus Tag 1 und Auflösung (unter ca. 400 px Kantenlänge im Bericht erwähnen). Eine abfotografierte Unterschrift eng zuschneiden (`sips -c <Höhe> <Breite> in.jpg --out out.jpg`, mittig). Den grauen Papierton entfernt der Renderer per Filter.

### Phase 6 – Rendern und prüfen

```bash
# Das Cockpit ruft scripts/render_cv.py in diesem Skill-Ordner selbst auf
python3 scripts/render_cv.py \
  "<Ausgabeordner>/lebenslauf.json" --out "<Ausgabeordner>" --keywords "<Ausgabeordner>/keywords.txt"
```
Das Skript erzeugt `Vorname_Nachname_Lebenslauf.pdf` (+ HTML) per Chrome headless, setzt Ränder 25/20/25/25 mm (oben adaptiv 20 mm), fügt bei Bedarf „Berufserfahrung (Fortsetzung)“ ein und gibt einen JSON-Prüfbericht aus (Seiten, Warnungen, Keyword-Abdeckung). Ohne Chrome: `--html-only`, Anwender druckt als PDF.

Danach selbst prüfen:
- PDF visuell ansehen (Read-Tool auf die PDF) – Layout sauber, nichts abgeschnitten, Datum und Titel in einer Zeile.
- `pdftotext` **ohne** `-layout` (so ähnlich lesen viele Parser): Feldname und Wert müssen zusammen stehen („Adresse: …“), das Datum vor dem passenden Titel, Kontaktdaten im Text. Erscheinen alle Feldnamen in einem Block und die Werte erst danach, ist das Layout zweispaltig geraten → korrigieren.
- **Faktencheck:** jede Zeile des CV gegen das Faktenregister – keine Aussage ohne Quelle. Bei Abweichung korrigieren und neu rendern.
- Keyword-Abdeckung: fehlende Muss-Keywords nur ergänzen, wenn belegt – sonst in den Lückenbericht.
- **Rechtschreibung** (ATS-Regel 7): den kompletten extrahierten Text einmal am Stück lesen wie einen Ausdruck – Tippfehler, einheitliche Schreibweisen („E-Mail“, „HubSpot“), Gedankenstrich in Zeiträumen, Partizip-Stil durchgängig.
- **Wirkungs-Check:** Haben die relevantesten Stationen je mindestens einen Wirkungs-Bullet? Stehen Zahlen vorne? Ist jede Zahl im Faktenregister mit `Antwort R<n>` oder `CV` belegt? Klingt nichts übertrieben?
- **Kurzprofil-Check:** Hat jede Zeile eine konkrete Information und eine Quelle im Faktenregister? Keine Floskel, auch keine ähnliche, die der Renderer nicht kennt?
- Renderer-Warnungen zu Datumsformat, Sonderzeichen (Sternchen/Balken), Überschriften, Zahlen-Bullets, Kurzprofil-Regeln und ähnlichen Stationen ohne Unterpunkte abarbeiten.

### Phase 7 – Übergabe

`pruefbericht.md` im Ausgabeordner, kurz und scanbar:
1. **Stelle & Rollentyp** (1–2 Zeilen)
2. **Muss-/Kann-Tabelle mit Eignung** (Ja/Nein/Teilweise + Beleg) und Fazit nach Faustregel
3. **Was geändert wurde** (5–10 Punkte, z. B. „stärkster Beleg ‚ca. 30 Stammkunden‘ an Position 1 der Raiffeisen-Station“)
4. **Wirkung und Zahlen** – Tabelle *Station | Tätigkeit vorher | Wirkungs-Bullet jetzt | Quelle*; Stationen, für die keine Wirkung/Zahl bestätigt wurde, mit Tipp (welche Kategorie sich anbieten würde)
5. **Kurzprofil** – Tabelle *Zeile | Quelle*, verworfene Aussagen ohne Beleg; bei „später“ oder „nein“ nur der Status
6. **Keyword-Abdeckung** (gefunden / gesamt, fehlende)
7. **Offene Lücken ⚠** – jede Information, die nötig oder hilfreich wäre, aber nicht belegt werden konnte, mit Wirkung („Muss-Kriterium Salesforce-Praxis nicht belegt → im Interview mit Weiterbildung argumentieren“) und was der Anwender tun kann
8. **Interview-Kurzantworten** zu jeder Lücke im Lebenslauf (1–2 Sätze) und zu jeder Zahl im CV ein Satz, wie sie zustande kam (Recruiter fragen nach)

Dem Anwender im Chat: Pfad zur PDF, Seitenzahl, Top-3-Änderungen, die Liste **offene Lücken**, das fertige Kurzprofil bzw. bei Status „später“ den Hinweis, dass „Kurzprofil jetzt hinzufügen“ reicht – und die Datei per SendUserFile schicken, falls verfügbar.

## Typische Fallen

- Anzeige-Keywords „hineinschmuggeln“, die nicht belegt sind → Faktenverstoß.
- Weiterbildungsinhalte komplett aufzählen → nur Zielstellen-Relevantes.
- Weiterbildung nur an einer Stelle eintragen, oder an beiden Stellen identisch (Bildungsträger gehört nur in den Ausbildungsteil, „– heute“ nur in die Berufserfahrung).
- Kontaktdaten in Kopf-/Fußzeile, Icons, Skill-Balken, zwei echte Spalten → ATS-Fehler.
- „Verfügbar ab“ an einem anderen Tag als dem 1./15. vorschlagen – oder umgekehrt ein bestätigtes Datum still auf den 1./15. verschieben. Bestätigte Angaben werden nie ohne Rückfrage geändert.
- Freiwillige Angaben ungefragt übernehmen, nur weil sie im Rohentwurf stehen.
- Lücke „verstecken“ durch Jahresangaben ohne Monat → immer `MM/JJJJ`.
- Stationen löschen statt kürzen.
- Nur Tätigkeiten auflisten, ohne zu fragen, was sie bewirkt haben → Tag-4-Fehler.
- Wirkung „dazudichten“ („Kundenzufriedenheit erhöht“), weil sie plausibel klingt → nur nach Bestätigung.
- Kurzprofil ungefragt schreiben, vor Phase 4 abfragen oder als Floskel-Fließtext („ausgeprägte Kommunikationsstärke …“) statt 3–4 belegter Zeilen.
- Unbewiesene Aussage ins Kurzprofil nehmen, weil die Belegfrage unbeantwortet blieb.
- Ähnliche Stationen: eine voll, die andere leer – oder Ergebnisse doppelt bei beiden.
