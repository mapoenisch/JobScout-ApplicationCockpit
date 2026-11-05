---
name: "JobScout Cockpit"
description: "Lokales Bewerbungs-Cockpit mit CRM-Lead-Scoring, faktentreuem CV-Editor und DIN 5008 / PDF-Pipeline"
colors:
  bg: "#f5f6fb"
  bg-dark: "#0f1120"
  surface: "#ffffff"
  surface-dark: "#171a2e"
  surface-2: "#f8f8fd"
  surface-2-dark: "#1d2038"
  line: "#e7e8f1"
  line-dark: "#2a2e4a"
  text: "#171a2c"
  text-dark: "#eceefb"
  muted: "#60657e"
  muted-dark: "#9fa4c4"
  accent: "#5b4bff"
  accent-dark: "#8577ff"
  accent-2: "#8b5cf6"
  accent-2-dark: "#a78bfa"
  accent-soft: "#eeecff"
  accent-soft-dark: "#262352"
  accent-text: "#3c2bd6"
  accent-text-dark: "#b4aaff"
  ok: "#12a26b"
  ok-soft: "#e3f6ee"
  ok-text: "#0b6641"
  ok-soft-dark: "#12342a"
  ok-text-dark: "#4ade80"
  warn: "#d98a00"
  warn-soft: "#fff4dc"
  warn-text: "#8a5800"
  warn-soft-dark: "#3a2d10"
  warn-text-dark: "#facc15"
  bad: "#e0445a"
  bad-soft: "#fde8eb"
  bad-text: "#b91c34"
  bad-soft-dark: "#3c1a22"
  bad-text-dark: "#f87171"
  info: "#2b7fff"
  info-soft: "#e5efff"
  info-text: "#1657c2"
  info-soft-dark: "#172a4d"
  info-text-dark: "#60a5fa"
typography:
  fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif"
  fontMono: "ui-monospace, 'SF Mono', Menlo, monospace"
  h1:
    fontSize: "24px"
    fontWeight: 750
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  h2:
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  h3:
    fontSize: "15.5px"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  small:
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.4
  nav-label:
    fontSize: "11.5px"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "0.08em"
    textTransform: "uppercase"
rounded:
  sm: "6px"
  md: "10px"
  lg: "12px"
  xl: "14px"
  full: "99px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "14px"
  lg: "18px"
  xl: "24px"
components:
  card:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.line}"
    rounded: "{rounded.xl}"
    padding: "20px"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "8px 14px"
  button-soft:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-text}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
  chip:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.muted}"
    rounded: "{rounded.full}"
    padding: "2px 9px"
    fontSize: "11.5px"
---

# Overview

JobScout Cockpit ist ein persönliches Desktop-Werkzeug für Fach- und Führungskräfte auf macOS. Das Designsystem verfolgt einen klaren, ruhigen und werkzeugzentrierten Ansatz:

1. **Datendichte & Effizienz:** Arbeitsplatz-Oberfläche mit klaren Hierarchien, schnellen Filterwegen und ohne verspielten Ballast.
2. **Mac-Integration:** Natives System-Feeling mit San Francisco Typography (`SF Pro Text`), dezenten Rahmenlinien, 14px-Radien und ausgewogener Elevation.
3. **Barrierefreiheit & Lesbarkeit (WCAG AA):** Sämtliche Badges, Status-Chips und Textkontraste halten mindestens 4.5:1 ein. Schriftgrößen unter 11.5px sind ausgeschlossen.
4. **Verlässlichkeit & Anti-Slop:** Keine unruhigen künstlichen AI-Neon-Glows, keine übertriebenen Gradienten-Banner, keine generischen Clichés.

---

# Colors

Das Farbsystem basiert auf funktionalen Statusfarben mit separaten soften Hintergründen und kontraststarken Textwerten.

