# Migration Guide for `v0.6.x`

Use this guide only when you are on less than `v0.6.0` and upgrading to `v0.6.x`.

> [!WARNING]
>
> Steps mentioned in this document will cause downtime.

Follow these steps when upgrading to `0.6.x`. There is some downtime involved. During the downtime SDKs would receive a `503 Service Unavailable` when sending sessions. Once the upgrade is complete, ingestion should resume normally. SDKs will retry sending unsent sessions automatically.

## 1. SSH into the VM where Measure is hosted

## 2. Perform the upgrade

Visit [Releases](https://github.com/measure-sh/measure/releases) page to capture the latest tag matching the `[MAJOR].[MINOR].[PATCH]` format.

```sh
cd ~/measure
git reset --hard # only applies if you have local modifications
git fetch --tags
git checkout <git-tag>
cd self-host
sudo ./install.sh
```

## 3. Run data backfills

Perform this step to complete the migration. Certain features on the Measure dashboard like user defined attributes won't work otherwise.

This may take some time. Make sure your SSH connection remains active until it completes.

```sh
sudo ./migrations/v0.6.x-data-backfills.sh
```
