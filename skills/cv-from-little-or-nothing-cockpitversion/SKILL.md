---
name: cv-from-little-or-nothing-cockpitversion
description: >-
  Cockpit-Version des Skills cv-from-little-or-nothing. Gilt ausschließlich im
  JobScout-Cockpit (Lebenslauf-Editor) und wird nur dort vom Backend geladen. Gehört nicht
  in die globale Skill-Bibliothek. Erstellt einen Basis-Lebenslauf ohne Stellenbezug
  (ATS-tauglich, Text-PDF) aus Eingabefeldern, Rückfragen und optional hochgeladenem
  Material: nichts wird erfunden, die Felder des Anwenders gelten als bestätigt, das
  Kurzprofil kommt erst am Ende und nur auf Wunsch.
---

# Basis-Lebenslauf aus wenig oder nichts – Cockpit-Version

> **Eigenständiger Skill für das JobScout-Cockpit.** Entstanden als Kopie von
> `cv-from-little-or-nothing`, danach umbenannt und für die Oberfläche des CV-Editors
> angepasst (Karte „Basis-CV erstellen“, Modus `basis` in `cv_formulieren.py`). Er wird nicht
> mit dem globalen Skill synchronisiert und gilt ausschließlich im Cockpit. Wo dieser
> Abschnitt von den Phasen weiter unten abweicht, **gilt dieser Abschnitt**.

## Anpassungen für das Cockpit (gehen den Phasen unten vor)

- **Eingaben statt Fragerunden pro Abschnitt:** Der Anwender trägt Stationen, Bildung und Kenntnisse in Felder ein (Phasen 2 bis 5). Die Felder gelten als bestätigte Abschnitte, eine eigene Bestätigungs-Zusammenfassung entfällt. Lose Stichpunkte sind erlaubt, daraus entstehen Formulierungen ohne neue Fakten.
- **Option 1 und 2 (Phase 0 und 1):** Es gibt keine Start-Auswahl. Option 1 ist der leere Editor. Option 2 ist der optionale Upload (PDF, Word, Markdown, Bild) im Schritt „Zielrichtung“: Das Cockpit liest die Dokumente aus und füllt nur die Felder vor. Was dort steht, prüft der Anwender selbst. Nichts wird ungefragt zum Fakt.
- **Zielrichtung:** Statt Stellenanzeige gibt es ein Freitextfeld „Zielrichtung“ (optional). Es steuert nur Gewichtung und Wortwahl, nie Inhalte. Ist es leer, gelten die Wunschrollen aus dem Profil.
- **Persönliche Daten (Phase 2) entfallen als Rückfrage:** Sie kommen aus dem Cockpit-Profil. Freiwillige Angaben erscheinen nur, wenn der Anwender sie im Schritt „Profil“ einschaltet. *Verfügbar ab* bleibt unverändert; liegt es nicht auf dem 1. oder 15., im Prüfbericht darauf hinweisen.
- **Rückfragen:** Statt AskUserQuestion zeigt das Cockpit Fragekarten mit Optionen und Freitextfeld. Höchstens 5 Runden mit je höchstens 4 Fragen (Lücken, Beendigungsgründe, Wirkung und Zahlen, Gesamtprüfung). Unbeantwortetes wird weggelassen und als Lücke gemeldet. Der Kurzprofil-Block zählt nicht dazu.
- **Wörtlich übernehmen:** Ist ein Eintrag so markiert, bleibt jede Zeile buchstabengetreu. Das Cockpit erzwingt das.
- **Kurzprofil (Phase 7):** Läuft im Schritt „Kurzprofil“ nach den Rückfragen: Ja, Nein oder Später, dann Stichpunkte oder „Vorschläge machen“, Belegfragen, Text nach den Schreibregeln.
- **Rendern und Ablage:** Gerendert wird mit `scripts/render_cv.py` der Cockpit-Version `../lebenslauf-stellenanpassung-cockpitversion/`. Die Gemeinsamen Grundlagen (best-practices, formulierungen, fragenkatalog, JSON-Schema) liegen ebenfalls dort. Das PDF heißt `Vorname_Nachname_Lebenslauf.pdf` (ohne Firmenzusatz) und wird unter `bewerbungen/` gespeichert. Prüfbericht und Faktenregister liegen im Ordner des Entwurfs unter `formulieren/` und erscheinen im Schritt „Ergebnis“.
- **Übergabe:** Für eine konkrete Bewerbung dient der Basis-CV danach als Entwurf der Cockpit-Ebene „CV-Entwurf umformulieren“ (Stellenanzeige dazu, Skill `lebenslauf-stellenanpassung-cockpitversion`).
- **Schema der Job-Coach (verbindlich):** Eine laufende Weiterbildung und die berufliche Neuorientierung (`Ziel: Positionierung als …`) stehen oben in der Berufserfahrung, die Weiterbildung zusätzlich einzeilig unter „Ausbildung & Weiterbildung“. Es gelten die echten Zeiträume, nie Beispieldaten. Lücken über 2 Monate bekommen einen eigenen Eintrag mit dem vom Anwender genannten Grund. Als Zielrolle gilt die Zielrichtung, sonst die Wunschrolle aus dem Profil; nie eine erfundene. Wortlaut: `cv_editor.SCHEMA_REGELN`.

