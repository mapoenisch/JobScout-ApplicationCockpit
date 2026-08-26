#!/bin/bash
cd "/Users/marcpoenisch/Documents/Projekte/JobScout" || exit 1
exec claude "$(cat prompt_bewerbungs_workflow.txt)"
