#!/usr/bin/env bash
# Usage: check-migrations.sh <postgres|clickhouse> <migration file>...
#
# Applies every other migration of the engine to a throwaway database, then
# applies, rolls back and reapplies each given migration in version order. A
# rollback has to return the schema dump to what it was before the migration
# applied. Run from the repository root.

set -euo pipefail

engine=$1
shift
dir=self-host/$engine

image_of() {
  awk -v service="  $1:" '$0 == service { found = 1; next } found && /^    image:/ { print $2; exit }' self-host/compose.yml
}

network=check-migrations-$engine-$$
db=$network-db
work=$(mktemp -d)
mkdir "$work/migrations" "$work/dumps"

cleanup() {
  docker rm -f "$db" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT

docker network create "$network" >/dev/null

case $engine in
  postgres)
    url="postgresql://postgres:postgres@$db:5432/measure?search_path=dbmate,measure&sslmode=disable"
    docker run -d --name "$db" --network "$network" \
      -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
      -v "$PWD/$dir/init-postgres.sh:/docker-entrypoint-initdb.d/init-postgres.sh:ro" \
      "$(image_of postgres)" >/dev/null
    ;;
  clickhouse)
    url="clickhouse://admin:admin@$db:9000/measure"
    docker run -d --name "$db" --network "$network" \
      --ulimit nofile=262144:262144 \
      -e CLICKHOUSE_DB=measure \
      -e CLICKHOUSE_USER=default_user -e CLICKHOUSE_PASSWORD=default_user \
      -e CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT=1 \
      -e CLICKHOUSE_ADMIN_USER=admin -e CLICKHOUSE_ADMIN_PASSWORD=admin \
      -e CLICKHOUSE_OPERATOR_USER=operator_user -e CLICKHOUSE_OPERATOR_PASSWORD=operator_user \
      -e CLICKHOUSE_READER_USER=reader_user -e CLICKHOUSE_READER_PASSWORD=reader_user \
      -e CLICKHOUSE_AGENT_SQL_USER=agent_sql_user -e CLICKHOUSE_AGENT_SQL_PASSWORD=agent_sql_user \
      -v "$PWD/$dir/init-clickhouse.sh:/docker-entrypoint-initdb.d/init-clickhouse.sh:ro" \
      -v "$PWD/$dir/config/config.xml:/etc/clickhouse-server/config.d/config.xml:ro" \
      "$(image_of clickhouse)" >/dev/null
    ;;
  *)
    echo "unknown engine: $engine" >&2
    exit 2
    ;;
esac

dbmate() {
  docker run --rm --network "$network" \
    -e DATABASE_URL="$url" \
    -e DBMATE_MIGRATIONS_DIR=/migrations \
    -e DBMATE_SCHEMA_FILE=/dumps/schema.sql \
    -e DBMATE_NO_DUMP_SCHEMA=true \
    -e DBMATE_STRICT=true \
    -e DBMATE_WAIT=true \
    -v "$work/migrations:/migrations:ro" \
    -v "$work/dumps:/dumps" \
    "$(image_of "dbmate-$engine")" "$@" 2>&1
}

dump() {
  local output
  output=$(dbmate dump) || { echo "$output"; exit 1; }
  mv "$work/dumps/schema.sql" "$work/$1"
}

# Postgres can only add a column at the end of a table, so a rollback that adds
# back a dropped column changes the order of the dump's lines. The dumps are
# compared with their lines sorted and without trailing commas, so a change in
# column order alone doesn't count as a difference.
same_schema() {
  diff -q <(sed 's/,$//' "$1" | sort) <(sed 's/,$//' "$2" | sort) >/dev/null
}

fail() {
  echo "::error file=$1::$2"
  echo "$3"
  exit 1
}

mapfile -t added < <(printf '%s\n' "$@" | sort)

for path in "$dir"/*.sql; do
  [[ " ${added[*]} " == *" $path "* ]] || cp "$path" "$work/migrations/"
done

echo "Applying the existing $engine migrations"
output=$(dbmate migrate) || {
  echo "::error::Applying the existing $engine migrations failed: $(grep -m 1 '^Error' <<<"$output")"
  echo "$output"
  exit 1
}

for path in "${added[@]}"; do
  name=$(basename "$path")
  echo "Checking $name"
  dump before.sql
  cp "$path" "$work/migrations/"

  output=$(dbmate migrate) || fail "$path" "Applying $name failed: $(grep -m 1 '^Error' <<<"$output")" "$output"
  output=$(dbmate rollback) || fail "$path" "Rolling back $name failed: $(grep -m 1 '^Error' <<<"$output")" "$output"

  dump after-rollback.sql
  same_schema "$work/before.sql" "$work/after-rollback.sql" \
    || fail "$path" "Rolling back $name leaves the schema different from before it applied." \
      "$(diff -u "$work/before.sql" "$work/after-rollback.sql")"

  output=$(dbmate migrate) || fail "$path" "Applying $name again after rolling it back failed: $(grep -m 1 '^Error' <<<"$output")" "$output"
done

echo "All ${#added[@]} new $engine migrations apply, roll back and apply again."
