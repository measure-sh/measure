---
title: Open Source Firebase Crashlytics Alternative
description: Mobile focused, open source alternative to Firebase Crashlytics. Crashes, ANRs, performance, network and full session replays for mobile engineering teams with simple pricing.
canonical: /crashlytics-alternative
---

# The open-source Firebase Crashlytics alternative, built for mobile

Measure gives mobile teams crashes, ANRs, performance, network monitoring and full session context in one thoughtful platform. Every issue gets an auto-captured [Session Replay](/product/session-replays), so you and your coding agents have the deep context needed to fix issues fast. Measure is fully open-source and gives you complete control over your data with no sampling.

## Why mobile teams look for a Firebase Crashlytics alternative

Crashlytics is free, widely deployed and a sensible place to start. For most apps, its basic crash reporting is enough to get going. Teams tend to start looking due to the following reasons:

1. **Limited context makes solving issues harder.** A stack trace tells you where the app crashed, but doesn't tell you what the user and device were doing when it happened. Crashlytics requires manually instrumenting breadcrumbs and keeping them in sync with every release. Individually instrumenting every possible user interaction, device signal, network event and navigation change is cumbersome and hard to keep up with as the app evolves. Teams often find out in production that they are missing logs and events which could have helped them debug issues quicker.
2. **No control over sampling.** To keep crash reporting and performance monitoring free, Firebase applies internal sampling which developers cannot change. Production issues are affected by device, network, app versions, OS versions and many other factors. The ability to collect and analyze data across multiple dimensions dynamically is necessary to hone in on issues as apps scale.
3. **Toolset Fragmentation hides the true cost.** Performance traces go in Firebase Performance Monitoring, a separate product with a separate SDK. Analytics events which are useful for debugging end up in Google Analytics. Custom analysis of your own data needs paid BigQuery export and only happens in delayed batches. Custom alerting needs Cloud Functions. In-app bug reports require a third-party tool. The number of SDKs in your app, the dashboards you look at and the MCP integrations your agents need keep climbing, with the context you need for any single investigation spread across multiple sources.
4. **Platform Lock-In.** The Crashlytics SDKs are open source, but the backend and dashboard are proprietary. You cannot audit the code, verify the data pipeline, or move your raw data out to any destination except BigQuery with a paid export.

Measure was built to close these gaps: full session context by default, dynamic sampling with user control, one platform for everything mobile teams need, and an open stack you can contribute to.

## Measure vs Firebase Crashlytics: The Full Comparison

| Capability | Measure | Firebase Crashlytics |
| --- | --- | --- |
| Crash reporting | Yes, with Session Replay on every crash | Yes, with manually instrumented breadcrumbs |
| ANR detection | Yes, with Session Replay attached | Yes, with manually instrumented breadcrumbs |
| Session context on every issue | Auto-captured | Manual breadcrumbs |
| Session Replay | Yes, on every issue | ✗ |
| Auto-captured context | Gestures, navigation, network calls, lifecycle events | Screen views when Google Analytics is enabled; rest is manual |
| Network monitoring | Yes, with full dynamic sampling control | Separate Firebase Performance Monitoring product, with no user-controlled sampling |
| Performance traces | Yes, with full dynamic sampling control | Separate Firebase Performance Monitoring product, with no user-controlled sampling |
| In-app bug reports | ✓ | No, needs a third-party tool |
| User journeys | ✓ | Requires Google Analytics |
| Open source | Yes, Apache 2.0 end to end | SDKs only; backend and dashboard are proprietary |
| Self-hostable | ✓ | ✗ |
| Public roadmap and issue tracker | ✓ | SDK repositories only |
| Raw data export | To any destination, in Enterprise plans | Paid export to BigQuery only |
| Platforms | Android, iOS, iPadOS, Flutter, React Native, Kotlin Multiplatform | Apple platforms, Android, Flutter, Unity |
| Product focus | Mobile only | One of many Firebase products |

## Go Beyond crash reports with full session context

