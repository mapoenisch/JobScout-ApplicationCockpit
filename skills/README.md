# Skills zum Bewerbungsprozess

Diese Ordner stammen aus `~/Projekte/Claude/Scheduled/` (ehemalige Claude-Cowork-Scheduled-Tasks)
und wurden am 29.09.2026 hierher verschoben, damit alles zum Bewerbungsprozess an einem Ort liegt.
Alte Pfade (`~/Documents/job-scout`) wurden auf `~/Projekte/JobScout` umgestellt.

Keiner dieser Skills ist aktuell als Scheduled Task aktiv. Die maßgeblichen, gepflegten
Prompt-Versionen liegen im Projektordner als `prompt_*.txt` und werden über die `run_*`-Skripte gestartet.

| Skill | Status | Aktuelle Entsprechung |
|---|---|---|
| `bewerbungs-workflow-1-montag` | Cowork-Version, inhaltlich = Donnerstag | `prompt_bewerbungs_workflow.txt` / `run_bewerbungs_workflow.sh` |
| `bewerbungs-workflow-2-donnerstag` | identisch mit Montag (nur anderer Name) | `prompt_bewerbungs_workflow.txt` |
| `jobfilter--bewerbungsassistent` | Vorgänger (ohne Tracker/Homepage-Recherche) | abgelöst durch Bewerbungs-Workflow |
| `jobfilter--bewerbungsassistent-2` | Vorgänger, Donnerstag-Variante | abgelöst durch Bewerbungs-Workflow |
| `interview-prep` | Cowork-Version | `prompt_interview_prep_template.txt` / `run_interview_prep.command` |
| `skill-gap-analyse--kurssuche` | eigene Variante (liest `jobs_ranked.csv` direkt) | `prompt_skill_gap_analyse.txt` nutzt dagegen `skill_radar.py` |
