---
title: Open Source Embrace Alternative
description: Open source, self-hostable alternative to Embrace. Crashes, ANRs, performance, network and full session timelines for mobile engineering teams with simple pricing.
canonical: /embrace-alternative
---

# Looking for Embrace alternatives?

Embrace is an observability platform which started out in mobile and has expanded to add web support.

Measure is a mobile first, open source Embrace alternative.

## Full session context on every issue

This is where Embrace and Measure are most alike. Both attach a full session view to every crash, ANR and error, and both capture it automatically.

Measure records gestures, navigation, network calls, lifecycle events and custom spans into a full [Session Timeline](/product/session-timelines) on every issue.

The difference is what happens to that data. With Measure the SDK and the backend that stores your timelines are both open source and run wherever you choose, so full session context never means handing your sessions to a proprietary system you cannot see inside.

## Adaptive capture, not all-or-nothing

Like Measure, Embrace captures full sessions with no sampling, so neither makes you trade away data to hit a quota. Where they differ is control: Embrace captures everything and bills per session, so full fidelity means paying for every session your app generates.

Measure captures full session context by default too, but with [Adaptive Capture](/product/adaptive-capture) you tune what you collect remotely, without shipping an app update.

Dial up on a risky release, dial down to cut cost or noise. You decide how much you collect, and change it whenever you need to.

## Fully open source

Embrace open sources its SDKs but the backend and dashboard that ingest, store and surface your data are a proprietary SaaS.

Measure is [fully open source](https://github.com/measure-sh/measure). Run the entire stack yourself, audit the pipeline end to end, keep your data on your own infrastructure if you choose, and if something can be done better, send a pull request.

## Simple, predictable pricing

Embrace charges per session which means a session with barely any activity matters the same as one with lots of interactions.

Measure has a single, transparent [price](/pricing) based on how much data you actually ingest which is a much simpler and more practical metric since it relates proportionally to usage of the platform without meaningless sessions costing more than they need to. With [Adaptive Capture](/product/adaptive-capture) you can also tune collection anytime to keep costs in check.

## Built for mobile, by mobile devs

Embrace, like Measure, grew through mobile roots. Embrace has since expanded into web RUM and broader observability that plugs into backend tooling.

Measure is mobile first and focused on mobile developers. [Crashes & ANRs](/product/crashes-and-anrs), [App Health](/product/app-health), [Performance Traces](/product/performance-traces), [Network Performance](/product/network-performance), [Bug Reports](/product/bug-reports) and [User Journeys](/product/user-journeys) are all shaped only by how mobile apps break in production.

Mobile is not a part of our product, it is the whole product.

## Measure vs Embrace

| Capability | Measure | Embrace |
| --- | --- | --- |
| Crash reporting with full session timelines | ✓ | ✓ |
| ANR detection with full session timelines | ✓ | ✓ |
| Performance traces | ✓ | ✓ |
| Network monitoring | ✓ | ✓ |
| User journeys | ✓ | ✓ |
| In-app bug reports | ✓ | ✗ |
| Session timeline on every issue | ✓ | ✓ |
| Dynamic Sampling with Adaptive Capture | ✓ | Always-on full capture |
| Auto-captured context | Gestures, navigation, network, lifecycle | Taps, views, network, lifecycle |
| Pricing | Simple pricing based on data usage | Per session, retention tied to plan |
| Open Source | Apache 2.0 (OSI open source) | SDKs only |
| Self-hostable | ✓ | ✗ |
| Public roadmap & issue tracker | ✓ | SDK repos only |
| Mobile focus | ✓ | Mobile and web |

Get started: <https://measure.sh/auth/login>
