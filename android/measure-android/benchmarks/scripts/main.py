import scipy.stats as stats
import typer
from pandas import Series

import parse_benchmark
import shapirowilk

MIN_BENCHMARK_ITERATIONS = 30

app = typer.Typer(help="Analyze Android macro-benchmark results")


@app.command()
def compare_startup(path_before: str, path_after: str):
    before_data = parse_benchmark.startup(path_before)
    after_data = parse_benchmark.startup(path_after)
    calculate_and_print_metrics(before_data, after_data)


@app.command()
def compare_track_gesture(path_before: str, path_after: str):
    before_data = parse_benchmark.track_gesture(path_before)
    after_data = parse_benchmark.track_gesture(path_after)
    calculate_and_print_metrics(before_data, after_data)

@app.command()
def compare_view_click_heap(path_before: str, path_after: str):
    before_data = parse_benchmark.track_gesture_heap(path_before)
    after_data = parse_benchmark.track_gesture_heap(path_after)
    calculate_and_print_metrics(before_data, after_data)


@app.command()
def compare_generate_svg(path_before: str, path_after: str):
    before_data = parse_benchmark.generate_svg(path_before)
    after_data = parse_benchmark.generate_svg(path_after)
    calculate_and_print_metrics(before_data, after_data)


def calculate_and_print_metrics(data_before: Series, data_after: Series) -> None:
    iteration_count_before = len(data_before)
    iteration_count_after = len(data_after)
    verify_minimum_iterations(iteration_count_before)
    verify_minimum_iterations(iteration_count_after)

    shapirowilk.test(data_before, label="before")
    shapirowilk.test(data_after, label="after")

    mean_before = data_before.mean().round(3)
    mean_after = data_after.mean().round(3)

    std_before = data_before.std().round(3)
    std_after = data_after.std().round(3)

    median_before = data_before.median().round(3)
    median_after = data_after.median().round(3)

    variance_before = (std_before ** 2).round(3)
    variance_after = (std_after ** 2).round(3)

    coefficient_of_variation_before = (std_before / mean_before).round(3)
    coefficient_of_variation_after = (std_after / mean_after).round(3)
    check_coefficient_of_variation(data_before, "before")
    check_coefficient_of_variation(data_after, "after")

    variance_ratio = variance_after / variance_before
    check_variance_ratio(data_before, data_after)

    confidence_level = 0.95
    alpha_level = round((1 - confidence_level) / 2, 3)
    z_score = (stats.norm.ppf(1 - alpha_level)).round(3)
    pooled_variance = ((iteration_count_after - 1) * variance_after + (
            iteration_count_before - 1) * variance_before) / (iteration_count_after + iteration_count_before - 2)
    pooled_estimate_of_common_std = (pooled_variance ** 0.5).round(3)
    standard_error = (
            (pooled_variance / iteration_count_after + pooled_variance / iteration_count_before) ** 0.5).round(3)
    margin_of_error = (z_score * standard_error).round(3)
    confidence_interval_range = (margin_of_error * 2).round(3)

    confidence_interval_of_mean_difference_lower = (mean_after - mean_before - margin_of_error).round(3)
    confidence_interval_of_mean_difference_upper = (mean_after - mean_before + margin_of_error).round(3)
    confidence_interval_of_mean_difference = (
        confidence_interval_of_mean_difference_lower, confidence_interval_of_mean_difference_upper)
    confidence_interval_of_mean_percent_change_lower = (
            (confidence_interval_of_mean_difference[0] / mean_before) * 100).round(3)
    confidence_interval_of_mean_percent_change_upper = (
            (confidence_interval_of_mean_difference[1] / mean_after) * 100).round(3)
    confidence_interval_of_mean_percent_change = (
        confidence_interval_of_mean_percent_change_lower, confidence_interval_of_mean_percent_change_upper)

    print_table(
        ["Metric", "Before", "After"],
        ["Mean", mean_before, mean_after],
        ["Standard Deviation", std_before, std_after],
        ["Median", median_before, median_after],
        ["Variance", variance_before, variance_after],
        ["Coefficient of Variation", coefficient_of_variation_before, coefficient_of_variation_after]
    )

    print_table(
        ["Metric", "Value"],
        ["Variance Ratio", variance_ratio],
        ["Confidence Level", confidence_level],
        ["Alpha Level", alpha_level],
        ["Z Score", z_score],
        ["Pooled Estimate of Common Standard Deviation", pooled_estimate_of_common_std],
        ["Standard Error", standard_error],
        ["Error Margin", margin_of_error],
        ["Confidence Interval Range", confidence_interval_range],
        ["Mean Difference", mean_after - mean_before],
        ["Confidence Interval of Mean Difference", confidence_interval_of_mean_difference],
        ["Confidence Interval of Mean Percent Change", confidence_interval_of_mean_percent_change]
    )


def print_table(header, *data) -> None:
    col_width = [max(len(str(x)) for x in col) for col in zip(*data, header)]
    header_row = " | ".join(format(title, f"{width}s") for title, width in zip(header, col_width))
    typer.echo()
    typer.echo("-" * len(header_row))
    typer.echo(header_row)
    typer.echo("-" * len(header_row))
    for row in data:
        typer.echo(" | ".join(format(str(item), f"{width}s") for item, width in zip(row, col_width)))


def verify_minimum_iterations(iterations: int) -> None:
    if iterations < MIN_BENCHMARK_ITERATIONS:
        typer.echo(f"Error: At least {MIN_BENCHMARK_ITERATIONS} iterations required for analysis.")
        raise typer.Exit(code=1)


def check_coefficient_of_variation(data: Series, label: str) -> None:
    cv = data.std() / data.mean()
    if (cv > 0.06).all():
        typer.echo(f"Warning: Coefficient of variation for \"{label}\" is higher than 6%: {cv.round(3) * 100}%",
                   err=False)


def check_variance_ratio(data_before: Series, data_after: Series) -> None:
    cv_before = (data_before.std() / data_before.mean())
    cv_after = (data_after.std() / data_after.mean())
    if (cv_before / cv_after < 0.5).all() and (cv_before / cv_after < 2).all():
        typer.echo(f"Warning: Variance ratio is more than double: {(cv_before / cv_after) * 100}%", err=False)


if __name__ == "__main__":
    app()
