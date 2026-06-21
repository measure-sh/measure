# Settings for the nightly run. Override any value with an environment variable
# of the same name, or a git-ignored config.local.sh next to this file.

# android | ios | both
: "${DEVICES:=both}"

# spec names to run (space-separated), empty for all; list with `npm start -- --specs`
: "${SPECS:=}"

# bug_report needs a gallery image on the device
: "${SEED_GALLERY:=true}"

# how to start the docker daemon if down: auto | desktop | colima | none
: "${DOCKER_MODE:=auto}"

# device to boot when none is running; empty requires a pre-booted one.
# list with `emulator -list-avds` / `xcrun simctl list devices`
: "${ANDROID_AVD:=}"
: "${IOS_SIMULATOR:=}"

: "${ANDROID_EMULATOR_FLAGS:=-no-window -no-snapshot -no-boot-anim -gpu swiftshader_indirect}"

: "${KEEP_LOGS_DAYS:=14}"

# optional incoming webhook for a one-line pass/fail summary
: "${NOTIFY_WEBHOOK:=}"

# read by install.sh
: "${SCHEDULE_HOUR:=3}"
: "${SCHEDULE_MINUTE:=0}"
