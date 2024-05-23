# Self Hosting Guide

Measure is designed from the ground up for easy self-hosting. Follow along to know how to run Measure on your own infrastructure.

## Prerequisites

- [Docker v24+](https://www.docker.com/)
- [Supabase v1.112.0+](https://supabase.com/)
- [dbmate v2.8.0+](https://github.com/amacneil/dbmate)
- [node &amp; npm](https://nodejs.org/en)

### Installing Docker

If you don't already have docker running, follow the official instructions on [docker.com](https://docs.docker.com/get-docker/) to install and run docker.

### Installing Supabase

> How Measure uses Supabase
>
> We use Supabase for auth. To try out measure on a local machine you don't need a Supabase account.

If you don't have [supabase/cli](https://github.com/supabase/cli) installed, follow the instructions on the [README](https://github.com/supabase/cli/blob/main/README.md) page to install it first.

If you are on `macOS`, you can install supabase-cli using homebrew.

```sh
brew install supabase/tap/supabase
```

> Make sure to keep the supabase cli updated by running `brew upgrade` periodically

### Installing dbmate

Measure uses [dbmate](https://github.com/amacneil/dbmate) for running database migrations to postgres and clickhouse instances. Follow the instructions on their GitHub README to install on your machine.

### Installing node/npm

Skip this step if you already have node/npm.

If you don't have node installed, we recommend [fnm](https://github.com/Schniz/fnm). Follow fnm's instructions to install the latest LTS version of node.

## 1. Clone the repository

```sh
git clone git@github.com:measure-sh/measure.git
```

## 2. Navigate to `./self-host`

```sh
cd self-host
```

## 3. Copy the supabase environment file

```sh
cp .env.example .env
```

## 4. Modify the variables in `.env`

Configure the following variables:

- `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`
- `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET`
- `SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID`
- `SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_SECRET`

## 5. Start supabase

```sh
supabase start
```

It might take a few seconds for all the supabase containers to start and get healthy.

## 6. Setup &amp; start web services

Navigate to `measure-backend/symbolicator-retrace`

Copy the `.env.example` to `.env` and modify the variables.

```sh
cp .env.example .env
```

Navigate to `measure-backend/measure-go`

Copy the `.env.example` to `.env` and modify the variables.

```sh
cp .env.example .env
```

Navigate to `./self-host` and start the containers.

If running for the first time or running after deleting containers, use the `--profile init` flag to setup buckets and so on.

```sh
# for the very first time
docker compose --profile init up

# for subsequent runs
docker compose up
```

Give a minute for the docker containers to become ready. You should see logs similar to this.

```sh
api                   | 2023/11/17 10:26:37 using default value of MAPPING_FILE_MAX_SIZE
api                   | [GIN-debug] [WARNING] Creating an Engine instance with the Logger and Recovery middleware already attached.
api                   |
api                   | [GIN-debug] [WARNING] Running in "debug" mode. Switch to "release" mode in production.
api                   |  - using env:   export GIN_MODE=release
api                   |  - using code:  gin.SetMode(gin.ReleaseMode)
api                   |
api                   | [GIN-debug] GET    /ping                     --> main.main.func1 (3 handlers)
api                   | [GIN-debug] PUT    /sessions                 --> main.putSession (4 handlers)
api                   | [GIN-debug] PUT    /mappings                 --> main.putMapping (4 handlers)
api                   | [GIN-debug] GET    /apps/:id/journey         --> main.getAppJourney (5 handlers)
api                   | [GIN-debug] GET    /apps/:id/metrics         --> main.getAppMetrics (6 handlers)
api                   | [GIN-debug] GET    /apps/:id/filters         --> main.getAppFilters (7 handlers)
api                   | [GIN-debug] GET    /teams                    --> main.getTeams (8 handlers)
api                   | [GIN-debug] GET    /teams/:id/apps           --> main.getApps (9 handlers)
api                   | [GIN-debug] [WARNING] You trusted all proxies, this is NOT safe. We recommend you to set a value.
api                   | Please check https://pkg.go.dev/github.com/gin-gonic/gin#readme-don-t-trust-all-proxies for details.
api                   | [GIN-debug] Listening and serving HTTP on :8080
symbolicator-retrace  | 2023-11-17 10:26:37.654 [main] INFO  Application - Autoreload is disabled because the development mode is off.
symbolicator-retrace  | 2023-11-17 10:26:37.791 [main] INFO  Application - Application started in 0.151 seconds.
symbolicator-retrace  | 2023-11-17 10:26:37.842 [DefaultDispatcher-worker-1] INFO  Application - Responding at http://0.0.0.0:8181
```

## 7. Run postgres migrations

Navigate to `./self-host/postgres`

Copy the `.env.example` file to `.env` and modify the dbmate variables and run migrations.

```sh
cp .env.example .env
dbmate migrate # run after updating `.env`
```

## 8. Run clickhouse migrations

Navigate to `./self-host/clickhouse`

Copy the `.env.example` file to `.env` and modify the dbmate variables and run migrations.

```sh
cp .env.example .env
dbmate migrate # run after updating `.env`
```

## 9. Start the web app

Navigate to `./measure-web-app` directory.

Copy the `.env.local.example` file to `.env.local` and modify the nextjs app's environment variables.

```sh
cp .env.local.example .env.local
```

Start the web app.

```sh
npm run dev
```

## 10. Open dashboard

Navigate to [http://localhost:3000/auth/login](http://localhost:3000/auth/login) to open Measure dashboard login page.

## Teardown &amp; cleanup

To shutdown the containers, run.

```sh
docker compose down
supabase stop
```

Any events or logs will be persisted the next time you run `docker compose up` again.

To perform a more aggressive shutdown, run the following command.

```sh
docker compose down --rmi local --remove-orphans --volumes
```

## Tail Clickhouse Logs

To see Clickhouse server logs, run.

```sh
# trace logs
docker exec -it measure-clickhouse-1 tail -f /var/log/clickhouse-server/clickhouse-server.log

# error logs
docker exec -it measure-clickhouse-1 tail -f /var/log/clickhouse-server/clickhouse-server.err.log
```
