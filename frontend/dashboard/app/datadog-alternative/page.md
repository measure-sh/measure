---
title: Open Source Datadog Alternative
description: Mobile focused open source alternative to Datadog. Crashes, ANRs, performance, network and full session timelines for mobile engineering teams with simple pricing.
canonical: /datadog-alternative
---

# Looking for Datadog alternatives?

Datadog is a comprehensive observability platform with roots in infrastructure and backend monitoring, spanning servers, cloud, APM, logs, security, web and mobile.

Measure is a mobile first, open source Datadog alternative.

## Full session context on every issue

With Datadog you get the stack trace plus the session's auto-captured actions, views and network requests. The richer, replay-style view of what the user did comes from Mobile Session Replay, which is sampled and billed as a separate product. This means you capture a fraction of sessions when the cost adds up at scale rather than all of them.

Measure attaches a full [Session Timeline](/product/session-timelines) with gestures, navigation, network calls, lifecycle events and custom spans to every crash, ANR and error and you only pay for the data used as a whole.

You see exactly what the user did and what the app did, on every issue, without deciding in advance which sessions are worth recording. No more ending with a production issue with no visibility because the session context got sampled out.

## Adaptive capture, not fixed sampling

Datadog uses fixed client-side sampling. You set a session sample rate, with a separate replay sample rate applied on top, decide up front what fraction to keep, and the rest is dropped before it ever reaches you.

Measure captures full session context by default, and with [Adaptive Capture](/product/adaptive-capture) you tune what you collect remotely, without shipping an app update.

Dial up sample rates on new releases or when chasing tricky production issues, dial down whenever you need to. Measure puts you in control.

## Fully open source

Datadog publishes its mobile SDKs as open source, but the backend and dashboard are a proprietary SaaS and there is no self-host option. You can read the SDK, but you can't see or run the platform that ingests and stores your data.

Measure is [fully open source](https://github.com/measure-sh/measure). Read it, run it, self-host it, audit the pipeline and if you think something can be done better, send a pull request.

## Simple, predictable pricing

Datadog is metered across a long list of separate SKUs. RUM sessions are split into tiers, Mobile Session Replay is billed on top, and that sits alongside per-host APM and infrastructure and per-gigabyte logs. There are consultants who make a living out of helping you understand and reduce your Datadog bills.

Measure has a single, transparent [price](/pricing) based on how much data you use. No per-seat fees, no separate product meters. With [Adaptive Capture](/product/adaptive-capture) you can dial collection up or down without rolling out app updates to control your costs even better.

## Built for mobile, by mobile devs

Datadog monitors infrastructure, servers, cloud, APM, logs, security and frontend across hundreds of integrations, so mobile is one small corner of a sprawling observability platform. Mobile is one workload among many, and the defaults, dashboards and roadmap are shaped by the whole platform rather than by mobile alone.

Measure is built only for mobile. [Crashes & ANRs](/product/crashes-and-anrs), [App Health](/product/app-health), [Performance Traces](/product/performance-traces), [Network Performance](/product/network-performance), [Bug Reports](/product/bug-reports) and [User Journeys](/product/user-journeys) are all designed around how mobile apps actually break in production.

Mobile is not a part of our product, it is the whole product.

## Measure vs Datadog

| Capability | Measure | Datadog |
| --- | --- | --- |
| Crash reporting with full session timelines | ✓ | Crash reports, session replay sampled & billed separately |
| ANR detection with full session timelines | ✓ | ANRs, session replay sampled & billed separately |
| Performance traces | ✓ | ✓ |
| Network monitoring | ✓ | ✓ |
| User journeys | ✓ | ✓ |
| In-app bug reports | ✓ | ✗ |
| Session timeline on every issue | ✓ | Session replay, sampled & billed separately |
| Dynamic Sampling with Adaptive Capture | ✓ | Static client side only sampling |
| Auto-captured context | Gestures, navigation, network, lifecycle | Actions, views, network, errors |
| Pricing | Simple pricing based on data usage | Separate SKUs for RUM session tiers, replay, APM, infra & logs |
| Open Source | Apache 2.0 (OSI open source) | SDKs only |
| Self-hostable | ✓ | ✗ |
| Public roadmap & issue tracker | ✓ | SDK repos only |
| Mobile focus | ✓ | One small part of a huge platform |

Get started: <https://measure.sh/auth/login>
