---
title: Open Source Firebase Crashlytics Alternative
description: Open source alternative to Firebase Crashlytics. Unifies crashes, ANRs, performance, network and full session timelines for mobile engineering teams.
canonical: /crashlytics-alternatives
---

# Looking for Crashlytics alternatives?

Firebase Crashlytics is a great beginner crash reporting solution. Mobile teams need more than crashes and often end up looking for complete mobile app monitoring solutions.

Measure is an open-source Crashlytics alternative built for mobile.

## Beyond Crashes

Crashlytics handles basic crash reporting but requires more tooling to complete the mobile app monitoring picture.

Want performance traces? You need the Firebase Performance Monitoring add-on. Want to understand what the user was doing when the crash happened? You'll need to enable Google Analytics and manually instrument breadcrumb logs for every kind of error you care about. Want users to report bugs? Buy a third party tool or hack your own. Want to analyse your data? Export it to BigQuery and pay per query. The number of SDKs in your app and the tools you need to look at keep expanding.

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

Crashlytics itself is free, and if free crash reporting is all you need, that's a fair choice. The catch is that going further usually means stepping into the rest of the Firebase and GCP price list: BigQuery exports for analysis, Cloud Functions for alerting and other paid GCP services for anything you want to do with the data.

Measure has a single, transparent [price](/pricing) based on data volume and retention. No per-seat charges, no hidden product bundles. With [Adaptive Capture](/product/adaptive-capture) you can dial collection up or down without rolling out app updates.

## Built for mobile, by mobile devs

Crashlytics sits inside the larger Firebase suite where mobile is one product line among many. The roadmap is opaque, and feature requests compete with the priorities of a much bigger platform.

Measure is built by a mobile-first team. Every feature, every default and every trade-off is shaped by mobile devs solving real production issues. The roadmap and issue tracker are public on [GitHub](https://github.com/measure-sh/measure). If something is missing, you can file it, see where it sits or send a pull request.

Get started: <https://measure.sh/auth/login>
