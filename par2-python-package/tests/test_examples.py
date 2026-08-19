"""Smoke tests: every shipped example script must run end to end."""

import os
import subprocess
import sys

import pytest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
EXAMPLES = [os.path.join("examples", "quickstart.py")] + [
    os.path.join("examples", "vignettes", name)
    for name in sorted(os.listdir(os.path.join(REPO_ROOT, "examples", "vignettes")))
    if name.endswith(".py")
]


@pytest.mark.parametrize("script", EXAMPLES, ids=lambda p: os.path.basename(p))
def test_example_runs(script):
    env = dict(os.environ, PYTHONPATH=REPO_ROOT)
    proc = subprocess.run(
        [sys.executable, script],
        cwd=REPO_ROOT,
        env=env,
        capture_output=True,
        text=True,
        timeout=300,
    )
    assert proc.returncode == 0, f"{script} failed:\n{proc.stdout}\n{proc.stderr}"
    assert proc.stdout.strip(), f"{script} produced no output"
