import pandas as pd
import numpy as np
from scipy.stats import shapiro
import sys
import json


def load_benchmark_result_json(file_path):
    with open(file_path, 'r') as file:
        data = json.load(file)
    runs = data['benchmarks'][0]['metrics']['timeToInitialDisplayMs']['runs']
    data_df = pd.DataFrame(runs, columns=['time_ms'])
    return data_df


def shapiro_test(data):
    stat, p = shapiro(data)
    follows_dist = "Follows" if p > 0.05 else "Does not follow"
    print(f"statistic: {stat:.4f}")
    print(f"pvalue: {p:.4f}")
    print(f"{follows_dist} normal distribution")
    if p > 0.05:
        return True
    else:
        return False


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python shapirowilk.py <path_to_benchmark_json_file>")
        sys.exit(1)

    file_path = sys.argv[1]
    data = load_benchmark_result_json(file_path)
    shapiro_test(data)