## Grundlage

Aus **Fragerunden** (Option 1) oder **hochgeladenen Unterlagen + Fragerunden** (Option 2) entsteht ein vollständiger, ehrlicher, ATS-tauglicher **Basis-Lebenslauf** ohne Bezug zu einer konkreten Stelle. Ergebnis: `Vorname_Nachname_Lebenslauf.pdf`, `faktenregister.md` und ein Prüfbericht mit offenen Lücken.

## Zusammenspiel mit der Cockpit-Ebene „CV-Entwurf umformulieren“

| | **Basis-CV erstellen** (dieser Skill) | **CV-Entwurf umformulieren** (`lebenslauf-stellenanpassung-cockpitversion`) |
|---|---|---|
| Ausgangslage | kein CV, veralteter CV, lose Dokumente/Stichpunkte | aktueller, weitgehend vollständiger CV-Entwurf |
| Eingaben | nichts oder beliebige Unterlagen | CV-Entwurf **+ Stellenanzeige** |
| Ergebnis | breiter **Basis-CV** | auf **eine Stelle** zugeschnittener CV |
| Eignung | Kartei einer Recruiting-Agentur, Jobportale/-börsen (breite Passung auf viele Rollen/Branchen), Grundlage für Stellenanpassung | konkrete Bewerbung |

**Best Practice:** Hast du keinen brauchbaren CV → **erst Basis-CV erstellen, danach „CV-Entwurf umformulieren“** für jede einzelne Bewerbung. Liegt bereits ein aktueller, weitgehend vollständiger Entwurf vor, ist direkt „CV-Entwurf umformulieren“ der richtige Einstieg.

Diese Verbindung **zu Beginn** (Phase 0, kurz) und **in der Übergabe** (Phase 8) nennen. Passt die Situation offensichtlich besser zum anderen Skill (aktueller CV + Stellenanzeige liegen vor), das sagen und fragen, ob gewechselt werden soll.

## Gemeinsame Grundlagen (nicht duplizieren, direkt verwenden)

Dieser Skill übernimmt alle Regeln, Vorlagen und den Renderer der Cockpit-Version `lebenslauf-stellenanpassung-cockpitversion`. **Vor dem Arbeiten lesen** (Basis: `../lebenslauf-stellenanpassung-cockpitversion/`):
- `references/best-practices-modul4.md` – Aufbau, Format, 7 ATS-Regeln, Lücken, Weiterbildung (§6), Bullet-Formel, Wirkung §8a, Kurzprofil §8b, Rollen + ATS-Begriffe §9. **Ausnahme:** §7 (Stellenanzeige lesen) entfällt hier.
- `references/formulierungen.md` – Bausteine A–G, Bullet-Vorher/Nachher, Wirkungs-/Zahlenmuster je Rolle, Niveaus, Kurzprofil-Schreibregeln
- `references/fragenkatalog.md` – Runde 1/2 (Pflicht-/freiwillige Angaben), 3 (Lücken), 4 (Beendigungsgründe), 5b (Wirkung/Zahlen), Kurzprofil K1–K4 als Vorlagen
- `assets/beispiel_lebenslauf.json` – JSON-Schema des Lebenslaufs
- `scripts/render_cv.py` – Renderer + automatische Prüfung

