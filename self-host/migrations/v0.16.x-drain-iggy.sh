#!/usr/bin/env bash

# exit on error
set -e

######################
# Migration Settings #
######################
# Seconds to wait for the queues to drain
DRAIN_TIMEOUT="${DRAIN_TIMEOUT:-600}"
# Seconds between checks
DRAIN_INTERVAL="${DRAIN_INTERVAL:-5}"

if [[ ! "$DRAIN_TIMEOUT" =~ ^[0-9]+$ ]]; then
  echo "  ✗ DRAIN_TIMEOUT must be a non-negative integer, got: $DRAIN_TIMEOUT"
  exit 1
fi

if [[ ! "$DRAIN_INTERVAL" =~ ^[1-9][0-9]*$ ]]; then
  echo "  ✗ DRAIN_INTERVAL must be a positive integer, got: $DRAIN_INTERVAL"
  exit 1
fi

# Runs inside the iggy container. Prints the lag of each
# consumer group partition then DRAINED or NOT DRAINED.
# Exits non-zero when not drained.
read -r -d '' DRAIN_CHECK <<'DRAIN' || true
http() { exec 3<>/dev/tcp/127.0.0.1/80
  printf '%s %s HTTP/1.1\r\nHost: x\r\nConnection: close\r\nContent-Type: application/json\r\n%sContent-Length: %d\r\n\r\n%s' "$1" "$2" "$AUTH" "${#3}" "$3" >&3
  awk 'END{print}' <&3; exec 3>&-; }
AUTH=
TOK=$(http POST /users/login "{\"username\":\"$IGGY_ROOT_USERNAME\",\"password\":\"$IGGY_ROOT_PASSWORD\"}" | sed 's/.*"token":"\([^"]*\)".*/\1/')
AUTH=$'Authorization: Bearer '$TOK$'\r\n'
for pair in ingest-batch:ingest-batch-consumer agent-slack:agent-slack-consumer; do
  t=${pair%%:*}; g=${pair##*:}
  http GET /streams/measure/topics/$t | sed 's/.*"partitions":\[//; s/},{/}\n{/g' |
  sed -n 's/.*"id":\([0-9]*\).*"current_offset":\([0-9]*\).*"messages_count":\([0-9]*\).*/\1 \2 \3/p' |
  while read -r p cur n; do
    st=$(iggy -u "$IGGY_ROOT_USERNAME" -p "$IGGY_ROOT_PASSWORD" consumer-offset get "$g" measure "$t" "$p" -k consumer-group 2>&1 | sed -n 's/.*Stored offset *| *\([0-9]*\).*/\1/p')
    if [ "$n" = 0 ]; then lag=0; elif [ -z "$st" ]; then lag=$((cur+1)); else lag=$((cur-st)); fi
    echo "$t/$g partition=$p current=$cur stored=${st:-none} messages=$n lag=$lag"
  done
done | tee /dev/stderr | awk '{split($NF,a,"="); s+=a[2]} END{print (s==0 ? "DRAINED" : "NOT DRAINED (total lag " s ")"); exit s!=0}'
DRAIN

# Prints the image of the running iggy container
iggy_image() {
  $DOCKER_COMPOSE ps --format '{{.Image}}' iggy 2>/dev/null | head -n 1
}

# Runs one drain check, prints the lag to stderr
check_drained() {
  $DOCKER_COMPOSE exec -T iggy bash -s <<<"$DRAIN_CHECK" 2>&1
}

# Polls until drained or DRAIN_TIMEOUT
wait_drained() {
  local start=$SECONDS
  local out

  while true; do
    if out=$(check_drained); then
      echo "$out"
      return 0
    fi
    echo "$out"
    if ((SECONDS - start >= DRAIN_TIMEOUT)); then
      return 1
    fi
    sleep "$DRAIN_INTERVAL"
  done
}

# set up environment
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../shared.sh"

check_base_dir
set_docker_compose

# kick things off
image=$(iggy_image)
if [[ "$image" != *iggy:0.7.* ]]; then
  echo "  ✔ Iggy 0.7.x is not running, nothing to drain"
  exit 0
fi

echo "Stop ingest & api..."
$DOCKER_COMPOSE stop ingest api
echo "  ✔ Stopped"
echo

echo "Wait for queues to drain..."
if ! wait_drained; then
  echo "  ✗ Queues did not drain in ${DRAIN_TIMEOUT}s"
  echo "  Make sure ingest-worker & agent are running & healthy, then run again."
  echo "  Use DRAIN_TIMEOUT=<seconds> to wait longer."
  exit 1
fi

echo
echo "  ✔ Drained. Continue with the migration guide."
