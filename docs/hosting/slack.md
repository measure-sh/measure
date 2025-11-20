# Set up Slack integration <!-- omit in toc -->

Use this guide to setup Slack integration to receive Measure alert notifications on Slack.

## Contents <!-- omit in toc -->
- [Configure Slack settings for new installation](#configure-slack-settings-for-new-installation)
- [Configure Slack settings for existing installation](#configure-slack-settings-for-existing-installation)

## Configure Slack settings for new installation

1. **Slack App**. Create a Slack app following the official [Slack guide](https://docs.slack.dev/quickstart/). You may choose any name, logo and description you wish for your app.

2. **Basic Information**. Go to `Basic Information` section and copy client id, client secret and signing secret and paste them into the prompts. (If you're upgrading an existing Measure installation you will paste these variables into your environment variables file. See section for existing users below)

3. **OAuth & Permissions**. Go to the `OAuth & Permissions` section of your app and under `Redirect URLs`, add your Measure Slack authentication callback URL. This should be something like `https://[measure.yourcompany.com]/auth/callback/slack`. Replace **`[measure.yourcompany.com]`** with your actual Measure Dashboard domain.

4. In the same `OAuth & Permissions` section of your app, under `Scopes`, request the following permissions:

    - **channels:read**
    - **chat:write**
    - **groups:read**
    - **commands**

5. **Slash Commands**. Go to `Slash Commands` section. Create the commands as follows:

> [!NOTE]
>
> Please note that you need to use the **Measure API domain** in the below step and not the Measure Dashboard domain.
>
> If this URL is incorrect, you'll get a `dispatch_failure` error when connecting your Measure Team to your Slack Workspace.
>
> Assuming your API domain is something like `measure-api.yourcompany.com`, you should put in something like `https://[measure-api.yourcompany.com]/slack/events` in the below step.
>
> Replace **`[measure-api.yourcompany.com]`** with your actual Measure API domain.

| Command              | Request URL                                                                                                                                   | Short Description                                                  |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| /subscribe-alerts    | https://[measure-api.yourcompany.com]/slack/events<br /><br />Replace **[measure-api.yourcompany.com]** with your actual Measure API domain.  | Registers current channel to receive alert notifications           |
| /stop-alerts         | https://[measure-api.yourcompany.com]/slack/events <br /><br />Replace **[measure-api.yourcompany.com]** with your actual Measure API domain. | Stops current channel from receiving alert notifications           |
| /list-alert-channels | https://[measure-api.yourcompany.com]/slack/events<br /><br />Replace **[measure-api.yourcompany.com]** with your actual Measure API domain.  | Lists channels currently registered to receive alert notifications |

## Configure Slack settings for existing installation

If you are upgrading from v0.8.2 or below, you would need to manually update the environment variables. After you've followed the above steps, instead of entering the client id and secrets in a terminal prompt, you will need to edit your environment variables file
and restart the services.

> [!NOTE]
>
> Slack cannot send event and OAuth callbacks to your local dev environments. In order to run and test Slack integration while developing or testing locally, you will need to use a tunneling service such as [ngrok](https://ngrok.com) or [Cloudflare tunnels](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/) and use that URL to proxy to your localhost.
>
> See this [guide](https://docs.slack.dev/tools/node-slack-sdk/tutorials/local-development/#using-a-local-request-url-for-development) for more information.

1. **Slack Client Credentials**. Open the `self-host/.env` file & add the following environment variables as obtained from your Slack app page.

    ```sh
    SLACK_CLIENT_ID=your-slack-client-id                # change this
    SLACK_CLIENT_SECRET=your-slack-client-secret        # change this
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