A Crashlytics crash report gives you a stack trace and whatever breadcrumbs you instrumented ahead of time. Taps, navigations, network calls and lifecycle transitions each need their own instrumentation, and this needs to keep up with code changes resulting in an error prone process with missing context as the app evolves.

Measure auto-captures gestures, navigation, lifecycle events, network calls and traces, then replays them as a [Session Replay](/product/session-replays) attached to every crash, ANR and error.

The debugging process changes from guesses about what happened to facts you can observe. Instead of reading a stack trace, forming a hypothesis, shipping breadcrumbs and waiting a release cycle to test it, you just open the issue and watch what happened. Even better, just point your agent at the issue and it can use our [MCP Server](/product/mcp) to fetch deep context across several occurrences to help you find the root cause. The hardest to reproduce issues: a crash that only happens on a certain device in a specific navigation path, an error that only occurs when a background request times out before completion, a failure that depends on state built up over several screens, become easier than ever to fix.

## Performance, Crash and ANR monitoring built only for mobile

Crashlytics is part of Firebase, where mobile is one product line among many and roadmap decisions compete with everything else on the platform.

Measure is built only for mobile. [Crashes & ANRs](/product/crashes-and-anrs), [App Health](/product/app-health), [Performance Traces](/product/performance-traces), [Network Performance](/product/network-performance), [Bug Reports](/product/bug-reports) and [User Journeys](/product/user-journeys) are all designed around the failure modes mobile apps experience in production: memory pressure, main-thread blocking, errors during background and foreground transitions, and unstable network conditions.

Mobile is not a part of our product. It is the whole product.

## The self-hostable, open-source Crashlytics alternative

Crashlytics publishes its SDKs on GitHub, but the backend and dashboard are proprietary and run only on Google's infrastructure.

