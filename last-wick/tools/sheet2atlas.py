"""Alias: the pose-sheet -> atlas tool lives in tools/posesheet.py (same arguments)."""
import runpy, os, sys
sys.argv[0] = os.path.join(os.path.dirname(__file__), 'posesheet.py')
runpy.run_path(sys.argv[0], run_name='__main__')
