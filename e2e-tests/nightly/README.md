# Nightly e2e runs

Runs the e2e suite unattended on a schedule via macOS `launchd`. Each run first
resets the checkout to `origin/main`, then recreates the stack (`docker compose
down` then `up`), runs each platform as its own full pass (Android first, then
iOS), and tears everything down. A failure on one platform still lets the other
run. The runner itself ([../README.md](../README.md)) assumes the self-host
stack is up and a device is booted, which this wrapper arranges.

Because each run does `git checkout -f -B main origin/main` on this checkout,
local changes here are discarded and the branch is moved to `main`. Use a
checkout dedicated to the nightly, not your working tree. To run the script
without updating (local development on a branch), set `NIGHTLY_NO_PULL=1`.

Everything here is path-independent: scripts derive the repo location from where
they live, and the only machine-specific file (the launchd plist) is generated
at install time. To move the job to another Mac, clone the repo there and run
`install.sh`.

## Prerequisites

The same tools the suite needs (see ../README.md): Node, Docker, `adb`, Xcode,
and Maestro. Plus a one-time setup of the dependencies the wrapper does not
manage for you:

- The self-host stack must be configured once so `docker compose up` works
  (secrets generated). See `../../self-host`.
- Frank's `MeasureConfig` must have `enableFullCollectionMode = true`.
- The Mac must be **awake and logged in** at run time. A LaunchAgent runs in
  your GUI session, which the iOS Simulator requires. The Android emulator runs
  headless (`-no-window`), so it does not need the screen unlocked.

## Configure

Edit [config.sh](config.sh), or override any value with an environment variable,
or drop a git-ignored `config.local.sh` next to it for per-machine values. At
minimum set how devices are obtained:

- `ANDROID_AVD`: emulator to boot when none is running (`emulator -list-avds`).
- `IOS_SIMULATOR`: simulator name or UDID to boot (`xcrun simctl list devices`).

If a device of that platform is already booted, the wrapper uses it and these
are ignored. Other useful knobs: `DEVICES` (android|ios|both), `SPECS`,
`DOCKER_MODE`, `NOTIFY_WEBHOOK`, `SCHEDULE_HOUR`/`SCHEDULE_MINUTE`.

## Install

```
./install.sh        # generates the agent, fills in paths + schedule, loads it
./uninstall.sh      # unloads and removes it
```

Run it immediately to verify, without waiting for the schedule:

```
launchctl kickstart -p gui/$UID/sh.measure.e2e-nightly
```

You can also run the driver directly in your terminal, bypassing launchd:

```
./run-nightly.sh
```

## Logs

- `logs/nightly-<timestamp>.log`: full output of each run (auto-pruned after
  `KEEP_LOGS_DAYS`).
- `logs/launchd.out.log`, `logs/launchd.err.log`: launchd's own capture, useful
  when the job fails to start at all.

## Waking the Mac

`launchd` will not power on a sleeping or shut-down machine. If the Mac is
asleep (not shut down) **and on AC power**, schedule a wake a couple of minutes
before the run:

```
sudo pmset repeat wake MTWRFSU 02:55:00
```

A laptop that is shut down, or asleep on battery with the lid closed, will not
wake. In that case `launchd` runs the missed job the next time the Mac is awake.
For true unattended overnight runs, use a machine that stays on.

## Troubleshooting

- **Job does nothing at the scheduled time**: check `logs/launchd.err.log`. Most
  often the Mac was asleep/off, or not logged in.
- **`command not found` in the log**: a tool is outside the PATH the script
  sets. Adjust the PATH line in `run-nightly.sh` or your tool install location.
- **iOS steps fail but Android passes**: the GUI session was locked. iOS needs
  the user logged in; Android does not.
