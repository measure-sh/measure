import json
import os

import pandas as pd
import typer
from pandas import Series


def startup(file_path: str) -> Series:
    json_data = read_json(file_path)
    try:
        runs = json_data['benchmarks'][0]['metrics']['timeToInitialDisplayMs']['runs']
    except KeyError as e:
        typer.echo(f"Error: Failed to parse JSON: {e}", err=True)
        raise typer.Exit(code=1)
    series = extract_data(runs)
    return series


def track_gesture(file_path: str) -> Series:
    json_data = read_json(file_path)
    try:
        runs = json_data['benchmarks'][0]['metrics']['msr-trackGestureAverageMs']['runs']
    except KeyError as e:
        typer.echo(f"Error: Failed to parse JSON: {e}", err=True)
        raise typer.Exit(code=1)
    series = extract_data(runs)
    return series

def track_gesture_heap(file_path: str) -> Series:
    json_data = read_json(file_path)
    try:
        runs = json_data['benchmarks'][0]['metrics']['memoryHeapSizeMaxKb']['runs']
    except KeyError as e:
        typer.echo(f"Error: Failed to parse JSON: {e}", err=True)
        raise typer.Exit(code=1)
    series = extract_data(runs)
    return series    


def generate_svg(file_path: str) -> Series:
    json_data = read_json(file_path)
    try:
        runs = json_data['benchmarks'][0]['metrics']['msr-generateSvgAttachmentAverageMs']['runs']
    except KeyError as e:
        typer.echo(f"Error: Failed to parse JSON: {e}", err=True)
        raise typer.Exit(code=1)
    series = extract_data(runs)
    return series


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
