"""Compatibility entrypoint. Refresh atomically through the shared lock."""
import runpy
from pathlib import Path
runpy.run_path(str(Path(__file__).with_name('graphify-runtime.py')), run_name='__main__')
