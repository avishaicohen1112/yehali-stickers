#!/bin/bash
cd "$(dirname "$0")"; S=$1
while ! grep -q CHARS_DONE $S/chars.log; do sleep 20; done
python3 bosses3d.py knight $S/frames/boss/knight > /dev/null 2>&1 && python3 pack.py $S/frames/boss/knight ../assets/sprites/b_knight --outline 3 --style 1.2
python3 fix_origins.py > /dev/null; python3 build_data.py; echo KNIGHT_DONE
