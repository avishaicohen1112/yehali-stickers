#!/bin/bash
# Render + pack all enemies and bosses. Frames go to $1 (scratch dir)
cd "$(dirname "$0")"; S=${1:-/tmp/lw_frames}
for e in wickling husk emberfly mothling sporecap jelly acolyte sentinel shardwing wraith; do
  python3 enemies3d.py $e $S/en/$e > /dev/null 2>&1 && python3 pack.py $S/en/$e ../assets/sprites/e_$e --outline 2 --style 1 || echo "FAIL $e"
done
for b in knight vesper moth angler extinguisher; do
  python3 bosses3d.py $b $S/boss/$b > /dev/null 2>&1 && python3 pack.py $S/boss/$b ../assets/sprites/b_$b --outline 3 --style 1.2 || echo "FAIL $b"
done
python3 fix_origins.py; python3 build_data.py
echo CHARS_DONE
