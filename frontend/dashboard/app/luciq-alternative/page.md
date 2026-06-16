---
title: Open Source Luciq (formerly Instabug) Alternative
description: Mobile focused, open source alternative to Luciq (formerly Instabug). Crashes, ANRs, performance, network and full session timelines for mobile engineering teams with simple pricing.
canonical: /luciq-alternative
---

# Looking for Luciq alternatives?

Luciq (formerly Instabug) originally started with bug reporting but later expanded to become a full mobile observability platform.

Measure is a mobile first, open source Luciq alternative.

## Full session context on every issue

Measure and Luciq both record full session replays and attach logs, network calls, device details and repro steps to the issues you debug, giving you far more than a stack trace.

Measure captures gestures, navigation, network calls, lifecycle events and custom spans into a full [Session Timeline](/product/session-timelines) on every issue.

The key difference is transparency. With Measure, you can audit what happens to those collected sessions since our entire platform is open source. From the SDK to the backend processing and the storage layer, you can see what Measure does with your data and verify it yourself. No need for blind trust, just read the source.

## Adaptive capture, on your terms

Measure captures full session context by default, and with [Adaptive Capture](/product/adaptive-capture) you can tune what you collect remotely, without shipping an app update.

Luciq does not give you the same remote control to increase capture while you chase a tricky bug and then pull it back to keep cost and noise down.

Turn detail up on a new release, down afterwards, and change it whenever you need to.

## Fully open source

Luciq is proprietary. Its SDK is published on GitHub, but under a license that forbids modifying it (use as is, all rights reserved), and the backend and dashboard are a closed platform you can neither run nor inspect.

Measure is [fully open source](https://github.com/measure-sh/measure). Read it, run it, self-host it, audit the pipeline end to end, and if you think something can be done better, send a pull request.

## Simple, predictable pricing

Luciq charges per daily active user and per seat and requires a sales call to get a quote. App users without much activity end up adding to costs, and every team member who needs access to the dashboard increases costs further.

Measure has a single, transparent [price](/pricing) based on how much data you use. No per-seat fees, no per-user charges, no sales call needed. With [Adaptive Capture](/product/adaptive-capture) you can tune collection to keep costs in check.

## Built for mobile, by mobile devs

Luciq and Measure are both mobile first platforms. Luciq is closed source and proprietary.

Measure is open source and built in the open, with a public roadmap and issue tracker, made for mobile developers to read, participate and contribute. [Crashes & ANRs](/product/crashes-and-anrs), [App Health](/product/app-health), [Performance Traces](/product/performance-traces), [Network Performance](/product/network-performance), [Bug Reports](/product/bug-reports) and [User Journeys](/product/user-journeys) are all shaped by how mobile apps break in production.

Measure is built with the community, incorporating continuous feedback which we strongly believe leads to a better platform for mobile developers.

## Measure vs Luciq

| Capability | Measure | Luciq |
| --- | --- | --- |
| Crash reporting with full session timelines | ✓ | ✓ |
| ANR detection with full session timelines | ✓ | ✓ |
| Performance traces | ✓ | ✓ |
| Network monitoring | ✓ | ✓ |
| User journeys | ✓ | ✓ |
| In-app bug reports | ✓ | ✓ |
| Session timeline on every issue | ✓ | ✓ |
| Dynamic Sampling with Adaptive Capture | ✓ | ✗ |
| Auto-captured context | Gestures, navigation, network, lifecycle | Screen changes, interactions, network, logs |
| Pricing | Simple pricing based on data usage | Per active user + seat, sales call needed |
| Open Source | Apache 2.0 (OSI open source) | Proprietary |
| Self-hostable | ✓ | ✗ |
| Public roadmap & issue tracker | ✓ | ✗ |
| Mobile focus | ✓ | ✓ |

Get started: <https://measure.sh/auth/login>