### Primäre Palette & Flächen
* **Hintergrund (`--bg`):** `#f5f6fb` (Dark: `#0f1120`) – Kühles, neutrales Canvas.
* **Fläche (`--surface`):** `#ffffff` (Dark: `#171a2e`) – Hauptkarten und Modale.
* **Fläche 2 (`--surface-2`):** `#f8f8fd` (Dark: `#1d2038`) – Eintragsblöcke, Listenzeilen, Vorschauen.
* **Trennlinie (`--line`):** `#e7e8f1` (Dark: `#2a2e4a`) – Feine Konturen für saubere Trennung.
* **Fließtext (`--text`):** `#171a2c` (Dark: `#eceefb`) – Tiefes Nachtblau statt reinem Schwarz.
* **Gedämpft (`--muted`):** `#60657e` (Dark: `#9fa4c4`) – Für sekundäre Metadaten (gehärtet für AA-Kontrast).

### Akzent & Markenidentität
* **Akzent (`--accent` / `--accent-2`):** `#5b4bff` und `#8b5cf6` – Präzises Indigo für aktive Zustände, primäre Buttons und Logo.
* **Akzent Soft (`--accent-soft`):** `#eeecff` (Dark: `#262352`).
* **Akzent Text (`--accent-text`):** `#3c2bd6` (Dark: `#b4aaff`) – Verhindert Kontrastverlust auf Soft-Flächen.

### Funktionale Ampel- & Statusfarben
| Status | Primär (`--*`) | Soft-Hintergrund (`--*-soft`) | Text / Badge (`--*-text`) | Einsatz |
|---|---|---|---|---|
| **Erfolg / Top** | `#12a26b` | `#e3f6ee` (Dark: `#12342a`) | `#0b6641` (Dark: `#4ade80`) | Score ≥ 70, Angebot, angenommen |
| **Warnung / Fällig** | `#d98a00` | `#fff4dc` (Dark: `#3a2d10`) | `#8a5800` (Dark: `#facc15`) | Score 50–69, Follow-up fällig |
| **Gefahr / Ablehnung** | `#e0445a` | `#fde8eb` (Dark: `#3c1a22`) | `#b91c34` (Dark: `#f87171`) | Absage, Malus, Fehler-Toast |
| **Information / Laufend** | `#2b7fff` | `#e5efff` (Dark: `#172a4d`) | `#1657c2` (Dark: `#60a5fa`) | Beworben, Unterlagen, Vision OCR |

---

# Typography

* **Schriftfamilie:** `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif` – Nativ auf macOS, kein FOUT (Flash of Unstyled Text), kein Lade-Overhead.
* **Monospace:** `ui-monospace, "SF Mono", Menlo, monospace` – Für Code, DIN-Voransichten und Logs.

### Hierarchie & Skala
* **H1 (View-Titel):** 24px, Weight 750, Tracking `-0.01em`.
* **H2 (Abschnitt / Panel):** 18px / 22px, Weight 700.
* **H3 / Card-Title:** 15.5px, Weight 700.
* **Body / Standard:** 14px, Weight 400/500, Line-Height 1.5.
* **Small / Meta:** 12.5px, Weight 500, Line-Height 1.4.
* **Labels / Kategorien:** 11.5px, Weight 650, Tracking `0.08em`, Uppercase (Mindest-Floor 11.5px strikt eingehalten).

---

# Layout

* **Two-Column Shell:** 
  * Feste linke Sidebar (`252px`) mit Sticky-Navigation.
  * Flexibler Hauptbereich (`1fr`) mit ergonomischem Padding (`26px 34px 60px`).
* **Responsiver Drawer (< 820px):**
  * Sidebar wandert in Off-Canvas-Drawer (`width: 260px; transform: translateX(-100%)`).
  * Einblendung über Hamburger-Menü (`.menu-btn`).
