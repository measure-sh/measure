---
title: "Measure Agent — Debug Apps faster than ever"
description: "Debug your apps with full context about crashes, errors, sessions and traces from Slack or your coding agent."
---

# Measure Agent

Measure Agent allows you to debug faster by answering questions about your app. Ask it to check your app's health, crashes and errors, performance and more!

* [**What the Agent Can Do**](#what-the-agent-can-do)
* [**Debugging from a Coding Agent (MCP)**](#debugging-from-a-coding-agent-mcp)
* [**Debugging from Slack**](#debugging-from-slack)
* [**Example Questions**](#example-questions)

## What the Agent Can Do

Measure Agent has access to all your app's telemetry data (crashes, errors, sessions, traces and metrics) and uses it to help you debug. Ask in natural language and it will count, compare, filter by version or time range, and follow up across a conversation.

## Debugging from a Coding Agent (MCP)

Measure Agent is exposed as the `ask_question` tool on Measure's [MCP server](./feature-mcp.md). Connect your coding agent (Claude Code, OpenAI Codex, Google Antigravity, Cursor and others) to Measure as described in [Connecting to MCP via Coding Agents](./feature-mcp.md#connecting-to-mcp-via-coding-agents), then ask about your telemetry in plain language. Your coding agent calls `ask_question`, gets the answer back, and can use it to help you debug issues, improve performance or run agentic loops.

## Debugging from Slack

If your workspace has the [Slack integration](./feature-slack-integration.md) connected, you can debug with Measure Agent without leaving Slack:

* **In a channel** — invite the Measure bot to the channel, then @mention it with your question, for example "@Measure how many crashes today?". The agent replies in the thread and you can ask follow up questions with full conversational context.
* **In a direct message** — message the Measure bot directly in Slack. Begin with starter prompts or ask your own questions and follow up with full conversational context.

Measure matches you to your team account by your Slack profile email, so your Measure email and your Slack email need to match. When a team has more than one app, you can either name the app in your question, or the agent will ask follow-up questions to clarify which app you are querying.

## Example Questions

* "How is the production app doing on crashes today?"
* "What are the top 5 errors this week?"
* "Show me the slowest network endpoints in version 4.2."
* "How many sessions had slow cold launches in the last 24 hours?"
* "What screen were users on right before the NullPointerException crash?"

> [!NOTE]
>
> #### Self Hosted Users
>
> If you are a self hosted user, please set up Measure Agent if you haven't done so using this [guide](../hosting/agent.md).
