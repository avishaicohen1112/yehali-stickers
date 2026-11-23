#!/bin/bash
cd "$(dirname "$0")"
for a in crypts gardens spire hearth; do python3 bg_scenes.py $a far 40 2>&1 | grep "BG\|Error\|Traceback" -A3; done
for a in crypts gardens spire hearth; do python3 bg_scenes.py $a mid 24 2>&1 | grep "BG\|Error\|Traceback" -A3; done
python3 bg_nave.py mid 24 2>&1 | grep "BG\|Error\|Traceback" -A3
python3 bg_nave.py far 48 2>&1 | grep "BG\|Error\|Traceback" -A3
