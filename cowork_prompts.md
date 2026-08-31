# Automatisierung des Bewerbungsprozesses (lokal, launchd)

Stand 26.08.2026: Die drei Workflows laufen **nicht mehr über Claude
Cowork** (Cowork Scheduled Tasks können grundsätzlich keine Ordner auf
dem eigenen Mac erreichen – feste Produktgrenze, kein Bug). Stattdessen
laufen sie lokal über macOS launchd + Claude Code CLI, mit vollem
Zugriff auf diesen Ordner.

Die Prompt-Texte selbst liegen unverändert als eigene Dateien hier im
Ordner:
- `prompt_bewerbungs_workflow.txt`
- `prompt_skill_gap_analyse.txt`
- `prompt_interview_prep_template.txt` (mit Platzhaltern `__FIRMA__`,
  `__POSITION__`, `__DATUM__`, `__NAME__`)

## 1. Bewerbungs-Workflow

Skript: `run_bewerbungs_workflow.sh`
LaunchAgent: `com.marcpoenisch.jobscout.bewerbungsworkflow`
Zeitplan: Mo + Do, 8:00 Uhr (30 Min. nach dem Scraping-Lauf von
`job_scout.py` um 7:30 Uhr, damit `jobs_ranked.csv` frisch ist)

Öffnet automatisch ein Terminal-Fenster und startet Claude Code mit dem
Prompt. Der Workflow fragt dich aktiv, auf welche Stellen du dich
bewerben willst, und WARTET auf deine Eingabe im Terminal – läuft also
nicht komplett unbeaufsichtigt durch. Voraussetzung: Mac ist wach, du
bist zeitnah am Rechner.

Manuell jederzeit auch so startbar:
```
bash /Users/marcpoenisch/Projekte/JobScout/run_bewerbungs_workflow.sh
```

## 2. Skill-Gap-Analyse + Kurssuche

Skript: `run_skill_gap_analyse.sh`
LaunchAgent: `com.marcpoenisch.jobscout.skillgap`
Zeitplan: 1. jeden Monats, 8:00 Uhr

Startet `skill_radar.py`, wertet den Report aus, recherchiert Kurse und
schreibt `kurs_empfehlungen_[JAHR-MONAT].md`. Läuft weitgehend ohne
Rückfragen durch, öffnet sich aber ebenfalls in einem Terminal-Fenster
(damit du Tool-Freigaben bestätigen kannst, falls nötig).

Manuell:
```
bash /Users/marcpoenisch/Projekte/JobScout/run_skill_gap_analyse.sh
```

## 3. Interview-Prep (bewusst ohne Zeitplan)

Skript: `run_interview_prep.command`
Kein LaunchAgent – ergibt bei einem Kalender-Trigger keinen Sinn, da es
nur bei einer tatsächlichen Einladung gebraucht wird und Angaben
(Firma, Position, Datum, Ansprechpartner) individuell sind.

Start: Doppelklick auf `run_interview_prep.command` im Finder (oder im
Terminal ausführen). Das Skript fragt Firma/Position/Datum/Ansprechpartner
ab und startet Claude Code direkt mit dem fertig ausgefüllten Prompt.

## Verwaltung der LaunchAgents

Alle drei Agents (inkl. Scraping-Lauf) prüfen/neu laden:
```
launchctl list | grep jobscout
launchctl bootout gui/$(id -u)/<label>
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/<plist-datei>
```

Labels:
- `com.marcpoenisch.jobscout` (Scraping, job_scout.py, Mo+Do 7:30)
- `com.marcpoenisch.jobscout.bewerbungsworkflow` (Mo+Do 8:00)
- `com.marcpoenisch.jobscout.skillgap` (monatlich, 1. um 8:00)

## Historie / warum diese Lösung

- Cowork Scheduled Tasks: können laut Anthropic-Doku grundsätzlich keine
  lokalen Ordner erreichen ("work with connectors and cloud-stored files
  but cannot access folders on your computer").
- Cloud-"Routinen" (Code-Tab): anderes Produkt, arbeiten nur gegen einen
  frisch geklonten GitHub-Repo, ebenfalls kein Zugriff auf den lebenden
  lokalen Ordner.
- Reiner "Prompt manuell in neue Cowork-Aufgabe einfügen": hätte
  funktioniert, aber ohne jede Automatisierung/Erinnerung.
- Diese Lösung: lokal, echter Dateizugriff, mit Zeitplan wo sinnvoll
  (Bewerbungs-Workflow, Skill-Gap-Analyse) und bewusst ohne Zeitplan wo
  nicht (Interview-Prep). Einzige Voraussetzung: Mac muss zur
  Ausführungszeit wach sein (wie beim bestehenden Scraping-Lauf auch).
