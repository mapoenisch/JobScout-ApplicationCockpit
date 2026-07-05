# Cowork-Prompts für das Job-Scout-System

Drei Prompts für dein Cowork-Projekt. Prompt 1 ersetzt deine bestehende
geplante Aufgabe (2× wöchentlich). Prompt 2 richtest du als neue geplante
Aufgabe ein (monatlich). Prompt 3 nutzt du manuell bei Bedarf.

Voraussetzungen im Ordner /Users/marcpoenisch/Documents/job-scout:
- Lebenslauf_Master.docx (dein vollständiger, aktueller Lebenslauf)
- bewerbungen_tracker.csv (liegt bei)
- Unterordner "bewerbungen"

---

## PROMPT 1 – Bewerbungs-Workflow (geplante Aufgabe, 2× wöchentlich)

Führe im Ordner /Users/marcpoenisch/Documents/job-scout folgende Schritte aus:

0. Öffne bewerbungen_tracker.csv. Prüfe: Gibt es Zeilen mit Status
   "beworben", deren "Beworben am" länger als 12 Tage zurückliegt und bei
   denen "Ergebnis" leer ist? Falls ja, liste mir diese Firmen zu Beginn
   als FOLLOW-UP-ERINNERUNG auf und setze ihren Status auf "follow-up".

1. Starte "python3 job_scout.py" und warte, bis der Lauf abgeschlossen ist.

2. Lies jobs_ranked.csv und zeige mir die NEUEN Stellen mit Score >= 50 als
   nummerierte Kurzliste (Titel, Firma, Ort, Score, Link), maximal die
   besten 15. Gibt es keine neuen Stellen >= 50, zeige die Top 5 des Tages.
   Überspringe Firmen, die bereits im Tracker stehen, und weise mich
   darauf hin.

3. Frage mich, auf welche Stellen ich mich bewerben möchte, und WARTE auf
   meine Antwort. Ohne meine Auswahl passiert nichts Weiteres.

4. Rufe für jede gewählte Stelle die Stellenausschreibung über den Link ab
   und lies Anforderungen und Qualifikationen. Achte dabei auch auf Tonfall
   und Sprachstil der Anzeige (z. B. förmlich vs. locker, nüchtern vs.
   emotional, kurze vs. ausschweifende Sätze, Buzzwords der Firma). Falls
   eine Seite nicht abrufbar ist, sag mir das und bitte mich, den Text
   einzufügen.

   Rufe zusätzlich die Firmen-Homepage auf (About-/Karriere-/Über-uns-
   Seite) und erfasse: Produkte/Dienstleistungen, Zielgruppe, erkennbare
   Werte oder Unternehmenskultur, Besonderheiten, mit denen sich das
   Anschreiben von einer 08/15-Bewerbung abheben kann. Falls die Homepage
   nicht eindeutig auffindbar oder nicht abrufbar ist, überspringe diesen
   Punkt und sag mir kurz Bescheid statt zu raten.

5. Erstelle pro Stelle auf Basis von Lebenslauf_Master.docx:
   a) einen angepassten Lebenslauf: nur vorhandene Fakten umformulieren,
      priorisieren und auf die Anforderungen ausrichten. STRIKT: nichts
      erfinden, keine Fähigkeiten, Erfahrungen oder Zeiträume hinzudichten.
   b) ein individuelles Anschreiben (max. 1 Seite, Deutsch, Du-Form nur
      wenn die Anzeige duzt, sonst Sie): Bezug auf konkrete Anforderungen
      der Stelle, mein Profil als Quereinsteiger mit Groß- und
      Außenhandels-Background und Weiterbildung Digital Sales Manager.
      Tonfall und Wortwahl an die Stellenausschreibung anlehnen (siehe
      Schritt 4) – nicht die Anzeige nachahmen oder Formulierungen
      übernehmen, sondern denselben Registerwechsel treffen (z. B. bei
      einer lockeren Startup-Anzeige entsprechend direkter und
      persönlicher schreiben als bei einer klassisch-förmlichen
      Konzern-Anzeige). Mindestens einen konkreten Bezug zum Unternehmen
      aus der Homepage-Recherche einbauen (z. B. Produkt, Zielgruppe oder
      erkennbarer Wert) – nur wenn die Recherche in Schritt 4 etwas
      Belastbares ergeben hat, sonst diesen Punkt auslassen statt etwas
      zu erfinden.

6. Speichere pro Stelle zwei Word-Dateien im Unterordner "bewerbungen":
   Lebenslauf_[Firma].docx und Anschreiben_[Firma].docx

7. Trage jede erstellte Bewerbung als neue Zeile in
   bewerbungen_tracker.csv ein: Firma, Position, Link, Status
   "vorbereitet", Erstellt am = heutiges Datum. Übrige Felder leer lassen.

8. Gib mir am Ende eine Liste der erstellten Dateien und weise mich auf
   Stellen hin, bei denen mein Profil Lücken zu den Anforderungen hat.

