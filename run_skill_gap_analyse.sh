#!/bin/bash
cd "/Users/marcpoenisch/Documents/Projekte/JobScout" || exit 1
exec claude "$(cat prompt_skill_gap_analyse.txt)"
