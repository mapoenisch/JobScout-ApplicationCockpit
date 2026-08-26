#!/bin/bash
cd "/Users/marcpoenisch/Documents/Projekte/JobScout" || exit 1

echo "Interview-Prep – Angaben zur Einladung:"
read -p "Firma: " FIRMA
read -p "Position: " POSITION
read -p "Gesprächsdatum: " DATUM
read -p "Gesprächspartner (oder leer für 'unbekannt'): " NAME
if [ -z "$NAME" ]; then
  NAME="unbekannt"
fi

PROMPT="$(cat prompt_interview_prep_template.txt)"
PROMPT="${PROMPT//__FIRMA__/$FIRMA}"
PROMPT="${PROMPT//__POSITION__/$POSITION}"
PROMPT="${PROMPT//__DATUM__/$DATUM}"
PROMPT="${PROMPT//__NAME__/$NAME}"

exec claude "$PROMPT"
