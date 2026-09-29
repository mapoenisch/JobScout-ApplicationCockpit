---
name: skill-gap-analyse--kurssuche
description: Analysiere vorhandene + geforderte Skills / Identifiziere Skill-gap / Suche Kurse(free first)
---

Führe eine wöchentliche Karriereentwicklungs-Analyse für Marc durch (8,5-monatige Weiterbildung zum Digital Sales Manager, seit 18.05.2026, remote).

Gehe in genau diesen Schritten vor:

SCHRITT 1 – Ist-Soll-Abgleich:

* Lies die Datei /Users/marcpoenisch/Projekte/JobScout/jobs_ranked.csv (Semikolon-getrennt, Spalten: Neu;Score;Titel;Firma;Ort;Remote;Veröffentlicht;Gründe;Link;Quelle)
* Vergleiche die darin gesammelten SDR-/Inside-Sales-/Digital-Sales-Stellenanzeigen mit Marcs Zielprofil: - Hintergrund: Groß- und Außenhandel
                      - Aktuell in Weiterbildung zum Digital Sales Manager
* Ziel-Skills: HubSpot, Sales Hub, Salesforce, Sales Cloud, CRM/Sales Automation,  ChatGPT/KI/Claude, LinkedIn Sales Navigator

SCHRITT 2 – Gap-Analyse / Skill-Radar:

* Werte die Spalte "Gründe" aus (enthält bereits Treffer im Format Keyword 'xxx' (+Punktzahl)) sowie die Spalte "Titel". 
* Zähle die Häufigkeit aller genannten Tools/Zertifikate/Skills. 
* Erstelle ein Ranking: Welche Skills werden am Markt am häufigsten verlangt, die NICHT in Marcs Ziel-Skills-Liste stehen oder die er noch nicht nachweisen kann? → das sind die Top-Lücken.

SCHRITT 3a – Kurssuche zu den erkannten Lücken (free-first):

* Suche für die Top 5–8 Lücken aus Schritt 2 im Web nach passenden Kursen/Zertifikaten. Priorisiere strikt:

1.  Kostenlos (z. B. HubSpot Academy, Google Skillshop, Salesforce Trailhead, Meta Blueprint, openHPI)
2. Günstig / über Umwege kostenlos (z. B. LinkedIn Learning via Bibliotheksausweis, Coursera mit Financial Aid)
3. Kostenpflichtig – nur wenn klar besser/anerkannter als jede Gratis-Alternative (z. B. IHK-Fachwirt-Module, ggf. mit Hinweis auf Bildungsgutschein/Förderung durch die Agentur für Arbeit)

* Bezahlte Optionen nur mit expliziter Begründung, warum kein gleichwertiger Gratis-Kurs existiert.

SCHRITT 3b – Kurssuche über die erkannten Lücken hinaus:

* Suche zusätzlich aktiv nach Kursen/Zertifizierungen, die NICHT in den Job-Anzeigen-Keywords auftauchen, aber Marc in Richtung einer höheren Qualifizierung in der Digital-Sales-/Vertriebsbranche voranbringen würden (z. B. Verhandlungstechniken, Key-Account-Management, Datenanalyse/Reporting im Vertrieb, Marketing-Automation, agiles Projektmanagement, weiterführende CRM-Spezialisierungen, Führungs-/Soft-Skills im Vertrieb).
* Begründe kurz, warum der jeweilige Kurs strategisch sinnvoll ist, auch wenn er in aktuellen Stellenanzeigen nicht explizit gefordert wird. 
* Gleicher Budget-Filter wie in 3a (free-first).

SCHRITT 4 – Report (2 CSV-Dateien):

* Erstelle im Ordner /Users/marcpoenisch/Projekte/JobScout/ zwei CSV-Dateien:

*  a) skill_gap_kurse.csv mit Spalten:

* Lücke; Quelle_Anzeigen_oder_Strategisch; Häufigkeit_in_Anzeigen; Empfohlener_Kurs; Kosten; Dauer; Anbieter; Anerkennung; Prüfung_ja_nein; Link
* (Spalte "Quelle_Anzeigen_oder_Strategisch" markiert, ob der Kurs aus Schritt 3a oder 3b stammt)

* b) zertifikat_roi_vergleich.csv mit Spalten:
* Skill; Kurs_A; Kosten_A; Dauer_A; Anerkennung_A; Kurs_B; Kosten_B; Dauer_B; Anerkennung_B; Empfehlung

Sortiere beide Dateien nach Relevanz absteigend, Anzeigen-Lücken vor strategischen Empfehlungen. Antworte am Ende kurz auf Deutsch mit einer 4-Punkte-Zusammenfassung: größte Marktlücke, günstigster Quick-Win-Kurs, ein Kurs mit Förderpotenzial, eine strategische Empfehlung aus Schritt 3b.