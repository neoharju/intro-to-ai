"""Checks the Python setup of the course. In the course folder: uv run check_setup.py"""

import platform
import sys
from importlib.metadata import PackageNotFoundError, version

print(f"Python {platform.python_version()} ({sys.executable})")

for package in ["numpy", "matplotlib", "pandas", "scikit-learn", "torch", "transformers"]:
    try:
        print(f"  {package:<13} {version(package)}")
    except PackageNotFoundError:
        print(f"  {package:<13} not installed")

import matplotlib

matplotlib.use("Agg")  # draw without opening a window

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression

# A tiny classification: small x is class 0, large x is class 1.
data = pd.DataFrame({"x": [0.0, 1.0, 2.0, 3.0], "y": [0, 0, 1, 1]})
model = LogisticRegression().fit(data[["x"]], data["y"])
predicted = model.predict(pd.DataFrame({"x": [0.5, 2.5]})).tolist()

figure, axes = plt.subplots()
axes.plot(np.arange(4), data["x"] ** 2)
plt.close(figure)

if predicted != [0, 1]:
    sys.exit(f"Something is wrong: the model predicted {predicted}, not [0, 1].")

print("Your setup works.")
