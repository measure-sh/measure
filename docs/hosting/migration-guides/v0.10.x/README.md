# Migration Guide for `v0.10.x`

Use this guide only when you are on less than `v0.10.0` and upgrading to `v0.10.x`.

> [!WARNING]
>
> Steps mentioned in this document will cause downtime.

Follow these steps when upgrading to `0.10.x`. There is some downtime involved. During the downtime SDKs would receive a `503 Service Unavailable` when sending sessions. Once the upgrade is complete, ingestion should resume normally. SDKs will retry sending unsent sessions automatically.

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

## 4. Create Google OAuth client secret

> [!NOTE]
>
> Skip this step if you only use **GitHub** sign in.

Starting with `v0.10.x`, Google sign-in uses a server-side code flow that requires the `OAUTH_GOOGLE_SECRET` environment variable. Previously, only the client ID (`OAUTH_GOOGLE_KEY`) was needed.

1. Go to [Google Cloud Console](https://console.cloud.google.com) > APIs & Services > Credentials
2. Click on your existing OAuth 2.0 Client ID, create a new **Client Secret** and copy it. (If you want to disable the existing client secret for security reasons and are sure it is not being used anywhere else outside of Measure, you can do so.)
3. Open `self-host/.env` and add:

    ```sh
    OAUTH_GOOGLE_SECRET=your-google-client-secret  # change this
    ```

## 5. Migrate configurations

```sh
cd self-host
```

```sh
sudo ./config.sh --production --ensure
```

## 6. Start Measure services

```sh
sudo ./install.sh
```

## 7. Run data back filling script

Perform this step to complete the migration. Measure dashboard will not work properly until these scripts are run.

```sh
sudo ./migrations/v0.10.x-data-backfills-1.sh
sudo ./migrations/v0.10.x-data-backfills-2.sh
sudo ./migrations/v0.10.x-read-optim.sh
```
