import numpy as np
import pandas as pd
from scipy import stats
import sys
import json

def load_benchmark_result_json(file_path):
    with open(file_path, 'r') as file:
        data = json.load(file)
    runs = data['benchmarks'][0]['metrics']['timeToInitialDisplayMs']['runs']
    data_df = pd.DataFrame(runs, columns=['time_ms'])
    return data_df

def calculate_stats(series):
    mean = np.mean(series)
    std_dev = np.std(series, ddof=1)
    median = np.median(series)
    count = len(series)
    variance = std_dev**2
    coefficient_of_variation = std_dev / mean if mean != 0 else np.nan
    return mean, std_dev, median, count, variance, coefficient_of_variation

def print_table(header, data):
    col_width = [max(len(str(x)) for x in col) for col in zip(*data, header)]
    header_row = " | ".join(format(title, f"{width}s") for title, width in zip(header, col_width))
    print(header_row)
    print("-" * len(header_row))
    for row in data:
        print(" | ".join(format(str(item), f"{width}s") for item, width in zip(row, col_width)))

def compare_benchmarks(file_path_1, file_path_2):
    before_data = load_benchmark_result_json(file_path_1)
    after_data = load_benchmark_result_json(file_path_2)
    series1 = before_data.iloc[:, 0]
    series2 = after_data.iloc[:, 0]

    stats_before = calculate_stats(series1)
    stats_after = calculate_stats(series2)

    comparison_data = [
        ['Mean', stats_before[0], stats_after[0]],
        ['Standard Deviation', stats_before[1], stats_after[1]],
        ['Median', stats_before[2], stats_after[2]],
        ['Variance', stats_before[4], stats_after[4]],
        ['Coefficient of Variation', stats_before[5], stats_after[5]]
    ]

    return comparison_data, stats_before, stats_after

def calculate_metrics(stats_before, stats_after):
    variance_ratio = stats_after[4] / stats_before[4]
    confidence_level = 0.95
    alpha_level = 1 - confidence_level
    z_score = stats.norm.ppf(1 - (alpha_level / 2))
    pooled_variance = ((stats_after[3] - 1) * stats_after[4] + (stats_before[3] - 1) * stats_before[4]) / (stats_after[3] + stats_before[3] - 2)
    pooled_std = np.sqrt(pooled_variance)
    std_error = np.sqrt(pooled_variance / stats_after[3] + pooled_variance / stats_before[3])
    margin_of_error = z_score * std_error
    mean_difference = stats_after[0] - stats_before[0]
    confidence_interval_range = (mean_difference - margin_of_error, mean_difference + margin_of_error)
    mean_percent_change = (mean_difference / stats_before[0]) * 100 if stats_before[0] != 0 else np.nan
    margin_of_error_percent_change = ((std_error / stats_after[0]) * 100) * z_score if stats_after[0] != 0 else np.nan
    confidence_interval_mean_percent_change = (mean_percent_change - margin_of_error_percent_change, mean_percent_change + margin_of_error_percent_change)

    other_metrics_data = [
        ['Variance Ratio', variance_ratio],
        ['Confidence Level', confidence_level],
        ['Alpha Level', alpha_level],
        ['Z Score', z_score],
        ['Pooled Estimate of Common Standard Deviation', pooled_std],
        ['Standard Error', std_error],
        ['Error Margin', margin_of_error],
        ['Confidence Interval Range', confidence_interval_range],
        ['Mean Difference', mean_difference],
        ['Confidence Interval of Mean Difference', confidence_interval_range],
        ['Confidence Interval of Mean Percent Change', confidence_interval_mean_percent_change]
    ]

    return other_metrics_data

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python compare.py <before_benchmarkData.json> <after_benchmarkData.json>")
        sys.exit(1)

    file_path_1 = sys.argv[1]
    file_path_2 = sys.argv[2]

    comparison_data, stats_before, stats_after = compare_benchmarks(file_path_1, file_path_2)
    metrics_data = calculate_metrics(stats_before, stats_after)

    print_table(['Metric', 'Before', 'After'], comparison_data)
    print("\n")
    print_table(['Metric', 'Value'], metrics_data)