Zusätzlich dieser Skill: `references/fragenkatalog.md` (im eigenen Ordner) – Start-Auswahl, Option-2-Upload, Abschnitts-Fragerunden mit Bestätigungs-Zusammenfassung.

Kommunikation mit dem Anwender: Deutsch, duzen, kurz.

## Die eiserne Regel: Nichts erfinden (unverändert)

Jede Aussage im CV braucht im **Faktenregister** eine Quelle:
`Antwort R<n>` (Antwort des Anwenders) · `Dokument <Dateiname>` (nur nach Bestätigung, s. u.) · `abgeleitet` (rein rechnerisch, z. B. Dauer aus Daten).

- Es gibt **keine Stellenanzeige**: Wortwahl, Schlüsselwörter und Gewichtung kommen aus den belegten Fakten und den rollentypischen ATS-Begriffen (best-practices §9) – **nie** als Faktenquelle.
- Verboten: neue Zahlen, Tools, Kunden, Erfolge, Verantwortung, Niveaus, Abschlüsse; Zahlen runden über „ca.“ hinaus; Niveau anheben; Wirkung ergänzen, nur weil sie zur Tätigkeit passen würde; Ergebnisse einer Station auf eine ähnliche übertragen.
- Zahlen dürfen Größenordnungen sein – aber nur, was der Anwender **erklären und begründen** kann.
- **Informationen aus hochgeladenen Dokumenten sind nur Antwortvorschläge.** Sie kommen als Option in eine Frage („steht so in Zeugnis X – stimmt das?“) und ins Faktenregister erst nach Bestätigung (Quelle: `Antwort R<n> (bestätigt, Dokument <Name>)`). Widersprechen sich Dokumente (andere Daten, andere Titel), beide Varianten als Optionen anbieten – nie selbst entscheiden.
- Zeugnis-Formulierungen („stets zu unserer vollsten Zufriedenheit“) sind keine Fakten über Zahlen oder Erfolge. Aus ihnen nur Tätigkeiten, Zeiträume, Positionen und genannte Verantwortung vorschlagen.
- Fehlt etwas Nötiges/Hilfreiches → **fragen**. Keine Antwort / „Nein“ → **weglassen** und im Lückenbericht nennen. Nie Platzhalter wie „XXX“ im CV.
- Wählt der Anwender eine Option, gibt aber den versprochenen Freitext nicht an, gilt das als **nicht beantwortet**.

## Ablauf

### Phase 0 – Ausgangslage klären, Option wählen

1. Kurz einordnen (2–3 Sätze): Was der Skill liefert (Basis-CV), wofür er taugt (Agentur-Kartei, Jobportale, Grundlage für „CV-Entwurf umformulieren“) und die Verbindung zum anderen Skill (Tabelle oben, gekürzt).
2. **Option wählen** per AskUserQuestion (Vorlage „Start“ in `references/fragenkatalog.md`):
   - **Option 1 – von 0 anfangen** → Fragerunden bis zur Vollständigkeit (ab Phase 2)
   - **Option 2 – Brainstorming** → Anwender lädt unstrukturierte Dokumente hoch (Phase 1)
3. **Ausgabeordner:** `Basis_Lebenslauf/` im Arbeitsverzeichnis bzw. neben den hochgeladenen Dokumenten, sofern der Anwender nichts anderes sagt. Dort `faktenregister.md` anlegen und laufend pflegen (je Fakt: Wert + Quelle).
4. **Zielrichtung (optional, eine Frage):** In welche Rollen/Branchen soll der Basis-CV passen (z. B. „Vertriebsinnendienst, SDR, Customer Success“)? Sie bestimmt nur **Gewichtung und Begriffswahl** (best-practices §9), nie Inhalte. Keine Angabe → breit und neutral bleiben.

