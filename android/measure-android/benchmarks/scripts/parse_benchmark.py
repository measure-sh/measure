import json
import os
from typing import Optional

import pandas as pd
import typer
from pandas import Series


def startup(file_path: str, test_filter: Optional[str] = None) -> Series:
    return _read_metric(file_path, 'timeToInitialDisplayMs', test_filter)


def track_gesture(file_path: str, test_filter: Optional[str] = None) -> Series:
    return _read_metric(file_path, 'msr-trackGestureAverageMs', test_filter)


def click_heap(file_path: str, test_filter: Optional[str] = None) -> Series:
    return _read_metric(file_path, 'memoryHeapSizeMaxKb', test_filter)


def _read_metric(file_path: str, metric: str, test_filter: Optional[str]) -> Series:
    json_data = read_json(file_path)
    benchmark = _select_benchmark(json_data, test_filter)
    try:
        runs = benchmark['metrics'][metric]['runs']
    except KeyError:
        label = f"{benchmark.get('className', '?')}.{benchmark.get('name', '?')}"
        typer.echo(
            f"Error: benchmark '{label}' has no metric '{metric}'. "
            f"Available metrics: {sorted(benchmark.get('metrics', {}).keys())}",
            err=True,
        )
        raise typer.Exit(code=1)
    return extract_data(runs)


def _select_benchmark(json_data, test_filter: Optional[str]) -> dict:
    benchmarks = json_data.get('benchmarks', [])
    if not benchmarks:
        typer.echo("Error: JSON contains no benchmark entries.", err=True)
        raise typer.Exit(code=1)
    if test_filter is None:
        if len(benchmarks) > 1:
            available = [f"{b.get('className', '?')}.{b.get('name', '?')}" for b in benchmarks]
            typer.echo(
                f"Error: JSON contains {len(benchmarks)} benchmark entries; "
                f"pass --test to pick one. Available: {available}",
                err=True,
            )
            raise typer.Exit(code=1)
        return benchmarks[0]
    needle = test_filter.lower()
    matches = [
        b for b in benchmarks
        if needle in b.get('className', '').lower() or needle in b.get('name', '').lower()
    ]
    if not matches:
        available = [f"{b.get('className', '?')}.{b.get('name', '?')}" for b in benchmarks]
        typer.echo(
            f"Error: no benchmark matches '--test {test_filter}'. Available: {available}",
            err=True,
        )
        raise typer.Exit(code=1)
    if len(matches) > 1:
        labels = [f"{b.get('className', '?')}.{b.get('name', '?')}" for b in matches]
        typer.echo(
            f"Error: '--test {test_filter}' matches {len(matches)} benchmarks ({labels}); "
            f"use a more specific filter.",
            err=True,
        )
        raise typer.Exit(code=1)
    return matches[0]


def extract_data(runs) -> Series:
    try:
        data_series = pd.Series(runs, name='time_ms')
    except ValueError as e:
        typer.echo(f"Error: Failed to parse JSON: {e}", err=True)
        raise typer.Exit(code=1)
    return data_series


def read_json(file_path):
    if not os.path.exists(file_path):
        raise typer.BadParameter(f"File does not exist at {file_path}")
    try:
        with open(file_path, 'r') as file:
            data = json.load(file)
    except FileNotFoundError:
        typer.echo(f"Error: The file at '{file_path}' was not found.", err=True)
        raise typer.Exit(code=1)
    except json.JSONDecodeError:
        typer.echo(f"Error: The file at '{file_path}' is not a valid JSON file.", err=True)
        raise typer.Exit(code=1)
    return data
