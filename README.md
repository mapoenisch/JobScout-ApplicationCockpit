# Job Scout 🔍

Ein Python-Tool, das Stellenanzeigen aus mehreren Job-APIs aggregiert, per
regelbasiertem Scoring gegen ein persönliches Profil bewertet und die
Ergebnisse als priorisierten HTML-Report ausgibt – inklusive
„NEU seit letztem Lauf"-Erkennung über eine lokale SQLite-Datenbank.

Entstanden als persönliches Projekt während meiner Weiterbildung zum
**Digital Sales Manager (IHK)** – die Scoring-Logik folgt demselben Prinzip
wie Lead Scoring in CRM-Systemen (HubSpot, Salesforce), nur angewendet auf
Stellenanzeigen statt Leads.

## Features

- **4 Datenquellen:** Bundesagentur für Arbeit (offizielle Jobsuche-API),
  Adzuna, Arbeitnow, Himalayas (globale Remote-Jobs, kein API-Key nötig) –
  erweiterbar über das Fetcher-Pattern
- **Regelbasiertes Scoring (0–100):** gewichtete Titel- und Kontext-Keywords,
  Remote-/Standort-Boni, Frische-Bonus, Malus- und Ausschlussregeln
- **Wortgrenzen-Matching:** kurze Keywords wie „KI" erzeugen keine
  Fehltreffer in Wörtern wie „Logistik"
- **Detail-Anreicherung:** für Top-Treffer der Arbeitsagentur wird die
  Stellenbeschreibung nachgeladen und neu bewertet
- **NEU-Erkennung:** SQLite merkt sich jede gesehene Stelle; der Report
  markiert nur echte Neuzugänge
- **Ausgabe:** klickbarer HTML-Report mit Score-Ampel und
  Bewertungsbegründung pro Stelle + CSV-Export
- **macOS-Benachrichtigung** bei neuen Treffern über konfigurierbarem Score
- **Skill-Gap-Radar** (`skill_radar.py`): wertet alle gesammelten
  Stellenbeschreibungen aus, misst die Marktnachfrage je Skill, gleicht
  sie mit dem eigenen Profil ab und zeigt Lücken samt Trend über die Zeit
- **Bewerbungs-Tracker** (`bewerbungen_tracker.csv`): Pipeline-Übersicht
  aller Bewerbungen mit Status und Follow-up-Erinnerungen – gepflegt über
  Claude-Cowork-Aufgaben (siehe `cowork_prompts.md`)

## Cockpit (Weboberfläche)

Alle Bausteine des Bewerbungsprozesses in einer lokalen Oberfläche:

```bash
python3 jobscout_app.py      # oder Doppelklick auf run_cockpit.command
```

Öffnet `http://127.0.0.1:8765` mit Dashboard, Stellenliste (Filter, Auswahl,
Scoring-Gründe), Kanban-Pipeline für `bewerbungen_tracker.csv`, Unterlagen,
Interview-Prep-Formular, Skill-Radar, Einstellungen und Automatisierungen. Ausgewählte
Stellen werden per Klick an den Bewerbungs-Workflow (Claude Code im
Terminal) übergeben. Nur Standardbibliothek, lauscht nur auf localhost.

## Setup

```bash
pip3 install requests
cp .env.beispiel .env   # Adzuna-Keys eintragen (developer.adzuna.com)
python3 job_scout.py
```

Ohne Adzuna-Keys läuft das Tool trotzdem – die Quelle wird dann übersprungen.

## Konfiguration

Am einfachsten über das Cockpit unter **Einstellungen** (Tabs Suchprofil,
Scoring-Engine, Ausschlüsse, Skill-Profil, Bewerbung). Dort gibt es eine
Live-Vorschau der neuen Top-Treffer und „Speichern & neu bewerten“, das die
vorhandenen Stellen ohne neuen Suchlauf neu bewertet.

Die Änderungen landen in `einstellungen.json`. `job_scout.py` und
`skill_radar.py` übernehmen sie bei jedem Start, auch ohne Cockpit. Die
Standardwerte bleiben als Dictionaries am Anfang von `job_scout.py`
(`PROFIL`, `SCORE_REGELN`) und `skill_radar.py` (`MEIN_STATUS`); „Standard
wiederherstellen“ im Cockpit kehrt zu ihnen zurück. Neue Skills samt
Synonymen werden weiterhin in `SKILL_KATALOG` in `skill_radar.py` gepflegt.

## Täglicher automatischer Lauf (macOS/Linux)

```bash
crontab -e
# Zeile einfügen (Pfad anpassen):
0 8 * * * cd /Users/DEIN_NAME/job-scout && /usr/bin/python3 job_scout.py >> lauf.log 2>&1
```

## Tech-Stack

Python 3.9+ · requests · sqlite3 (Standardbibliothek) · REST-APIs

## Hinweis

Das Tool nutzt ausschließlich offizielle, öffentliche APIs – kein Scraping.