### Phase 1 – Nur Option 2: Dokumente einsammeln und auswerten

1. **Ohne weitere Fragen zuerst bitten**: „Lade jetzt alle Dokumente in den Chat hoch, die mit deinem Werdegang zu tun haben …“ (Formulierung in `references/fragenkatalog.md`). **Warten**, bis der Anwender „fertig“ sagt. Nicht schon vorher Fragerunden starten.
2. **Einlesen** je Format:
   - PDF: `pdftotext -layout datei.pdf -`; kaum Text (Scan) → Read-Tool visuell
   - .docx/.doc/.rtf/.pages: `textutil -convert txt -stdout datei.docx` (macOS)
   - .md/.txt: Read-Tool · Bilder (png/jpg): Read-Tool (visuell)
   - Google-Docs-Link oder URL: WebFetch bzw. um Export bitten
3. **Alles CV-Relevante herausfiltern** und ins Faktenregister als **Kandidaten** (Status „unbestätigt“, Quelle `Dokument <Name>`) eintragen: persönliche Daten, Stationen (Zeitraum, Position, Arbeitgeber, Ort, Tätigkeiten, Zahlen, Tools), Ausbildung, Weiterbildungen, Zertifikate (inkl. Ausstellungsdatum), Sprachen, IT-Kenntnisse, Führerschein, Ehrenamt/Projekte/Hobbys, Selbstbeschreibungen („kommunikationsstark“ – nur als Kandidat für spätere Belegfragen).
4. **Dubletten und Widersprüche** markieren (gleiche Station in zwei Dokumenten, abweichende Daten/Titel). Zu fehlenden Monaten, unklaren Zeiträumen oder fehlenden Abschlüssen Fragen vormerken.
5. **Kurze Zusammenfassung an den Anwender** (Tabelle/Liste): „Das habe ich gefunden: n Stationen, n Ausbildungen/Weiterbildungen, n Zertifikate, … Ignoriert/unklar: …“. Keine Bestätigung nötig – die Bestätigung erfolgt abschnittsweise in den Fragerunden.
6. Ab jetzt laufen die Phasen 2–6 **wie Option 1**, nur dass jede Frage die gefundenen Informationen als **Antwortmöglichkeiten** anbietet (Beleg mit Dateiname in der Optionsbeschreibung). Was nicht in den Dokumenten steht, wird wie bei Option 1 offen erfragt.

### Phase 2 bis 6 – Abschnitt für Abschnitt: fragen, zusammenfassen, bestätigen

Für **jeden Abschnitt** gilt derselbe Zyklus (Vorlagen in `references/fragenkatalog.md`):

1. **Fragerunde(n)** mit AskUserQuestion (1–4 Fragen je Aufruf, 2–4 Optionen, „Other“ für Freitext). Bei Antworten, die viel Text verlangen (Tätigkeiten einer Station), darf stattdessen eine Freitext-Frage direkt im Chat gestellt werden – dann wartest du auf die Antwort.
2. **Nachfragen** bis der Abschnitt vollständig ist (Pflichtfelder gefüllt, keine „Jahr ohne Monat“-Angaben, keine unklaren Zeiträume). Mehrere Runden pro Abschnitt sind ausdrücklich erlaubt; es gibt kein Rundenlimit für das Sammeln, aber nichts fragen, was schon sicher beantwortet ist.
3. **Zusammenfassung zur Bestätigung:** Antworten übersichtlich zusammenstellen (Liste/Tabelle, in der Form, wie sie im CV stehen würden) und per AskUserQuestion bestätigen lassen: „Stimmt so“ / „Korrigieren“ / „Noch etwas ergänzen“. Erst nach „Stimmt so“ gelten die Fakten als bestätigt und wandern mit Quelle `Antwort R<n>` ins Faktenregister. Bei „Korrigieren“/„Ergänzen“ → gezielt nachfragen und die Zusammenfassung erneut bestätigen lassen.