Measure is [open source end to end](https://github.com/measure-sh/measure) under an Apache 2.0 license. You can read the code, run it, self-host it, and audit how data is collected and stored. If you have ideas on how to make it better, you can open an issue or send a pull request.

Open source software is better for transparency because you can see the code handling your data. It's better for security since more eyes on the code lead to more discovered vulnerabilities. It is better for flexibility, since you can raise issues and PRs to improve the platform or host it yourself if you have the need. Being open source also makes Measure easier to use with coding agents - just point your agent at the code or docs and it can figure out everything it needs to make full use of everything the platform offers without poking around a black box.

## One platform for Android, iOS, iPadOS, Flutter, React Native and KMP

Measure supports [Android](/for/android), [iOS](/for/ios), [iPadOS](/for/ipados), [Flutter](/for/flutter), [React Native](/for/react-native) and [Kotlin Multiplatform](/for/kmp).

Our SDKs are designed to be thoughtful, flexible, lightweight and performant across all platforms. Crashes, ANRs, performance traces, network monitoring and session context are tracked, symbolicated and collected with platform-specific best practices in mind so that observability doesn't impact the performance of the app itself.

Data across all your Android, iOS and cross-platform apps, along with their dev, staging and production variants feeds into a single unified dashboard so you can ship and monitor your apps with confidence.

## Simple, transparent pricing with full data ownership

Crashlytics crash reporting is free but data export and advanced analysis depend on separate products with independent pricing. Products like BigQuery export for custom analysis, Cloud Functions for custom alerting, Google analytics for user interaction events lead to platform lock-in and hard to predict costs as apps scale.

Measure has a single [price](/pricing) based on how much data you send. No per-seat charges, no arbitrary feature bundles. Raw data export is available in enterprise plans to a destination you choose without restriction to a particular cloud or vendor. With [Adaptive Capture](/product/adaptive-capture) you can adjust data collection rates without shipping an app update, which makes it easy to scale telemetry when your app needs to while keeping costs under control.

## Who is Measure right for?

Measure is useful for any mobile app but it fits best for apps with growing users, complexity and scale. If production issues are getting harder to debug due to missing information about the states that led to them, or if users are complaining about performance and network issues and your current setup lacks deep telemetry and context to fix them, Measure will fit like a glove.

Measure can also be a good choice if data ownership, auditability of the platform and avoiding platform lock-in to a single ecosystem matters to you for security or compliance reasons.

If simple crash reporting is all you need, and your team is already comfortable inside the Google ecosystem, Crashlytics is a decent option. Measure is designed for growing mobile teams that need production observability at scale. With deep telemetry, Measure makes fixing issues with agents and shipping amazing mobile experiences easier and faster.

## Migrating from Crashlytics

Switching to Measure does not have to be a rip-and-replace. You can install the Measure SDK and run it alongside Crashlytics while you evaluate. A generous free tier lets you integrate your app, send telemetry data, use session replays, performance traces and MCP server integration to debug issues and see how Measure helps improve your app.

Many teams use both Crashlytics and Measure together until they make the switch. Setup and per-platform guides are in the [docs](/docs).

## Firebase Crashlytics alternative FAQs

### Is there an open-source alternative to Firebase Crashlytics?

Yes. Measure is a fully open-source alternative to Firebase Crashlytics, licensed under Apache 2.0. Crashlytics publishes its SDKs as open source, but its backend and dashboard are proprietary. Measure's entire stack is open, so you can read the code, self-host it and audit how data is collected and stored. It covers crashes, ANRs, performance, network monitoring and session context, and is built only for mobile.

### Is Firebase Crashlytics open source?

Partially. The Crashlytics SDKs are open source on GitHub, but the backend and dashboard are closed and run only on Google's infrastructure. That means you cannot self-host Crashlytics, run its servers yourself, or audit the full ingestion pipeline. If an end-to-end open-source stack matters to your team, Measure is 100% open source.

### Is Firebase Crashlytics free?

Yes. Crashlytics crash reporting is free to use. Costs start when you go further: Exporting your data to BigQuery for custom analysis and Cloud Functions for custom alerting are separately billed services. Measure has a single usage-based price and generous free tier to get you started.

### Is Measure free?

Measure has a generous free tier which is sufficient for most small teams and solo developers. For teams hitting scale, we offer a pro plan with a simple usage-based pricing.

### Does Firebase Crashlytics report ANRs?

Yes, for Android apps. Crashlytics collects ANRs and attaches breadcrumbs if you've taken the time to manually instrument them. Measure reports ANRs with a Session Replay attached, so you can see the user interactions and device activity that lead to them making debugging easier.

### Can Measure replace Firebase Crashlytics?

Yes, it can. Measure covers the core Crashlytics job of crash and ANR reporting, and adds session context, network monitoring, performance traces and in-app bug reports in the same SDK. You can run both side by side during evaluation. Teams that only need free crash reporting inside the Google ecosystem may still prefer Crashlytics but for teams looking for advanced mobile performance monitoring and issue debugging, Measure offers a better platform.

### Does Measure support Android, iOS, Flutter, React Native and Kotlin Multiplatform?

Yes. Measure has SDKs for Android, iOS, iPadOS, Flutter, React Native and Kotlin Multiplatform. Crashes, ANRs, performance traces, network monitoring and session context all feed into one dashboard, so cross-platform teams can monitor and debug in one unified tool.

### Does Measure support Claude Code, Codex, Pi, OpenCode and other coding agents?

Yes. Measure has an MCP server that is specifically designed to give your coding agents deep app context so they can help you fix issues faster. You can also set up automated workflows such as loops to have your agents fix issues on their own using the MCP integration.

### Can Measure be self-hosted?

Yes. Because Measure is open source under Apache 2.0, you can self-host the entire stack, backend and dashboard included, on infrastructure you control. Crashlytics cannot be self-hosted, since its backend is proprietary. Self-hosting keeps crash and real-user session data in your own environment, which certain terms need. Our hosted cloud option is a better option for most teams who would rather not manage and scale the platform themselves.

Or checkout the [docs](/docs).

Get started: <https://measure.sh/auth/login>
