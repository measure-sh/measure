# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [ios-v0.10.2] - 2026-05-08

### :bug: Bug fixes


- (**ios**): Remove orphaned attachment cleanup logic

## [ios-v0.10.1] - 2026-05-07

### :bug: Bug fixes


- (**ios**): Send correct user defined attributes json (#3589)

### :hammer: Misc


- (**ios**): Prepare sdk release 0.10.1

## [ios-v0.10.0] - 2026-04-03

### :bug: Bug fixes


- (**ios**): Send proper symbol address (#3389) by @adwinross in #3389
- (**ios**): Use dispatch queues to track http events (#3384) by @adwinross in #3384

### :hammer: Misc


- (**ios**): Prepare sdk release 0.10.0 (#3391) by @adwinross in #3391
- (**ios**): Send attachment size in the event payload (#3355) by @adwinross in #3355
- (**ios**): Update sdk integration docs (#3341) by @adwinross in #3341
- (**ios**): Use correct session start time (#3339) by @adwinross in #3339
- (**ios**): Use core data to save gzip data (#3331) by @adwinross in #3331
- (**ios**): Add correct url host to http events (#3330) by @adwinross in #3330

### :sparkles: New features


- (**ios**): Implement improved layout snapshots (#3327) by @adwinross in #3327
- (**ios**): Integrate kscrash (#3255) by @adwinross in #3255

## [ios-v0.9.2] - 2026-03-05

### :bug: Bug fixes


- (**ios**): Use correct data type for session start time attribute (#3256) by @adwinross in #3256

### :hammer: Misc


- (**ios**): Prepare sdk release 0.9.2 (#3264) by @adwinross in #3264
- (**ios**): Delete expired attachments on cleanup (#3262) by @adwinross in #3262
- (**ios**): Add session start timestamp to attributes (#3250) by @adwinross in #3250
- (**ios**): Add http_sampling_rate dynamic config (#3231) by @abhaysood in #3231

## [ios-v0.9.1] - 2026-02-23

### :bug: Bug fixes


- (**ios**): Make config api call asynchronously (#3202) by @adwinross in #3202

### :hammer: Misc


- (**ios**): Prepare sdk release 0.9.1 (#3203) by @adwinross in #3203

## [ios-v0.9.0] - 2026-02-19

### :bug: Bug fixes


- (**ios**): Swizzle url session task only once (#3137) by @adwinross in #3137

### :hammer: Misc


- (**ios**): Prepare sdk release 0.9.0 (#3146) by @adwinross in #3146
- (**ios**): Enable internal logging based on macro (#3141) by @adwinross in #3141
- (**ios**): Add cleanup logic for stale attachments (#3135) by @adwinross in #3135
- (**ios**): Update exporting logic (#3134) by @adwinross in #3134
- (**ios**): Update plcrashreporter version (#3120) by @adwinross in #3120
- (**ios**): Update ci checks (#3068) by @adwinross in #3068
- (**ios**): Rename userJourneySamplingRate to journeySamplingRate (#2957) by @adwinross in #2957

### :sparkles: New features


- (**ios**): Implement dynamic config with new session definition (#3077) by @adwinross in #3077
- (**ios**): Expose measure init api for cpp app delegate (#3028) by @adwinross in #3028

## [ios-v0.8.1] - 2025-11-26

### :bug: Bug fixes


- (**ios**): Use correct coding keys for userJourneysSamplingRate (#2939) by @adwinross in #2939

### :hammer: Misc


- (**ios**): Prepare sdk release 0.8.1 (#2941) by @adwinross in #2941

## [ios-v0.8.0] - 2025-11-25

### :bug: Bug fixes


- (**ios**): Update network interceptor to generate proper request body (#2889) by @adwinross in #2889

### :hammer: Misc


- (**ios**): Prepare sdk release 0.8.0 (#2937) by @adwinross in #2937
- (**ios**): Update measure config and default event collection by @adwinross in #2935

## [ios-v0.7.1] - 2025-10-29

### :bug: Bug fixes


- (**ios**): Filter HTTP body fields instead of discarding events (#2856) by @adwinross in #2856
- (**ios**): Log proper error message on failure by @adwinross in #2807

### :hammer: Misc


- (**ios**): Prepare sdk release 0.7.1 (#2858) by @adwinross in #2858
- (**ios**): Limit http data body size to 256 kb (#2852) by @adwinross in #2852

## [ios-v0.7.0] - 2025-10-22

### :bug: Bug fixes


- (**ios**): Track proper session duration (#2641) by @adwinross in #2641

### :hammer: Misc


- (**ios**): Prepare sdk release 0.7.0 (#2799) by @adwinross in #2799
- (**ios**): Use signed urls to upload dsyms (#2785) by @adwinross in #2785
- (**ios**): Continue existing attachment export on unregister (#2796) by @adwinross in #2796
- (**ios**): Update core data model version (#2775) by @adwinross in #2775
- (**ios**): Implement serial attachment upload (#2730) by @adwinross in #2730
- (**ios**): Centralize custom attribute validation logic (#2716) by @adwinross in #2716
- (**ios**): Remove maxSessionDurationMs from internal config (#2696) by @adwinross in #2696
- (**ios**): Add jitter to periodic export (#2695) by @adwinross in #2695
- (**ios**): Update upload dyms scripts (#2626) by @adwinross in #2626

### :sparkles: New features


- (**ios**): Expose API to track http events (#2788) by @adwinross in #2788
- (**ios**): Add session start event (#2607) by @adwinross in #2607

## [ios-v0.6.0] - 2025-09-01

### :bug: Bug fixes


- (**ios**): Add proper implementation for LifecycleManagerInternal (#2603) by @adwinross in #2603
- (**ios**): Update process start time logic (#2597) by @adwinross in #2597
- (**ios**): Add safe uiapplication swizzling (#2593) by @adwinross in #2593
- (**ios**): Only call functions if sdk is started (#2583) by @adwinross in #2583
- (**ios**): Fix blank svg generation (#2580) by @adwinross in #2580
- (**ios**): Disable shake listener when app moves to background (#2566) by @adwinross in #2566
- (**ios**): Remove deprecated UIWebView usage (#2538) by @hoermannpaul in #2538
- (**ios**): Prepare crash file if crash data is cleared (#2533) by @adwinross in #2533
- (**ios**): Make MsrAttachment properties public (#2534) by @adwinross in #2534

### :hammer: Misc


- (**ios**): Prepare sdk release 0.6.0 (#2606) by @adwinross in #2606
- (**ios**): Update performance docs (#2605) by @adwinross in #2605
- (**ios**): Update ios project structure (#2601) by @adwinross in #2601
- (**ios**): Update package.swift to include objc code (#2599) by @adwinross in #2599
- (**ios**): Add script to upload dsyms from xcarchive (#2585) by @adwinross in #2585
- (**ios**): Add more view controllers to be ignored (#2565) by @adwinross in #2565
- (**ios**): Add lifecycleViewControllerExcludeList to internal config (#2468) by @adwinross in #2468
- (**ios**): Add more view controllers to be ignored (#2461) by @abhaysood in #2461

### :sparkles: New features


- (**ios**): Add user defined attributes to screen view events (#2592) by @adwinross in #2592
- (**ios**): Provide configurable storage limits (#2470) by @adwinross in #2470

## [ios-v0.5.1] - 2025-07-11

### :hammer: Misc


- (**ios**): Prepare sdk release 0.5.1 (#2400) by @adwinross in #2400

## [ios-v0.5.0] - 2025-07-09

### :bug: Bug fixes


- (**ios**): Convert float to int safely (#2381) by @adwinross in #2381
- (**ios**): Generate non nil network attributes for first event (#2372) by @adwinross in #2372
- (**ios**): Make attribute processor thread safe (#2351) by @adwinross in #2351
- (**ios**): Prevent network change callback from firing on SDK initialisation (#2345) by @adwinross in #2345

### :hammer: Misc


- (**ios**): Prepare sdk release 0.5.0 (#2376) by @adwinross in #2376
- (**ios**): Update apis to support objc initialisation (#2374) by @adwinross in #2374
- (**ios**): Update shake detector api (#2365) by @adwinross in #2365
- (**ios**): Remove shake to launch bug report config (#2358) by @abhaysood in #2358
- (**ios**): Update unreliable tests in ci environment (#2336) by @adwinross in #2336
- (**ios**): Update release script (#2342) by @adwinross in #2342

### :recycle: Refactor


- (**ios**): Rename Attachment to MsrAttachment (#2368) by @adwinross in #2368

### :sparkles: New features


- (**ios**): Add support for custom header (#2355) by @adwinross in #2355

## [ios-v0.4.0] - 2025-06-19

### :books: Documentation


- (**ios**): Add app size monitoring documentation (#2321) by @adwinross in #2321

### :bug: Bug fixes


- (**ios**): Remove hardcoded values from upload dysm script (#2322) by @adwinross in #2322
- (**ios**): Make session id API public (#2315) by @abhaysood in #2315

### :hammer: Misc


- (**ios**): Prepare sdk release 0.4.0 (#2333) by @adwinross in #2333
- (**ios**): Add measure api url to http blocklist (#2317) by @adwinross in #2317
- (**ios**): Add performance data (#2295) by @adwinross in #2295

### :recycle: Refactor


- (**ios**): Update public api interface (#2319) by @adwinross in #2319

### :sparkles: New features


- (**ios**): Implement handled exception tracking (#2331) by @adwinross in #2331

## [ios-v0.3.1] - 2025-06-04

### :bug: Bug fixes


- (**ios**): Swizzle UIApplication.sendEvent to avoid breaking keyboard input (#2267) by @adwinross in #2267
- (**ios**): Update core data Initialization logic (#2257) by @adwinross in #2257
- (**ios**): Replaces uses of TARGET_OS_SIMULATOR (#2244) by @DominatorVbN in #2244

### :hammer: Misc


- (**ios**): Prepare sdk release 0.3.1 (#2276) by @adwinross in #2276

## [ios-v0.3.0] - 2025-05-28

### :books: Documentation


- (**ios**): Update readme.md (#2132) by @DominatorVbN in #2132

### :bug: Bug fixes


- (**ios**): Attach crash report to the correct session (#2196) by @adwinross in #2196

### :hammer: Misc


- (**ios**): Prepare sdk release 0.3.0 (#2229) by @adwinross in #2229

### :sparkles: New features


- (**ios**): Add bug report (#2203) by @adwinross in #2203

## [ios-v0.2.0] - 2025-04-29

### :bug: Bug fixes


- (**ios**): Update cgfloat to int conversion logic (#2098) by @adwinross in #2098
- (**ios**): Update cpu frequency generation logic (#2092) by @adwinross in #2092
- (**ios**): Start the sdk when autostart is enabled (#2036) by @adwinross in #2036

### :hammer: Misc


- (**ios**): Prepare sdk release 0.2.0 (#2099) by @adwinross in #2099
- (**ios**): Update swizzling logic (#2079) by @adwinross in #2079
- (**ios**): Update swiftlint config (#2027) by @adwinross in #2027
- (**ios**): Update json encoding logic (#1959) by @adwinross in #1959
- (**ios**): Remove swift-lint check on ci (#2017) by @adwinross in #2017

### :sparkles: New features


- (**ios**): Track view controller ttid (#2083) by @adwinross in #2083
- (**ios**): Implement performance tracing (#2076) by @adwinross in #2076
- (**ios**): Expose APIs to allow start/stop of SDK (#2007) by @adwinross in #2007

## [ios-v0.1.0] - 2025-03-28

### :books: Documentation


- (**ios**): Update readme (#1956) by @adwinross in #1956
- (**ios**): Add feature documentation (#1863) by @adwinross in #1863

### :bug: Bug fixes


- (**ios**): Skip sdk initialisation if api key or api url is invalid (#1970) by @adwinross in #1970
- (**ios**): Update in_app generation logic (#1885) by @adwinross in #1885
- (**ios**): Update long press timeout (#1801) by @adwinross in #1801
- (**ios**): Data type issue by @adwinross in #1734
- (**ios**): Data ingestion failure by @adwinross

### :hammer: Misc


- (**ios**): Prepare sdk release 0.1.0 (#2000) by @adwinross in #2000
- (**ios**): Update release script (#1999) by @adwinross in #1999
- (**ios**): Update pod name to measure-sh (#1998) by @adwinross in #1998
- (**ios**): Update heartbeat tests (#1994) by @adwinross in #1994
- (**ios**): Prepare sdk release 0.1.0 (#1987) by @adwinross in #1987
- (**ios**): Add http event configurations to measure config (#1980) by @adwinross in #1980
- (**ios**): Log error messages when upload dsym script fails (#1975) by @adwinross in #1975
- (**ios**): Create new session if build number or app version is updated (#1972) by @adwinross in #1972
- (**ios**): Rename MeasureSDK to Measure (#1957) by @adwinross in #1957
- (**ios**): Update plcrashreporter config (#1938) by @adwinross
- (**ios**): Remove fatal errors (#1932) by @adwinross in #1932
- (**ios**): Update cpu frequency generation logic by @adwinross in #1904
- (**ios**): Prepare sdk release 0.0.1-rc1 (#1877) by @adwinross in #1877
- (**ios**): Update release scripts (#1876) by @adwinross in #1876
- (**ios**): Add release scripts (#1869) by @adwinross in #1869
- (**ios**): Update public apis (#1841) by @adwinross in #1841
- (**ios**): Add scripts to upload dsyms (#1823) by @adwinross in #1823
- (**ios**): Add binary images to exception (#1802) by @adwinross in #1802
- (**ios**): Add spm and cocoapod support (#1796) by @adwinross in #1796
- (**ios**): Add layout snapshots to gestures (#1779) by @adwinross in #1779
- (**ios**): Add privacy manifest (#1782) by @adwinross in #1782
- (**ios**): Add sessionator data (#1749) by @adwinross in #1749
- (**ios**): Add public apis to set and unset userid by @adwinross in #1753
- (**ios**): Add session sampling and data cleanup (#1733) by @adwinross in #1733
- (**ios**): Add screen view event (#1721) by @adwinross
- (**ios**): Add custom event tracking (#1676) by @adwinross
- (**ios**): Track and export network change events (#1683) by @adwinross
- (**ios**): Track and export http events (#1612) by @adwinross
- (**ios**): Track app termination event (#1678) by @adwinross
- (**ios**): Add launch event tracking (#1535) by @adwinross in #1535
- (**ios**): Add cpu and memory tracking (#1519) by @adwinross in #1519
- (**ios**): Update time provider (#1478) by @adwinross in #1478
- (**ios**): Add lifecycle tracking (#1444) by @adwinross in #1444
- (**ios**): Update session creation logic (#1398) by @adwinross in #1398
- (**ios**): Batch and send events (#1369) by @adwinross in #1369
- (**ios**): Update event store to save gesture data (#1365) by @adwinross in #1365
- (**ios**): Update project structure (#1328) by @adwinross in #1328
- (**ios**): Detect and save gesture events (#1324) by @adwinross in #1324
- (**ios**): Save events and sessions to core data (#1307) by @adwinross in #1307
- (**ios**): Add crash reporting (#1267) by @adwinross
- (**ios**): Add signpost for performance testing (#1208) by @adwinross
- (**ios**): Add event processor (#1206) by @adwinross
- (**ios**): Add attribute processor (#1192) by @adwinross
- (**ios**): Add session manager (#1162) by @adwinross
- (**ios**): Update sdk initialisation (#1146) by @adwinross
- (**ios**): Update ios sdk initialisation (#1119) by @adwinross
- (**ios**): Add swiftLint to ios by @adwinross

### :recycle: Refactor


- (**ios**): Rename NetworkInterceptor to MsrNetworkInterceptor (#1922) by @adwinross in #1922

### :sparkles: New features


- (**ios**): Expose API to get current session ID (#1677) by @adwinross
- (**ios**): Initial project setup  (#1034) by @adwinross

[ios-v0.10.2]: https://github.com/measure-sh/measure/compare/ios-v0.10.1..ios-v0.10.2
[ios-v0.10.1]: https://github.com/measure-sh/measure/compare/ios-v0.10.0..ios-v0.10.1
[ios-v0.10.0]: https://github.com/measure-sh/measure/compare/ios-v0.9.2..ios-v0.10.0
[ios-v0.9.2]: https://github.com/measure-sh/measure/compare/ios-v0.9.1..ios-v0.9.2
[ios-v0.9.1]: https://github.com/measure-sh/measure/compare/ios-v0.9.0..ios-v0.9.1
[ios-v0.9.0]: https://github.com/measure-sh/measure/compare/ios-v0.8.1..ios-v0.9.0
[ios-v0.8.1]: https://github.com/measure-sh/measure/compare/ios-v0.8.0..ios-v0.8.1
[ios-v0.8.0]: https://github.com/measure-sh/measure/compare/ios-v0.7.1..ios-v0.8.0
[ios-v0.7.1]: https://github.com/measure-sh/measure/compare/ios-v0.7.0..ios-v0.7.1
[ios-v0.7.0]: https://github.com/measure-sh/measure/compare/ios-v0.6.0..ios-v0.7.0
[ios-v0.6.0]: https://github.com/measure-sh/measure/compare/ios-v0.5.1..ios-v0.6.0
[ios-v0.5.1]: https://github.com/measure-sh/measure/compare/ios-v0.5.0..ios-v0.5.1
[ios-v0.5.0]: https://github.com/measure-sh/measure/compare/ios-v0.4.0..ios-v0.5.0
[ios-v0.4.0]: https://github.com/measure-sh/measure/compare/ios-v0.3.1..ios-v0.4.0
[ios-v0.3.1]: https://github.com/measure-sh/measure/compare/ios-v0.3.0..ios-v0.3.1
[ios-v0.3.0]: https://github.com/measure-sh/measure/compare/ios-v0.2.0..ios-v0.3.0
[ios-v0.2.0]: https://github.com/measure-sh/measure/compare/ios-v0.1.0..ios-v0.2.0