Die Abschnitte in dieser Reihenfolge:

**Phase 2 – Persönliche Angaben.** Runde 1 und 2 aus dem `fragenkatalog.md` der Grundlage, aber ohne vorhandenen CV: bei Option 1 sind die Werte offen zu erfragen (Name, Adresse, E-Mail, Telefon – Pflicht; Geburtsdatum, Familienstand, Nationalität – freiwillig, Empfehlung „Keine“; *Verfügbar ab* nur am **1. oder 15.**, Datum nie still ändern; *Kinderbetreuung gesichert* nur auf ausdrücklichen Wunsch; Foto-Kriterien; LinkedIn/Xing-Profil optional). Bei Option 2 stehen die gefundenen Werte in den Fragen.

**Phase 3 – Berufserfahrung.** Erst **Stationen-Inventar** (Zeitraum `MM/JJJJ`, Position, Arbeitgeber, Ort – in einer Zeile, antichronologisch; Nebenjobs, Praktika, Selbstständigkeit, Minijobs, Ehrenamt mit Arbeitscharakter nicht vergessen), dann **je Station**: Tätigkeiten (Bullet-Formel), Tools/Methoden, Wirkung und Zahlen (Runde 5b: erst Wirkung mit rollenpassenden Vorschlägen aus `formulierungen.md`, dann Größenordnung – **hier für jede Station mit Substanz**, nicht nur für 2–3, da es keine Zielstelle zum Priorisieren gibt), Beendigungsgrund (Runde 4: bei ≥ 3 Stationen < 2 Jahre oder auf Wunsch). Ähnliche Stationen einzeln befragen, keine Ergebnisse übertragen. Dem Anwender sagen, dass kleine Erfolge zählen. Danach Zusammenfassung → Bestätigung.

**Phase 4 – Ausbildung und Weiterbildung.** Schule/Abschluss (mit Monat), Ausbildung/Studium (bei Abbruch „(ohne Abschluss)“), Weiterbildungen/Umschulungen/Kurse mit Bildungsträger, Ort, Zeitraum; **laufende Weiterbildung** → Enddatum, Ort, Träger erfragen und nach der **Zwei-Stellen-Regel** (best-practices §6) behandeln. Danach Zusammenfassung → Bestätigung.

**Phase 5 – Kompetenzen.** IT-/Tool-Kenntnisse mit Niveau-Wort (nie Balken, nie hochstufen) und Herkunft (Weiterbildung/Berufspraxis), Sprachen inkl. **Deutsch: Muttersprache** (nur wenn bestätigt) mit Niveau, Zertifikate (Bezeichnung, Aussteller, Datum `MM/JJJJ`), Führerschein, weitere Qualifikationen; Hobbys/Ehrenamt/Eigene Projekte nur, wenn der Anwender sie aufnehmen möchte (Alltagserfahrungen mit Zielbezug, T3 Beispiel C). Optional Unterschrift (Bilddatei) und Foto. Danach Zusammenfassung → Bestätigung.

**Phase 6 – Gesamtprüfung und Lücken.** Den bestätigten Gesamtstand gegen Modul-4-Regeln prüfen (wie Phase 3 im Cockpit-Version von `lebenslauf-stellenanpassung-cockpitversion`, ohne den Stellenbezug):
- Top-10-Fehler (best-practices §2), Reihenfolge, Datumsformat, Datum/Position/Unternehmen/Ort in einer Zeile
- **Lücken ≥ 2 Monate** (auch vor laufender Weiterbildung) → Runde 3 (A–G); keine Antwort → Zeitraum sichtbar lassen und im Bericht nennen
- Jahresangaben ohne Monat → nachfragen, sonst Jahr stehen lassen und im Bericht nennen
- Doppeleintrag laufende Weiterbildung (Berufserfahrung `– heute` UND Ausbildung/Weiterbildung)
- Bullets ohne Wirkung/Zahl, ähnliche Stationen mit leeren Unterpunkten → ggf. Runde 5b ergänzen
- Pauschale Selbstzuschreibungen ohne Beleg ( „teamfähig“) → nicht übernehmen, nur als Kandidat für Phase 7
Offene Punkte per Runde erfragen, dann kurze Bestätigung.

