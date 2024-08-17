#!/usr/bin/env sh

set -euo pipefail

# read count of applied migrations
count=$(dbmate status | tail -2 | head -1 | cut -d ' ' -f 2)

# rollback `count` times
for i in $(seq 1 "$count")
do
  dbmate rollback
done

# run all pending migrations
dbmate migrate
