# Measure Contribution Guidelines

## General workflow

- Every feature or bug must have a task in the [project board](https://github.com/orgs/measure-sh/projects/5)
- Each task gets converted to an issue
- Pull requests must be opened against an existing issue (which in turn contains a linked task in the board)
- All pull requests must be reviewed and approved by at least 1 maintainer before merging

## Local environment setup

> [!WARNING]
>
> Not interested in contributing? If you just want to try out measure, follow our [self hosting guide](./hosting/README.md).
>
> **The self hosting guide is the official and recommended way to try out measure.**

### Prerequisites

- Docker >= v26.1.3
- Docker Compose >= 2.27.3
- Node LTS

After cloning the repostiory, run the following commands for the best contribution experience. All core maintainers **MUST** follow these steps.

> [!NOTE]
>
> You would need [node](https://nodejs.org/) to run the above commands. We recommend you always stick to the `lts` version of node.
> If you need to setup node, we recommend you use [fnm (Fast Node Manager)](https://github.com/Schniz/fnm) to manage node versions. Follow [fnm's installation instructions](https://github.com/Schniz/fnm?tab=readme-ov-file#installation).

In the repo root, run

```sh
npm install
npm prepare
```

The above commands would install the required dependencies and setup git hooks as intended. This is a one-time setup, unless you do a fresh clone again.

### Setup initial configuration

Change to `self-host` directory.

```sh
cd self-host
```

Next, run `./config.sh`

```sh
./config.sh
```

This will start the configuration wizard and prepre all the environment variable files tuned for local development.

### Start services

Once configuration is complete, run the following docker compose command to start all services. For starting for the first time, provide `--profile migrate` to trigger database migrations.

```sh
docker compose --profile migrate up
```

> [!NOTE]
>
> #### About Compose Profiles
>
> The `migrate` profiles are idempotent in nature. You can use it everytime, though for subsequent runs you may choose to skip them.

Alternatively, you could build and up the containers in separate steps, like this.

```sh
docker compose build
docker compose --profile migrate up
```

For automatic file watching using docker compose, run:

```sh
docker compose watch
# or
docker compose up --watch
```

### Shutdown services

To stop all services and to remove all containers, run.

```sh
docker compose --profile migrate stop
docker compose --profile migrate down
```

## Troubleshooting

In case of any issues related to incoherent state, reset your environment by running. Keep in mind that this will remove all Measure volumes and all the data contained in those volumes.

```sh
# would stop all containers and
# remove images, orphan containers, volumes & networks
docker compose down --rmi all --remove-orphans --volumes
```

And rerun.

```sh
docker compose --profile migrate up
```

## Writing commit messages

All commits landing in any branch are first linted in your local environment and then in CI.

- Follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) for all commits.
- Stick to present tense for the commit message language
- Follow these `type` rules
  - **fix:** for commits that fixes a bug and must bump semver PATCH.
  - **feat:** for commits that adds new features and must bump semver MINOR
  - **docs:** for commits that modifies user facing documentation
  - **ci:** for commits that modifies CI configuration
  - **chore:** for commits that modifies settings, configurations and everything else
- Scoping your commits is optional, but encouraged. Allowed scopes are:
  - **ios** for commits related to iOS SDK
  - **android** for commits related to Android SDK
  - **frontend** for commits related to dashboard web app
  - **backend** for commits related to backend infrastructure
  - **[and more](https://github.com/measure-sh/measure/blob/d8b2c6048d854ac3c69535f0c4d955e4758a54c9/.commitlintrc.js#L13)**
- Try not to exceed **72** characters for commit header message
- Try not to exceed **100** characters for each line in body. Break each line with newlines to remain under 100 characters.
- Make sure commit message headers are in lowercase
- Make sure commit message body & footer are always sandwiched with a single blank line

### ❌ Bad Commits

- No `type`

  ```
  fix an issue with session replay
  ```

- Incorrect `scope`

  ```
  feat(foobar): add exception symbolication
  ```

- No newline between header & body

  ```
  feat(backend): add exception symbolication
  Add android symbolication of unhandled exceptions
  ```

- Exceeding `body-max-line-length`

  ```
  fix(backend): frames not ingesting

  this is a really really really long line that is exceeding the allowed limit of max characters per line
  ```

### ✅ Good Commits

- Correct `type`

  ```
  fix: an issue with session replay
  ```

- Correct & allowed `scope`

  ```
  feat(backend): add exception symbolication
  ```

- 1 blank line between header & body

  ```
  feat(backend): add exception symbolication

  Add android symbolication of unhandled exceptions
  ```

- Each body line is within limits

  ```
  fix(backend): frames not ingesting

  this is a really really really long line that is
  exceeding the allowed limit of max characters per line
  ```

## Managing databases

When contributing to databases, please strictly follow the following guidelines.

- Ensure every migration is backward compatible.
- Optimize queries for performance and scalability.
- Make sure all database migrations are in ALWAYS order.

## Migrating codebase from <= v0.8.x

1. Turn off all services

    ```sh
    # run from self-host directory
    docker compose down
    ```

2. Migrate configurations

    ```sh
    ./config.sh --development --ensure
    ```

3. Synchronize databases

    ```sh
    ./migrations/v0.9.x-sync-databases.sh
    ```

4. Run database migrations

    ```sh
    docker compose run --rm dbmate-postgres migrate
    ```

    ```sh
    docker compose run --rm dbmate-clickhouse migrate
    ```

5. Start development

    ```sh
    docker compose watch
    ```

6. Additionally, copy `postgres_dsn` and `clickhouse_dsn` variables in sessionator config.toml from [`config.toml.example`](../self-host/session-data/config.toml.example)

    ```toml
    postgres_dsn = "postgresql://..."
    clickhouse_dsn = "clickhouse://..."
    ```

## Release process

To trigger a release, create a signed git tag using [git-cliff](https://git-cliff.org/) and push the tag. Here's a one liner.

```sh
# bash/zsh
VERSION=$(git cliff --bumped-version) && git tag -s $VERSION -m $VERSION && git push origin $VERSION

# fish
set VERSION $(git cliff --bumped-version) && git tag -s $VERSION -m $VERSION && git push origin $VERSION
```

## Documentation
- Public facing docs should be in [docs](../README.md) folder - API requests & responses, self host guide, sdk guides and so on
- Main folder of subproject should link to main guide. ex: [frontend README](../../frontend/README.md) has link to self hosting and local dev guide
- Non public facing docs can stay in sub folder. ex: [backend benchmarking README](../../backend/benchmarking/README.md) which describes its purpose