### Phase 7 – Kurzprofil (erst jetzt, am Ende, optional)

Das Kurzprofil wird **bewusst zuletzt** erfasst, weil vorher die Grundlage für Vorschläge fehlt. Block K1–K4 aus dem `fragenkatalog.md` der Grundlage:
1. **K1 – Entscheidung:** Ja / Nein / Später hinzufügen. Nein oder Später → CV ohne Kurzprofil bauen; bei „Später“ im Faktenregister `Kurzprofil: später` notieren und in der Übergabe daran erinnern (Anwender kann jederzeit „Kurzprofil jetzt hinzufügen“ sagen, dann bei K2 einsteigen).
2. **K2 – Inhalte** (eigene Stichpunkte oder „Vorschläge machen“) → **K3 – Vorschläge** aus dem bestätigten Faktenregister mit Beleg → **K4 – Belegfragen** für Unbewiesenes.
3. **Text** strikt nach `formulierungen.md` → „Kurzprofil“: 3, max. 4 Zeilen `**Schlagwort** – Fakt`, Telegramm-Stil, keine Floskeln. Da kein Zielprofil existiert, bleibt das Kurzprofil **breit** (Kernkompetenz, stärkster Beleg, Besonderheit) und nennt keine Zielposition. Unter 3 belegte Zeilen → nichts auffüllen, `Kurzprofil: später`.
4. Der fertige Text wird dem Anwender zur Bestätigung vorgelegt, bevor gerendert wird.

Im CV steht das Kurzprofil wie gewohnt **direkt nach den persönlichen Angaben**, vor der Berufserfahrung.

### Phase 8 – Bauen, Rendern, Prüfen, Übergabe

**Bauen:** `lebenslauf.json` im Ausgabeordner nach `assets/beispiel_lebenslauf.json` (Cockpit-Version von `lebenslauf-stellenanpassung-cockpitversion`). Es gelten Phase 5 des Cockpit-Version von `lebenslauf-stellenanpassung-cockpitversion`s und best-practices mit diesen Unterschieden:
- Reihenfolge und Überschriften unverändert: Name → Persönliche Daten (+ Foto) → *Kurzprofil* → Berufserfahrung → *Weitere Stationen* → Ausbildung und Weiterbildung → Zusatzqualifikationen → Kernkompetenzen → *Hobbies, Ehrenamt* / *Eigene Projekte* → Ort, Datum (+ Unterschrift).
- **Relevanz nicht stellenbezogen, sondern breit:** Alle Stationen mit Substanz bekommen 2–5 Bullets (Tätigkeit + wo bestätigt Wirkung/Zahl), ältere/kurze Stationen einzeilig unter „Weitere Stationen“. Mindestens 2 Wirkungs-Bullets, wenn bestätigt.
- **Kernkompetenzen:** 8–12 belegte, **rollen- und branchenübergreifende** Begriffe (best-practices §9 liefert die Schreibweisen für Vertrieb, Customer Success, Innendienst, Ops …), passend zur Zielrichtung aus Phase 0. Ohne Zielrichtung: die stärksten belegten Fähigkeiten. Fachbegriffe dürfen nur stehen, wenn der Sachverhalt belegt ist.
- **Laufende Weiterbildung:** Zwei-Stellen-Regel unverändert. Der Block „Berufliche Neuorientierung, Zielposition: …“ nennt die Zielposition **nur**, wenn der Anwender in Phase 0 eine einzelne Zielrolle genannt hat; sonst „Berufliche Neuorientierung“ ohne Zielposition.
- **Länge:** Ziel 2 Seiten, höchstens 3 bei langer Laufbahn. Für den Basis-CV hat Vollständigkeit Vorrang vor dem späteren Zuschnitt; gekürzt wird nach der Reihenfolge des Cockpit-Version von `lebenslauf-stellenanpassung-cockpitversion`s (Doppelte streichen, ältere Stationen einzeilig, Zertifikate auf die wichtigsten, Bullets geringer Relevanz).
- Datumszeile, Foto/Unterschrift wie im Cockpit-Version von `lebenslauf-stellenanpassung-cockpitversion`.

