# Migration Guide for `v0.4.x`

Use this guide only when you are on less than `v0.4.0` and upgrading to `v0.4.x`.

> [!WARNING]
>
> Steps mentioned in this document will cause downtime.

## Upgrade while optionally dropping old data

Follow these steps to drop all older sessions **before upgrading**.

Follow these steps when upgrading to `0.4.x`. There is some downtime involved. During the downtime SDKs would receive a `503 Service Unavailable` when sending sessions. Once the upgrade is complete, ingestion should resume normally. SDKs will retry sending unsent sessions automatically.

### 1. SSH into the VM where Measure is hosted

### 2. Bring down services

> [!CAUTION]
> Skip to step 4 if you **do not want to delete old data**

```sh
cd measure/self-host
sudo docker compose down api cleanup
```

### 3. Run the following commands to drop all older sessions data

> [!CAUTION]
> Skip to step 4 if you **do not want to delete old data**

```sh
sudo docker compose exec clickhouse clickhouse-client --progress -q "truncate table events;"

sudo docker compose exec postgres psql -U postgres -c "truncate table unhandled_exception_groups, anr_groups, event_reqs;"
```

### 4. Perform the upgrade

Visit [Releases](https://github.com/measure-sh/measure/releases) page to capture the latest tag matching the `[MAJOR].[MINOR].[PATCH]` format.

```sh
cd ~/measure
git fetch
git checkout <git-tag>
cd self-host
sudo docker compose -f compose.yml -f compose.prod.yml \
  --profile init \
  --profile migrate \
  down
sudo docker compose pull
sudo ./install.sh
```

### 5. Run data backfills

Perform this step regardless of whether you chose to drop data or not. Certain features on the Measure dashboard like filters, metrics and some graphical plots won't show otherwise.

This may take some time. Make sure your SSH connection remains active until it completes.

```sh
sudo ./migrations/v0.4.x-data-backfills.sh
```