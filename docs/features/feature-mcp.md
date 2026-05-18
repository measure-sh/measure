---
title: "MCP Server for Mobile App Monitoring"
description: "Connect Measure to Claude Code, Codex, Cursor, Gemini and other AI coding agents. Query crashes, traces, sessions and bug reports from your editor or AI agent workflows."
---

# MCP Server

Measure exposes a [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server that lets AI-powered coding tools query your app's crash and error data directly.

* [**What is MCP?**](#what-is-mcp)
* [**Connecting to MCP via Coding Agents**](#connecting-to-mcp-via-coding-agents)
* [**Available Tools**](#available-tools)
  * [`list_apps`](#list_apps)
  * [`get_filters`](#get_filters)
  * [`get_metrics`](#get_metrics)
  * [`get_errors`](#get_errors)
  * [`get_error`](#get_error)
  * [`get_errors_over_time`](#get_errors_over_time)
  * [`get_error_over_time`](#get_error_over_time)
  * [`get_error_distribution`](#get_error_distribution)
  * [`get_error_common_path`](#get_error_common_path)
  * [`get_sessions`](#get_sessions)
  * [`get_sessions_over_time`](#get_sessions_over_time)
  * [`get_session`](#get_session)
  * [`get_bug_reports`](#get_bug_reports)
  * [`get_bug_reports_over_time`](#get_bug_reports_over_time)
  * [`get_bug_report`](#get_bug_report)
  * [`get_root_span_names`](#get_root_span_names)
  * [`get_span_instances`](#get_span_instances)
  * [`get_span_metrics_over_time`](#get_span_metrics_over_time)
  * [`get_trace`](#get_trace)
  * [`get_alerts`](#get_alerts)
  * [`get_journey`](#get_journey)
  * [`update_bug_report_status`](#update_bug_report_status)

## What is MCP?

The [Model Context Protocol](https://modelcontextprotocol.io) is an open standard that allows AI tools to interact with external data sources through a consistent interface. With Measure's MCP server, you can ask AI assistants to look up crashes, analyze error trends and inspect stack traces without leaving your editor.

## Connecting to MCP via Coding Agents

You can connect your favorite coding agents to Measure as a remote MCP server.

The MCP endpoint is available at:

| Version     | Endpoint                                      |
| ----------- | --------------------------------------------- |
| Cloud       | `https://api.measure.sh/mcp`                  |
| Self Hosted | `https://[your-measure-api-domain]/mcp`       |

Refer to your coding agent's documentation for the specific steps to add a remote MCP server. A few popular agent docs are linked here:
- [**Claude Code**](https://code.claude.com/docs/en/mcp)
- [**OpenAI Codex**](https://developers.openai.com/codex/mcp/)
- [**Gemini CLI**](https://geminicli.com/docs/tools/mcp-server/)
- [**XCode**](https://code.visualstudio.com/docs/copilot/customization/mcp-servers)
- [**Android Studio**](https://developer.android.com/studio/gemini/add-mcp-server)
- [**VSCode**](https://code.visualstudio.com/docs/copilot/customization/mcp-servers)
- [**Cursor**](https://cursor.com/docs/context/mcp)
- [**Windsurf**](https://docs.windsurf.com/windsurf/cascade/mcp)

When you first use a Measure tool, your coding agent will open a browser window for you to sign in to Measure. After authenticating subsequent requests will work automatically.

## Available Tools

### `list_apps`

List all apps the authenticated user has access to.

### `get_filters`

Get available filter options (versions, OS, countries, devices, etc.) for an app.

### `get_metrics`

Get app metrics including adoption, crash-free/ANR-free sessions and launch performance (cold/warm/hot p95).

### `get_errors`

Get crash or ANR error groups for an app.

### `get_error`

Get individual crash or ANR events for a specific error group.

### `get_errors_over_time`

Get time-series of crash or ANR occurrences across all error groups.

### `get_error_over_time`

Get time-series of occurrences for a specific error group.

### `get_error_distribution`

Get attribute distribution (OS, device, version, country) for a specific error group.

### `get_error_common_path`

Get the most common user navigation path leading to a specific crash or ANR.

### `get_sessions`

Get sessions for an app, ordered by most recent first.

### `get_sessions_over_time`

Get time-series of session counts.

### `get_session`

Get full session with all events.

### `get_bug_reports`

Get bug reports for an app, ordered by most recent first.

### `get_bug_reports_over_time`

Get time-series of bug report counts.

### `get_bug_report`

Get a single bug report with full details.

### `update_bug_report_status`

Update the status of a bug report (open or closed).

### `get_root_span_names`

Get all root span names for an app.

### `get_span_instances`

Get span instances for a root span name.

### `get_span_metrics_over_time`

Get p50/p90/p95/p99 duration metrics over time for a span name.

### `get_trace`

Get full trace with all child spans.

### `get_alerts`

Get alerts for an app, ordered by most recent first.

### `get_journey`

Get user navigation journey graph with session counts between screens.