**Rendern:**
```bash
python3 ../lebenslauf-stellenanpassung-cockpitversion/scripts/render_cv.py \
  "<Ausgabeordner>/lebenslauf.json" --out "<Ausgabeordner>" [--keywords "<Ausgabeordner>/keywords.txt"]
```
`--keywords` nur, wenn aus der Zielrichtung eine Begriffsliste erstellt wurde (aus best-practices §9, nicht aus einer Anzeige). Ohne Chrome: `--html-only`.

**Prüfen** (alles aus Phase 6 des Cockpit-Version von `lebenslauf-stellenanpassung-cockpitversion`s): PDF visuell ansehen, `pdftotext` ohne `-layout` lesen, **Faktencheck** jeder Zeile gegen das Faktenregister, Rechtschreibung, Wirkungs-Check, Kurzprofil-Check, Renderer-Warnungen abarbeiten.

**Prüfbericht** `pruefbericht.md`, kurz und scanbar:
1. **Überblick:** Option (1/2), verwendete Dokumente, Zielrichtung, Seitenzahl
2. **Was entstanden ist** und wofür er taugt (Agentur-Kartei, Portale, Basis für Stellenanpassung)
3. **Wirkung und Zahlen** – Tabelle *Station | Tätigkeit | Wirkungs-Bullet | Quelle*; Stationen ohne Wirkung mit Tipp, welche Kategorie sich anbieten würde
4. **Kurzprofil** – Tabelle *Zeile | Quelle*, verworfene Aussagen; bei „später“/„nein“ nur der Status
5. **Offene Lücken ⚠** – jede nötige/hilfreiche, aber nicht belegte Information mit Wirkung und Handlungsempfehlung
6. **Aus Dokumenten nicht übernommen** (Option 2): Dubletten, nicht bestätigte oder widersprüchliche Angaben
7. **Interview-Kurzantworten** zu jeder Lücke und jeder Zahl

**Übergabe im Chat:** Pfad zur PDF, Seitenzahl, Top-Hinweise, Liste **offene Lücken**, Kurzprofil bzw. Status „später“ – Datei per SendUserFile schicken, falls verfügbar. Dann **die Verbindung nennen**:
> Das ist jetzt dein Basis-CV, geeignet für eine Recruiting-Agentur-Kartei oder Jobportale. Für jede konkrete Bewerbung nimmst du als Nächstes die Ebene „CV-Entwurf umformulieren“: Basis-CV (`<Pfad>.pdf`) laden und die Stellenanzeige eintragen, den Rest erledigt das Cockpit. Das `faktenregister.md` liegt im selben Ordner.

## Typische Fallen

- Fakten aus Dokumenten ungefragt übernehmen, statt sie als Antwortvorschlag bestätigen zu lassen.
- Widersprüche zwischen Dokumenten still auflösen.
- Zeugnisfloskeln als Erfolge oder Zahlen ausgeben.
- Kurzprofil früh abfragen oder ungefragt schreiben – es kommt erst in Phase 7 und nur auf Wunsch.
- Abschnitt ohne Zusammenfassung/Bestätigung abhaken.
- Stellenanzeigen-Denken (Muss/Kann, Eignung, Keywords aus der Anzeige) in diesen Skill tragen – es gibt keine Zielstelle; Zielrichtung steuert nur die Wortwahl.
- Zielposition in „Berufliche Neuorientierung“ erfinden.
- Alles aus dem Cockpit-Version von `lebenslauf-stellenanpassung-cockpitversion`: Lücke verstecken, Stationen löschen statt kürzen, nur Tätigkeiten ohne Wirkung, Wirkung dazudichten, „Verfügbar ab“ außerhalb 1./15., freiwillige Angaben ungefragt übernehmen, ähnliche Stationen einseitig befüllen.
