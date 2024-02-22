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

### Recording sessions or mappings

To record sessions or mappings to a local directory, navigate to `./self-host/sessionator` and run

```sh
go run . record
```

* to record sessions from an Android emulator, set following in `~/.gradle.properties`:

```sh
measure_url=http://10.0.2.2:8080
```

* to record sessions from an Android device, use a service like [tunnelmole](https://tunnelmole.com/) to forward requests from the device to localhost.


* to record mappings, run a assemble task, the mapping will be added to the local directory, `self-host/session-data`.
