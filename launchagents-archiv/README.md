# Archivierte LaunchAgents

Stillgelegt am **31.08.2026**. JobScout soll nicht mehr nach Zeitplan laufen –
das Projekt wird umstrukturiert.

Die drei `.plist` lagen bis dahin in `~/Library/LaunchAgents/` und waren aktiv.
Sie wurden mit `launchctl bootout` ausgeladen und hierher verschoben. Nur
Ausladen hätte nicht gereicht: launchd lädt beim nächsten Anmelden alles aus
`~/Library/LaunchAgents` automatisch wieder.

| Datei | Zeitplan | Startet |
|---|---|---|
| `com.marcpoenisch.jobscout.plist` | Mo + Do, 07:30 | `run_job_scout.sh` |
| `com.marcpoenisch.jobscout.bewerbungsworkflow.plist` | Mo + Do, 08:00 | `run_bewerbungs_workflow.sh` |
| `com.marcpoenisch.jobscout.skillgap.plist` | 1. des Monats, 08:00 | `run_skill_gap_analyse.sh` |

Alle drei haben `RunAtLoad = false` – nach dem Zurückholen läuft nichts sofort,
sie warten auf den nächsten Termin.

## Ohne Zeitplan arbeiten

Für Läufe auf Zuruf braucht es launchd nicht. Die Agents rufen ohnehin nur
`open -a Terminal <skript>` auf. Direkt starten:

    ~/Documents/Projekte/JobScout/run_job_scout.sh
    ~/Documents/Projekte/JobScout/run_bewerbungs_workflow.sh
    ~/Documents/Projekte/JobScout/run_skill_gap_analyse.sh
    ~/Documents/Projekte/JobScout/run_interview_prep.command

Oder im Finder doppelklicken.

## Alle drei zurückholen

    cp ~/Documents/Projekte/JobScout/launchagents-archiv/com.marcpoenisch.jobscout*.plist ~/Library/LaunchAgents/
    for f in ~/Library/LaunchAgents/com.marcpoenisch.jobscout*.plist; do launchctl bootstrap gui/501 "$f"; done

Der zweite Schritt ist optional – beim nächsten Anmelden lädt launchd sie von
selbst. `bootstrap` macht es sofort wirksam.

## Einzelnen zurückholen

    cp ~/Documents/Projekte/JobScout/launchagents-archiv/com.marcpoenisch.jobscout.plist ~/Library/LaunchAgents/
    launchctl bootstrap gui/501 ~/Library/LaunchAgents/com.marcpoenisch.jobscout.plist

## Prüfen, was geladen ist

    launchctl list | grep jobscout

Keine Ausgabe = kein Zeitplan aktiv.

## Wieder stilllegen

    launchctl bootout gui/501/com.marcpoenisch.jobscout
    mv ~/Library/LaunchAgents/com.marcpoenisch.jobscout.plist ~/Documents/Projekte/JobScout/launchagents-archiv/

`501` ist Marcs UID (`id -u`).
