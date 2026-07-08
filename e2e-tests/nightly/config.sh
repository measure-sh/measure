# Settings for the nightly run. Override in a git-ignored config.local.sh next
# to this file. The nightly always runs all specs on both devices; device names
# live in e2e-tests/.env (the runner config).

# Slack incoming webhook for the end-of-run summary; empty disables it.
: "${NOTIFY_WEBHOOK:=}"

# delete nightly logs older than this many days
: "${KEEP_LOGS_DAYS:=14}"

# daily schedule, read by install.sh
: "${SCHEDULE_HOUR:=3}"
: "${SCHEDULE_MINUTE:=0}"
