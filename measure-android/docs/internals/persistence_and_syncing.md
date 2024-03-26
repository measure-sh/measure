# Persistence and Syncing

This document explains how the Measure SDK persists events, metrics and logs and syncs them to the server.

## Persistence

Coming soon...

### In-memory buffers

Coming soon...

### Disk storage

Coming soon...

## Syncing

Measure SDK uses HTTP to send data collected to the server.

### Conditions to sync

* Sends _all_ events and attachments each time the app goes to background.
* Sends _all_ events and attachments when the app cold launch completes (with a delay of __x__ seconds).
* Sends exception and ANR events as soon as they happen. It also sends data in it's in-memory buffers but does not
  attempt to read _all_ events or attachments from the disk.
* Sends events and attachments when app is in foreground if there are at least __y__ events or __z__ attachments.
* Only one active request is allowed at a time. If a request is in progress, the next request is queued.

### Retries

* If a request fails, it is retried once with a delay of 1 second after the first failure. If the retry fails, the
  request is not retried again until one of the above conditions are met again.

_Note_: the SDK respects the maximum events and attachments limits per request when trying to sync _all_ data. 

