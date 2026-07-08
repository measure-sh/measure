# E2E Tests

End-to-end tests for Measure. A Node runner creates a fresh user and
team in the local self-host stack, drives the Frankenstein sample app with
[Maestro](https://maestro.mobile.dev) to produce real events, then checks
the dashboard with [Playwright](https://playwright.dev).

The Frankenstein Android and iOS apps each host the native, Flutter, KMP, and
React Native demo screens, so all four are exercised with no extra setup.

Tests are organized by spec (e.g. `errors`, `bug_report`,
`session_timeline`). Each spec pairs a Maestro orchestrator
(`maestro/specs/<spec>/<device>/main.yaml`), where <device> either 
`android` or `ios`, with a Playwright dashboard test (`playwright/specs/<spec>/`); 
the runner derives both paths from the spec name. 

## Setup

One-time host setup: install tools, install Node deps, then write the config.

### Prerequisites

Install on the host:

- Node.js + npm
- Docker (for the self-host stack)
- `adb` (Android path)
- Xcode + `xcodebuild` (iOS path)
- [Maestro](https://docs.maestro.dev/get-started/quickstart)

### Install

Node deps and the Playwright browser:

```
cd e2e-tests
npm install
npx playwright install chromium
```

### Configure

`self-host/.env` must contain these values (the runner hardcodes them in
`runner/main.ts`):

```
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
SESSION_ACCESS_SECRET=super-secret-for-jwt-token-with-at-least-32-characters
SESSION_REFRESH_SECRET=super-secret-for-jwt-token-with-at-least-32-characters
```

`e2e-tests/.env` (git-ignored; copy `.env.example`) sets which device the runner
boots when none is attached:

```
ANDROID_AVD="pixel-3a-API-36"     # emulator -list-avds
IOS_SIMULATOR="iPhone 16 Pro"     # xcrun simctl list devices
```

Frank App's `MeasureConfig` must have `enableFullCollectionMode = true`.

> [!NOTE]
> The iOS bug-report flow is not supported on iOS 26. Its photo picker runs
> out-of-process there, so its elements are absent from Maestro's accessibility
> tree and the gallery-attachment step cannot be driven by selectors. Run the
> iOS path on an earlier iOS version until the upstream fix lands:
> https://github.com/mobile-dev-inc/maestro/pull/3183

## Run

From `e2e-tests/`:

```
npm start                          # all specs, android + iOS
npm start -- errors                # one spec
npm start -- errors --android      # one spec, android only
npm start -- --specs               # list available specs
npm start -- --android             # all specs, android only
npm start -- --ios                 # all specs, iOS only
npm start -- --seed-gallery        # seed a gallery image (needed by bug_report)
npm start -- --notify              # post a Slack summary at the end
npm start -- --verbose             # or -v; stream output from app builds and maestro
npm start -- --show-browser        # show Chrome during dashboard steps
npm start -- --help                # or -h
```

Every run is self-contained: it starts Docker and recreates the self-host stack,
then for each platform boots the device, builds and installs Frank, runs the
suite, and stops that device, finally stopping the stack. `docker compose down`
keeps the named volumes, so data is not lost between runs.

## Nightly

`nightly/` runs this suite unattended on a Mac via `launchd`, resetting to
`origin/main` each night. Use a checkout dedicated to the nightly, not your
working tree, since each run does `git checkout -f -B main` and discards local
changes. To set it up:

1. Make sure the suite runs by hand first (the prerequisites above, including
   the device names in `e2e-tests/.env`). The nightly always runs every spec on
   both devices.

2. For a Slack summary at the end of each run, set `NOTIFY_WEBHOOK` to an
   incoming webhook URL in the git-ignored `nightly/config.local.sh`. The message
   carries the per-platform Playwright pass/fail breakdown and the titles of any
   failed web tests. The schedule lives in `nightly/config.sh`
   (`SCHEDULE_HOUR`/`SCHEDULE_MINUTE`).

3. Install the schedule:

   ```
   cd nightly
   ./install.sh                                          # generate + load the launchd agent
   launchctl kickstart -p gui/$UID/sh.measure.e2e-nightly   # run once now to verify
   ./uninstall.sh                                        # remove it
   ```

4. Tail the latest run at `nightly/logs/nightly-<timestamp>.log`; if the job
   never starts, check `nightly/logs/launchd.{out,err}.log`.

The Mac must be awake and logged in at run time. To run by hand without resetting
to `main`, use `NIGHTLY_NO_PULL=1 ./run-nightly.sh`.
