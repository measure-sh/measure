#!/usr/bin/env sh

# low volume
wrk -c 10 -d 30s -t 2 -s events-bench.lua http://localhost:8080/events

# high volume
#wrk -c 100 -d 60s -t 4 -s events-bench.lua http://localhost:8080/events
