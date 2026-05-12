# Tests

End-to-end tests for Measure. Each test is a [maestro](https://maestro.mobile.dev)
flow that drives a sample app.

## Prerequisites

- Latest Frankenstein app installed
- Staging dashboard open on the app configured in the Frankenstein app
- Physical Android device (API 26+), Wi-Fi + cellular reachable

## Run

```
maestro test tests/android/crash.yaml        # one flow
maestro test tests/android/all.yaml          # every android flow
```

Flows:

- `android/session` — exercises all event types (no crash)
- `android/crash` — session + native uncaught exception
- `android/anr` — session + main-thread hang
- `android/bug_report` — session + bug report submission
- `android/http` — session + N HTTP requests (HTTP_COUNT env, default 10)
- `android/all` — runs crash, anr, bug_report, and http in sequence

`crash`, `anr`, `bug_report`, and `http` each `runFlow: session.yaml`
first, then trigger their specific event.

## Add a new test

One yaml file under `tests/android/`. If it builds on top of the
common session flow, start with `runFlow: session.yaml`.

Flows are deliberately independent of dashboard config — running them
doesn't require toggling masks or other settings beforehand.
