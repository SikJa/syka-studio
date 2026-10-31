"""Compatibility entrypoint for the current isolated onboarding/social QA (port 5307)."""
from pathlib import Path
import runpy

runpy.run_path(str(Path(__file__).with_name('verify-social.py')), run_name='__main__')
