---
title: Open Source Firebase Crashlytics Alternative
description: Open source alternative to Firebase Crashlytics. Unifies crashes, ANRs, performance, network and full session timelines for mobile engineering teams.
canonical: /crashlytics-alternative
---

# Looking for Firebase Crashlytics alternatives?

Firebase Crashlytics gives you basic crash reporting but why the crash happened, what the user was doing, what state the app was in and all the surrounding context is up to you to figure out with additional tools.

Measure is an open-source Crashlytics alternative that gives you the full context you need to fix issues faster.

## Beyond Crashes

Crashlytics handles basic crash reporting but requires more tooling to complete the mobile app monitoring picture.

Want performance traces? You need the Firebase Performance Monitoring add-on. Want to understand what the user was doing when the crash happened? You'll need to enable Google Analytics and manually instrument breadcrumb logs for every kind of error you care about. Want users to report bugs? Buy a third-party tool or hack your own. Want to analyze your data? Export it to BigQuery and pay per query. The number of SDKs in your app and the tools you need to look at keep expanding.

Measure unifies [Crashes & ANRs](/product/crashes-and-anrs), [Network Performance](/product/network-performance), [Performance Traces](/product/performance-traces), [App Health](/product/app-health), [Bug Reports](/product/bug-reports) and [User Journeys](/product/user-journeys) in one product. Every issue comes with a full Session Timeline which is auto collected for you without having to manually instrument every user interaction in your app.

One SDK, one dashboard, one place to look so you can stop stitching context and get to the root cause faster.

## Full session context, not just stack traces

When a crash hits in Crashlytics you get the stack trace plus breadcrumb logs. Those logs are powered by Google Analytics, so screen views are captured automatically but anything richer, like taps, navigation timing, network calls or lifecycle events, requires error-prone, manual instrumentation.

Measure auto-captures gestures, navigation, lifecycle events, network calls and custom spans, and replays them as a [Session Timeline](/product/session-timelines) attached to every crash, ANR or error.

You see exactly what the user did, what the app did and where things went wrong, without instrumenting every screen by hand.

## Open source

The Crashlytics SDKs are open source on GitHub, but the backend and dashboard are closed and run only on Google's infrastructure. Your users' stack traces, device info and any breadcrumbs you log all flow through Firebase, and you can't see or change what happens once the data leaves the SDK.

Measure is [fully open source](https://github.com/measure-sh/measure). Read the SDK, read the backend, file issues, contribute fixes. Your data is yours, the pipeline is auditable and you can be part of the community and help make it better.

## Predictable, transparent pricing

Crashlytics itself is free, and if free crash reporting is all you need, that's a good choice. The catch is that going further usually means stepping into the rest of the Firebase and GCP price list: BigQuery exports for analysis, Cloud Functions for alerting and other paid GCP services for anything you want to do with the data.

Measure has a single, transparent [price](/pricing) based on how much data you use. No per-seat charges, no hidden product bundles. With [Adaptive Capture](/product/adaptive-capture) you can dial collection up or down without rolling out app updates.

## Built for mobile, by mobile devs

Crashlytics sits inside the larger Firebase suite where mobile is one product line among many. The roadmap is opaque, and feature requests compete with the priorities of a much bigger platform.

Measure is built by a mobile-first team. Every feature, every default and every trade-off is shaped by mobile devs solving real production issues. The roadmap and issue tracker are public on [GitHub](https://github.com/measure-sh/measure). If something is missing, you can file a feature request, keep track of updates or send a pull request.

## Measure vs Firebase Crashlytics

| Capability | Measure | Firebase Crashlytics |
| --- | --- | --- |
| Crash reporting with full session timelines | ✓ | Crash reports with manual breadcrumbs |
| ANR detection with full session timelines | ✓ | ANRs with manual breadcrumbs |
| Performance traces without sampling | ✓ | Sampled with no control |
| Network monitoring without sampling | ✓ | Sampled with no control |
| User journeys | ✓ | Needs Google Analytics |
| In-app bug reports | ✓ | ✗ |
| Session timeline on every issue | ✓ | ✗ |
| Dynamic Sampling with Adaptive Capture | ✓ | ✗ |
| Auto-captured context | Gestures, navigation, network, lifecycle | Screen views via Google Analytics but rest needs manual instrumentation |
| Pricing | Simple pricing on data usage | Free crash reporting but complicated Google Analytics + BigQuery pricing for advanced users |
| Open Source | Apache 2.0 (OSI open source) | SDKs only |
| Self-hostable | ✓ | ✗ |
| Public roadmap & issue tracker | ✓ | SDK repos only |
| Raw data access | Data export whenever you need it | BigQuery export only, locking you into Google's ecosystem |
| Mobile focus | ✓ | One of many Firebase products |

Get started: <https://measure.sh/auth/login>
