#!/bin/bash
cd "/Users/marcpoenisch/Projekte/JobScout" || exit 1
/Library/Developer/CommandLineTools/Library/Frameworks/Python3.framework/Versions/3.9/bin/python3.9 job_scout.py >> lauf.log 2>&1
