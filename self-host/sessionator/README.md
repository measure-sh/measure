## Measure Dev CLI

Use Measure Dev CLI to manage development operations like ingesting test sessions and so on.

### Ingesting Sessions

To ingest sessions from a local directory,

1. navigate to the local directory
2. copy example config - `cp config.toml.example config.toml`
3. edit `config.toml` to list your apps and their api keys
4. navigate to `./self-host/sessionator` and run.

```sh
go run . ingest
```

### Usage and Help

To see usage at root.

```sh
go run . --help
```

To see usage of a subcommand.

```sh
go run . ingest --help
```