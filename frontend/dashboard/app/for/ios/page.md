---
title: iOS Crash Reporting and Performance Monitoring
description: Reduce crashes and errors, improve performance and get better app store ratings with iOS performance monitoring & crash reporting.
canonical: /for/ios
---

# Measure for iOS

Measure is an open source, mobile first monitoring platform built for iOS. Measure gives you the full context behind every crash and slowdown, so you can decrease crashes and errors, improve performance and deliver a smoother experience to your iOS app users.

## Session Timelines

Every crash and error in your iOS app gets a complete [Session Timeline](/product/session-timelines) attached. Step back through everything that led up to it — taps and gestures, screen navigation, network calls, logs and lifecycle events — with CPU and memory readings plotted right beside them.

Instead of working backwards from a lone stack trace, you can see exactly what the user did and how the app responded in the moments before things broke.

## Detailed Stack Traces

Every [crash report](/product/crashes-and-anrs) comes with a full stack trace captured across every thread, so you can see what each one was doing, not just the thread that crashed.

Traces are symbolicated automatically, turning raw memory addresses back into the original function names, files and line numbers from your Swift and Objective-C sources. Upload your dSYMs through the Xcode build phase or straight from your .xcarchive and let Measure handle the symbolication so you can stay focused on the fix.

## Performance Monitoring

Put traces around the operations you care about with [Performance Traces](/product/performance-traces). Watch how network requests, disk and database work, heavy code paths and screen rendering add up inside a single user flow or across millions of sessions with waterfall charts that make the slow parts jump out.

Each trace carries detailed device and app context and links back to the full session timeline, so a slow operation always comes with the conditions it ran under.

## App Health

Keep a close eye on every release with [App Health](/product/app-health). Follow adoption, crash-free sessions, the error rates your users actually perceive, app size, and launch times across cold, warm and hot starts.

Catch a bad rollout while it's still contained and fix it before it reaches the rest of your users.

## Bug Reports

Let users flag problems the instant they hit them with [Bug Reports](/product/bug-reports), triggered by a device shake or from your own button through the SDK. Every report bundles device details, app version, network conditions and a screenshot together with the user's note, and links straight to the matching session timeline.

No more long email threads or support ticket ping-pong. Users describe the issue in their own words while you get all the context needed to fix it.

## User Journeys

Trace the actual routes people take through your app with [User Journeys](/product/user-journeys). Screen-to-screen movement is mapped for you into clear flow diagrams, and the exception view shows you where issues degrade those flows.

Not sure what to tackle first? See at a glance which paths matter most to your users so you can prioritize effectively.

## Network Monitoring

Keep tabs on every request your app fires with [Network Performance](/product/network-performance). Track how HTTP status codes trend over time and dig into your busiest endpoints, ranked by latency, error rate and call volume, to surface the requests dragging your app down.

Spot failing endpoints early and tune the API calls that matter most to your users.

## Coding Agents

Pull all of Measure's context into the coding agents you already use. The [Measure MCP server](/product/mcp) opens up your crashes, performance traces and session timelines to any agent, right from your IDE, editor or terminal.

Have it dig into a crash, walk through user sessions, or wire it into an agentic triage and debugging pipeline. Whether you lean on Claude Code or Codex, or prefer open source agents and models, Measure slots straight into your workflow.

Works with Claude Code, Cursor, Codex, Gemini CLI, Windsurf, Cline, opencode and Kilo Code.

Get started: <https://measure.sh/auth/login>
