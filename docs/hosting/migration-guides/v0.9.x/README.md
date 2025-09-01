# Migration Guide for `v0.9.x`

Use this guide only when you are on less than `v0.9.0` and upgrading to `v0.9.x`.

> [!WARNING]
>
> Steps mentioned in this document will cause downtime.

Follow these steps when upgrading to `0.9.x`. There is some downtime involved. During the downtime SDKs would receive a `503 Service Unavailable` when sending sessions. Once the upgrade is complete, ingestion should resume normally. SDKs will retry sending unsent sessions automatically.

## 1. SSH into the VM where Measure is hosted

## 2. Perform the upgrade

Visit [Releases](https://github.com/measure-sh/measure/releases) page to capture the latest tag matching the `[MAJOR].[MINOR].[PATCH]` format.

```sh
cd ~/measure/self-host
sudo docker compose -f compose.yml -f compose.prod.yml --profile init --profile migrate down --remove-orphans
cd ..
git reset --hard # only applies if you have local modifications
git fetch --tags
git checkout <git-tag>
cd self-host
sudo ./config.sh --production --ensure
sudo ./migrations/v0.9.x-sync-databases.sh
sudo ./install.sh
```

## 3. Run database synchronization script

Perform this step to complete the migration. Measure dashboard may not work properly until this step is completed.

```sh
sudo ./migrations/v0.9.x-sync-databases.sh
```
