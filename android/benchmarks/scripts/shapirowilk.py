import typer
from scipy.stats import shapiro


def test(data, label: str):
    stat, p = shapiro(data)
    if p > 0.05:
        return True
    else:
        typer.echo(f"Error: Data in \"{label}\" is not normally distributed. Shapiro-Wilk test result: stat={stat}, p={p}", err=True)
        raise typer.Exit(code=1)

