# Migration Guide for `v0.9.x`

Use this guide only when you are on less than `v0.9.0` and upgrading to `v0.9.x`.

> [!WARNING]
>
> Steps mentioned in this document will cause downtime.

Follow these steps when upgrading to `0.9.x`. There is some downtime involved. During the downtime SDKs would receive a `503 Service Unavailable` when sending sessions. Once the upgrade is complete, ingestion should resume normally. SDKs will retry sending unsent sessions automatically.

## 1. SSH into the VM where Measure is hosted

## 2. Shutdown all Measure services

```sh
cd ~/measure/self-host
```

```sh
sudo docker compose -f compose.yml -f compose.prod.yml --profile init --profile migrate down --remove-orphans
```

## 3. Perform the upgrade

Visit [Releases](https://github.com/measure-sh/measure/releases) page to capture the latest tag matching the `[MAJOR].[MINOR].[PATCH]` format.

```sh
cd ~/measure
```

```sh
git reset --hard # only applies if you have local modifications
```

```sh
git fetch --tags
```

```sh
git checkout <git-tag>
```

## 4. Migrate configurations

```sh
cd self-host
```

```sh
sudo ./config.sh --production --ensure
```

## 5. Run database synchronization & migration scripts

Perform this step to complete the migration. Measure dashboard may not work properly until this step is completed.

```sh
sudo ./migrations/v0.9.x-sync-databases.sh
sudo ./migrations/v0.9.x-data-backfills.sh
```

## 6. Start Measure services

```sh
sudo ./install.sh
```
