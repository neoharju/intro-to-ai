# Introduction to Artificial Intelligence 2026: course folder

One [uv](https://docs.astral.sh/uv/) project for all the programming exercises of the course. It has
Python 3.12 and NumPy, Matplotlib, pandas and scikit-learn, at the exact versions in `uv.lock`.

In a terminal in this folder:

```bash
uv sync                  # installs Python 3.12 and the packages into .venv
uv run check_setup.py    # prints the versions and checks that they work
```

- Unzip the exercise templates (for example `AlphaBeta.zip`) into this folder and run their tests in the
  exercise's own folder: `uv run python -m testrunner`. uv finds this project in the folder above.
- Run a script with `uv run python my_script.py`, or activate the environment once
  (`source .venv/bin/activate` on macOS and Linux, `.venv\Scripts\activate` on Windows) and use `python`.
- Add a package when an exercise needs it: `uv add torch transformers` (Week 5). Where a guide says
  `pip install <package>`, use `uv add <package>`.
- uv takes only releases that are at least 14 days old (`exclude-newer` in `pyproject.toml`): most
  malicious releases are found and removed from PyPI within days.
- On Linux, PyTorch comes as the CPU-only build (about 200 MB instead of about 3 GB with the CUDA
  libraries). With an NVIDIA GPU, remove the `torch` line under `[tool.uv.sources]` before `uv add torch`.