Hinweis für mich (nicht Teil der Aufgabe): Sobald ich eine Bewerbung
tatsächlich abgeschickt habe, sage ich Claude Bescheid ("Bewerbung bei X
ist raus") – dann wird Status auf "beworben", "Beworben am" auf das Datum
und "Follow-up am" auf +12 Tage gesetzt.

---

## PROMPT 2 – Skill-Radar + Kurs-Recherche (geplante Aufgabe, monatlich)

Führe im Ordner /Users/marcpoenisch/Documents/job-scout folgende Schritte aus:

1. Starte "python3 skill_radar.py" und warte auf das Ergebnis.

2. Lies skill_report.html und fasse mir zusammen:
   - die Top-5-Lücken (Skills, die ich nicht habe, sortiert nach
     Marktnachfrage in Prozent)
   - auffällige Trends (Skills mit deutlich steigender oder fallender
     Nachfrage gegenüber dem letzten Lauf)

3. Recherchiere für die Top-3-Lücken passende Zertifizierungen,
   Qualifizierungen und Kurse im Internet. Prioritätenreihenfolge:
   a) kostenlos (z. B. HubSpot Academy, Salesforce Trailhead, Google
      Zertifikate, LinkedIn Learning über den Bibliotheksausweis der
      Leipziger Städtischen Bibliotheken)
   b) günstig unter 100 Euro (z. B. Udemy-Kurse in Aktionszeiträumen)
   c) förderfähig über die Arbeitsagentur (Bildungsgutschein,
      Weiterbildungsförderung) – nur wenn a) und b) nichts hergeben

4. Prüfe je Empfehlung: Anbieter seriös? Zertifikat mit Aussagekraft für
   Recruiter (anerkanntes Badge/Zertifikat zum Verlinken auf LinkedIn)?
   Zeitaufwand realistisch neben Weiterbildung und Bewerbungsphase
   (max. ca. 3-5 Std./Woche)?

5. Erstelle eine Empfehlungs-Notiz als Markdown-Datei
   kurs_empfehlungen_[JAHR-MONAT].md mit: je Lücke 1-2 konkrete Kurse
   (Name, Anbieter, Kosten, Dauer, Link, welches Zertifikat es gibt,
   welche Lücke es schließt) und einer klaren Empfehlung, womit ich
   diesen Monat starten soll. Kennzeichne Fakten und Einschätzungen
   getrennt.

6. Wichtig: Empfiehl nur, was echte Marktnachfrage aus dem Radar abdeckt.
   Keine Kurs-Sammelwut – maximal 1 aktiver Kurs parallel zur laufenden
   Weiterbildung.

---

## PROMPT 3 – Interview-Prep (manuell, bei Einladung)

Vorlage – [PLATZHALTER] ersetzen und als neue Cowork-Aufgabe im Projekt
starten:

Ich habe eine Einladung zum Vorstellungsgespräch: [FIRMA], Position
[POSITION], Gespräch am [DATUM], Gesprächspartner: [NAME(N) ODER
"unbekannt"]. Arbeite im Ordner /Users/marcpoenisch/Documents/job-scout.

1. Recherchiere die Firma: Produkte/Dienstleistungen, Zielkunden,
   Geschäftsmodell, Größe, Standorte, aktuelle News der letzten 6 Monate,
   Wettbewerber. Nutze die Firmenwebsite und aktuelle Quellen; kennzeichne
   Unsicheres als Annahme.

2. Falls Gesprächspartner bekannt: Recherchiere deren Rolle und
   beruflichen Hintergrund (nur öffentlich zugängliche Quellen, z. B.
   LinkedIn, Firmenwebsite). Keine Spekulationen über die Person.

3. Lies das ursprüngliche Anschreiben und den Lebenslauf zu dieser
   Bewerbung aus dem Ordner "bewerbungen" (Dateien mit [FIRMA] im Namen)
   sowie Lebenslauf_Master.docx.

4. Erstelle ein Briefing-Dokument Interview_Briefing_[FIRMA].docx mit:
   a) Firmenprofil auf einer Seite (Fakten, Quellen genannt)
   b) 10 wahrscheinliche Interviewfragen für diese Position, davon
      mindestens: die Quereinsteiger-Frage ("Warum der Wechsel aus der
      Logistik?"), eine Frage zu Kaltakquise/Umgang mit Ablehnung, eine
      Rollenspielfrage ("Verkaufen Sie mir...") und eine zur Motivation
      für genau diese Firma
   c) zu jeder Frage ein Antwortgerüst in Stichpunkten – ausschließlich
      aus Fakten meines Lebenslaufs und meiner Weiterbildung, nach dem
      STAR-Prinzip wo passend. Nichts erfinden.
   d) 5 gute Rückfragen von mir an die Firma (zeigen Vorbereitung und
      Sales-Denke)
   e) organisatorische Checkliste (Unterlagen, Technik bei
      Remote-Gespräch, Kleidung, Anreise/Puffer)

5. Aktualisiere im bewerbungen_tracker.csv den Status dieser Firma auf
   "interview" und notiere das Gesprächsdatum in den Notizen.
