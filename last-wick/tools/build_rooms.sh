#!/bin/bash
cd "$(dirname "$0")"
for r in c1 c2 c3 c4 c5 c6 g1 g2 g3 g5 n1 n2 n3 n4 s1 s2 s3 s4 h1 h2; do
  python3 terrain3d.py --samples 12 $r 2>&1 | grep "ROOM\|Error\|Traceback" -A3
done
python3 place_props.py; python3 build_data.py; echo ROOMS_DONE
