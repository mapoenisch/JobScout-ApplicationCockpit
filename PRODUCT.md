<!-- impeccable:product-schema 1 -->

# JobScout — Product Context

## 1. Zweck & Kernnutzen (Purpose & Value Proposition)
JobScout ist ein lokales Bewerbungs-Cockpit, das den gesamten Bewerbungsprozess von der Stellensuche bis zur versandfertigen Bewerbungsmappe systematisiert und beschleunigt.

* **Differenzierender Mechanismus:** CRM-inspiriertes Lead-Scoring (0–100 Punkte mit Keyword-Gewichtung, Verneinungs-Erkennung, Malus-/Ausschlusskriterien und Frische-/Standort-Boni), angewendet auf Stellenanzeigen statt Vertriebs-Leads.
* **Faktengetriebene Dokumenten-Generierung:** Stellenbezogene Lebenslauf-Anpassung und Anschreiben-Erstellung mit striktem Faktenregister („nichts erfinden“), gezielten Rückfragen bei Lücken und vollständiger Transparenz.
* **Normenkonformität:** Druckreife PDF-Ausgabe nach DIN 5008, ATS-optimierte Formatierung und einheitliche Bewerbungsmappen per Headless Chrome und Poppler.

---

## 2. Zielgruppe & Nutzungskontext (Target Audience & Context)
* **Primärer Nutzer:** Fach- und Führungskräfte (initiiert im Kontext Digital Sales Management / Tech) im aktiven oder strukturierten Bewerbungsprozess.
* **Nutzungsumgebung:** Lokales Desktop-Werkzeug (macOS) mit Web-UI auf `localhost` (Port 8765 bzw. 8766).
* **Nutzungsverhalten:** Fokussiertes Arbeiten mit hoher Informationsdichte, schneller Tastaturbedienung und direktem Feedback; keine Ablenkung durch unnötige Gamification.

---

## 3. Zentrale Workflows & Funktionen (Key Workflows)
1. **Finden & Bewerten (Scouting & Scoring):**
   * Aggregation aus 4 Job-APIs (Arbeitsagentur, Adzuna, Arbeitnow, Himalayas) plus LinkedIn-Bridge.
   * Regelbasiertes Scoring gegen persönliches Profil (`profil.json`).
   * SQLite-Persistenz (`jobs_gesehen.db`) für NEU-Erkennung und Historie.
2. **Analysieren & Abgleichen:**
   * Text- oder PDF-Upload von Stellenanzeigen.
   * Multi-CV-Vergleich (Bibliothek mit bis zu 10 Lebensläufen) zur Identifikation von Stärken und Gaps.
3. **CV neu formulieren (Ebene im Lebenslauf-Editor):**
   * Transformation von Stichpunkten oder Entwürfen in bewerbungsfertige Stationen.
   * Faktenprüfung, Prüfbericht und wörtliche Übernahmemöglichkeit eigener Formulierungen.
4. **Unterlagen & Bewerbungsmappe:**
   * Anschreiben nach DIN 5008 mit Formblatt-Präzision.
   * Zwei-Spalten-Lebenslauf mit optimierter Seitenumbruch-Berechnung.
   * Zeugnisse und Zertifikate mit automatischer OCR (macOS Vision API).
   * Generierung einheitlicher Gesamt-PDFs (`pdfunite`).
5. **Nachverfolgung & Vorbereitung:**
   * Kanban-Board mit Follow-up-Erinnerungen.
   * Interview-Vorbereitung (Fragenkatalog, Antwortgerüste nach STAR-Methode).
   * Skill-Radar zum Abgleich von Markttrends vs. eigenes Portfolio.

---

## 4. Leitplanken & Invarianten (Durable Constraints)
* **100% Lokale Datenhaltung (Datenschutz):** Alle persönlichen Daten (`profil.json`, `lebenslauf.json`, generierte Anschreiben, Mappen, Bewerbungs-Tracker) verbleiben strikt lokal auf dem Rechner und sind git-ignoriert. Keinerlei unkontrollierter Upload in Cloud-Silos.
* **Strikte Faktentreue:** Keine Halluzinationen. Es werden nur belegbare Qualifikationen und Erfahrungen verwendet.
* **Leichtgewichtiger Tech-Stack:**
  * Python Standard-Bibliothek (`http.server`, SQLite) mit minimalen Drittabhängigkeiten (`requests`).
  * Vanilla Web-Frontend (HTML5, modernes CSS, ES6 JavaScript) ohne Framework-Overhead (kein React, kein Webpack/Build-Step).
  * Systemwerkzeuge für Rendering und PDF-Manipulation (`Chrome Headless`, `poppler`, Swift OCR).
* **Formale Standards:** DIN 5008 für Geschäftsbriefe/Anschreiben, ATS-Lesbarkeit für Lebensläufe.

---

## 5. Tonalität & Design-Prinzipien (Voice & Philosophy)
* **Pragmatisch & Werkzeug-orientiert:** Sachliche, klare UI mit professioneller Dichte. Jedes UI-Element erfüllt eine konkrete Aufgabe im Bewerbungstrichter.
* **Transparenz:** Scores und KI-Vorschläge werden stets begründet (Ampel-Logik, Prüfberichte).
* **Verlässlichkeit:** Strikte visuelle Ruhe, keine visuellen Spielereien oder generischer „AI Slop“ (z. B. willkürliche Farbschattierungen, übertriebene Glow-Effekte oder unpassende Schmuckelemente).
