---
title: "Set Up Slack for Self-Hosted Measure"
description: "Set up Slack integration for your self-hosted Measure instance. Configure the Slack app with OAuth, slash commands and events for crash alerts and the query agent."
---

# Set up Slack integration <!-- omit in toc -->

Use this guide to setup Slack integration to receive Measure alert notifications on Slack and to ask the Measure query agent questions from Slack.

## Contents <!-- omit in toc -->
- [Configure Slack settings for new installation](#configure-slack-settings-for-new-installation)
- [Configure Slack settings for existing installation](#configure-slack-settings-for-existing-installation)

## Configure Slack settings for new installation

1. **Slack App**. Create a Slack app following the official [Slack guide](https://docs.slack.dev/quickstart/). You may choose any name, logo and description you wish for your app.

2. **Basic Information**. Go to `Basic Information` section and copy client id, client secret and signing secret and paste them into the prompts. (If you're upgrading an existing Measure installation you will paste these variables into your environment variables file. See section for existing users below)

3. **OAuth & Permissions**. Go to the `OAuth & Permissions` section of your app and under `Redirect URLs`, add your Measure Slack authentication callback URL. This should be something like `https://[measure.yourcompany.com]/auth/callback/slack`. Replace **`[measure.yourcompany.com]`** with your actual Measure Dashboard domain.

4. In the same `OAuth & Permissions` section of your app, under `Scopes`, request the following permissions:

    - **app_mentions:read**
    - **assistant:write**
    - **chat:write**
    - **chat:write.public**
    - **channels:read**
    - **channels:history**
    - **groups:read**
    - **groups:history**
    - **im:history**
    - **im:write**
    - **commands**
    - **files:write**
    - **links:read**
    - **links:write**
    - **reactions:read**
    - **reactions:write**
    - **users:read**
    - **users:read.email**

> [!NOTE]
>
> The steps below need the **Measure API domain** and not the Measure Dashboard domain.
>
> If this URL is incorrect, you'll get a `dispatch_failure` error when connecting your Measure Team to your Slack Workspace.
>
> Assuming your API domain is something like `measure-api.yourcompany.com`, you should put in something like `https://[measure-api.yourcompany.com]/slack/events` in the below steps.
>
> Replace **`[measure-api.yourcompany.com]`** with your actual Measure API domain.

5. **Event Subscriptions**. Go to the `Event Subscriptions` section, enable events and set the Request URL to `https://[measure-api.yourcompany.com]/slack/events`. Slack verifies the URL immediately, so your Measure API service must be reachable when you save it. Then, under `Subscribe to bot events`, add:

    - **app_mention** — questions asked by @mentioning the bot in channels
    - **app_home_opened** — lets the bot greet the user with suggested prompts when they open its DM
    - **message.channels** — follow-up messages in a public channel thread, so a conversation can continue without re-mentioning the bot
    - **message.groups** — the same for private channels
    - **message.im** — questions asked in the bot's DMs

6. **Agent**. Go to the `Agent` section of your app settings and enable it (new Slack apps use Slack's Agent messaging experience by default). This gives the Measure app a direct-message surface where users chat with the agent, in addition to @mentioning it in channels.

7. **Slash Commands**. Go to `Slash Commands` section. Create the commands as follows:

| Command              | Request URL                                                                                                                                   | Short Description                                                  |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| /subscribe-alerts    | https://[measure-api.yourcompany.com]/slack/events<br /><br />Replace **[measure-api.yourcompany.com]** with your actual Measure API domain.  | Registers current channel to receive alert notifications           |
| /stop-alerts         | https://[measure-api.yourcompany.com]/slack/events <br /><br />Replace **[measure-api.yourcompany.com]** with your actual Measure API domain. | Stops current channel from receiving alert notifications           |
| /list-alert-channels | https://[measure-api.yourcompany.com]/slack/events<br /><br />Replace **[measure-api.yourcompany.com]** with your actual Measure API domain.  | Lists channels currently registered to receive alert notifications |

## Configure Slack settings for existing installation

If you already set up Slack integration on an earlier version of Measure, your Slack app predates the query agent and is missing the scopes, event subscriptions and settings the agent needs. Update your existing Slack app, and if you are upgrading from v0.8.2 or below, your environment variables, as described below.

> [!NOTE]
>
> Slack cannot send event and OAuth callbacks to your local dev environments. In order to run and test Slack integration while developing or testing locally, you will need to use a tunneling service such as [ngrok](https://ngrok.com) or [Cloudflare tunnels](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/) and use that URL to proxy to your localhost.
>
> See this [guide](https://docs.slack.dev/tools/node-slack-sdk/tutorials/local-development/#using-a-local-request-url-for-development) for more information.

### Update your Slack app

1. **New scopes**. Open your existing Slack app at [api.slack.com/apps](https://api.slack.com/apps), go to the `OAuth & Permissions` section and, under `Scopes`, add the following permissions while keeping the ones you already have:

    - **app_mentions:read**
    - **assistant:write**
    - **chat:write.public**
    - **channels:history**
    - **groups:history**
    - **im:history**
    - **im:write**
    - **files:write**
    - **links:read**
    - **links:write**
    - **reactions:read**
    - **reactions:write**
    - **users:read**
    - **users:read.email**

    Your app should now have the full set of scopes listed in step 4 of the [new installation guide](#configure-slack-settings-for-new-installation) above.

2. **Event Subscriptions**. This section did not exist for alerts-only installs, so you are adding it for the first time. Follow step 5 of the [new installation guide](#configure-slack-settings-for-new-installation) to enable events, set the Request URL and subscribe to the bot events.

3. **Agent**. Follow step 6 of the [new installation guide](#configure-slack-settings-for-new-installation) to enable the agent.

4. **Reinstall the app**. New scopes only take effect after the app is reinstalled. Once you add them, Slack shows a banner prompting you to reinstall. Open the `Install App` section and reinstall the app to your workspace. Your existing bot token keeps working and gains the new scopes, so you do not need to reconnect Slack from the Measure dashboard.

### Update environment variables

If you are upgrading from v0.8.2 or below, you also need to add the Slack credentials to your environment variables manually instead of entering them at a terminal prompt.

1. **Slack Client Credentials**. Open the `self-host/.env` file & add the following environment variables as obtained from your Slack app page.

    ```sh
    SLACK_CLIENT_ID=your-slack-client-id                # change this
    SLACK_CLIENT_SECRET=your-slack-client-secret        # change this
    SLACK_SIGNING_SECRET=your-slack-signing-secret      # change this
    ```

2. **State Salt**. Generate a random 44 character salt. Use the command `openssl rand -hex 22` to generate a random salt.

    ```sh
    SLACK_OAUTH_STATE_SALT=your-slack-oauth-state-salt  # change this
    ```

3. **Shutdown**. Run the following command to shutdown all services.

    ```sh
    sudo docker compose -f compose.yml -f compose.prod.yml --profile migrate down
    ```

4. **Startup**. Finally, run the `install.sh` script for the configuration to take effect.

    ```sh
    sudo ./install.sh
    ```

[Go back to self host guide](./README.md)
