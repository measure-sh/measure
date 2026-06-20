# E2E Tests

End-to-end tests for Measure. A Node runner creates a fresh user and
team in the local self-host stack, drives the Frank sample app with
[Maestro](https://maestro.mobile.dev) to produce real events, then checks
the dashboard with [Playwright](https://playwright.dev).

The Frank Android and iOS apps each host the native, Flutter, KMP, and
React Native demo screens, so all four are exercised with no extra setup.

Tests are organized by spec (e.g. `errors`, `bug_report`,
`session_timeline`). Each spec pairs a Maestro orchestrator
(`maestro/specs/<spec>/<device>/main.yaml`) with a Playwright dashboard test
(`playwright/specs/<spec>/`); the runner derives both paths from the
spec name. Run one spec or all of them, on Android, iOS, or both.

## Setup

One-time. Install on the host:

- Node.js + npm
- Docker (for the self-host stack)
- `adb` (Android path)
- Xcode + `xcodebuild` (iOS path)
- [Maestro](https://docs.maestro.dev/get-started/quickstart)

Install Node deps and the Playwright browser:

```
cd e2e-tests
npm install
npx playwright install chromium
```

`self-host/.env` must contain these values (the runner hardcodes them in
`runner/main.ts`):

```
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
SESSION_ACCESS_SECRET=super-secret-for-jwt-token-with-at-least-32-characters
SESSION_REFRESH_SECRET=super-secret-for-jwt-token-with-at-least-32-characters
```

Frank App's `MeasureConfig` must have `enableFullCollectionMode = true`.

## Run

Bring up the stack in a separate terminal:

```
cd self-host
docker compose up
```

Boot a device for whichever platform you want to run:

- Android: start an emulator (or plug in a device); verify with `adb devices`.
- iOS: open Simulator.app and boot one; verify with `xcrun simctl list devices booted`.

On a fresh Android emulator, disable Gboard's stylus-handwriting first-use
sheet. It pops up the first time an `EditText` is focused and swallows
the bug-report `inputText` step. Run once per emulator:

```
adb shell settings put secure stylus_handwriting_enabled 0
adb shell settings put secure stylus_handwriting_default_value 0
```

The iOS bug-report flow is not supported on iOS 26. Its photo picker runs
out-of-process there, so its elements are absent from Maestro's accessibility
tree and the gallery-attachment step cannot be driven by selectors. Run the
iOS path on an earlier iOS version until the upstream fix lands:
https://github.com/mobile-dev-inc/maestro/pull/3183

Then from `e2e-tests/`:

```
npm start                          # all features, android + iOS (builds Frank)
npm start -- errors                # one feature (builds Frank)
npm start -- errors --no-build     # one feature, reuse installed app + cached team
npm start -- errors --android      # one feature, android only
npm start -- --list                # list available features
npm start -- --android             # all features, android only
npm start -- --ios                 # all features, iOS only
npm start -- --no-build            # all features, reuse installed app + cached team
npm start -- --seed-gallery        # seed a gallery image (needed by bug_report)
npm start -- --verbose             # or -v; stream output from app builds and maestro
npm start -- --show-browser        # show Chrome during dashboard steps
npm start -- --help                # or -h
```

By default each run rebuilds Frank and provisions a fresh team. Pass `--no-build`
to reuse the already-installed Frank and the team/app cached from the last build,
so iterating on one feature is fast (it requires a prior run that built Frank).
