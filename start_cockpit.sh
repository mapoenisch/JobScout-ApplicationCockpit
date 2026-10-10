#!/bin/bash
# Startet das JobScout Cockpit (falls nicht schon aktiv) und öffnet es im Browser.
cd "/Users/marcpoenisch/Projekte/JobScout" || exit 1
URL="http://127.0.0.1:8765"
PY="/opt/homebrew/bin/python3"; [ -x "$PY" ] || PY="/usr/bin/python3"
if ! /usr/bin/curl -s -o /dev/null --max-time 1 "$URL/api/status"; then
  mkdir -p .cockpit
  nohup "$PY" jobscout_app.py --kein-browser > .cockpit/server.log 2>&1 &
  for i in $(seq 1 20); do
    /usr/bin/curl -s -o /dev/null --max-time 1 "$URL/api/status" && break
    sleep 0.3
  done
fi
open "$URL"
