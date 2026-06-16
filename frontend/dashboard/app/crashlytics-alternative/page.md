---
title: Open Source Firebase Crashlytics Alternative
description: Mobile focused, open source alternative to Firebase Crashlytics. Crashes, ANRs, performance, network and full session timelines for mobile engineering teams with simple pricing.
canonical: /crashlytics-alternative
---

# Looking for Firebase Crashlytics alternatives?

Firebase Crashlytics is a free and popular crash reporting tool that many apps start with.

Measure is a mobile first, open source Firebase Crashlytics alternative.

## Beyond Crashes

Crashlytics handles basic crash reporting but requires more tooling to complete the mobile app monitoring picture.

Performance traces need the performance monitoring add-on. Understanding what the user was doing when the crash happened requires enabling Google Analytics and manually instrumenting breadcrumb logs. Bug reporting requires third party tooling. Data analysis needs BigQuery export which is charged separately. The number of SDKs in your app and the tools you need to look at keep expanding.

Measure unifies [Crashes & ANRs](/product/crashes-and-anrs), [Network Performance](/product/network-performance), [Performance Traces](/product/performance-traces), [App Health](/product/app-health), [Bug Reports](/product/bug-reports) and [User Journeys](/product/user-journeys) in one product. Every issue comes with a full Session Timeline which is auto collected for you without having to manually instrument every user interaction in your app.

One SDK, one dashboard, one place to look so you can stop stitching context and get to the root cause faster.

## Full session context, not just stack traces

Crash reports in Crashlytics come with stack traces and manually instrumented breadcrumbs. Taps, navigations, network calls or lifecycle events require manual instrumentation which needs to be updated and synced when your app code changes in new releases.

Measure auto-captures gestures, navigation, lifecycle events, network calls and custom spans, and replays them as a [Session Timeline](/product/session-timelines) attached to every crash, ANR or error.

Measure makes it easy to see what the user did, what the app did and where things went wrong, without instrumenting every screen by hand.

## Open source

The Crashlytics SDKs are open source on GitHub, but the backend and dashboard are closed and run only on Google's proprietary infrastructure.

Measure is [fully open source](https://github.com/measure-sh/measure). Read it, run it, self-host it, audit the pipeline and if you think something can be done better, send a pull request.

## Simple, transparent pricing

Crashlytics itself is free. The catch is that going further usually means stepping into the rest of the Firebase and GCP pricing ecosystem. BigQuery exports for data analysis, Cloud Functions for alerting and other paid GCP services require separate payment for advanced operations on your data.

Measure has a single, transparent [price](/pricing) based on how much data you use. No per-seat charges, no hidden product bundles. With [Adaptive Capture](/product/adaptive-capture) you can dial collection up or down without rolling out app updates to control costs further.

## Built for mobile, by mobile devs

Crashlytics sits inside the larger Firebase suite where mobile is one product line among many. The product roadmap and platform decisions compete with the priorities of a much bigger platform.

Measure is built only for mobile. [Crashes & ANRs](/product/crashes-and-anrs), [App Health](/product/app-health), [Performance Traces](/product/performance-traces), [Network Performance](/product/network-performance), [Bug Reports](/product/bug-reports) and [User Journeys](/product/user-journeys) are all designed around how mobile apps actually break in production.

Mobile is not a part of our product, it is the whole product.

## Measure vs Firebase Crashlytics

| Capability | Measure | Firebase Crashlytics |
| --- | --- | --- |
| Crash reporting with full session timelines | ✓ | Crash reports with manual breadcrumbs |
| ANR detection with full session timelines | ✓ | ANRs with manual breadcrumbs |
| Performance traces without sampling | ✓ | Sampled |
| Network monitoring without sampling | ✓ | Sampled |
| User journeys | ✓ | Needs Google Analytics |
| In-app bug reports | ✓ | ✗ |
| Session timeline on every issue | ✓ | ✗ |
| Dynamic Sampling with Adaptive Capture | ✓ | ✗ |
| Auto-captured context | Gestures, navigation, network, lifecycle | Screen views if Google Analytics is enabled but rest needs manual instrumentation |
| Pricing | Simple pricing based on data usage | Free crash reporting but complex Google Analytics + BigQuery pricing for advanced users |
| Open Source | Apache 2.0 (OSI open source) | SDKs only |
| Self-hostable | ✓ | ✗ |
| Public roadmap & issue tracker | ✓ | SDK repos only |
| Raw data access | Data export whenever you need it | Paid export to BigQuery only |
| Mobile focus | ✓ | One of many Firebase products |

Get started: <https://measure.sh/auth/login>
