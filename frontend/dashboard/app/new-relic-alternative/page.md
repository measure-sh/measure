---
title: Open Source New Relic Alternative
description: Mobile focused, open source alternative to New Relic. Crashes, ANRs, performance, network and full session timelines for mobile engineering teams with simple pricing.
canonical: /new-relic-alternative
---

# Looking for New Relic alternatives?

New Relic is a comprehensive, all-in-one observability platform spanning APM, infrastructure, logs, browser monitoring, synthetics and mobile.

Measure is a mobile first, open source New Relic alternative.

## Full session context on every issue

New Relic gives you stack traces, breadcrumbs and interaction traces, and optionally Mobile Session Replay with several sampling options.

Measure attaches a full [Session Timeline](/product/session-timelines) with gestures, navigation, network calls, lifecycle events and custom spans to every crash, ANR and error and you only pay for the data used as a whole.

The key difference is transparency. Measure is open source, the platform that stores your user data is transparent, and you never have to send your data to a proprietary, locked platform.

## Adaptive capture, not fixed sampling

New Relic offers several sampling strategies. Some of these are server controlled but changing other sample rates means shipping an app update with new SDK settings.

Measure captures full session context by default, and with [Adaptive Capture](/product/adaptive-capture) you can tune what you collect remotely, without shipping an app update.

Dial up on new releases or when chasing tricky production issues, dial down whenever you need to.

## Fully open source

New Relic open sources its mobile agents, but the backend and dashboard are proprietary. You can look into the SDK, but you can't see or run the platform that ingests and stores your data.

Measure is [fully open source](https://github.com/measure-sh/measure). Read it, run it, self-host it, audit the pipeline and if you think something can be done better, send a pull request.

## Simple, predictable pricing

New Relic charges on data ingest and user seats. This means adding teammates and ingesting more data both push the bill up.

Measure has a single, transparent [price](/pricing) based on how much data you use. No per-seat fees, no separate product meters. With [Adaptive Capture](/product/adaptive-capture) you can dial collection up or down without rolling out app updates to control your costs even better.

## Built for mobile, by mobile devs

New Relic monitors infrastructure, APM, logs, browser, synthetics, security and more across one expansive platform. Mobile is one surface among many, and the defaults, dashboards, product decisions and roadmap are shaped by the whole platform rather than by the needs of mobile devs alone.

Measure is built only for mobile. [Crashes & ANRs](/product/crashes-and-anrs), [App Health](/product/app-health), [Performance Traces](/product/performance-traces), [Network Performance](/product/network-performance), [Bug Reports](/product/bug-reports) and [User Journeys](/product/user-journeys) are all designed around how mobile apps actually break in production.

Mobile is not a part of our product, it is the whole product.

## Measure vs New Relic

| Capability | Measure | New Relic |
| --- | --- | --- |
| Crash reporting with full session timelines | ✓ | Crash reports with optional Session replays |
| ANR detection with full session timelines | ✓ | ANRs with optional Session replays |
| Performance traces | ✓ | ✓ |
| Network monitoring | ✓ | ✓ |
| User journeys | ✓ | ✓ |
| In-app bug reports | ✓ | ✗ |
| Session timeline on every issue | ✓ | Session replay, sampled |
| Dynamic Sampling with Adaptive Capture | ✓ | Sampled, partial remote control |
| Auto-captured context | Gestures, navigation, network, lifecycle | Interactions, network, handled exceptions, breadcrumbs |
| Pricing | Simple pricing based on data usage | Per-GB data ingest plus per-user seats |
| Open Source | Apache 2.0 (OSI open source) | SDKs only |
| Self-hostable | ✓ | ✗ |
| Public roadmap & issue tracker | ✓ | SDK repos only |
| Mobile focus | ✓ | One small part of a huge platform |

Get started: <https://measure.sh/auth/login>
