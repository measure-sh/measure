---
title: Open Source Bugsnag Alternative
description: Mobile focused open source alternative to Bugsnag. Crashes, ANRs, performance, network and full session timelines for mobile engineering teams with simple pricing.
canonical: /bugsnag-alternative
---

# Looking for Bugsnag alternatives?

Bugsnag is an established error monitoring and app stability tool, now part of SmartBear, covering mobile alongside web and backend across dozens of platforms.

Measure is a mobile first, open source Bugsnag alternative.

## Full session context on every issue

With Bugsnag you get the stack trace plus a breadcrumb trail of what happened before the error. Breadcrumbs are limited (25 by default and 100 at most) and there is no visual replay of the session.

Measure attaches a full [Session Timeline](/product/session-timelines) with gestures, navigation, network calls, lifecycle events and custom spans to every crash, ANR and error, with no hard limit on what you can see.

You see exactly what the user did and what the app did, on every issue, not just the last hundred breadcrumbs before it broke.

## Adaptive capture, not quota sampling

Bugsnag keeps you limited to the tier you pay for by sampling. Performance data is sampled server-side so it fits your span quota, and errors are metered against a monthly event quota. In case of traffic spikes or sudden user growth, you would end up with less visibility into your system, just when you need more.

Measure captures full session context by default, and with [Adaptive Capture](/product/adaptive-capture) you tune what you collect remotely, without shipping an app update.

Dial up on new releases or when chasing tricky production issues, dial down whenever you need to. You stay in control, there is no billing tier.

## Fully open source

Bugsnag publishes its notifier SDKs on GitHub under the MIT license, but the backend and dashboard are proprietary. You can read the SDK, but you can't see or influence what happens to your data once it leaves the device, and self-hosting means running a closed binary on an Enterprise plan.

Measure is [fully open source](https://github.com/measure-sh/measure). Read it, run it, self-host it, audit the pipeline and if you think something can be done better, send a pull request.

## Simple, predictable pricing

Bugsnag meters two separate things, error events and performance spans, each against its own monthly quota, and exceeding them means sampling or overage.

Measure has a single, transparent [price](/pricing) based on how much data you use. No separate product meters. With [Adaptive Capture](/product/adaptive-capture) you can dial collection up or down without rolling out app updates to control your costs even better.

## Built for mobile, by mobile devs

Bugsnag monitors mobile, web and backend across 50+ platforms and is now one product inside SmartBear's larger testing and monitoring suite. Mobile is one player among many, and the defaults, dashboards and roadmap are shaped by the whole portfolio rather than by mobile alone.

Measure is built only for mobile. [Crashes & ANRs](/product/crashes-and-anrs), [App Health](/product/app-health), [Performance Traces](/product/performance-traces), [Network Performance](/product/network-performance), [Bug Reports](/product/bug-reports) and [User Journeys](/product/user-journeys) are all designed around how mobile apps actually break in production.

Mobile is not a part of our product, it is the whole product.

## Measure vs Bugsnag

| Capability | Measure | Bugsnag |
| --- | --- | --- |
| Crash reporting with full session timelines | ✓ | Crash reports with breadcrumbs, no session timeline |
| ANR detection with full session timelines | ✓ | ANRs with breadcrumbs, no session timeline |
| Performance traces | ✓ | ✓ |
| Network monitoring | ✓ | ✓ |
| User journeys | ✓ | ✗ |
| In-app bug reports | ✓ | ✗ |
| Session timeline on every issue | ✓ | Breadcrumbs only, limited to 100 |
| Dynamic Sampling with Adaptive Capture | ✓ | Quota-driven sampling |
| Auto-captured context | Gestures, navigation, network, lifecycle | Navigation, network, taps via breadcrumbs limited to 100 |
| Pricing | Simple pricing based on data usage | Separate quotas for error events & performance spans |
| Open Source | Apache 2.0 (OSI open source) | SDKs only |
| Self-hostable | ✓ | Enterprise on-premise |
| Public roadmap & issue tracker | ✓ | SDK repos only |
| Mobile focus | ✓ | One of many platforms |

Get started: <https://measure.sh/auth/login>
