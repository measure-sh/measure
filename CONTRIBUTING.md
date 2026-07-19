# Measure Contribution Guidelines

## General workflow

- Every feature or bug must have a task in the [project board](https://github.com/orgs/measure-sh/projects/5)
- Each task gets converted to an issue
- Pull requests must be opened against an existing issue (which in turn contains a linked task in the board)
- All pull requests must be reviewed and approved by at least 1 maintainer before merging

## Local environment setup

> [!TIP]
>
> If you just looking to try out measure, follow our [self hosting guide](https://measure.sh/docs/hosting).
>
> **The self hosting guide is the official and recommended way to try out measure.**

### Prerequisites

- Docker >= v26.1.3
- Docker Compose >= 2.27.3
- Node LTS

After cloning the repository, run the following commands for the best contribution experience. All core maintainers **MUST** follow these steps.

> [!NOTE]
>
> You would need [node](https://nodejs.org/) to run the above commands. We recommend you always stick to the `lts` version of node.
> If you need to setup node, we recommend you use [fnm (Fast Node Manager)](https://github.com/Schniz/fnm) to manage node versions. Follow [fnm's installation instructions](https://github.com/Schniz/fnm?tab=readme-ov-file#installation).

In the repo root, run

```sh
npm install
npm run prepare
```

The above commands would install the required dependencies and setup git hooks as intended. This is a one-time setup, unless you do a fresh clone again.

### Setup initial configuration

Change to `self-host` directory.

```sh
cd self-host
```

Next, configure the environment variables.

```sh
./config.sh --development --wizard
```

This will start the configuration wizard and prepare all the environment variable files tuned for local development.

### Start services

Once configuration is complete, run the following docker compose command to start all services. For starting for the first time, provide `--profile migrate` to trigger database migrations.

```sh
docker compose --profile migrate up
```

> [!NOTE]
>
> #### About Compose Profiles
>
> The `migrate` profiles are idempotent in nature. You can use it every time, though for subsequent runs you may choose to skip them.

Alternatively, you could build and up the containers in separate steps, like this.

```sh
docker compose build
docker compose --profile migrate up
```

Additionally, run the following script to finish migration.

```sh
./migrations/v0.9.x-data-backfills.sh
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
## Running Tests

### Backend

Backend Go tests are separated into two categories using build tags.

**Unit tests** — pure logic, no containers or external services needed:

```sh
cd backend/api && go test ./...
```

**Integration tests** — require Docker (spins up Postgres and ClickHouse via testcontainers):

```sh
go test backend/... -tags=integration
```

Run all backend tests together without cache:

```sh
go test backend/... --tags=integration -v -count=1
```

### Frontend Dashboard

```sh
cd frontend/dashboard && npm run test
```

### Android SDK

```sh
cd android/measure-android/
./gradlew :measure:testDebugUnitTest
```

### Flutter SDK

```sh
cd flutter/
melos test:all
```

### iOS SDK

```sh
cd ios/
xcodebuild test \
    -project ios/MeasureSDK.xcodeproj \
    -scheme MeasureSDKTests \
    -sdk iphonesimulator \
    -destination 'platform=iOS Simulator,name=iPhone 16 Pro,OS=18.4' \
    ONLY_ACTIVE_ARCH=YES
```

## Code formatting

The dashboard uses [Prettier](https://prettier.io/) to keep TypeScript and JavaScript formatting consistent regardless of which editor you use. The configuration lives in [`frontend/dashboard/.prettierrc.json`](frontend/dashboard/.prettierrc.json).

Run it manually from the `frontend/dashboard` directory:

```sh
npm run format        # format all JS/TS files in place
npm run format:check  # check formatting without writing changes
```

Linting is handled separately by ESLint:

```sh
npm run lint
```

### Editor setup

Formatting on save keeps every commit consistently formatted and means you rarely need to run the commands above by hand.

- **Zed** — works out of the box. The repo ships [`frontend/dashboard/.zed/settings.json`](frontend/dashboard/.zed/settings.json), and Prettier is bundled with Zed, so no extension is needed. Reopen the project after pulling so the settings load.
- **VS Code** — install the [Prettier extension](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode), then add to your user or workspace settings:

  ```json
  {
    "editor.formatOnSave": true,
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
  ```

- **Other editors** — any editor with a Prettier integration will pick up `.prettierrc.json` automatically.

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
- Make sure all database migrations are **ALWAYS** in sequence.

### Connecting to Postgres

To connect to locally running Postgres instance, use the following command from the `self-host` directory:

```sh
# when postgres service is running
docker compose exec postgres psql -U postgres -d measure

# when postgres service is _not_ running
docker compose run --rm postgres psql -U postgres -d measure
```

### Connecting to ClickHouse

To connect to locally running ClickHouse instance, use the following command from the `self-host` directory:

```sh
# when clickhouse service is running
docker compose exec clickhouse clickhouse-client -u app_admin -d measure

# when clickhouse service is _not_ running
docker compose run --rm clickhouse clickhouse-client -u app_admin -d measure
```

### ClickHouse Team Isolation

To ensure a ClickHouse read query does not return rows from other teams which the user are not part of, certain row policies enforce team isolation via per-query custom settings (`SQL_reader_team_ids` / `SQL_agent_team_ids`). These policies are applied at the connection pool level. So, if you are using the correct connection pool (reader or agent_sql), you do not need to set these custom settings yourself.

But you do need to set the team scope in your query context. Use `chquery.WithTeamScope(ctx, teamIDs...)` (reader) or `chquery.WithAgentScope(ctx, teamIDs...)` (agent_sql) to set the team scope. Unless, the feature you are working on requires to query from multiple teams, you should set the team scope to a single team ID.

Few things to keep in mind, when authoring ClickHouse read queries:

- Always set the team scope.** Use `chquery.WithTeamScope(ctx, teamIDs...)` (reader) or `chquery.WithAgentScope(ctx, teamIDs...)` (agent_sql) & pass the context down.
- **Fail-closed.** No scope set means the setting is empty, which matches **zero rows**. A read that silently returns nothing almost always means the scope was not carried on the context. **The reader pool guards this for you.** Pools wrapped by `chquery.NewReaderConn` return an error if a query reaches them without the scope set.
- When creating a new service that reads from ClickHouse, decide & use `chquery.NewReaderConn` to wrap the connection pool.
- Use `chquery.WithSettings` to merge settings, rather than calling `clickhouse.WithSettings` directly.
- **Operator/write pool is not scoped.** Ingestion & non-tenant introspection (`system.*`) use the raw operator pool by design; the policy only applies to the `reader` & `agent_sql` roles.

Basic usage:

```go
// reader query, single team (the common case)
ctx = chquery.WithTeamScope(ctx, app.TeamId)
rows, err := rch.Query(ctx, "select ... from events where app_id = ?", appID)

// reader query, several teams
ctx = chquery.WithTeamScope(ctx, teamA, teamB)

// merge more per-query settings without dropping the scope
ctx = chquery.WithSettings(ctx, clickhouse.Settings{
    "use_query_cache":      true,
    chquery.ReaderScopeKey: clickhouse.CustomSetting{Value: teamId.String()},
})

// agent_sql (LLM-generated SQL) path
ctx = chquery.WithAgentScope(ctx, teamID)
```

Under the hood the ids are comma joined into the `SQL_reader_team_ids` / `SQL_agent_team_ids` custom settings the policy reads.

### Managing Dashboard Environment Variables

Typically, there are 2 kinds of environment variables in the dashboard nextjs application. Public & Private.

1. **Public**. Variables prefixed with `NEXT_PUBLIC_...`

    - Public variables **MUST** only contain non-sensitive data.
    - Public variables are baked into the deployable artifact at build time.
    - Public variables are exposed to browsers which is a vulnerable environment.
    - Example: OAuth client identifiers, analytics service identifers & so on.

    To manage public variables:

    1. Define them in the `dashboard/compose.prod.yml` file under `dashboard.build.args` section.
    2. Define them in the `dashboard/dockerfile.prod` file as `ARG` & pass them as environment variables in the `RUN` directive.
    3. Make sure to keep the variables in sync in both step **1** & **2**.

    Example for `dashboard/compose.prod.yml`

    ```yaml
    dashboard:
      build:
        dockerfile: dockerfile.prod
        args:
          - NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
          - NEXT_PUBLIC_YOUR_VARIABLE=${NEXT_PUBLIC_YOUR_VARIABLE}
    ```

    Example for `dashboard/dockerfile.prod`

    ```dockerfile
    ARG NEXT_PUBLIC_SITE_URL
    ARG NEXT_PUBLIC_YOUR_VARIABLE

    RUN NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
        NEXT_PUBLIC_YOUR_VARIABLE=${NEXT_PUBLIC_YOUR_VARIABLE} \
        npm run build
    ```

2. **Private**. Variables without the `NEXT_PUBLIC_...` prefix

    - Private variables may contain sensitive & non-sensitive data.
    - Private variables are not baked into the deployable artifact.
    - Private variables are not exposed to browsers, they are safely & securely passed to the nextjs server at runtime.
    - Exmaple: OAuth client secrets, LLM provider API keys & other non-sensitive data.

    To manage private variables:

    1. Define them in the `self-host/.env`.
    2. Use them in the `self-host/compose.yml` under `services.dashboard.environment`.


    Example for `self-host/compose.yml`

    ```yaml
    serivces:
      dashboard:
        environment:
          - YOUR_VARIABLE=${YOUR_VARIABLE}
    ```

> [!CAUTION]
>
> **NEVER commit the `self-host/.env` file.**

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

5. Run backfills script

   ```sh
    ./migrations/v0.9.x-data-backfills.sh
    ./migrations/v0.10.x-read-optim.sh
    ```

5. Start development

    ```sh
    docker compose watch
    ```

6. Additionally, copy `postgres_dsn` and `clickhouse_dsn` variables in sessionator config.toml from [`config.toml.example`](self-host/session-data/config.toml.example)

    ```toml
    postgres_dsn = "postgresql://..."
    clickhouse_dsn = "clickhouse://..."
    ```

## Versioning

We use git tags and [semver](https://semver.org/) for versioning.

- Platform releases (Backend + Dashboard) are tagged in the following format: `v1.0.0`
- SDK releases are tagged with platform specific prefixes: `android-v1.0.0`, `android-gradle-plugin-v1.0.0`, `ios-v1.0.0` and so on

## Release process

To trigger a release, create a signed git tag using [git-cliff](https://git-cliff.org/) and push the tag. Here's a one liner.

```sh
# bash/zsh
VERSION=$(git cliff --bumped-version) && git tag -s $VERSION -m $VERSION && git push origin $VERSION

# fish
set VERSION $(git cliff --bumped-version) && git tag -s $VERSION -m $VERSION && git push origin $VERSION
```

## Documentation
- Public facing docs are MDX pages in [frontend/dashboard/content/docs](frontend/dashboard/content/docs), rendered at [measure.sh/docs](https://measure.sh/docs) with fumadocs - self host guide, SDK guides, feature docs and so on. The REST API reference is generated from the OpenAPI specs in [frontend/dashboard/content/openapi](frontend/dashboard/content/openapi); edit the specs, not the generated pages under content/docs/api
- Main folder of subproject should link to main guide. ex: [frontend README](frontend/dashboard/README.md) has link to self hosting and local dev guide
- Non public facing docs can stay in sub folder. ex: [backend benchmarking README](backend/benchmarking/README.md) which describes its purpose
- To add a doc page, create `frontend/dashboard/content/docs/<slug>.mdx` with `title` and `description` frontmatter (plus `seoTitle` when the search-facing title should be longer), then add its entry to the folder's `meta.json` for sidebar ordering. Search, llms.txt and the sitemap all derive from the content files at build time. Content links use absolute `/docs/...` routes and images go in `frontend/dashboard/public/docs/assets`

### Updating the REST API reference

The API reference at [measure.sh/docs/api](https://measure.sh/docs/api) is generated, not hand-written. To change it:

1. Edit the OpenAPI 3.1 specs in [frontend/dashboard/content/openapi](frontend/dashboard/content/openapi): `dashboard.yaml` for the dashboard API, `sdk.yaml` for the SDK ingestion API. Operations, request/response schemas, descriptions and tags all come from here, and the specs should match the Go handlers they describe.
2. There is no manual generation step. `scripts/generate_api_docs.mjs` runs as part of `npm run dev`, `npm run build` and `npm test`, wipes the previous output and regenerates one page per operation under `frontend/dashboard/content/docs/api/`, grouped into a folder per tag. The generated pages are gitignored; do not edit them.
3. Sidebar labels come from the spec: each operation page is titled by its `summary`, and tag folders are titled by the tag name. The only hand-maintained files in the reference are `content/docs/api/index.mdx` (the overview page) and the `meta.json` of each section, which control section titles and ordering.
4. To add a whole new spec (a third API surface), add the yaml to `content/openapi/`, add a section entry in `scripts/generate_api_docs.mjs`, commit a `meta.json` for it and extend the `.gitignore` patterns that keep its generated pages out of the repo.

## Blog

- Blog posts are MDX files in [frontend/dashboard/content/blog](frontend/dashboard/content/blog), rendered at [measure.sh/blog](https://measure.sh/blog) with fumadocs. One flat file per post, no subfolders
- To add a post, create `frontend/dashboard/content/blog/<kebab-case-slug>.mdx`; the file name is the URL slug. Frontmatter takes `title`, `description`, `date` (a quoted `"YYYY-MM-DD"` string), `author` with `name` and `avatar` (an image path, e.g. `/images/profile_pics/profile_name.webp`), an optional `image` (the social share card, usually the hero image under `/blog/assets/...`; link previews fall back to the generic site image without it), and an optional `tags` list
- Tags must be lowercase kebab-case; the build rejects anything else because tags appear verbatim in `/blog/tags/<tag>` URLs. Every tag any post carries gets a listing page automatically
- The frontmatter title renders as the page H1, so body sections start at `##`. Sections at `#` produce a second H1 per section and break the inline table of contents indentation
- Images are in [frontend/dashboard/public/blog/assets](frontend/dashboard/public/blog/assets) and are referenced with absolute `/blog/assets/...` paths; content links also use absolute routes (`/blog/...`, `/docs/...`)
- The index at `/blog` (newest first), the tag pages, the RSS feed at `/blog/rss.xml`, the per-post markdown at `/blog/<slug>.md`, llms.txt and the sitemap all derive from the content files at build time.
