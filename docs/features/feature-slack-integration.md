---
title: "Slack Integration — Crash, ANR, Bug Report Alerts and Daily Summaries"
description: "Receive Measure crash spike, ANR spike, bug report alerts and daily summaries in Slack. Manage subscriptions, list channels and stop alerts via slash commands."
---

# Slack Integration

Measure's Slack integration lets you receive alert notifications and daily summaries directly in your Slack workspace.

* [**Connecting Your Slack Workspace**](#connecting-your-slack-workspace)
* [**Slash Commands**](#slash-commands)
  * [`/subscribe-alerts`](#subscribe-alerts)
  * [`/stop-alerts`](#stop-alerts)
  * [`/list-alert-channels`](#list-alert-channels)
* [**Sending a Test Alert**](#sending-a-test-alert)
* [**Disabling Slack Integration**](#disabling-slack-integration)
* [**Self Hosted Setup**](../hosting/slack.md)

## Connecting Your Slack Workspace

> [!NOTE]
>
> #### Self Hosted Users
>
> If you are a self hosted user, please set up your Slack app if you haven't done so using this [guide](../hosting/slack.md).

Navigate to the **Team** settings page on the Measure dashboard and click the **Add to Slack** button. This will start an OAuth flow to authorize the Measure Slack app for your workspace.

Once connected, you will see a toggle to enable or disable the integration and a **Send Test Alert** button to verify the connection is working.

## Slash Commands

After connecting your workspace, invite the Measure bot to any channel where you want to receive alerts. Then use the following slash commands to manage alert subscriptions.

### `/subscribe-alerts`

Registers the current channel to receive alert notifications. The Measure bot must be invited to the channel before running this command.

### `/stop-alerts`

Unregisters the current channel from receiving alert notifications. Use this in a channel that is currently subscribed.

### `/list-alert-channels`

Lists all channels in your workspace that are currently registered to receive alert notifications. Use this in any channel where the Measure bot has been added.

## Sending a Test Alert

Once connected and enabled, you can verify your setup by clicking the **Send Test Alert** button on the **Team** settings page. This sends a test message to all subscribed channels.

## Disabling Slack Integration

You can stop all alerts across every channel at once by disabling the Slack integration toggle on the **Team** settings page. Individual channel subscriptions are preserved and will resume if you re-enable the integration.
