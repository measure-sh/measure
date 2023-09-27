# Self Hosting Guide

Measure is designed from the ground up for easy self-hosting. Follow along to know how to run Measure on your own infrastructure.

## Using Docker

Measure can run on Linux, macOS and Windows.

> ### Requirements
>
> Make sure you have [Docker](https://docker.com/) running on your machine. You can follow the official instructions on [docker.com](https://docs.docker.com/get-docker/.) to know how to install and run docker.

### 1. Clone the repository

    git clone git@github.com:measure-sh/measure.git

### 2. Navigate to `measure-backend/self-host`

    cd measure-backend/self-host

### 3. Launch Measure using docker compose

    docker compose up

Give a few minutes for the docker containers to become ready. You should see logs similar to these.

```sh
measure-postgres-1    | 2023-09-27 00:16:40.499 UTC [1] LOG:  starting PostgreSQL 15.4 (Debian 15.4-1.pgdg120+1) on aarch64-unknown-linux-gnu, compiled by gcc (Debian 12.2.0-14) 12.2.0, 64-bit
measure-postgres-1    | 2023-09-27 00:16:40.500 UTC [1] LOG:  listening on IPv4 address "0.0.0.0", port 5432
measure-postgres-1    | 2023-09-27 00:16:40.500 UTC [1] LOG:  listening on IPv6 address "::", port 5432
measure-postgres-1    | 2023-09-27 00:16:40.500 UTC [1] LOG:  listening on Unix socket "/var/run/postgresql/.s.PGSQL.5432"
measure-postgres-1    | 2023-09-27 00:16:40.502 UTC [29] LOG:  database system was shut down at 2023-09-27 00:16:09 UTC
measure-postgres-1    | 2023-09-27 00:16:40.506 UTC [1] LOG:  database system is ready to accept connections
measure-api-1         | [GIN-debug] [WARNING] Creating an Engine instance with the Logger and Recovery middleware already attached.
measure-api-1         |
measure-api-1         | [GIN-debug] [WARNING] Running in "debug" mode. Switch to "release" mode in production.
measure-api-1         |  - using env:   export GIN_MODE=release
measure-api-1         |  - using code:  gin.SetMode(gin.ReleaseMode)
```

### 4. Open dashboard

Navigate to [http://localhost:9999](http://localhost:9999) to visit the dashboard.

### 5. Teardown & cleanup

To shutdown the containers, run.

```sh
docker compose down
```

Any events or logs will be persisted the next time you run `docker compose up` again.

To perform a more aggressive shutdown, run the following command.

```sh
docker compose down --rmi local --remove-orphans --volumes
```

### Tail Clickhouse Logs

To see Clickhouse server logs, run.

```sh
# trace logs
docker exec -it measure-clickhouse-1 tail -f /var/log/clickhouse-server/clickhouse-server.log

# error logs
docker exec -it measure-clickhouse-1 tail -f /var/log/clickhouse-server/clickhouse-server.err.log
```