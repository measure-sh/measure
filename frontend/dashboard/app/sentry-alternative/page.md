---
title: Open Source Sentry Alternative
description: Mobile focused open source alternative to Sentry. Crashes, ANRs, performance, network and full session timelines for mobile engineering teams with simple pricing.
canonical: /sentry-alternative
---

# Looking for Sentry alternatives?

Sentry is a popular error monitoring tool with roots in the web dev world. Mobile support is a more recent expansion to the core error monitoring platform.

Measure is a mobile first, open source Sentry alternative.

## Full session context on every issue

With Sentry you get the stack trace and breadcrumbs out of the box. The richer, replay-style view of what the user did comes from Session Replay, which is billed as a separate product. This means you capture a fraction of error sessions when the price gets expensive at scale rather than all of them.

Measure attaches a full [Session Timeline](/product/session-timelines) with gestures, navigation, network calls, lifecycle events and custom spans to every crash, ANR and error and you only pay for the data used as a whole.

You see exactly what the user did and what the app did, on every issue, without deciding in advance which errors are worth attaching full context to. No more ending with a production issue with no visibility because the session context got sampled out.

## Adaptive capture, not fixed sampling

Sentry uses fixed client-side sampling. You set a sample rate for traces and replays, decide up front what fraction to keep, and the rest is dropped before it ever reaches you.

Measure captures full session context by default, and with [Adaptive Capture](/product/adaptive-capture) you tune what you collect remotely, without shipping an app update.

Dial up sample rates on new releases or when chasing tricky production issues, dial down whenever you need to. Measure puts you in control.

## Fully open source

Sentry uses a custom source-available rather than OSI open source: its main application and dashboard ship under the Functional Source License (FSL) with only SDKs being MIT and the main application only going Apache 2.0 after 2 years.

Measure is [fully open source](https://github.com/measure-sh/measure). Read it, run it, self-host it, audit the pipeline and if you think something can be done better, send a pull request.

## Simple, predictable pricing

Sentry bills across a stack of separate features — errors, spans, replays all cost different amounts which in practice turns into juggling usage math and potentially unpleasant surprises at billing time.

Measure has a single, transparent [price](/pricing) based on how much data you use. No per-seat fees, no separate product meters. With [Adaptive Capture](/product/adaptive-capture) you can dial collection up or down without rolling out app updates to control your costs even better.

## Built for mobile, by mobile devs

Sentry monitors servers, cloud, serverless, frontend, games and mobile across dozens of SDKs, so mobile is only one part of its sprawling observability empire. Mobile is one platform among many, and the defaults, dashboards and product roadmap are shaped by the whole platform rather than by mobile alone.

Measure is built only for mobile. [Crashes & ANRs](/product/crashes-and-anrs), [App Health](/product/app-health), [Performance Traces](/product/performance-traces), [Network Performance](/product/network-performance), [Bug Reports](/product/bug-reports) and [User Journeys](/product/user-journeys) are all designed around how mobile apps actually break in production.

Mobile is not a part of our product, it is the whole product.

## Measure vs Sentry

| Capability | Measure | Sentry |
| --- | --- | --- |
| Crash reporting with full session timelines | ✓ | Crash reports with manual breadcrumbs, Session replay billed separately |
| ANR detection with full session timelines | ✓ | ANRs with manual breadcrumbs, Session replay billed separately |
| Performance traces | ✓ | ✓ |
| Network monitoring | ✓ | ✓ |
| User journeys | ✓ | ✗ |
| In-app bug reports | ✓ | ✓ |
| Session timeline on every issue | ✓ | Session Replay billed separately |
| Dynamic Sampling with Adaptive Capture | ✓ | Static client side only sampling |
| Auto-captured context | Gestures, navigation, network, lifecycle | Breadcrumbs, deeper context via Replay |
| Pricing | Simple pricing based on data usage | Separate quotas for errors, spans, replays, profiling, cron, uptime & logs |
| Open Source | Apache 2.0 (OSI open source) | FSL — source-available, Apache 2.0 after 2 years |
| Self-hostable | ✓ | ✓ |
| Public roadmap & issue tracker | ✓ | ✓ |
| Mobile focus | ✓ | One of many Sentry products |

Get started: <https://measure.sh/auth/login>
