# Set up Slack integration

Set up Slack integration to receive alert notifications on Slack.

1. You will need to create a Slack app following the official [Slack guide](https://docs.slack.dev/quickstart/). You may choose any name, logo and description you wish for your app.

2. Go to `Basic Information` section and copy client id, client secret and signing secret and paste them into the prompts. (If you're upgrading an existing Measure installation you will paste these variables into your environment variables file. See section for existing users below)

3. Go to the `OAuth & Permissions` section of your app and under `Redirect URLs`, add a url for receiving OAuth callbacks. This should be `yourdomain.com/auth/callback/slack-app`.

4. In the same `OAuth & Permissions` section of your app, under `Scopes`, request the following permissions:

```txt
channels:read
chat:write
commands
groups:read
```

5. Go to `Slash Commands` section. Create the commands as follows:

```
Command: /subscribe-alerts
Request URL: yourdomain.com/slack/events
Short Description: Registers current channel to receive alert notifications

Command: /stop-alerts
Request URL: yourdomain.com/slack/events
Short Description: Stops current channel from receiving alert notifications

Command: /list-alert-channels
Request URL: yourdomain.com/slack/events
Short Description: Lists channels currently registered to receive alert notifications
```

> [!NOTE]
>
> Slack does not send event and OAuth callbacks to localhost and dev environments reliably. In order to run and test Slack integration while doing local development, you will need to use a tunneling service such as ngrok or Cloudflare tunnels and use that url to proxy to your localhost.
>
> See this [guide](https://docs.slack.dev/tools/node-slack-sdk/tutorials/local-development/#using-a-local-request-url-for-development) for more information.

## Configure Slack settings for existing users

If you are upgrading from v0.8.2 or below, you would need to manually update the environment variables. After you've followed the above steps, instead of entering the client id and secrets in a terminal prompt, you will need to edit your environment variables file
and restart the services.

1. Edit the `self-host/.env` file.

2. Add the following environment variables as obtained from your Slack app page.

    ```sh
    SLACK_CLIENT_ID=your-slack-client-id                # change this
    SLACK_CLIENT_SECRET=your-slack-client-secret        # change this
    ```

3. Generate a random 44 character salt and add it as an environment variable. You can use any password generator to generate it.

    ```sh
    SLACK_OAUTH_STATE_SALT=your-slack-oauth-state-salt  # change this
    ```

4. Run the following command to shutdown all services.

    ```sh
    sudo docker compose \
      -f compose.yml \
      -f compose.prod.yml \
      --profile migrate \
      down
    ```

5. Finally, run the `install.sh` script for the configuration to take effect.

    ```sh
    sudo ./install.sh
    ```

[Go back to self host guide](./README.md)