* **Splitscreen & Editoren:**
  * Editor-Ansichten (Lebenslauf, Analyse) nutzen ein 2-Spalten-Grid (`minmax(380px, 1fr) minmax(0, 1.05fr)`).
  * Vorschau-Spalte ist sticky (`position: sticky; top: 18px`).
* **Absicherung:**
  * `min-width: 0` auf allen Grid-Kindern zur Vermeidung von WebKit/Safari-Überlauf-Bugs.

---

# Elevation & Depth

* **Karten-Schatten (`--shadow`):**
  * Light Mode: `0 1px 2px rgba(23,26,44,.04), 0 6px 24px rgba(23,26,44,.06)`.
  * Dark Mode: `0 1px 2px rgba(0,0,0,.3), 0 8px 28px rgba(0,0,0,.25)`.
* **Modale & Dialoge:**
  * Dialog: `0 30px 80px rgba(0,0,0,.35)` mit `backdrop-filter: blur(3px)`.
* **Fliegende Leisten (`.auswahl-bar`):**
  * Schwebende Aktionsleiste: `0 12px 30px rgba(0,0,0,.25)`.
* **Keine Farb-Glows:** Keine bunten Außen-Schatten auf dunklem Grund. Schatten bleiben streng monochromatisch und physikalisch glaubwürdig.

---

# Shapes

* **Karten & Container (`--radius`):** `14px` für Cards, Hero-Bereiche und Modale.
* **Buttons & Inputs:** `10px` für reguläre Buttons, Selects und Textareas.
* **Kompakt-Buttons & Badges:** `8px` für `.btn-sm` und Mini-Buttons.
* **Chips & Pills:** `99px` für Status-Chips, Zähler-Badges und Tags.

---

# Components

### Buttons
* `.btn`: 13.5px, Weight 600, Padding `8px 14px`, 1px Solid Line.
* `.btn-primary`: Akzent-Hintergrund, weißer Text.
* `.btn-soft`: Zarter Akzent-Hintergrund, `--accent-text`.
* `.icon-btn.mini`: 28×28px sichtbar, mit `::after`-Hitbox auf 42×42px Touch-Zone erweitert.

### Status-Chips (`.chip`)
* Kompakt (`11.5px`), voll abgerundet (`99px`), immer semantisch gepaart:
  * `.chip.neu`: `--accent-soft` + `--accent-text`.
  * `.chip.ok`: `--ok-soft` + `--ok-text`.
  * `.chip.warn`: `--warn-soft` + `--warn-text`.
  * `.chip.bad`: `--bad-soft` + `--bad-text`.

### Barrierefreier Fokus (`:focus-visible`)
* Interaktive Elemente erhalten bei Tastaturbedienung eine 2px Accent-Kontur mit 2px Abstand:
  ```css
  :focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  ```

---

# Do's and Don'ts

### Do's
* **Faktentreue wahren:** Alle generierten Texte müssen aus `profil.json` oder bestätigten Angaben stammen.
* **DIN 5008 & ATS-Konformität:** Vorschauen und Ausgaben für Anschreiben und Lebenslauf millimetergenau formatieren.
* **System-Schrift nutzen:** Immer den definierten `-apple-system`-Stack verwenden.
* **Kontrast-Tokens verwenden:** Bei farbigen Texten auf getönten Hintergründen immer die `--*-text`-Varianten einsetzen.

### Don'ts
* **Kein AI-Slop:** Keine zufälligen Gradienten-Texte, keine bunten Box-Shadow-Glows, keine überflüssigen Schmuck-Grafiken.
* **Keine Schriften unter 11.5px:** Niemals funktionale UI-Texte unter den 11.5px-Floor absenken.
* **Keine Framework-Abhängigkeiten im Frontend:** Kein React, kein Vue, kein Tailwind, kein Webpack einführen – reines Vanilla HTML/CSS/JS beibehalten.
* **Keine Tastaturfallen:** Fokusringe niemals per `outline: none` ohne visuellen Ersatz abschalten.
