#!/usr/bin/env sh

set -euo pipefail

# read count of applied migrations
count=$(dbmate status | tail -2 | head -1 | cut -d ' ' -f 2)


# rollback `count` times
for ((i=1; i<=count; i++))
do
  dbmate rollback
done

# run all pending migrations
dbmate migrate
