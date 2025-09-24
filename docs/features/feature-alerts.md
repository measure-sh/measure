# Alerts

Measure sends out alert notifications via email and slack on Crash & ANR spikes along with Daily Summaries of core app metrics.

* [**Email Integration**](#email-integration)
  * [**Setting Up Email**](#setting-up-email)
* [**Slack Integration**](#slack-integration)
  * [**Connecting Slack Workspace**](#connecting-slack-workspace)
  * [**Receiving Alerts**](#receiving-alerts)
  * [**Stopping Alerts**](#stopping-alerts)
  * [**Disabling Slack Integration**](#disabling-slack-integration)

## Email Integration
Email integration allows you to receive alert notifications and daily summaries in your inbox.

### Setting up email
If you are a self hosted user, please set up your email integration if you haven't done so using this [guide](/docs/hosting/smtp-email.md).

Once completed, all members in your team will receive emails for apps belonging to the same team.

## Slack Integration
Slack integration allows you to receive alert notifications and daily summaries directly in your Slack workspace.

### Connecting Slack Workspace

If you are a self hosted user, please set up your slack integration if you haven't done so using this [guide](/docs/hosting/slack.md).

Click `Add to Slack` button and authorize Measure Slack App for your workspace.

### Receiving Alerts
To receive alert nofications in a channel, invite the Measure Slack app to the channel you wish to receive alerts in and then register it using the `/subscribe-alerts` slash command.

### Stopping Alerts
To stop alert nofications in a channel, use the `/stop-alerts` slash command in a channel that is subscribed for receving alerts.

### Listing Active Alert Channels
To see all active channels that are subscribed for alerts, use the `/list-alert-channels` slash command in a channel that the Measure Slack app has been added to.

### Disabling Slack Integration
You can stop all alerts regardless of channel subscription by disabling the Slack integration in the `teams` page on the Dashboard.


