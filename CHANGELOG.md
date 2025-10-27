# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### :bug: Bug fixes

- (**backend**): Avoid panic when uploading some attachments (#2830) by @detj in #2830
- (**backend**): Enable ScreenView sequential chaining in journey (#2826) by @abhaysood in #2826
- (**backend**): Update measure logo url in email template by @anupcowkur in #2803

### :hammer: Misc

- (**frontend**): Fix landing header button spacing for mobile by @anupcowkur in #2818
- (**frontend**): Reset posthog on redirect to login by @anupcowkur in #2817
- (**frontend**): Make "cloud" -> "Cloud" in alpha disclaimer by @anupcowkur in #2797

### :books: Documentation

- (**backend**): Update self host guide with updated nginx config info (#2821) by @detj in #2821
- (**backend**): Improve messaging (#2819) by @detj in #2819
- (**backend**): Update contribution guide (#2813) by @detj in #2813
- (**backend**): Improve slack integration guide (#2809) by @detj in #2809

## [0.9.0] - 2025-10-22

### :sparkles: New features

- (**backend**): Implement slack alerts by @anupcowkur in #2646
- (**backend**): Make the project compatible for cloud deployment (#2608) by @detj in #2608
- (**backend**): Add ability to set custom email domain by @anupcowkur in #2465
- (**backend**): Use screen view events to build journey (#2460) by @abhaysood in #2460

### :bug: Bug fixes

- (**backend**): Fix google login for some users (#2795) by @detj in #2795
- (**backend**): Drop and recreate public schema after successful migration (#2750) by @detj in #2750
- (**backend**): Grant sufficient permissions to clickhouse role (#2735) by @detj in #2735
- (**backend**): Cloud fix symbolication (#2733) by @detj in #2733
- (**backend**): Improve concurrency safety of attachment upload operation (#2729) by @detj in #2729
- (**backend**): Grant appropriate permissions for cleanup service (#2720) by @detj in #2720
- (**backend**): Show first available user ID in session timeline by @anupcowkur in #2648
- (**backend**): Correctly load lifecycle app and fragment events (#2638) by @abhaysood in #2638
- (**backend**): Insert metrics asynchronously (#2613) by @detj in #2613
- (**backend**): Update builds upload endpoint in sessionator (#2612) by @detj in #2612
- (**frontend**): Fix journey crash when no nodes found while search text filtering by @anupcowkur in #2650
- (**frontend**): Fix typo by @anupcowkur in #2595
- (**frontend**): Update span display to accomodate large values by @anupcowkur in #2527
- (**frontend**): Prevent span cutoff by @anupcowkur in #2483
- (**frontend**): Select timeline event even when no graph is present by @anupcowkur in #2482
- (**frontend**): Add tick rotation to fix overview sessions vs exceptions graph date overlap by @anupcowkur in #2458

### :hammer: Misc

- (**backend**): Make alerts compatible with cloud (#2783) by @detj in #2783
- (**backend**): Expose posthog environment variables so they become accessible (#2766) by @detj in #2766
- (**backend**): Add smtp related env vars for upgrading users (#2765) by @detj in #2765
- (**backend**): Add newly added slack & posthog env vars (#2761) by @detj in #2761
- (**backend**): Improve clickhouse settings for ingestion (#2749) by @detj in #2749
- (**backend**): Only deploy on staging on backend changes (#2748) by @detj in #2748
- (**backend**): Return attachment URLs for already seen requests (#2746) by @abhaysood in #2746
- (**backend**): Improve symbolicator error logging (#2740) by @abhaysood in #2740
- (**backend**): Make slack creds prompt optional by @anupcowkur in #2739
- (**backend**): Add option to wait for build processing in sessionator (#2738) by @detj in #2738
- (**backend**): Remove unused variable for dashboard service (#2722) by @detj in #2722
- (**backend**): Support json events request (#2710) by @abhaysood in #2710
- (**backend**): Fix postgres connection for all services (#2717) by @detj in #2717
- (**backend**): Pin go version for all services (#2715) by @detj in #2715
- (**backend**): Use go 1.25.0-alpine for api service (#2713) by @detj in #2713
- (**backend**): Implement an allowlist for filtering authentication (#2711) by @detj in #2711
- (**backend**): Dispatch deploy on main push (#2699) by @detj in #2699
- (**backend**): Use attachments for json layout snapshots by @anupcowkur in #2698
- (**backend**): Implement json layout snapshots by @anupcowkur in #2675
- (**backend**): Improve scaling by incorporating learnings from load tests (#2668) by @detj in #2668
- (**backend**): Update daily summary email schedule & header by @anupcowkur in #2622
- (**backend**): Check for alerts at start of every hour by @anupcowkur in #2621
- (**backend**): Implement metering by @anupcowkur in #2591
- (**backend**): Ingest session start event (#2581) by @abhaysood in #2581
- (**backend**): Drop crash + anr groups tables from postgres by @anupcowkur in #2452
- (**backend**): Implement alerts by @anupcowkur in #2418
- (**deps**): Bump form-data from 4.0.2 to 4.0.4 in /frontend/dashboard (#2636) by @dependabot[bot] in #2636
- (**deps**): Bump github.com/ulikunitz/xz in /self-host/sessionator (#2635) by @dependabot[bot] in #2635
- (**frontend**): Update measure logos in website and email by @anupcowkur in #2794
- (**frontend**): Remove console error log by @anupcowkur in #2760
- (**frontend**): Hide cloud actions + messaging in self host by @anupcowkur in #2759
- (**frontend**): Add posthog for analytics and error tracking by @anupcowkur in #2743
- (**frontend**): Update landing copy by @anupcowkur in #2732
- (**frontend**): Update landing & auth pages by @anupcowkur in #2731
- (**frontend**): Always show login button on dashboard homepage (#2708) by @detj in #2708
- (**frontend**): Show api level for Android in crash & anr distribution plots by @anupcowkur in #2596
- (**frontend**): Update milis to human readable display format by @anupcowkur in #2529
- (**frontend**): Improve os name & version display formatting by @anupcowkur in #2500
- (**frontend**): Remove "v" prefix from app version by @anupcowkur in #2499

### :coffin: Removed

- (**backend**): Remove fly deploy (#2721) by @detj in #2721

### :books: Documentation

- (**backend**): Improve slack integration guide (#2791) by @detj in #2791
- (**backend**): Update self host guide (#2764) by @detj in #2764
- (**backend**): Update contribution guide (#2763) by @detj in #2763
- (**backend**): Fix typo and format slack guide (#2736) by @detj in #2736
- (**backend**): Update slack docs by @anupcowkur in #2647
- (**backend**): Update sessionator example config (#2615) by @detj in #2615
- (**backend**): Add faq on updating environment variables (#2484) by @detj in #2484
- Document attribute key restrictions (#2485) by @detj in #2485
- Update configuration options documentation (#2446) by @abhaysood in #2446

## [0.8.2] - 2025-07-22

### :hammer: Misc

- (**backend**): Brand team invite, removal & role change emails by @anupcowkur in #2422
- (**frontend**): Update landing page videos & flutter availability by @anupcowkur in #2431
- Ignore flutter tags in cliff config (#2440) by @detj in #2440
- Revert unwanted changes to root changelog (#2439) by @detj in #2439

### :books: Documentation

- Update README with flutter support inclusion by @anupcowkur in #2441
- Update README with new feature videos by @anupcowkur in #2432

## [0.8.1] - 2025-07-15

### :bug: Bug fixes

- (**backend**): Builds api would fail when no mappings present (#2420) by @detj in #2420

### :hammer: Misc

- (**backend**): Upgrade to orhun/git-cliff-action@v4 (#2417) by @detj in #2417

## [0.8.0] - 2025-07-15

### :sparkles: New features

- (**backend**): Support error in ios handled exceptions by @detj
- (**backend**): Add flutter exception symbolication (#2166) by @abhaysood in #2166
- (**backend**): Implement email invites by @anupcowkur in #2091
- (**frontend**): Show ios handled exceptions in session timeline by @detj in #2314
- (**frontend**): Update charts UIs by @anupcowkur in #2178
- (**frontend**): Add collapsible sidebar with submenus by @anupcowkur in #2148
- (**frontend**): Show profile pic of logged in user by @anupcowkur in #2115
- (**frontend**): Show logged in user avatar by @anupcowkur in #2110

### :bug: Bug fixes

- (**backend**): Members were not ordered in a predictable manner (#2246) by @detj in #2246
- (**backend**): Validate & sort by os specific versioning (#2240) by @detj in #2240
- (**backend**): Remove unwanted warning on sessionator record (#2231) by @detj in #2231
- (**backend**): Metrics fetch would fail sometimes (#2191) by @detj in #2191
- (**backend**): Auto rotate compose logs (#2112) by @detj in #2112
- (**backend**): Check user & member role in team member removal, role change, invite resend & invite revoke by @anupcowkur in #2103
- (**backend**): Prevent removal or role change of member in their default team by @anupcowkur in #2071
- (**backend**): Get own team correctly when user is owner of multiple teams by @anupcowkur in #2069
- (**frontend**): Check window before accessing persisted filters by @anupcowkur in #2284
- (**frontend**): Show google login after nonce calculation by @anupcowkur in #2283
- (**frontend**): Fix sidebar inset padding by @anupcowkur in #2224
- (**frontend**): Fix misaligned chevron in dropdown select by @anupcowkur in #2222
- (**frontend**): Fixes selected app version not updating correctly by @anupcowkur in #2190
- (**frontend**): Update member roles after role change by @anupcowkur in #2176
- (**frontend**): Fix tooltip chevron colour by @anupcowkur in #2174
- (**frontend**): Fix sidebar colour by @anupcowkur in #2172
- (**frontend**): Allow concurrent GET requests by @anupcowkur in #2168
- (**frontend**): Fix infinite loop in dropdown select by @anupcowkur in #2163
- (**frontend**): Fix incorrect parsing of url filters by @anupcowkur in #2150
- (**frontend**): Fix error on app name change by @anupcowkur in #2149
- (**frontend**): Add missing css semicolons by @anupcowkur in #2129
- (**frontend**): Fix metadata for social preview links by @anupcowkur in #2122
- (**frontend**): Select first root span available if url span invalid by @anupcowkur in #2119
- (**frontend**): Update filters on ready state change by @anupcowkur in #2116
- (**frontend**): Relaxes cookie restricitions in dev by @anupcowkur in #2096
- (**frontend**): Improve teams error UI on change role & remove member errors by @anupcowkur in #2072
- (**frontend**): Filters not updating on no data/not onboarded states by @anupcowkur in #2066

### :hammer: Misc

- (**backend**): Modify production dashboard compose (#2410) by @detj in #2410
- (**backend**): Reverse proxy all dashbaord apis using nextjs rewrites (#2406) by @detj in #2406
- (**backend**): Update sessionator clean commands by @anupcowkur in #2352
- (**backend**): Add versioning column for bug reports table by @anupcowkur in #2332
- (**backend**): Handle empty dir cases in sessionator (#2329) by @detj in #2329
- (**backend**): Move crash + anr groups to clickhouse by @anupcowkur in #2323
- (**backend**): Improve workflow security (#2255) by @detj in #2255
- (**backend**): Remove unused ios session data (#2254) by @detj in #2254
- (**backend**): Upgrade go dependencies (#2252) by @detj in #2252
- (**backend**): Remove "Own Team Id" from access token by @anupcowkur in #2121
- (**backend**): Delete stale auth sessions in cleanup by @anupcowkur in #2120
- (**backend**): Use cookies to store access + refresh tokens by @anupcowkur in #2064
- (**deps**): Bump golang.org/x/net from 0.37.0 to 0.38.0 in /backend/api (#2127) by @dependabot[bot] in #2127
- (**deps**): Bump golang.org/x/net in /backend/cleanup (#2126) by @dependabot[bot] in #2126
- (**deps**): Bump golang.org/x/net in /self-host/sessionator (#2124) by @dependabot[bot] in #2124
- (**frontend**): Use circle checkbox for multi select dropdown for clearer selected state differentiation by @anupcowkur in #2335
- (**frontend**): Save journey type as part of url by @anupcowkur in #2330
- (**frontend**): Fix typo in bug reports search placeholder by @anupcowkur in #2296
- (**frontend**): Replace journey with sessions graph in overview by @anupcowkur in #2291
- (**frontend**): Organise imports by @anupcowkur in #2281
- (**frontend**): Update positive toast text copy by @anupcowkur in #2280
- (**frontend**): Select new team on team create by @anupcowkur in #2279
- (**frontend**): Show toast on team name change by @anupcowkur in #2278
- (**frontend**): Adjust apps and teams pages UIs by @anupcowkur in #2275
- (**frontend**): Move team creation to dialog by @anupcowkur in #2273
- (**frontend**): Update loading and error states by @anupcowkur in #2265
- (**frontend**): Use loading spinner instead of loading text by @anupcowkur in #2263
- (**frontend**): Move app creation to dialog flow by @anupcowkur in #2261
- (**frontend**): Update integration guide link by @anupcowkur in #2251
- (**frontend**): Update apps page UI by @anupcowkur in #2248
- (**frontend**): Update session mem & cpu graphs by @anupcowkur in #2245
- (**frontend**): Update apps page ui with better section differentiation by @anupcowkur in #2243
- (**frontend**): Reduce loading spinner size by @anupcowkur in #2239
- (**frontend**): Avoid page reload on app name change by @anupcowkur in #2237
- (**frontend**): Avoid table reload during members, roles & invites updates in team page by @anupcowkur in #2236
- (**frontend**): Remove redundant 'rounded-md' in buttons by @anupcowkur in #2233
- (**frontend**): Update teams page UI by @anupcowkur in #2227
- (**frontend**): Add toasts by @anupcowkur in #2226
- (**frontend**): Update positive & negative toast variants by @anupcowkur in #2225
- (**frontend**): Use new alert dialogs and toasts by @anupcowkur in #2211
- (**frontend**): Make table rows links by @anupcowkur in #2208
- (**frontend**): Make metrics card larger in small screens by @anupcowkur in #2206
- (**frontend**): Update metrics UI by @anupcowkur in #2192
- (**frontend**): Update stacktrace bg + line height by @anupcowkur in #2185
- (**frontend**): Update table UIs by @anupcowkur in #2182
- (**frontend**): Update stack trace UI by @anupcowkur in #2180
- (**frontend**): Standardise buttons, links, inputs using Button component and standard styles by @anupcowkur in #2165
- (**frontend**): Update filter pills ui by @anupcowkur in #2162
- (**frontend**): Show filters focus ring only on keyboard nav by @anupcowkur in #2160
- (**frontend**): Update filters ui by @anupcowkur in #2159
- (**frontend**): Use Button component in sidebar by @anupcowkur in #2158
- (**frontend**): Update social preview links metadata by @anupcowkur in #2125
- (**frontend**): Move gsi client script inside google-sign-in component by @anupcowkur in #2123

### :books: Documentation

- (**backend**): Fix incorrect command in contributing guide (#2414) by @detj in #2414
- (**backend**): Add smtp configuration to self host guide (#2412) by @detj in #2412
- (**backend**): Update sdk api documentation by @detj
- (**backend**): Update clickhouse migration docs (#2264) by @detj in #2264
- (**backend**): Add low memory note for podman on macos (#2169) by @detj in #2169
- (**backend**): Add faq for nginx conf in self host guide (#2146) by @detj in #2146
- (**backend**): Update self host guide (#2139) by @detj in #2139
- (**backend**): Add banner in contributing (#2101) by @detj in #2101
- Improve SDK documentation (#2256) by @abhaysood in #2256
- Format sdk api docs (#2144) by @detj in #2144
- Add a faqs page in docs (#2141) by @detj in #2141
- Remove defunct command from contribution guide (#2137) by @detj in #2137
- Update github-oauth.md (#2131) by @DominatorVbN in #2131

## [0.7.0] - 2025-04-15

### :sparkles: New features

- (**frontend**): Handle nav link clicks on same page by @anupcowkur in #2033
- (**frontend**): Update iOS availability on landing page by @anupcowkur in #2006
- (**frontend**): Update landing page with bug reports feature by @anupcowkur in #2003

### :bug: Bug fixes

- (**backend**): Add podman support (#2055) by @detj in #2055

### :hammer: Misc

- (**frontend**): Refactor auth utils to MeasureAuth by @anupcowkur in #2054
- (**frontend**): Save page state using urls by @anupcowkur in #2031

### :books: Documentation

- Update sdk api readme (#2045) by @adwinross in #2045
- Update bug reports feature video from mov to webm by @anupcowkur in #2016
- Update iOS availability in README by @anupcowkur in #2015
- Update README with bug reports feature by @anupcowkur in #2005

## [0.6.1] - 2025-03-28

### :bug: Bug fixes

- (**backend**): Broken builds api for older android sdks (#1984) by @detj in #1984

## [0.6.0] - 2025-03-27

### :sparkles: New features

- (**backend**): Symbolicate ttid span classes (#1947) by @detj in #1947
- (**backend**): Integrate new cross-platform symbolicator with ios support (#1800) by @detj in #1800
- (**backend**): Implement bug reports by @anupcowkur in #1815
- (**backend**): Add user defined attrs to spans by @anupcowkur in #1788
- (**backend**): Support dsym mapping type in sessionator (#1774) by @detj in #1774
- (**backend**): Add support for iOS exceptions (#1726) by @detj in #1726
- (**frontend**): Update bug report details desc text size by @anupcowkur in #1856
- (**frontend**): Adjust bug report table text sizes by @anupcowkur in #1855
- (**frontend**): Update website description by @anupcowkur in #1846
- (**frontend**): Show bug reports in session timeline by @anupcowkur in #1833
- (**frontend**): Show user def attrs in bug report details by @anupcowkur in #1832
- (**frontend**): Add build number to session replay attr display by @anupcowkur in #1831
- (**frontend**): Match bug report attr display style with others by @anupcowkur in #1830
- (**frontend**): Rename button to "Close/Re-Open Bug Report" by @anupcowkur in #1828
- (**frontend**): None selection option in filters dropdown by @vunder in #1752
- (**frontend**): Implement ud attr filters by @anupcowkur in #1739
- (**frontend**): Add discord support link to dashboard nav by @anupcowkur in #1715

### :bug: Bug fixes

- (**backend**): Incorrect data backfill script (#1978) by @detj in #1978
- (**backend**): Mismatch and duplicate sessions (#1974) by @detj in #1974
- (**backend**): Filter duplicate ud attribute keys (#1967) by @detj in #1967
- (**backend**): Broken session pagination with user defined attrs (#1948) by @detj in #1948
- (**backend**): Anr exception type was not symbolicated (#1944) by @detj in #1944
- (**backend**): Remove mapping file size validation (#1935) by @detj in #1935
- (**backend**): Fix partial android symbolication (#1933) by @detj in #1933
- (**backend**): Fix a panic during anr symbolication (#1927) by @detj in #1927
- (**backend**): Fix issue with sessionator clean-all flag (#1924) by @detj in #1924
- (**backend**): Fixed an issue where clock_speed validation was failing for iOS (#1907) by @detj in #1907
- (**backend**): Fix errors in sessionator record & ingest (#1902) by @detj in #1902
- (**backend**): Codeql integer conversion error (#1897) by @detj in #1897
- (**backend**): Sessionator would fail deleting objects (#1891) by @detj in #1891
- (**backend**): Svg layout attachments are not visible sometimes (#1777) by @detj in #1777
- (**backend**): Clean up event batches stuck for a long time (#1770) by @detj in #1770
- (**backend**): Only apply span statuses where clause if available by @anupcowkur in #1764
- (**backend**): Query all user defined attributes (#1738) by @detj in #1738
- (**frontend**): Improve crash display for ios (#1916) by @detj in #1916
- (**frontend**): Handle session timeline with no events by @anupcowkur in #1898
- (**frontend**): Handle no events selected case in session timeline by @anupcowkur in #1836
- (**frontend**): Make user def attr dropdown stay in viewport by @anupcowkur in #1784
- (**frontend**): Hide filter pill when no span statuses are selected by @anupcowkur in #1765
- (**frontend**): Set default session type to All by @anupcowkur in #1746

### :hammer: Misc

- (**backend**): Add data backfill for upcoming release (#1977) by @detj in #1977
- (**backend**): Change compose command detection logic (#1962) by @detj in #1962
- (**backend**): Update migration script for seamless migration (#1937) by @detj in #1937
- (**backend**): Support .dylib mapping files in ios (#1914) by @detj in #1914
- (**backend**): Send attachments for more gesture events by @detj
- (**backend**): Clean more resources in sessionator (#1899) by @detj in #1899
- (**backend**): Update go deps (#1896) by @detj in #1896
- (**backend**): Update go toolchain version (#1894) by @detj in #1894
- (**backend**): Update ci changelog (#1893) by @detj in #1893
- (**backend**): Rename span api endpoints for consistency by @anupcowkur in #1864
- (**backend**): Refactor event, attachment & span cleanup by @anupcowkur in #1861
- (**backend**): Cleanup stale bug reports by @anupcowkur in #1839
- (**backend**): Tidy sessionator `go.mod` (#1776) by @detj in #1776
- (**backend**): Add sessionator data (#1772) by @adwinross in #1772
- (**backend**): Add lifecycle app type for ios (#1767) by @detj in #1767
- (**backend**): Add `--skip-apps` option (#1744) by @detj in #1744
- (**backend**): Replace email with new user login log by @anupcowkur in #1719
- (**backend**): Sync `go.work.sync` (#1717) by @detj in #1717
- (**backend**): Update go dependencies (#1716) by @detj in #1716
- (**backend**): Update dependencies (#1714) by @detj in #1714
- (**backend**): Log email instead of sending to waitlist by @anupcowkur in #1712
- (**backend**): Support `flutter` & `rn` in cliff config (#1705) by @detj in #1705
- (**backend**): Add new scopes to commitlint (#1703) by @detj in #1703
- (**deps**): Bump github.com/golang-jwt/jwt/v5 in /backend/api (#1964) by @dependabot[bot] in #1964
- (**deps**): Bump cross-spawn from 7.0.3 to 7.0.6 in /frontend/dashboard (#1711) by @dependabot[bot] in #1711
- (**deps**): Bump next from 14.2.13 to 14.2.22 in /frontend/dashboard (#1710) by @dependabot[bot] in #1710
- (**deps**): Bump nanoid from 3.3.7 to 3.3.8 in /frontend/dashboard (#1708) by @dependabot[bot] in #1708
- (**deps**): Bump golang.org/x/crypto in /backend/cleanup (#1707) by @dependabot[bot] in #1707
- (**deps**): Bump golang.org/x/crypto in /backend/api (#1701) by @dependabot[bot] in #1701
- (**frontend**): Update next js to 14.2.26 by @anupcowkur in #1966
- (**frontend**): Render attachments for more gesture events by @detj in #1910
- (**frontend**): Refactor FiltersApiType to FilterSource by @anupcowkur in #1883
- (**frontend**): Upgrade to nivo 0.88 by @anupcowkur in #1880
- (**frontend**): Update to tailwind 4.0 with dashboard container file sync by @anupcowkur in #1870
- (**frontend**): Change font-sans to font-body by @anupcowkur in #1862
- (**frontend**): Refactor details link fetch in session timeline event details by @anupcowkur in #1860
- (**frontend**): Rename session 'replay' to 'timeline' by @anupcowkur in #1859
- (**frontend**): Remove 'font-regular' by @anupcowkur in #1858
- (**frontend**): Rename font variables by @anupcowkur in #1845
- (**frontend**): Add .node-version by @anupcowkur in #1818
- (**frontend**): Update iOS lifecycle events display name by @anupcowkur in #1766
- (**frontend**): Rename "None" to "Clear" by @anupcowkur in #1762
- (**frontend**): Allow unchecking last item in dropdown select if "None" is available by @anupcowkur in #1760
- (**frontend**): Remove "None" for app version selection by @anupcowkur in #1757
- (**frontend**): Update landing page + readme with perf traces by @anupcowkur in #1697
- Add wikipedia sessionator data (#1936) by @adwinross in #1936
- Add wikipedia sessionator data (#1929) by @adwinross in #1929
- Add sessionator data (#1911) by @adwinross in #1911
- Add sessionator data (#1908) by @adwinross in #1908
- Improve automated changelog formatting (#1706) by @detj in #1706

### :books: Documentation

- (**backend**): Update sdk api docs (#1918) by @detj in #1918
- (**backend**): Improve self hosting faq section (#1728) by @detj in #1728
- (**backend**): Address clickhouse high cpu usage (#1727) by @detj in #1727
- Update sdk readme (#1118) by @adwinross in #1118
- Update readme by @anupcowkur in #1699
- (**readme**): Update banner image by @gandharva in #1768

## [0.5.0] - 2025-01-06

### :sparkles: New features

- (**backend**): Show traces in session timeline by @anupcowkur in #1643
- (**backend**): Ios session timeline (#1624) by @detj in #1624
- (**backend**): Support ios event ingestion (#1587) by @detj in #1587
- (**backend**): Add span support by @anupcowkur in #1559
- (**backend**): Support custom events (#1554) by @detj in #1554
- (**backend**): Support user defined attributes (#1529) by @detj in #1529
- (**frontend**): Add memory usage absolute plot in session timeline (#1625) by @detj in #1625
- (**frontend**): Make whole checkbox container clickable in dropdown select component by @anupcowkur in #1584
- (**frontend**): Show user defined attrs in session timeline by @anupcowkur in #1567

### :bug: Bug fixes

- (**backend**): Log extra info during ingestion failure (#1686) by @detj in #1686
- (**backend**): Duplicate sessions shown in sessions overview (#1668) by @detj in #1668
- (**backend**): Nil pointer dereference in remove apps (#1654) by @detj in #1654
- (**backend**): Dashboard no longer depends on api service (#1653) by @detj in #1653
- (**backend**): Handle large numbers in user defined attributes gracefully (#1644) by @detj in #1644
- (**backend**): Add session id to free text search by @anupcowkur in #1646
- (**backend**): Sessionator ingestion failure (#1622) by @detj in #1622
- (**backend**): Handle checkpoint parsing in GetTrace by @anupcowkur in #1606
- (**backend**): Unexpected shortcodes gets created sometimes (#1603) by @detj in #1603
- (**backend**): Improve ios support (#1599) by @detj in #1599
- (**backend**): Format checkpoints for ingestion by @anupcowkur in #1593
- (**backend**): Make span name query param by @anupcowkur in #1591
- (**backend**): Validate required event & span attributes (#1590) by @detj in #1590
- (**backend**): Discard batch if it contains duplicate event or span ids (#1588) by @detj in #1588
- (**backend**): Filter versions and os versions securely (#1563) by @detj in #1563
- (**frontend**): Handle incorrect http event display in session timeline by @anupcowkur in #1684
- (**frontend**): Show memory usage in mbs in session timeline (#1679) by @detj in #1679
- (**frontend**): Made api key input read only to fix warnings (#1657) by @detj in #1657
- (**frontend**): Check onboarding status after filters api call by @anupcowkur in #1640
- (**frontend**): Fix span sorting & null checkpoints handling by @anupcowkur in #1609
- (**frontend**): Place span durations above bar by @anupcowkur in #1604
- (**frontend**): Retain overflowing span name bg color by @anupcowkur in #1601
- (**frontend**): Round millis to nearest int by @anupcowkur in #1582
- (**frontend**): Fix root span names api call by @anupcowkur in #1571
- (**frontend**): Handle empty user_defined_attrs in session timeline by @anupcowkur in #1569
- (**frontend**): Don't update filters on selectedApp change by @anupcowkur in #1558

### :hammer: Misc

- (**backend**): Remove unneeded log lines (#1687) by @detj in #1687
- (**backend**): Update user defined attributes sample session by @abhaysood in #1666
- (**backend**): Cleanup expired resources (#1655) by @detj in #1655
- (**backend**): Remove all app resources in sessionator (#1647) by @detj in #1647
- (**backend**): Update sessionator example config (#1632) by @detj in #1632
- (**backend**): Add new sessions by @abhaysood in #1405
- (**backend**): Add span limits by @anupcowkur in #1611
- (**backend**): Revert deletion of session data with spans by @abhaysood in #1573
- (**backend**): Support layout_snapshot attachments for gesture click by @abhaysood
- (**backend**): Made span queries secure (#1566) by @detj in #1566
- (**backend**): Update sessionator deps (#1553) by @detj in #1553
- (**backend**): Remove unused code (#1545) by @detj in #1545
- (**backend**): Add sample sessions by @abhaysood in #1525
- (**backend**): Ingest low power and thermal throttling attributes by @abhaysood
- (**frontend**): Remove "|| null" from empty metrics sample by @anupcowkur in #1693
- (**frontend**): Remove old journey code by @anupcowkur in #1688
- (**frontend**): Remove clarity by @anupcowkur in #1650
- (**frontend**): Clear span statuses in filters by @anupcowkur in #1641
- (**frontend**): Improve custom event ui in session timeline by @anupcowkur in #1618
- (**frontend**): Improve user def attrs spacing by @anupcowkur in #1617
- (**frontend**): Adjust dropdown select popup position & width by @anupcowkur in #1610
- (**frontend**): Remove cursor pointer style by @anupcowkur in #1585
- (**frontend**): Support attachments for gesture click by @abhaysood in #1551
- (**frontend**): Truncate class names in session timeline event titles by @anupcowkur in #1570
- (**frontend**): Delete unused url filters code by @anupcowkur in #1565

### :recycle: Refactor

- (**backend**): Use aws-sdk-go-v2 for object uploads (#1675) by @detj in #1675

### :books: Documentation

- (**backend**): Document short filters api (#1552) by @detj in #1552
- (**backend**): Document rename app api (#1547) by @detj in #1547

## [0.4.1] - 2024-11-11

### :bug: Bug fixes

- (**backend**): Use specific clickhouse image version (#1517) by @detj in #1517

### :books: Documentation

- (**backend**): Fix typos and missing info (#1513) by @detj in #1513

## [0.4.0] - 2024-11-07

### :sparkles: New features

- (**backend**): Use short codes for list filters by @anupcowkur in #1476

### :bug: Bug fixes

- (**backend**): Validate limit to not be zero (#1500) by @detj in #1500
- (**backend**): Incorrect pagination when no data (#1499) by @detj in #1499
- (**backend**): Optimize session detail apis and overall loading experience (#1490) by @detj in #1490
- (**frontend**): Handle no data case for sessions list by @anupcowkur in #1496
- (**frontend**): Truncate matched free text by @anupcowkur in #1494
- (**frontend**): Better pagination in session detail (#1491) by @detj in #1491
- (**frontend**): Handle empty attr distributions by @anupcowkur in #1488

### :hammer: Misc

- (**backend**): Add migration guide & script for next version (#1512) by @detj in #1512
- (**backend**): Remove backfilling migrations (#1511) by @detj in #1511
- (**backend**): Change postgres compose config (#1509) by @detj in #1509
- (**backend**): Change index type in sessions table (#1505) by @detj in #1505
- (**backend**): Add skip indexes for sessions table (#1492) by @detj in #1492
- (**frontend**): Set default session type filter to all issues by @anupcowkur in #1481
- (**frontend**): Update landing page exceptions video by @anupcowkur in #1473
- (**frontend**): Standardise paginator UI by @anupcowkur in #1472
- (**frontend**): Cancel in-flight requests by @anupcowkur in #1470
- (**frontend**): Update exceptions landing video by @anupcowkur in #1465

### :books: Documentation

- (**backend**): Document sessions overview list api (#1502) by @detj in #1502
- Update exceptions demo video in README by @anupcowkur in #1474
- Update exceptions demo video in README by @anupcowkur in #1466

## [0.3.0] - 2024-11-01

### :sparkles: New features

- (**frontend**): Replace exception detail journey with attr distribution plot by @anupcowkur in #1463
- (**frontend**): Add new UI for session replay by @anupcowkur in #1389
- (**frontend**): Persist paginator on master detail nav by @anupcowkur in #1373
- (**frontend**): Add search bar to dropdown component by @anupcowkur in #1370
- (**frontend**): Use sankey graphs for journeys by @anupcowkur in #1343
- (**frontend**): Add filters to urls by @anupcowkur in #1322

### :bug: Bug fixes

- (**backend**): Improve crash/anr detail experience (#1451) by @detj in #1451
- (**backend**): Improve dashboard api response times (#1404) by @detj in #1404
- (**backend**): Occasional runtime panic during ingestion (#1345) by @detj in #1345
- (**backend**): Increase app version character limit (#1342) by @detj in #1342
- (**backend**): Increase thread name character limit (#1341) by @detj in #1341
- (**backend**): Prevent duplicate ingestion of events (#1331) by @detj in #1331
- (**backend**): Improve security posture (#1303) by @detj in #1303
- (**frontend**): Crash detail not showing id (#1453) by @detj in #1453
- (**frontend**): Hot launch metric was incorrectly showing warm launch metric (#1448) by @detj in #1448
- (**frontend**): Some dashboard apis were failing due to lack of url encoding (#1449) by @detj in #1449
- (**frontend**): Handle empty mem/cpu graph in session replay by @anupcowkur in #1436
- (**frontend**): Calculate time diff b/w filtered events by @anupcowkur in #1381
- (**frontend**): Fix nav aside scroll on detail content exceeding screen area by @anupcowkur in #1366
- (**frontend**): Handle empty file/method name by @anupcowkur in #1364
- (**frontend**): Handle empty file/method name for crashes/anrs by @anupcowkur in #1357
- (**frontend**): Limit height of dropdown component by @anupcowkur in #1356
- (**frontend**): Improve exception/anr details plot ui by @anupcowkur in #1350
- (**frontend**): Disable appending filters to URLs by @anupcowkur in #1348
- (**frontend**): Update app name on selected app change by @anupcowkur in #1347
- (**frontend**): Improve security posture (#1305) by @detj in #1305

### :hammer: Misc

- (**backend**): Remove deprecated cliff feature (#1462) by @detj in #1462
- (**backend**): Apply suitable restart policy (#1458) by @detj in #1458
- (**backend**): Add data skipping indexes for fingerprints (#1455) by @detj in #1455
- (**backend**): Prevent db statement leaks (#1318) by @detj in #1318
- (**backend**): Search sessions by screen view by @abhaysood in #1265
- (**backend**): Integrate screen view event with session replay by @abhaysood
- (**backend**): Ingest screen view event by @abhaysood
- (**backend**): Add screen view sample sessions by @abhaysood
- (**frontend**): Improve exception details loading state by @anupcowkur in #1435
- (**frontend**): Update default time filter to last 6 hours by @anupcowkur in #1434
- (**frontend**): Update landing page videos by @anupcowkur in #1412
- (**frontend**): Add loading states by @anupcowkur in #1377
- (**frontend**): Remove legends & add versions in tooltips to exception & sessions overview plots by @anupcowkur in #1374
- (**frontend**): Add loading spinners for plot components by @anupcowkur in #1359
- (**frontend**): Go directly to dashboard if logged in by @anupcowkur in #1355

### :books: Documentation

- (**backend**): Update incorrect json key name (#1363) by @detj in #1363
- Improve spelling in readme (#1460) by @detj in #1460
- Add videos to README by @anupcowkur in #1413
- Add call to action for star to README by @gandharva in #1401

## [0.2.1] - 2024-09-25

### :bug: Bug fixes

- (**backend**): Crash/anr details instances plot won't load sometimes (#1298) by @detj in #1298
- (**frontend**): Add option to handle no data & not onboarded in filters by @anupcowkur in #1299

### :books: Documentation

- Update release one liner command (#1294) by @detj in #1294

## [0.2.0] - 2024-09-24

### :sparkles: New features

- (**backend**): Update warm launch schema and duration calculation by @abhaysood
- (**backend**): Track email on new user sign in by @anupcowkur in #1270
- (**backend**): Improve session explorer by @anupcowkur in #1218
- (**backend**): Add session explorer with text search filter by @anupcowkur in #1200
- (**frontend**): Add custom error page by @anupcowkur in #1279
- (**frontend**): Add custom 404 page by @anupcowkur in #1276
- (**frontend**): Update tooltips by @anupcowkur in #1266
- (**frontend**): Link to crash/anr details from session replay by @anupcowkur in #1255
- (**frontend**): Add 'Last 6 months' date range option by @anupcowkur in #1252
- (**frontend**): Add detailed filters to crash + anr overview pages by @anupcowkur in #1250
- (**frontend**): Add filter for OS versions by @anupcowkur in #1242
- (**frontend**): Add 'All', 'Latest' options + 'at least 1' enforcement by @anupcowkur in #1238
- (**frontend**): Redesign apps page by @anupcowkur in #1237

### :bug: Bug fixes

- (**backend**): Overview instance plot would not load for some cases (#1288) by @detj in #1288
- (**backend**): Round crash rate metrics to 2 decimal places by @anupcowkur in #1284
- (**backend**): Update warm_launch ingest by @detj
- (**backend**): Set warm launch duration threshold to 10s by @abhaysood
- (**backend**): Use client timezone for plots by @anupcowkur in #1224
- (**backend**): Round crash and anr contribution percentage to 2 decimal places (#1221) by @detj in #1221
- (**backend**): Addressed ingestion failures related to ip inspection (#1197) by @detj in #1197
- (**backend**): Nil pointer dereference when ingesting `low_memory` events (#1190) by @detj in #1190
- (**frontend**): Hide attachment data in session replay event body by @anupcowkur in #1259
- (**frontend**): Only attempt to show attachments for crashes/anrs in sesion replay by @anupcowkur in #1258
- (**frontend**): Add missing useEffect deps for journey by @anupcowkur in #1230
- (**frontend**): Use whole int left axes for crash + anr instances plots by @anupcowkur in #1219

### :hammer: Misc

- (**backend**): Capture more details in otel traces (#1289) by @detj in #1289
- (**backend**): Add new sessions by @abhaysood in #1268
- (**backend**): Remove compose profile by @detj
- (**backend**): Enable sessionator parallel ingest (#1220) by @detj in #1220
- (**backend**): Add os_page_size attribute by @abhaysood in #1211
- (**backend**): Additional log for anomalous cold launch duration (#1199) by @detj in #1199
- (**backend**): Format log line (#1189) by @detj in #1189
- (**backend**): Sessionator `--clean-all` flag (#1187) by @detj in #1187
- (**frontend**): Use selected filters instead of expanded params by @anupcowkur in #1244
- (**frontend**): Fix table column widths and move paginator to top right by @anupcowkur in #1232
- (**frontend**): Refactor filter application to api calls by @anupcowkur in #1229
- (**frontend**): Refactor time utils to have separate functions for human readable datetime, date only and time only by @anupcowkur in #1225

### :books: Documentation

- (**backend**): Add self host upgrade guide (#1291) by @detj in #1291
- (**backend**): Improve sessionator readme (#1188) by @detj in #1188
- Update README.md by @anupcowkur in #1201
- Improved language and formatting for working with databases (#1198) by @detj in #1198
- Update discord link by @anupcowkur in #1169

## [0.1.1] - 2024-08-31

### :bug: Bug fixes

- (**backend**): Handle no selected versions for app journey & metrics by @anupcowkur in #1158

## [0.1.0] - 2024-08-30

### :sparkles: New features

- (**frontend**): Add "Copy AI context" button by @anupcowkur in #1092

### :bug: Bug fixes

- (**backend**): Fix incorrect filter query for crash & anr groups by @anupcowkur in #1153
- (**backend**): Proceed with event ingestion on symbolication failure by @anupcowkur in #1134
- (**backend**): Handle exception/anr groups with no events by @anupcowkur in #1098

### :hammer: Misc

- (**backend**): Reorder & cleanup postgres migrations (#1155) by @detj in #1155
- (**backend**): Remove eventIds array from crash + anr groups by @anupcowkur in #1145
- (**backend**): Fix session data (#1141) by @detj in #1141
- (**frontend**): Remove commented code by @anupcowkur in #1150
- (**frontend**): Update landing hero animation by @anupcowkur in #1095
- Update root `package.json` by @detj

### :books: Documentation

- Add specific types to numbers in SDK API docs by @abhaysood in #1152
- Fix typo in README by @anupcowkur in #1149
- Update self host guide by @detj
- Update contributing guide by @detj
- Add code of conduct by @anupcowkur in #1128
- Add PR template by @anupcowkur in #1125
- Add issue template by @anupcowkur in #1122
- Add feature request template by @anupcowkur in #1124
- Add security policy by @anupcowkur in #1113
- Add discord link to README by @anupcowkur in #1112
- Fix formatting (#1094) by @detj in #1094
- Fix broken link by @detj in #1093
- Update self host guide by @detj
- Improve self host guide by @detj

## [0.0.1] - 2024-08-20

### :sparkles: New features

- (**backend**): Add stale data cleanup service by @anupcowkur
- (**backend**): Improve crash + anr grouping by @anupcowkur in #920
- (**backend**): Add app settings read/write api by @anupcowkur
- (**backend**): Add get usage stats api by @anupcowkur
- (**backend**): Implement new schema for navigation event by @abhaysood
- (**backend**): Migrate to self-hosted postgres by @anupcowkur in #651
- (**backend**): Update alert perfs to be per user per app by @anupcowkur in #647
- (**backend**): Add alert_prefs table with read+write APIs by @anupcowkur
- (**backend**): Support http request and response body by @abhaysood
- (**backend**): Add navigation event by @abhaysood
- (**backend**): Ingest cpu and memory performance metrics by @abhaysood in #258
- (**backend**): Ingest http event by @abhaysood
- (**backend**): Remove http_request and http_response events by @abhaysood
- (**backend**): Ingest device_locale with ANR & exception by @abhaysood in #223
- (**backend**): Ingest device_locale with resource by @abhaysood
- (**backend**): Add network properties to resource by @abhaysood
- (**backend**): Track n/w props for ANR & exception by @abhaysood
- (**backend**): Ingest network change event by @abhaysood
- (**backend**): Ingest cold, warm and hot launch by @abhaysood in #189
- (**backend**): Add new attachment type: android_method_trace by @abhaysood
- (**backend**): Ingest cold launch event (#158) by @abhaysood in #158
- (**backend**): Ingest lifecycle events (#134) by @abhaysood in #134
- (**backend**): Upload session attachments (#124) by @detj in #124
- (**backend**): Implement symbolicator with retrace (#126) by @abhaysood in #126
- (**backend**): Add symbolication (#79) by @detj in #79
- (**webapp**): Enable retention period app setting by @anupcowkur
- (**webapp**): Add date selection presets to filters by @anupcowkur in #968
- (**webapp**): Update exceptions overview list format by @anupcowkur in #937
- (**webapp**): Show title & description for exception groups by @anupcowkur
- (**webapp**): Add base url to apps page by @anupcowkur in #895
- (**webapp**): Add data retention read/write to apps page by @anupcowkur in #891
- (**webapp**): Show usage stats in pie chart by @anupcowkur in #879
- (**webapp**): Add usage stats UI by @anupcowkur in #865
- (**webapp**): Add different colour for handled exceptions in session replay by @anupcowkur in #838
- (**webapp**): Fade out non-path journey nodes on hover by @anupcowkur
- (**webapp**): Hightlight path to hovered node in journey by @anupcowkur in #831
- (**webapp**): Persist selected app & dates filters across pages by @anupcowkur in #806
- (**webapp**): Update navigation event title by @abhaysood
- (**webapp**): Add screenshots to exception details + session events by @anupcowkur in #783
- (**webapp**): Add custom tooltip for crash/anr group details plot by @anupcowkur in #753
- (**webapp**): Update exceptions overview plot with api data by @anupcowkur
- (**webapp**): Add detailed filters support for exception detail journey plot by @anupcowkur in #721
- (**webapp**): Add exception detail journey plot by @anupcowkur in #717
- (**webapp**): Make journey unidirectional by @anupcowkur in #707
- (**webapp**): Update crash/anr group details plot with api data by @anupcowkur in #701
- (**webapp**): Add multi app version select to overview page by @anupcowkur in #697
- (**webapp**): Set journey min zoom by @anupcowkur in #682
- (**webapp**): Add zoom buttons to journey map by @anupcowkur in #681
- (**webapp**): Remove hack to animate title in journey node by @anupcowkur
- (**webapp**): Color journey bg reflecting issue contribution by @anupcowkur
- (**webapp**): Change journey error node & contrib indicator colours by @anupcowkur in #664
- (**webapp**): Update journey ui & data format by @anupcowkur in #660
- (**webapp**): Remove slack from alert prefs UI by @anupcowkur
- (**webapp**): Clear updatePrefsMsg on selected app change by @anupcowkur
- (**webapp**): Integrate alert prefs APIs by @anupcowkur
- (**webapp**): Add slack connect button & status indicator to Alerts UI by @anupcowkur in #589
- (**webapp**): Remove team member & role change alerts UI by @anupcowkur in #588
- (**webapp**): Update checkbox styles by @anupcowkur in #587
- (**webapp**): Add an alerts page to configure notification options by @anupcowkur in #586
- (**webapp**): Improve journey node expansion animation by @anupcowkur in #584
- (**webapp**): Update journey to flow graph in overview page by @anupcowkur in #579
- (**webapp**): Change overview journey to network graph by @anupcowkur
- (**webapp**): Update overview page to show session metrics by @anupcowkur in #559
- (**webapp**): Format session replay timeline event bodies by @anupcowkur in #555
- (**webapp**): Implement version codes in filters by @anupcowkur in #546
- (**webapp**): Change session replay events timeline animation by @anupcowkur in #544
- (**webapp**): Improve session replay event details UI by @anupcowkur in #514
- (**webapp**): Format sesssion replay event titles based on event types by @anupcowkur in #502
- (**webapp**): Format & use localised, readable date times everywhere by @anupcowkur in #491
- (**webapp**): Improve small screen UI for session replay by @anupcowkur in #490
- (**webapp**): Use params to persist and pass around dates by @anupcowkur in #477
- (**webapp**): Add filters to session replay event timeline by @anupcowkur in #476
- (**webapp**): Update session replay event timeline scale by @anupcowkur in #475
- (**webapp**): Add scrolling animations to session replay event timeline by @anupcowkur in #468
- (**webapp**): Show session duration in session replay by @anupcowkur
- (**webapp**): Animate cpu + mem charts in session replay by @anupcowkur
- (**webapp**): Add more event type based colours to session replay timeline by @anupcowkur in #465
- (**webapp**): Add time diff based vertical dividers to session replay event timeline by @anupcowkur
- (**webapp**): Update memory + cpu graphs in session replay by @anupcowkur in #464
- (**webapp**): Change from thread chart to basic event timeline for session replay by @anupcowkur in #462
- (**webapp**): Use millisecond precision for session replay charts by @anupcowkur
- (**webapp**): Implement session replay with API data by @anupcowkur in #454
- (**webapp**): Implement session replay with API data by @anupcowkur
- (**webapp**): Show team creation success dialog in Teams page by @anupcowkur in #443
- (**webapp**): Add create team functionality to Team page by @anupcowkur in #434
- (**webapp**): Improve pagination loading state handling in Crashes + ANRs overview by @anupcowkur in #420
- (**webapp**): Implement ANRs overview and details by @anupcowkur in #416
- (**webapp**): Integrate apps, filters and crash details APIs into Crash Details page by @anupcowkur in #415
- (**webapp**): Use paginated crashes API in Crashes page by @anupcowkur in #395
- (**webapp**): Add pagination to Crashes page by @anupcowkur in #375
- (**webapp**): Update CheckboxDropdown component and select all version filters in Crashes on init by @anupcowkur
- (**webapp**): Update landing page animations by @anupcowkur in #358
- (**webapp**): Fetch crash groups list in Crashes page from API by @anupcowkur in #339
- (**webapp**): Fetch apps+filters from API in Crashes page by @anupcowkur in #303
- (**webapp**): Highlight team, role & member better in Team confirmation dialogs by @anupcowkur
- (**webapp**): Show member email & team name in Team member removal confirmation dialog by @anupcowkur in #288
- (**webapp**): Show member email, old & new roles in Team member role change confirmation dialog by @anupcowkur
- (**webapp**): Include old & new names in Team name change confirmation dialog by @anupcowkur
- (**webapp**): Hide change role & remove user for current user in Team page by @anupcowkur in #276
- (**webapp**): Add ability to remove team members by @anupcowkur
- (**webapp**): Change role using API in Team page by @anupcowkur in #269
- (**webapp**): Fetch authz roles from API and set invite roles dropdown accordingly by @anupcowkur in #259
- (**webapp**): Fetch team members from API by @anupcowkur
- (**webapp**): Handle invite member states - success, error, loading and auth error by @anupcowkur
- (**webapp**): Add team rename feature in Team page by @anupcowkur in #251
- (**webapp**): Add copy API key functionality to CreateApp component & Apps page by @anupcowkur in #247
- (**webapp**): Fetch & display apps from api in Apps page by @anupcowkur in #240
- (**webapp**): Add CreateApp to apps page by @anupcowkur in #238
- (**webapp**): Handle no apps/no data for app cases in Overview page by @anupcowkur
- (**webapp**): Use supabase auth token to make API calls by @anupcowkur
- (**webapp**): Update navigation to use API retrieved app ids by @anupcowkur
- (**webapp**): Fetch overview filters from filters api by @anupcowkur in #207
- (**webapp**): Fetch app launch time overview metrics from API by @anupcowkur in #195
- (**webapp**): Fetch metrics overview data from API by @anupcowkur in #193
- (**webapp**): Fetch user flow data from API in overview page by @anupcowkur in #190
- (**webapp**): Add "Sign-in and sign-up with Google" (#163) by @detj in #163
- (**webapp**): Logout (#153) by @detj in #153
- (**webapp**): Add basic signup/in flow (#150) by @detj in #150

### :bug: Bug fixes

- (**backend**): Google auth (#1022) by @detj in #1022
- (**backend**): Update memory usage struct by @abhaysood
- (**backend**): Remove validation for 0 percentage usage as it's valid value by @abhaysood
- (**backend**): Update app.go with new percwentage_usage field by @abhaysood
- (**backend**): Allow zero interval as it's valid value for first event by @abhaysood
- (**backend**): Ignore cold launch greater than 30s for metrics calculation by @anupcowkur in #942
- (**backend**): Update method comments to match code by @anupcowkur
- (**backend**): Authn issue by @detj
- (**backend**): Handle no teams by @detj
- (**backend**): Anr overview mismatch by @detj in #820
- (**backend**): Exception overview mismatch by @detj
- (**backend**): Anr not found by @detj in #817
- (**backend**): Exception not found by @detj
- (**backend**): Update sesssion replay by @detj
- (**backend**): Incorrect launch metrics delta (#811) by @detj in #811
- (**backend**): Filter using time range by @detj in #804
- (**backend**): Anr overview plot instances by @detj
- (**backend**): Exception overview plot instances by @detj
- (**backend**): Modify anr grouping by @detj
- (**backend**): Update exception groups query by @detj
- (**backend**): Journey grap build (#803) by @detj in #803
- (**backend**): Make from and source optional for navigation event by @abhaysood
- (**backend**): Fix missing fields in session replay by @abhaysood
- (**backend**): Use correct index when iterating exceptions and anrs by @abhaysood in #784
- (**backend**): Fix network type validation by @abhaysood in #775
- (**backend**): Modify session data to use non-nullable network properties by @abhaysood
- (**backend**): Update session replay (#765) by @detj in #765
- (**backend**): Metrics api errorneous 500 (#766) by @detj in #766
- (**backend**): Attachment processing by @detj
- (**backend**): Anr overview plot query by @detj in #750
- (**backend**): Crash overview plot query by @detj
- (**backend**): Response of anr plot by @detj in #705
- (**backend**): Response of crash plot by @detj
- (**backend**): Journey issue count (#679) by @detj in #679
- (**backend**): Format anr stacktrace by @detj
- (**backend**): Modify stacktrace by @detj
- (**backend**): Add authz in metrics (#658) by @detj in #658
- (**backend**): Fix failing test by @anupcowkur in #601
- (**backend**): No data for size by @detj
- (**backend**): No data for perceived anr free by @detj
- (**backend**): No data for perceived crash free by @detj
- (**backend**): No data for anr free sessions by @detj
- (**backend**): No data for crash free sessions by @detj
- (**backend**): Handle no data for adoption by @detj
- (**backend**): Add missing query close by @detj
- (**backend**): Broken crash group list api (#545) by @detj in #545
- (**backend**): Broken sesion replay api (#540) by @detj in #540
- (**backend**): Make mapping file optional by @abhaysood
- (**backend**): Ingest http client by @abhaysood
- (**backend**): Fix clickhouse schema by @abhaysood
- (**backend**): Issue with uploading build by @detj
- (**backend**): Update cpu usage compute by @detj
- (**backend**): Bug with launch time processing by @detj
- (**backend**): Add validation check by @detj
- (**backend**): Handle error when no teams (#498) by @detj in #498
- (**backend**): `app_exit` validation (#479) by @detj in #479
- (**backend**): Incorrect struct tag by @detj in #451
- (**backend**): Unused code by @detj
- (**backend**): Extra parameter by @detj
- (**backend**): Add missing `defer` keyword by @detj
- (**backend**): Incorrect struct tag by @detj
- (**backend**): Unused code by @detj
- (**backend**): Extra parameter by @detj
- (**backend**): Non-consistent pagination issues by @detj
- (**backend**): Non-consistent pagination issues by @detj
- (**backend**): Consistent grouping pagination by @detj
- (**backend**): Set default limit for filters api (#386) by @detj in #386
- (**backend**): Incorrect query syntax by @detj
- (**backend**): Incorrect counting of exceptions/anrs grouping (#336) by @detj in #336
- (**backend**): Accept zero events session (#328) by @detj in #328
- (**backend**): Update anr group filters api by @detj in #325
- (**backend**): Update crash group filters api by @detj
- (**backend**): Remove time range in event filters query by @detj
- (**backend**): Remove time range in app filters query by @detj
- (**backend**): Change time range validation behavior by @detj
- (**backend**): Don't set default time range by @detj
- (**backend**): Session ingestion failure with http request & response by @detj
- (**backend**): Nonce mismatch with google signin by @detj
- (**backend**): Anr grouping by @detj
- (**backend**): Revamp symbolication need detection logic (#305) by @detj in #305
- (**backend**): Retrace frame parsing (#300) by @detj in #300
- (**backend**): Lookup country by ip (#291) by @detj in #291
- (**backend**): Respond with bad request on team not found (#281) by @detj in #281
- (**backend**): Handle existing & new invitee(s) by @detj
- (**backend**): Panics if api key is supplied in place of access token (#279) by @detj in #279
- (**backend**): Role validation logic (#270) by @detj in #270
- (**backend**): Add validation for thread name in anr and exception by @abhaysood in #267
- (**backend**): Increase thread name max size to 64 by @abhaysood
- (**backend**): Pre authz logic for teams by @detj in #264
- (**backend**): Change teamId to id to match client response expectation by @anupcowkur in #224
- (**backend**): Use correct table name in CH migrations by @abhaysood in #211
- (**backend**): Invalid error format (#215) by @detj in #215
- (**backend**): Use correct column name in query to get mapping key by @abhaysood in #217
- (**backend**): Validate all events (#142) by @detj in #142
- (**backend**): Resolve go-staticcheck warnings (#116) by @detj in #116
- (**backend**): Partial symbolication should work (#113) by @detj in #113
- (**backend**): Separate anrs (#110) by @detj in #110
- (**backend**): Issues with types (#107) by @detj in #107
- (**backend**): Fix schema for gestures (#101) by @abhaysood in #101
- (**backend**): Accept session if no mapping file (#97) by @detj in #97
- (**backend**): Retrace symbolication algorithm (#93) by @detj in #93
- (**backend**): App_exit symbolication (#91) by @detj in #91
- (**backend**): Change names of exception columns (#52) by @detj in #52
- (**frontend**): Use node env for auth.ts jest test by @anupcowkur in #1060
- (**webapp**): Remove env checks causing vercel build failure by @anupcowkur in #983
- (**webapp**): Import lottie dynamically to fix ssr error by @anupcowkur in #963
- (**webapp**): Incorrect landing page video borders by @anupcowkur in #959
- (**webapp**): Add missing id attribute to inline script by @anupcowkur in #952
- (**webapp**): Use &apos; instead of apostrophe by @anupcowkur
- (**webapp**): Lottie-react wrongfully added to project root by @anupcowkur
- (**webapp**): Show formatted y value in tooltip in cpu usage graph by @anupcowkur in #939
- (**webapp**): Set max height for session replay event vertical connectors by @anupcowkur in #938
- (**webapp**): Handle 0 delta cases in metrics display by @anupcowkur in #936
- (**webapp**): Fix launch time showing '0x faster' as delta by @anupcowkur in #935
- (**webapp**): Handle invalid selected app in persisted filters by @anupcowkur in #915
- (**webapp**): Remove hover,active & focus states on disabled buttons by @anupcowkur in #899
- (**webapp**): Self-hosted check by @anupcowkur in #864
- (**webapp**): Prevent unnecessary useEffect calls by @anupcowkur in #858
- (**webapp**): Expand journey node on title hover only by @anupcowkur
- (**webapp**): Decode title in exceptions details page by @anupcowkur in #827
- (**webapp**): Use slices tooltips for exceptions plots by @anupcowkur in #813
- (**webapp**): Fix typo in perceived anr free sessions metric tooltip by @anupcowkur in #801
- (**webapp**): Use full width in exception pages by @anupcowkur in #786
- (**webapp**): Handle null app size metrics by @anupcowkur in #770
- (**webapp**): Remove session replay event timeline animation by @anupcowkur
- (**webapp**): Fix area gradient opacity in cpu chart by @anupcowkur
- (**webapp**): Rotate mem & cpu chart ticks to reduce overlap by @anupcowkur
- (**webapp**): Set cpu graph max value to 100 and 5 ticks by @anupcowkur
- (**webapp**): Remove decimal precision from memory graph tooltip by @anupcowkur
- (**webapp**): Make filter end date include all day by @anupcowkur in #723
- (**webapp**): Hide detail filters in exception overview page by @anupcowkur in #720
- (**webapp**): Show crash or anr legend correctly in group details plot by @anupcowkur
- (**webapp**): Handle invalid date input in date filters by @anupcowkur in #695
- (**webapp**): Update UI to handle chained exceptions by @anupcowkur in #678
- (**webapp**): Pick exception thread name correctly in crash/anr details by @anupcowkur in #669
- (**webapp**): Improve messaging for no Crashes/ANRs by @anupcowkur in #668
- (**webapp**): Fix date selectors allowing dates later than today by @anupcowkur in #666
- (**webapp**): Append crash or anr query param to filters api by @anupcowkur in #645
- (**webapp**): Handle null cpu & memory data in session replay by @anupcowkur in #642
- (**webapp**): Update api response handling by @anupcowkur
- (**webapp**): Set mock timezone for time_utils tests by @anupcowkur
- (**webapp**): Fix incorrect session replay event timestamp state format by @anupcowkur
- (**webapp**): Fix chart datetime format by @anupcowkur
- (**webapp**): Updated alert prefs not reflecting in UI by @anupcowkur in #604
- (**webapp**): Set updatedAlertPrefs on fetch alert prefs API success by @anupcowkur
- (**webapp**): Fix version and codes query params in metrics API call by @anupcowkur
- (**webapp**): Fix change role being incorrectly enabled by @anupcowkur in #567
- (**webapp**): Avoid calling APIs that need app id before it's set by @anupcowkur in #557
- (**webapp**): Ellipsize overflowing dropdown items by @anupcowkur in #553
- (**webapp**): Fix session duration human readable display by @anupcowkur in #548
- (**webapp**): Fix session replay event timeline sorting by @anupcowkur in #547
- (**webapp**): Display correct stacktrace thread name by @anupcowkur in #517
- (**webapp**): Disable side nav link if current page is same as link by @anupcowkur
- (**webapp**): Fix event timeline animation jittering by @anupcowkur in #474
- (**webapp**): Sort events by timestamp in session replay event timeline by @anupcowkur
- (**webapp**): Remove unneeded IDs in DangerConfirmationModal comoponent by @anupcowkur in #444
- (**webapp**): Fix placeholder text in create new team input field by @anupcowkur in #436
- (**webapp**): Fix typo in method name by @anupcowkur in #435
- (**webapp**): Add key id + timestamp only when pagination has actually occured by @anupcowkur in #419
- (**webapp**): Select all versions on filters fetch in Crashes page by @anupcowkur in #381
- (**webapp**): Handle empty state of crash groups list fetch in Crashes page by @anupcowkur in #376
- (**webapp**): Update nivo charts to latest version to fix rendering issues by @anupcowkur in #371
- (**webapp**): Update invite API by @anupcowkur
- (**webapp**): Refresh team members after inviting by @anupcowkur in #366
- (**webapp**): Fix invite member api call & update docs by @anupcowkur in #365
- (**webapp**): Upadte apps fetch API error msg by @anupcowkur in #359
- (**webapp**): Fix invite member request failing by @anupcowkur in #357
- (**webapp**): Handle not onboarded & no data cases separately by @anupcowkur in #320
- (**webapp**): Use 'onboarded' flag in apps API response to set filter status by @anupcowkur in #301
- (**webapp**): Update filters api json response parsing in Overview page by @anupcowkur in #292
- (**webapp**): Hide Team change role confirmation dialog on cancel click by @anupcowkur in #289
- (**webapp**): Handle existing invite flow by @detj
- (**webapp**): Set remove member API error message correctly by @anupcowkur
- (**webapp**): Handle can_change_roles being null in Team page by @anupcowkur
- (**webapp**): Incorrect formatting in invite message by @detj in #260
- (**webapp**): Fix TeamSwitcher text overflow by @anupcowkur in #262
- (**webapp**): Show API key in create app from new apps API response format by @anupcowkur in #244
- (**webapp**): Fix typo by @anupcowkur in #237
- (**webapp**): Put conditional state inside useState to avoid calling useState conditionally by @anupcowkur in #236
- (**webapp**): Add missing return on overview filters api failure by @anupcowkur
- (**webapp**): Update param names for journey & metrics apis by @anupcowkur in #202
- (**webapp**): Set max & min limits for date filters by @anupcowkur
- (**webapp**): Update date & uuids format to match journey & metrics api formats by @anupcowkur
- (**webapp**): Fix server renderd HTML mismatch error for date filter pills by @anupcowkur in #192
- (**webapp**): Save date filter state in crash details page by @anupcowkur in #182
- (**webapp**): Change env var name (#165) by @detj in #165
- (**webapp**): Fix comment syntax by @anupcowkur
- (**webapp**): Change text to black on side nav button on focus visible by @anupcowkur in #86
- (**webapp**): Set header z-index so it's always on top by @anupcowkur in #66
- (**webapp**): Center align section headers on small screens by @anupcowkur

### :hammer: Misc

- (**backend**): Fix dashboard healthcheck by @detj in #1085
- (**backend**): Fix dashboard healthcheck by @detj in #1084
- (**backend**): Fix incorrect path by @detj
- (**backend**): Update dashboard github workflow by @anupcowkur
- (**backend**): Fix dockerfile by @detj
- (**backend**): Fix dashboard docker compose by @detj
- (**backend**): Update compose.yml by @detj
- (**backend**): Update rigmarole script by @detj
- (**backend**): Remove stale files by @detj
- (**backend**): Update go.work.sum (#1050) by @detj in #1050
- (**backend**): Move dashboard directory by @detj
- (**backend**): Update cleanup deps by @detj
- (**backend**): Update cleanup service by @detj
- (**backend**): Change health check by @detj
- (**backend**): Update github workflow by @detj
- (**backend**): Update docker compose by @detj
- (**backend**): Rename directory & service names by @detj
- (**backend**): Rename directory & service names by @detj
- (**backend**): Tidy go.mod by @anupcowkur in #1044
- (**backend**): Change default retention period to 90 days by @anupcowkur in #1042
- (**backend**): Extend access token expiry (#1031) by @detj in #1031
- (**backend**): Update `config.sh` by @detj in #1030
- (**backend**): Proxy attachments by default by @detj
- (**backend**): Fix typos by @detj
- (**backend**): Rename web env vars by @detj
- (**backend**): Fix a sessionator edge case (#1026) by @detj in #1026
- (**backend**): Consistent healthcheck (#997) by @detj in #997
- (**backend**): Add healthchecks (#989) by @detj in #989
- (**backend**): Remove example env (#985) by @detj in #985
- (**backend**): Add otel instrumentation to api server by @anupcowkur
- (**backend**): Add new sessions with real cpu usage data by @abhaysood
- (**backend**): Add dummy percentage usage in session data by @abhaysood
- (**backend**): Update interval_config to interval in session data by @abhaysood
- (**backend**): Update cpu and memory usage events schema by @abhaysood
- (**backend**): Refactor cpu usage calculation for clarity by @anupcowkur in #943
- (**backend**): Rename msg column to message in anr/exception groups by @anupcowkur
- (**backend**): Remove redundant parameter types by @anupcowkur
- (**backend**): Make getDisplayTitle method to encapsulate exception group naming by @anupcowkur
- (**backend**): Standardise migration file names by @anupcowkur
- (**backend**): Store exception/anr group name in separate columns by @anupcowkur
- (**backend**): Update config.sh by @detj
- (**backend**): Update config.sh by @detj
- (**backend**): Mod github auth by @detj
- (**backend**): Mod github auth by @detj
- (**backend**): Update compose.yml by @detj
- (**backend**): Fix a typo by @detj
- (**backend**): Parameterized cors settings by @detj
- (**backend**): Update self-host settings by @detj
- (**backend**): Update installation script by @detj
- (**backend**): Update config.sh by @detj
- (**backend**): Update config.sh by @detj
- (**backend**): Update config.sh by @detj
- (**backend**): Update config.sh by @detj
- (**backend**): Reorganize install.sh by @detj
- (**backend**): Update install.sh by @detj
- (**backend**): Update dbmate.sh by @detj
- (**backend**): Update config.sh by @detj
- (**backend**): Update compose.yml by @detj
- (**backend**): Update .env.example by @detj
- (**backend**): Update compose.yml by @detj
- (**backend**): Install.sh by @detj
- (**backend**): Config.sh script by @detj
- (**backend**): Update prod compose by @detj
- (**backend**): Update container naming by @detj
- (**backend**): Update dockerfiles by @detj
- (**backend**): Improve clickhouse close handling by @detj
- (**backend**): Remove ipinfo env variable by @detj
- (**backend**): Use local geoip db by @detj
- (**backend**): Update dockerfile by @detj
- (**backend**): Update dockerfile by @detj
- (**backend**): Update measure-go dockerfile by @detj
- (**backend**): Update labels in dockerfile by @detj
- (**backend**): Update dockerfile by @detj
- (**backend**): Update measure-go workflow by @detj
- (**backend**): Reorg dockerfiles by @detj
- (**backend**): Add label to dockerfile by @detj
- (**backend**): Rename dockerfile by @detj
- (**backend**): Consolidate env vars by @detj
- (**backend**): Add gitignore by @detj
- (**backend**): Remove example env file by @detj
- (**backend**): Improve migrations by @detj
- (**backend**): Mod compose by @detj
- (**backend**): Change env vars by @detj
- (**backend**): Remove put users endpoint by @detj
- (**backend**): Add team id by @detj
- (**backend**): Improve create team by @detj
- (**backend**): Remove unused field by @detj
- (**backend**): Add google signin by @detj
- (**backend**): Update deps by @detj
- (**backend**): Update dot env example by @detj
- (**backend**): Update server by @detj
- (**backend**): Add google user struct by @detj
- (**backend**): Update cipher pkg by @detj
- (**backend**): Revamp invite flow by @detj
- (**backend**): Set last sign in time by @detj
- (**backend**): Remove stale logic by @detj
- (**backend**): Handle signups by @detj
- (**backend**): Update postgres ddl by @detj
- (**backend**): Refresh session automatically by @detj
- (**backend**): Remove log by @detj
- (**backend**): Update github callback by @detj
- (**backend**): Add authn routes by @detj
- (**backend**): Update deps by @detj
- (**backend**): Update server by @detj
- (**backend**): Modify authentication by @detj
- (**backend**): Add a user method by @detj
- (**backend**): Update `.env.example` by @detj
- (**backend**): Add tables for auth by @detj
- (**backend**): Update session replay api by @detj in #835
- (**backend**): Update session replay api by @detj
- (**backend**): Mod event ingestion by @detj
- (**backend**): Mod events table by @detj
- (**backend**): Tidy go mods by @detj
- (**backend**): Update example config.toml by @detj
- (**backend**): Add --clean flag by @detj
- (**backend**): Add go mods by @detj
- (**backend**): Remove mapping cache by @detj
- (**backend**): Misc improvements by @detj
- (**backend**): Change docker registry (#818) by @detj in #818
- (**backend**): Modify frame location method by @detj
- (**backend**): Send display title in anr by @detj
- (**backend**): Set exception group name by @detj
- (**backend**): Send exception display title by @detj
- (**backend**): Anr location method by @detj
- (**backend**): Exception location method by @detj
- (**backend**): Remove unused code by @detj
- (**backend**): Modify anr groups table by @detj
- (**backend**): Set older event timestamp by @detj
- (**backend**): Modify exception grouping by @detj
- (**backend**): Modify unhandled exception groups table by @detj
- (**backend**): Delta in metrics by @detj
- (**backend**): Multi version filtering (#776) by @detj in #776
- (**backend**): Record new events by @abhaysood
- (**backend**): Validate network type & generation by @abhaysood in #726
- (**backend**): Use non-nullable network properties by @abhaysood
- (**backend**): Update session replay api by @detj
- (**backend**): Update anr detail api by @detj
- (**backend**): Update crash detail api by @detj
- (**backend**): Presign url by @detj
- (**backend**): Compute attachment mime by @detj
- (**backend**): Add attachments in response by @detj
- (**backend**): Update server by @detj
- (**backend**): Update .env.example by @detj
- (**backend**): Update symbolicator-retrace docker by @detj in #740
- (**backend**): Clickhouse:24 (#739) by @detj in #739
- (**backend**): Anr overview plot instances route by @detj
- (**backend**): Add anr plot instances method by @detj
- (**backend**): Crash overview instance plot route by @detj
- (**backend**): Add query function by @detj
- (**backend**): Rename methods by @detj
- (**backend**): Update dependencies in symbolicator by @abhaysood
- (**backend**): Tidy go mod (#715) by @detj in #715
- (**backend**): Remove unused route by @detj
- (**backend**): Remove unused route by @detj
- (**backend**): Anr detail journey plot api by @detj
- (**backend**): Minor refactor by @detj
- (**backend**): Add full filter support by @detj
- (**backend**): Remove unused code by @detj
- (**backend**): Add crash detail journey plot by @detj
- (**backend**): Add journey in filter pkg by @detj
- (**backend**): Add journey options by @detj
- (**backend**): Add anr instance plot api by @detj
- (**backend**): Add crash plot route by @detj
- (**backend**): Add exceptions plot method by @detj
- (**backend**): Fix typo by @detj in #676
- (**backend**): Doc comments by @detj
- (**backend**): Add doc comments by @detj
- (**backend**): Remove hardcoded prefix by @detj
- (**backend**): Modify response by @detj
- (**backend**): Modify response by @detj
- (**backend**): Change variable name by @detj
- (**backend**): Add doc comment by @detj
- (**backend**): Rename function by @detj
- (**backend**): Organize method by @detj
- (**backend**): Optimize journey events by @detj in #646
- (**backend**): Add doc comment by @detj
- (**backend**): Update get journey by @detj
- (**backend**): New method in journey by @detj
- (**backend**): Update group by @detj
- (**backend**): Authz checks in journey by @detj
- (**backend**): Fix typo by @detj
- (**backend**): Change method names by @detj
- (**backend**): Create journey interface by @detj
- (**backend**): Journey map api by @detj
- (**backend**): Add set pkg by @detj
- (**backend**): Update group by @detj
- (**backend**): Update group by @detj
- (**backend**): Compute issues to journey by @detj
- (**backend**): Update doc comments by @detj
- (**backend**): Doc comments by @detj
- (**backend**): Store session ids in graph by @detj
- (**backend**): Dedup fragments by @detj
- (**backend**): Modify app journey route by @detj
- (**backend**): Add journey pkg by @detj
- (**backend**): Add uuid set by @detj
- (**backend**): Add graph pkg by @detj
- (**backend**): Get journey events by @detj
- (**backend**): Lifecycle events constants by @detj
- (**backend**): Remove dead code by @detj
- (**backend**): Update app metrics api by @detj
- (**backend**): Validate app journey by @detj
- (**backend**): Improve app metrics by @detj
- (**backend**): Add validate versions by @detj
- (**backend**): Improve app metrics by @detj
- (**backend**): Doc comments for app filter by @detj
- (**backend**): Update dashboard api docs (#644) by @detj in #644
- (**backend**): Update event validation by @detj
- (**backend**): Fix app onboarding by @detj
- (**backend**): Remove unused tables by @detj
- (**backend**): Fix broken code by @detj
- (**backend**): Fix context in get team by @detj
- (**backend**): Remove unnecessary error return by @anupcowkur
- (**backend**): Update schema.sql with alert_prefs table by @anupcowkur
- (**backend**): Add missing sqlf statement close method by @anupcowkur
- (**backend**): Remove print statement by @anupcowkur
- (**backend**): Add doc comments by @detj
- (**backend**): Remove old session api by @detj
- (**backend**): Remove old app's get method by @detj
- (**backend**): Remove old symbolicate by @detj
- (**backend**): Update old symbolicate by @detj
- (**backend**): Rewire session replay by @detj
- (**backend**): Network events thread name by @detj
- (**backend**): Nav events thread name by @detj
- (**backend**): Memory events thread name by @detj
- (**backend**): Log events thread name by @detj
- (**backend**): Lifecycle events thread name by @detj
- (**backend**): Launch events thread name by @detj
- (**backend**): Gesture events thread name by @detj
- (**backend**): Exit events thread name by @detj
- (**backend**): Critical events thread name by @detj
- (**backend**): Add missing context by @detj
- (**backend**): Update events schema by @detj
- (**backend**): Additional events by @detj
- (**backend**): Rewire metricsa api by @detj
- (**backend**): Fix anr symbolication by @detj
- (**backend**): Modify attachment by @detj
- (**backend**): Contextified get team by @detj
- (**backend**): Rewire anr groups anrs api by @detj
- (**backend**): Update crash group with crashes by @detj
- (**backend**): Rewire crash groups crashes api by @detj
- (**backend**): Fix missing ctx by @detj
- (**backend**): Update references by @detj
- (**backend**): Rewire get crash groups api by @detj
- (**backend**): App filters request context by @detj
- (**backend**): Context in app filters by @detj
- (**backend**): Update get app filters api by @detj
- (**backend**): Fix bucketting by @detj
- (**backend**): Remove background context by @detj
- (**backend**): Remove unused code by @detj
- (**backend**): Format doc comments by @detj
- (**backend**): Remove older put sessions route by @detj
- (**backend**): Save event req to db by @detj
- (**backend**): Idempotecy of request id by @detj
- (**backend**): Remove extra newline by @detj
- (**backend**): Add event_reqs db table by @detj
- (**backend**): Modify events table schema by @detj
- (**backend**): Fix event ingestion by @detj
- (**backend**): Fix app onboarding by @detj
- (**backend**): Improve reporting by @detj
- (**backend**): Fix hand during bucketting by @detj
- (**backend**): Measure ingest duration by @detj
- (**backend**): Fix hang during bucketting by @detj
- (**backend**): More metrics during ingestion by @detj
- (**backend**): Fix hang up during bucketting by @detj
- (**backend**): Fix symbolication issues by @detj
- (**backend**): Fix multipart event processing by @detj
- (**backend**): Fix event request by @detj
- (**backend**): Fix event batching by @detj
- (**backend**): Close writer by @detj
- (**backend**): Add fresh events by @detj
- (**backend**): Add event req id by @detj
- (**backend**): Modify ingest to send events by @detj
- (**backend**): Remove session from scanning by @detj
- (**backend**): Remove session recording by @detj
- (**backend**): Change scan logic to read blobs by @detj
- (**backend**): Attribute as key name instead of attributes by @detj
- (**backend**): Fix invalid json bug by @detj
- (**backend**): Fix error message by @detj
- (**backend**): Update session recording by @detj
- (**backend**): Improve code comments by @detj
- (**backend**): Support transactions in bucketting by @detj
- (**backend**): Add app onboarding by @detj
- (**backend**): Update field name by @detj
- (**backend**): Update bucketting by @detj
- (**backend**): Rewire event ingestion by @detj
- (**backend**): Update events table schema by @detj
- (**backend**): Bucket exceptions, anrs by @detj
- (**backend**): Rewire attachment processing by @detj
- (**backend**): Remove unused code by @detj
- (**backend**): Add new events route by @detj
- (**backend**): Rewire symbolication by @detj
- (**backend**): Update session by @detj
- (**backend**): Delete old attachment by @detj
- (**backend**): Add attachment by @detj
- (**backend**): Rewire country lookup by @detj
- (**backend**): Update event struct by @detj
- (**backend**): Add events route by @detj
- (**backend**): Update db schema by @detj
- (**backend**): Update attribute validation by @detj
- (**backend**): Define attributes by @detj in #598
- (**backend**): Wip - attribute by @detj
- (**backend**): Remove `/events` route by @detj in #597
- (**backend**): Organize response by @detj
- (**backend**): Sessionator request interface (#572) by @detj in #572
- (**backend**): Sort only by version code (#569) by @detj in #569
- (**backend**): Format response by @detj
- (**backend**): Add launch time metrics by @detj
- (**backend**): Compute hot launch duration by @detj
- (**backend**): Add hot launch duration column by @detj
- (**backend**): Compute warm launch duration by @detj
- (**backend**): Add warm launch duration column by @detj
- (**backend**): Compute cold launch duration by @detj
- (**backend**): Add cold launch duration column by @detj
- (**backend**): Send metrics response by @detj
- (**backend**): Add perceived anr free metrics by @detj
- (**backend**): Add perceived crash free metrics by @detj
- (**backend**): Add anr free metrics by @detj
- (**backend**): Add crash free sessions by @detj
- (**backend**): Modify adoption metric by @detj
- (**backend**): Modify size metric by @detj
- (**backend**): Wip - metrics api by @detj
- (**backend**): Club version name & code by @detj
- (**backend**): Version code in anr detail api by @detj
- (**backend**): Version code in crash detail api by @detj
- (**backend**): Version code in crash/anr groups by @detj
- (**backend**): Add version code in app filter by @detj
- (**backend**): Remove unneeded logs by @abhaysood in #541
- (**backend**): Add pocket cast sessions by @abhaysood in #537
- (**backend**): Improve sessionator by @detj
- (**backend**): Update `cold_launch` event by @detj
- (**backend**): Update `http` event by @detj
- (**backend**): Update `hot_launch` event by @detj
- (**backend**): Fix `warm_launch` duration compute by @detj
- (**backend**): Update `warm_launch` event by @detj
- (**backend**): Update `gesture_scroll` event by @detj
- (**backend**): Update `gesture_long_click` event by @detj
- (**backend**): Update `gesture_click` event by @detj
- (**backend**): Update `anr` event by @detj
- (**backend**): Update `exception` event by @detj
- (**backend**): Update record command to capture build size by @abhaysood
- (**backend**): Mapping is optional by @detj
- (**backend**): Improve error messages by @detj
- (**backend**): Support build info in sessionator by @detj
- (**backend**): Update mapping key fetch by @detj
- (**backend**): Add transaction to builds api by @detj
- (**backend**): Upsert `build_sizes` by @detj
- (**backend**): Update `build_sizes` relation by @detj
- (**backend**): Add `build_type` column by @detj
- (**backend**): Add `build_sizes` relation by @detj
- (**backend**): Use `app_id` for build mappings by @detj
- (**backend**): Modify `build_mappings` relation by @detj
- (**backend**): Upgrade go version by @detj in #501
- (**backend**): Use go v1.22.x by @detj
- (**backend**): Fix paths patterns (#500) by @detj in #500
- (**backend**): Add `foreground` to session replay by @detj
- (**backend**): Add `foreground` to session replay by @detj
- (**backend**): Update session-data sessions by @detj
- (**backend**): Add `foreground` to anr by @detj
- (**backend**): Add `foreground` to exception by @detj
- (**backend**): Update clickhouse schema by @detj
- (**backend**): Change job trigger file list (#450) by @detj in #450
- (**backend**): Change mapping file key query by @detj
- (**backend**): Add `low_memory` event by @detj
- (**backend**): Remove `app_exit.timestamp` by @detj
- (**backend**): Handle updated `low_memory` events by @detj
- (**backend**): Expand `low_memory` click schema by @detj
- (**backend**): Bring back duration by @detj
- (**backend**): Change job trigger file list (#450) by @detj
- (**backend**): Send first/last event time by @detj
- (**backend**): Add `http` event by @detj
- (**backend**): Modify structure of thread groups by @detj
- (**backend**): Fix issue with anr events by @detj
- (**backend**): Add `anr` event by @detj
- (**backend**): Add `exception` event by @detj
- (**backend**): Fix a typo by @detj
- (**backend**): Fix a typo by @detj
- (**backend**): Add `app_exit` event by @detj
- (**backend**): Add `trim_memory` event by @detj
- (**backend**): Add `lifecycle_app` event by @detj
- (**backend**): Add `lifecycle_fragment` event by @detj
- (**backend**): Add `lifecycle_activity` event by @detj
- (**backend**): Add `hot_launch` event by @detj
- (**backend**): Add `warm_launch` event by @detj
- (**backend**): Trim string event by @detj
- (**backend**): Add `cold_launch` event by @detj
- (**backend**): Add `network_change` event by @detj
- (**backend**): Add `string` event by @detj
- (**backend**): Fix bad file name by @detj
- (**backend**): Add `navigation` event by @detj
- (**backend**): Add `gesture_scroll` events by @detj
- (**backend**): Add `gesture_long_click` events by @detj
- (**backend**): Add `gesture_click` events by @detj
- (**backend**): Add `memory usage` data points by @detj
- (**backend**): Rename `cpu` pkg to `replay` by @detj
- (**backend**): Add `resource` in session replay response by @detj
- (**backend**): Add `cpu_usage` calculation for session replay by @detj
- (**backend**): Add `text` package by @detj
- (**backend**): Add `cpu` package by @detj
- (**backend**): Update `chrono` package by @detj
- (**backend**): Add session replay api route by @detj
- (**backend**): Add init compose profile by @detj
- (**backend**): Update `go.work.sum` (#440) by @detj in #440
- (**backend**): Ignore existing buckets (#432) by @detj in #432
- (**backend**): Fix minio bucket creation by @detj in #429
- (**backend**): Add create team api by @detj
- (**backend**): Add session-data by @abhaysood in #417
- (**backend**): Rename session-data app name to use app-unique-id by @abhaysood
- (**backend**): Add record command to sessionator by @abhaysood
- (**backend**): Update docker compose by @detj
- (**backend**): Support local s3 fetching in symbolicator-retrace by @detj
- (**backend**): Update symbolicator-retrace's env file by @detj
- (**backend**): Files now uploads locally by @detj
- (**backend**): Update `.env.example` by @detj
- (**backend**): Remove dead code by @detj
- (**backend**): Upload files locally if in debug mode by @detj
- (**backend**): Network_generations in anr groups anr by @detj
- (**backend**): Network_types in anr groups anr by @detj
- (**backend**): Fix incorrect column name by @detj
- (**backend**): Network_providers in anr groups anr by @detj
- (**backend**): Locales in anr groups anr by @detj
- (**backend**): Device_manufacturers in anr groups anr by @detj
- (**backend**): Device_names in anr groups anr by @detj
- (**backend**): Countries in anr groups anrs by @detj
- (**backend**): Countries in crash groups crashes by @detj
- (**backend**): Add `countries` filter by @detj
- (**backend**): Network_generations in crash groups crashes by @detj
- (**backend**): Add `network_generations` filter by @detj
- (**backend**): Network_types in crash groups crashes by @detj
- (**backend**): Add `network_types` filter by @detj
- (**backend**): Network_providers in crash groups crashes by @detj
- (**backend**): Add `network_providers` filter by @detj
- (**backend**): Locales in crash groups crashes by @detj
- (**backend**): Add `locales` filter by @detj
- (**backend**): Device_manufacturers in crash groups crashes by @detj
- (**backend**): Add `device_manufacturers` filter by @detj
- (**backend**): Device_names in crash groups crashes by @detj
- (**backend**): Add `device_names` filter by @detj
- (**backend**): Update dashboard api docs by @detj in #409
- (**backend**): Add session_id in anr groups anrs api by @detj
- (**backend**): Add session_id in crash groups crasshes api by @detj
- (**backend**): Add time range support anr groups anr get by @detj
- (**backend**): Add time range support crash groups crashes get by @detj
- (**backend**): Fix an edge case by @detj
- (**backend**): Add navigation sample by @abhaysood
- (**backend**): Use non deprecated API to read response error by @abhaysood
- (**backend**): Log error when sessionator ingestion fails by @abhaysood
- (**backend**): Update go workspace by @detj in #398
- (**backend**): Upgrade measure-go dependencies by @detj
- (**backend**): Update gh actions/setup-go (#399) by @detj in #399
- (**backend**): Reduce error chance (#397) by @detj in #397
- (**backend**): Organize routes (#396) by @detj in #396
- (**backend**): Update clickhouse schema file by @detj in #392
- (**backend**): Reverting route re-org by @detj in #391
- (**backend**): Update app filter validation by @detj
- (**backend**): Upgrade uuid pkg by @detj
- (**backend**): Modify grouping schema by @detj
- (**backend**): Rearrange events table columns (#385) by @detj in #385
- (**backend**): Remove `key` query parameter by @detj
- (**backend**): Remove `version` field from app filter by @detj
- (**backend**): Add get anr group detail api by @detj
- (**backend**): Remove unused code by @detj
- (**backend**): Add get crash group detail api by @detj
- (**backend**): Modify pagination behavior by @detj
- (**backend**): Add keyset pagination by @detj
- (**backend**): Add keyset pagination by @detj
- (**backend**): Omit fields from api response by @detj
- (**backend**): Omit fields from api response by @detj
- (**backend**): Update list anr groups api by @detj
- (**backend**): Update anr_groups table schema by @detj
- (**backend**): Remove app version from exception grouping by @detj
- (**backend**): Remove `app_version` field by @detj
- (**backend**): Modify crash groups list api by @detj
- (**backend**): Change event group field name by @detj
- (**backend**): Change event group schemas by @detj
- (**backend**): Update crash groups list api by @detj
- (**backend**): Add trim method to resource by @detj
- (**backend**): Add function to fetch exception group events by @detj
- (**backend**): Add function expand filters by @detj
- (**backend**): Remove unused app apis (#351) by @detj in #351
- (**backend**): Reorder event columns (#346) by @detj in #346
- (**backend**): Sort anr groups by @detj in #345
- (**backend**): Sort crash groups by @detj
- (**backend**): Add 2 sessions from pocketcast app by @abhaysood in #332
- (**backend**): Check presence of unhandled_exceptions & anrs by @detj
- (**backend**): Add new methods to session by @detj
- (**backend**): Modify anr group query by @detj
- (**backend**): Modify exception group query by @detj
- (**backend**): Delete unneeded code by @detj in #323
- (**backend**): Change handling of attribute map by @detj
- (**backend**): Update help text of ingest command by @detj in #312
- (**backend**): Update ingest command by @detj
- (**backend**): Change config to a flag by @detj
- (**backend**): Update help of ingest command by @detj
- (**backend**): Modify root command by @detj
- (**backend**): Generate nonce only when required by @detj in #314
- (**backend**): Use api keys from config by @detj
- (**backend**): Add a config package to sessionator by @detj
- (**backend**): Add sample config file by @detj
- (**backend**): Add toml package by @detj
- (**backend**): Remove unwanted logging by @detj in #307
- (**backend**): Tests are being silently skipped (#302) by @detj in #302
- (**backend**): Add sessionator by @detj
- (**backend**): Add version filter support by @detj in #290
- (**backend**): Add `app_version` to `anr_groups` table by @detj
- (**backend**): Add version filter support by @detj
- (**backend**): Add `app_version` to `unhandled_exception_groups` table by @detj
- (**backend**): Add single anr group filters api by @detj
- (**backend**): Add single crash group filters api by @detj
- (**backend**): Dedup slice of event ids by @detj
- (**backend**): Add identity package by @detj
- (**backend**): Get anr filters api by @detj
- (**backend**): Get filters for crashes api by @detj
- (**backend**): Get anr groups api by @detj
- (**backend**): Add app filter to anr group query by @detj
- (**backend**): Get crash groups api by @detj
- (**backend**): App app filter to exception group query by @detj
- (**backend**): Add anr grouping by @detj
- (**backend**): Add methods to get type, message & location of ANR by @detj
- (**backend**): Add method to get app's anr groups by @detj
- (**backend**): Refactor exception grouping by @detj
- (**backend**): Implement exception grouping by @detj
- (**backend**): Modify anr and exception group relation schema by @detj
- (**backend**): Create exception & anr grouping relations by @detj
- (**backend**): Compute fingerprint by @detj
- (**backend**): Add simhash pkg by @detj
- (**backend**): Modify events relation by @detj
- (**backend**): Add caching & default client by @detj in #284
- (**backend**): Lookup country from ip by @detj
- (**backend**): Modify events schema by @detj
- (**backend**): Add ipinfo pkg by @detj
- (**backend**): Add `inet` package by @detj
- (**backend**): Support querying unhandled exceptions by @detj
- (**backend**): Add get filters api by @detj
- (**backend**): Remove unused const (#282) by @detj in #282
- (**backend**): Remove `apps.first_seen_at` field by @detj in #275
- (**backend**): Set onboarded_at field by @detj
- (**backend**): Remove latest version by @detj
- (**backend**): Update clickhouse schema by @detj
- (**backend**): Update apps after session save by @detj
- (**backend**): Add platform package by @detj
- (**backend**): Add support for `appId` by @detj
- (**backend**): Update cipher pkg by @detj
- (**backend**): Update clickhouse schema by @detj
- (**backend**): Modify postgres schema by @detj
- (**backend**): Update clickhouse schema dump by @detj
- (**backend**): Add rigmarole.sh to clickhouse migrations by @detj
- (**backend**): Remove all clickhouse migrations by @abhaysood in #265
- (**backend**): Remove invitation related db modifications by @detj in #261
- (**backend**): Remove invitations relation sql by @detj
- (**backend**): Add change member role api by @detj in #256
- (**backend**): Add method to validate role by @detj
- (**backend**): Add remove team member api by @detj in #255
- (**backend**): Use chrono package for time by @detj in #253
- (**backend**): Create custom time package by @detj
- (**backend**): Add get team members api by @detj
- (**backend**): Change method name by @detj
- (**backend**): Update `/teams/:id/authz` rbac logic by @detj
- (**backend**): Change method name by @detj in #250
- (**backend**): Add `/teams/:id/authz` api by @detj
- (**backend**): Update rbac logic by @detj in #241
- (**backend**): Modify postgres table definitions by @detj
- (**backend**): Update json response by @detj
- (**backend**): Add team rename api by @detj
- (**backend**): Suspend invite record creation by @detj
- (**backend**): Implement rbac for team invite by @detj
- (**backend**): Add team invite api by @detj
- (**backend**): Add sqlf package by @detj
- (**backend**): Handle custom rank json marshalling and unmarshalling by @detj
- (**backend**): Modify team_invitations schema by @detj
- (**backend**): Add cipher package by @detj
- (**backend**): Update get team apps api by @detj in #239
- (**backend**): Remove unneeded statements by @detj
- (**backend**): Update get app details api by @detj
- (**backend**): Increase access token expiration by @detj
- (**backend**): Add app details api by @detj
- (**backend**): Handle not found condition (#235) by @detj in #235
- (**backend**): Remove log line by @detj in #234
- (**backend**): Return apps from db by @detj
- (**backend**): Wip get team apps api by @detj
- (**backend**): Change name of app key by @detj in #233
- (**backend**): Fix types of create app response by @detj
- (**backend**): Return response in app create api by @detj in #227
- (**backend**): Add create app by @detj in #226
- (**backend**): Update jwt package by @detj
- (**backend**): Add api keys by @detj
- (**backend**): Add rbac by @detj
- (**backend**): Move server into a separate package by @detj
- (**backend**): Schema changes for creating app by @detj
- (**backend**): Add env var (#220) by @detj in #220
- (**backend**): Rename migration files by @abhaysood
- (**backend**): Add github oauth redirection (#219) by @detj in #219
- (**backend**): Remove old sql files by @detj in #213
- (**backend**): Update docker compose by @detj
- (**backend**): Drop old clickhouse table by @detj
- (**backend**): Change a column in `mapping_files` by @detj
- (**backend**): Change events table name by @detj
- (**backend**): Add migrations infra by @detj
- (**backend**): Change container names by @detj in #210
- (**backend**): Change mapping files parameter (#204) by @detj in #204
- (**backend**): Add app filters stub api by @detj in #201
- (**backend**): Add teams stub apis (#199) by @detj in #199
- (**backend**): App request filtering (#198) by @detj in #198
- (**backend**): Add missing metrics by @detj in #194
- (**backend**): Change cors origin (#188) by @detj in #188
- (**backend**): Add cors config (#187) by @detj in #187
- (**backend**): Fix incorrect version in go.mod (#186) by @detj in #186
- (**backend**): Add api server build action (#179) by @detj in #179
- (**backend**): Fix syntax (#176) by @detj in #176
- (**backend**): Add rest of the events to symbolication (#141) by @detj in #141
- (**backend**): Refactor magic strings (#139) by @detj in #139
- (**backend**): Symbolication codec (#137) by @detj in #137
- (**backend**): Modify docker compose (#128) by @detj in #128
- (**backend**): Count session payload size (#122) by @detj in #122
- (**backend**): Improve example dotenv files (#123) by @detj in #123
- (**frontend**): Revert google ux_mode by @detj
- (**frontend**): Remove commented code by @anupcowkur in #1083
- (**frontend**): Lazy load landing page videos by @anupcowkur in #1082
- (**frontend**): Adjust landing hero anim dimensions by @anupcowkur
- (**frontend**): Change android availability on landing page by @anupcowkur
- (**frontend**): Remove unity section from landing page by @anupcowkur
- Rename directory and service names by @detj
- Update installation script (#1037) by @detj in #1037
- Delete self host `.env.example` (#1033) by @detj in #1033
- Update .commitlintrc.js
- Update compose.yml (#1023) by @detj in #1023
- Remove dotenv by @detj
- Remove supabase by @detj
- Update .gitignore (#850) by @detj in #850
- Update root go work sum by @detj in #832
- Report status and errors (#324) by @detj in #324
- Remove supabase dependency from root folder by @anupcowkur in #318
- Update supabase config (#216) by @detj in #216
- Move docker compose by @detj
- Streamline self-host by @detj
- Change commitlint config (#54) by @detj in #54
- Add husky & commitlint (#36) by @detj in #36
- Improve landing page copy by @anupcowkur in #37
- Expose clickhouse http port by @detj in #33
- Remove unused imports by @anupcowkur in #28
- Link contribution guidelines in README by @anupcowkur
- Improve security by @detj
- Add docker-compose script by @detj
- Improve kdoc by @abhaysood
- Rearrange sinks to have DbSink initialized first by @abhaysood
- Rename package in test source by @abhaysood
- Abstract session ID management to separate class by @abhaysood
- Add measure SDK version to resource by @abhaysood
- Improve event validation by @detj
- Fix incorrect data type by @detj
- Update benchmark by @detj
- Accepts arrays in events endpoint by @detj
- Remove extra nesting by @detj
- Restructure events request by @detj
- Remove use of dotenv by @detj
- Update events and deploy settings by @detj
- Upgrade clickhouse-go by @detj
- Add /events endpoint by @detj
- Add api endpoints and sql statements by @detj
- Add initial backend code by @detj
- Rename bodyValue to value for brevity by @abhaysood
- Fix incorrect package name by @abhaysood
- (**webapp**): Limit filter pill width & show tooltip by @anupcowkur in #1005
- (**webapp**): Update dockerfile by @detj
- (**webapp**): Update landing page with new tagline by @anupcowkur in #978
- (**webapp**): Update landing page tagline by @anupcowkur
- (**webapp**): Update 'App Hangs' to 'ANRs' in landing copy by @anupcowkur
- (**webapp**): Update landing copy for session timelines by @anupcowkur
- (**webapp**): Update 'timeline' to 'Timelines' in session landing copy by @anupcowkur
- (**webapp**): Add favicon by @anupcowkur in #962
- (**webapp**): Add measure logo to landing header by @anupcowkur
- (**webapp**): Update landing page layout for smaller screens by @anupcowkur in #958
- (**webapp**): Hide retention period settings by @anupcowkur
- (**webapp**): Update landing copy by @anupcowkur in #951
- (**webapp**): Update landing page hero animation by @anupcowkur
- (**webapp**): Add highlight instrumentation by @anupcowkur in #948
- (**webapp**): Add clarity instrumentation by @anupcowkur
- (**webapp**): Update exceptions product video on landing page by @anupcowkur in #944
- (**webapp**): Change laneing page features to vertical layout by @anupcowkur
- (**webapp**): Remove redudant if statement by @anupcowkur in #924
- (**webapp**): Ellipsize long session replay event titles by @anupcowkur
- (**webapp**): Remove google auto sign in by @anupcowkur in #910
- (**webapp**): Update npm packages to latest by @anupcowkur in #909
- (**webapp**): Add dockerfile by @detj
- (**webapp**): Change build settings by @detj
- (**webapp**): Add dockerignore by @detj
- (**webapp**): Update env var by @detj
- (**webapp**): Consolidate auth utils by @anupcowkur in #908
- (**webapp**): Update Github sign in button text by @anupcowkur in #904
- (**webapp**): Update auth flow by @detj in #886
- (**webapp**): Update Accordion ui by @anupcowkur in #901
- (**webapp**): Update exceptions overview table ui by @anupcowkur
- (**webapp**): Remove disabled states on link by @anupcowkur
- (**webapp**): Adjust button margin by @anupcowkur in #897
- (**webapp**): Replace create app integration steps with integration guide link by @anupcowkur in #885
- (**webapp**): Update nivo packages by @anupcowkur
- (**webapp**): Use &apos; instead of ' in landing copy by @anupcowkur in #878
- (**webapp**): Update landing copy by @anupcowkur
- (**webapp**): Update landing OSS & Self hosted section by @anupcowkur
- (**webapp**): Add containers around landing videos by @anupcowkur
- (**webapp**): Update landing copy by @anupcowkur
- (**webapp**): Add login button to landing page header by @anupcowkur in #861
- (**webapp**): Replace email waitlist with Github link by @anupcowkur
- (**webapp**): Remove supabase packages by @detj
- (**webapp**): Remove supabase related pieces by @detj
- (**webapp**): Fix logout by @detj
- (**webapp**): Revamp auth by @detj
- (**webapp**): Remove auth routes by @detj
- (**webapp**): Update auth callbacks by @detj
- (**webapp**): Update auth by @detj
- (**webapp**): Remove unused field by @detj
- (**webapp**): Add google signin by @detj
- (**webapp**): Add next parameter by @detj
- (**webapp**): Remove unused code by @detj
- (**webapp**): Revamp invite flow by @detj
- (**webapp**): Remove unused code by @detj
- (**webapp**): Revamp authn by @detj
- (**webapp**): Add authn utils by @detj
- (**webapp**): Use esnext by @detj
- (**webapp**): Update landing page by @anupcowkur in #860
- (**webapp**): Hide alerts page from nav bar by @anupcowkur in #841
- (**webapp**): Remove console.log by @anupcowkur in #839
- (**webapp**): Rename variable for clarity by @anupcowkur in #834
- (**webapp**): Add flower brackets for if statement by @anupcowkur
- (**webapp**): Update journey positive node colour by @anupcowkur
- (**webapp**): Update journey hightlight edge colour by @anupcowkur
- (**webapp**): Center journey node titles by @anupcowkur
- (**webapp**): Use rounded indicators in memory graph slices tooltip by @anupcowkur in #821
- (**webapp**): Reduce point size in exceptions plots by @anupcowkur
- (**webapp**): Make current page clickable in sidebar by @anupcowkur in #810
- (**webapp**): Improve quality and adjust size of screenshots by @anupcowkur in #809
- (**webapp**): Improve display of app metrics deltas by @anupcowkur in #807
- (**webapp**): Remove unused component by @anupcowkur in #799
- (**webapp**): Refactor 'crashOrAnr' to 'exceptions' by @anupcowkur in #798
- (**webapp**): Use correct types for exception plots states by @anupcowkur in #792
- (**webapp**): Remove console.log statement by @anupcowkur
- (**webapp**): Add app versions only if present in api calls by @anupcowkur in #791
- (**webapp**): Update metrics tooltips & delta display by @anupcowkur in #787
- (**webapp**): Set exception title in session replay using updated api by @anupcowkur in #772
- (**webapp**): Select latest version only in overview on init by @anupcowkur in #769
- (**webapp**): Remove unused import by @anupcowkur
- (**webapp**): Show app size metrics only on single app version selection by @anupcowkur
- (**webapp**): Move app size metrics to last position by @anupcowkur
- (**webapp**): Add custom tooltip to memory chart by @anupcowkur in #762
- (**webapp**): Remove semicolons by @anupcowkur
- (**webapp**): Remove unused import by @anupcowkur
- (**webapp**): Set mem & cpu chart precision to seconds instead of milliseconds by @anupcowkur
- (**webapp**): Remove 0 padding from x-axis hours in mem & cpu charts by @anupcowkur
- (**webapp**): Remove log statement by @anupcowkur
- (**webapp**): Add custom tooltip for cpu chart by @anupcowkur
- (**webapp**): Increase cpu chart size by @anupcowkur
- (**webapp**): Remove semicolons by @anupcowkur
- (**webapp**): Add time util function to format chart format timestamp to human readable by @anupcowkur
- (**webapp**): Set tick rotation to 90 in exceptions overview & details charts by @anupcowkur
- (**webapp**): Remove cpu & mem chart animations by @anupcowkur
- (**webapp**): Update exception details plot endpoint by @anupcowkur in #716
- (**webapp**): Extract filters to a component by @anupcowkur in #711
- (**webapp**): Adjust tick padding in crash or anr group details plot by @anupcowkur in #703
- (**webapp**): Add Paginator component tests by @anupcowkur in #641
- (**webapp**): Fix FilterPill test name by @anupcowkur in #640
- (**webapp**): Add FilterPill component tests by @anupcowkur in #639
- (**webapp**): Add TeamSwitcher component tests by @anupcowkur in #638
- (**webapp**): Decouple TeamSwitcher component from API by @anupcowkur
- (**webapp**): Remove unused import by @anupcowkur in #628
- (**webapp**): Add DangerConfirmationModal tests by @anupcowkur
- (**webapp**): Add AlertDialogModal component tests by @anupcowkur in #627
- (**webapp**): Fix accordion test file name by @anupcowkur in #626
- (**webapp**): Add test for accordion component by @anupcowkur in #625
- (**webapp**): Remove unused import in auth utils test by @anupcowkur in #621
- (**webapp**): Add snapshot tests for accordion component by @anupcowkur
- (**webapp**): Add webapp github action ci pipeline by @anupcowkur in #613
- (**webapp**): Add unit tests for scroll_utils by @anupcowkur
- (**webapp**): Use scrollY insead of deprecated pageYOffset by @anupcowkur
- (**webapp**): Add auth_utils unit tests by @anupcowkur in #612
- (**webapp**): Externalise supabase client dependency in auth_utils by @anupcowkur
- (**webapp**): Update files to have correct ts extension by @anupcowkur in #611
- (**webapp**): Add router utils unit tests by @anupcowkur in #610
- (**webapp**): Enable vercel build to run tests by adding ts-node dev dependency by @anupcowkur in #609
- (**webapp**): Use luxon for all datetime calculations by @anupcowkur in #608
- (**webapp**): Add tests for formatTimestampToChartFormat in time_utils by @anupcowkur in #607
- (**webapp**): Add tests for formatTimeToHumanReadable in time_utils by @anupcowkur
- (**webapp**): Add tests for formatDateToHumanReadable in time_utils by @anupcowkur
- (**webapp**): Throw error on invalid date in time_utils by @anupcowkur
- (**webapp**): Add tests for formatMillisToHumanReadable in time_utils by @anupcowkur
- (**webapp**): Use luxon lib to handle dates/times in time_utils by @anupcowkur
- (**webapp**): Fix string_utils test file extension by @anupcowkur
- (**webapp**): Add unit tests for utils/string_utils by @anupcowkur in #606
- (**webapp**): Set up jest for testing with NextJs by @anupcowkur
- (**webapp**): Remove unused state in journey component by @anupcowkur in #583
- (**webapp**): Handle no data cases in metrics API by @anupcowkur in #582
- (**webapp**): Handle new response metrics API response format by @anupcowkur in #571
- (**webapp**): Refactor multiple dropdown components into one by @anupcowkur in #566
- (**webapp**): Remove unused import by @anupcowkur in #558
- (**webapp**): Adjust spacing in session replay page by @anupcowkur in #538
- (**webapp**): Extract camel case formatting function to util file by @anupcowkur
- (**webapp**): Remove unused imports by @anupcowkur
- (**webapp**): Extract scroll direction detection into a util function by @anupcowkur
- (**webapp**): Fix case  of ref variable in TeamSwitcher by @anupcowkur
- (**webapp**): Fix typo in formatMillisToHumanReadable util function by @anupcowkur
- (**webapp**): Remove empty line by @anupcowkur
- (**webapp**): Extract utility function to format milliseconds to human readable format by @anupcowkur
- (**webapp**): Refactor TeamSwitcher to handle loading & error states internally by @anupcowkur in #445
- (**webapp**): Improve team switcher title & arrow alignment by @anupcowkur
- (**webapp**): Refactor CreateApp and move api call to common api calls file by @anupcowkur in #437
- (**webapp**): Upgrade to NexJs version 14 by @anupcowkur in #380
- (**webapp**): Pass initial selected item instead of index in Dropdown component by @anupcowkur in #372
- (**webapp**): Refactor UI rendering in response to API statuses in Apps, Crashes & Overview pages by @anupcowkur in #370
- (**webapp**): Remove unused imports by @anupcowkur
- (**webapp**): Extract team management APIs into centralised api calls file by @anupcowkur in #364
- (**webapp**): Extract crash groups API into centralised API calls file by @anupcowkur
- (**webapp**): Extract metrics API into centralised API calls file by @anupcowkur
- (**webapp**): Extract journey API to centralised api calls file by @anupcowkur
- (**webapp**): Rename UserFlow component to Journey by @anupcowkur
- (**webapp**): Fetch teams using centralised API in layout by @anupcowkur in #362
- (**webapp**): Fetch teams using centralised API in Teams page by @anupcowkur
- (**webapp**): Extract fetch teams api in centralised api calls file by @anupcowkur
- (**webapp**): Fetch apps + filters from centralised APIs in Crashes page by @anupcowkur
- (**webapp**): Fetch apps + filters from centralised APIs in Apps page by @anupcowkur
- (**webapp**): Fetch apps + filters from centralised APIs in overview page by @anupcowkur
- (**webapp**): Extract apps and filters fetch apis in separate file by @anupcowkur
- (**webapp**): Remove unnecessary div by @anupcowkur
- (**webapp**): Update supabase js npm package by @anupcowkur in #317
- (**webapp**): Remove unnecessary logout call from route by @anupcowkur in #316
- (**webapp**): Remove logs by @anupcowkur in #310
- (**webapp**): Remove unnecessary onAuthStateChanged method by @anupcowkur in #309
- (**webapp**): Remove unnecessary setSession call in github auth callback by @anupcowkur in #308
- (**webapp**): Refactor role names camel case conversions into a function by @anupcowkur
- (**webapp**): Update change role/remove member error msg alignment in Team page by @anupcowkur in #273
- (**webapp**): Fetch members + authz roles from same API in teams page by @anupcowkur
- (**webapp**): Remove unnecessary 'text-black' classes by @anupcowkur in #263
- (**webapp**): Handle invalid invites by @detj
- (**webapp**): Rename variables for clarity by @anupcowkur in #254
- (**webapp**): Fetch team from API in Team page by @anupcowkur in #249
- (**webapp**): Format code by @anupcowkur in #248
- (**webapp**): Set session on invite redirect by @detj
- (**webapp**): Remove old auth handler by @detj
- (**webapp**): Add logout by @detj
- (**webapp**): Modify github signin by @detj
- (**webapp**): Modify supabase auth routes by @detj
- (**webapp**): Add new environment variable by @detj
- (**webapp**): Upgrade dependencies by @detj
- (**webapp**): Update supabase email templates by @detj
- (**webapp**): Adjust spacing in Apps page by @anupcowkur in #246
- (**webapp**): Update spacing in Apps page by @anupcowkur in #245
- (**webapp**): Update ui + add comments to overview page ui by @anupcowkur
- (**webapp**): Update CreateApp ui by @anupcowkur
- (**webapp**): Open first step of create app setup by default by @anupcowkur
- (**webapp**): Use &apos instead of apostrophe by @anupcowkur
- (**webapp**): Add CreateApp component by @anupcowkur
- (**webapp**): Add example env var (#225) by @detj in #225
- (**webapp**): Improve sign-in flow error handling (#221) by @detj in #221
- (**webapp**): Handle error on logout (#222) by @detj in #222
- (**webapp**): Remove unused function by @anupcowkur in #218
- (**webapp**): Use env variable for API base URL by @anupcowkur
- (**webapp**): Improve error message in UserFlow by @anupcowkur in #212
- (**webapp**): Fetch apps list in overview from API by @anupcowkur
- (**webapp**): Disable react hooks exhaustive deps rule by @anupcowkur in #209
- (**webapp**): Store selected team state in side nav by @anupcowkur
- (**webapp**): Fix indent in Dropdown component by @anupcowkur
- (**webapp**): Add onChangeSelectedItemListener & initialItemIndex params to TeamSwitcher by @anupcowkur
- (**webapp**): Fetch teams from API by @anupcowkur
- (**webapp**): Update TeamSwitcher layout by @anupcowkur
- (**webapp**): Add new line by @anupcowkur
- (**webapp**): Handle metrics api status with enum by @anupcowkur in #208
- (**webapp**): Handle journey api status with enum by @anupcowkur
- (**webapp**): Handle filters api status with enum by @anupcowkur
- (**webapp**): Store & use app id + app name in overview app filter by @anupcowkur
- (**webapp**): Update date filter pill format in overview page by @anupcowkur in #181
- (**webapp**): Save filter states in crashes and crash details pages by @anupcowkur
- (**webapp**): Remove interactivity from FilterPills by @anupcowkur
- (**webapp**): Save selected filter states in overview page by @anupcowkur in #180
- (**webapp**): Auth ui improvements (#173) by @detj in #173
- (**webapp**): Add google auth log (#172) by @detj in #172
- (**webapp**): Add API key field to Apps page by @anupcowkur in #171
- (**webapp**): Add basic sign in with github (#168) by @detj
- (**webapp**): Add Apps page ui by @anupcowkur in #170
- (**webapp**): Fix indent by @anupcowkur
- (**webapp**): Add landing page animation for app health section by @anupcowkur in #166
- (**webapp**): Update landing page hero animation by @anupcowkur
- (**webapp**): Remove nav right border on small screens by @anupcowkur
- (**webapp**): Add change team name field to Team page by @anupcowkur
- (**webapp**): Remove text-center alignment from remove button in team page by @anupcowkur in #161
- (**webapp**): Fix width of role selector button in team page by @anupcowkur
- (**webapp**): Fix dropdown components z-index so that they are always on top of other UI by @anupcowkur
- (**webapp**): Add team page ui by @anupcowkur
- (**webapp**): Combine thread events into single chart in session replay by @anupcowkur in #155
- (**webapp**): Show only time on x-axis in session replay by @anupcowkur
- (**webapp**): Add info fields to session replay by @anupcowkur
- (**webapp**): Add session replay by @anupcowkur in #151
- (**webapp**): Add multithread stack traces with accordiong to crash details by @anupcowkur in #148
- (**webapp**): Add exception count chart instead of rate chart to crash details by @anupcowkur
- (**webapp**): Add user id to crash details session list by @anupcowkur
- (**webapp**): Remove hover styling on session list table column by @anupcowkur
- (**webapp**): Add crash details page by @anupcowkur in #145
- (**webapp**): Keep side nav link highlighted even when navigating to sub paths by @anupcowkur
- (**webapp**): Fix user flow tooltip anr length check by @anupcowkur
- (**webapp**): Fix crash details route by @anupcowkur
- (**webapp**): Remove unused imports by @anupcowkur
- (**webapp**): Add selected date filter pill to crashes by @anupcowkur in #133
- (**webapp**): Add selected filters pills to overview by @anupcowkur
- (**webapp**): Change grid gap in overview filters by @anupcowkur
- (**webapp**): Add selected filters pills to crashes by @anupcowkur
- (**webapp**): Update search field text in crashes by @anupcowkur
- (**webapp**): Remove network provider and type filter from crashes by @anupcowkur
- (**webapp**): Add crash list to crashes page by @anupcowkur in #132
- (**webapp**): Add country, network provider, network type and free search filters to crashes by @anupcowkur
- (**webapp**): Adjust crashes page padding and element sizes by @anupcowkur
- (**webapp**): Adjusting overview page padding and element sizes by @anupcowkur
- (**webapp**): Adjust crash rate chart positioning by @anupcowkur
- (**webapp**): Add crash rate line chart and app version checkbox dropdown to crashes page by @anupcowkur in #130
- (**webapp**): Remove unnecessary items-center class on info circle flex wrap by @anupcowkur in #127
- (**webapp**): Reduce horiontal gap between info circles on smaller screens by @anupcowkur
- (**webapp**): Remove unnecessary flex-1 from dashboard side nav by @anupcowkur
- (**webapp**): Change main to div in overview page by @anupcowkur
- (**webapp**): Make dashboard side nav stick on medium+ screen sizes by @anupcowkur
- (**webapp**): Add app size info circle to overview by @anupcowkur
- (**webapp**): Update app adoption tooltip text in overview by @anupcowkur
- (**webapp**): Add warm and hot launch time to overview by @anupcowkur
- (**webapp**): Update user flow tooltips with issues and ui changes by @anupcowkur in #125
- (**webapp**): Adjust user flow diagram margins by @anupcowkur
- (**webapp**): Make tooltip show up only on hover over info circle by @anupcowkur
- (**webapp**): Add hover effects for info circles by @anupcowkur
- (**webapp**): Adjust tooltip positioning for info circles by @anupcowkur
- (**webapp**): Add multiple crash & ANR info circles by @anupcowkur
- (**webapp**): Add tooltips to info circles by @anupcowkur
- (**webapp**): Add user flow diagram to overview by @anupcowkur in #117
- (**webapp**): Reduce text size for delta value in info circles by @anupcowkur
- (**webapp**): Add version users & total users for to adoption info circle by @anupcowkur
- (**webapp**): Add info circles to overview by @anupcowkur in #111
- (**webapp**): Add high level filters for ovrview page by @anupcowkur in #102
- (**webapp**): Add team switcher to side nav by @anupcowkur
- (**webapp**): Change z-index and bg color for dropdown component by @anupcowkur
- (**webapp**): Change side nav selected button color to neutral-950 by @anupcowkur
- (**webapp**): Add side nav with dashboard page links by @anupcowkur in #83
- (**webapp**): Adjust landing page spacing by @anupcowkur in #65
- (**webapp**): Add hero animation to landing page by @anupcowkur in #63

### :recycle: Refactor

- (**backend**): Minor refactor to google auth (#1038) by @detj in #1038
- (**backend**): Improve interval calculation function for cpu and memory usage collectors by @abhaysood
- (**backend**): Rename authsession path by @detj
- (**backend**): Organize function order by @detj
- (**backend**): Fix typo by @detj
- (**backend**): Improve query by @detj
- (**backend**): Rename route functions by @detj
- (**backend**): Organize events by @detj
- (**backend**): Organize group methods by @detj
- (**backend**): Group pkg by @detj
- (**backend**): Filter pkg by @detj
- (**backend**): Journey by @detj
- (**backend**): Remove resource by @detj
- (**backend**): Organize group by @detj
- (**backend**): Rearrange methods by @detj
- (**backend**): Organize methods by @detj
- (**backend**): Update text pkg by @detj in #573
- (**backend**): Trim exception event by @detj
- (**backend**): Trim exception by @detj
- (**backend**): Trim lifecycle app by @detj
- (**backend**): Trim lifecycle fragment by @detj
- (**backend**): Trim lifecycle activity by @detj
- (**backend**): Trim gesture clicks by @detj
- (**backend**): Trim gesture scroll by @detj
- (**backend**): Trim gesture long click by @detj
- (**backend**): Trim app exit by @detj
- (**backend**): Trim string by @detj
- (**backend**): Trim anr by @detj
- (**backend**): Trim resource fields by @detj
- (**backend**): Trim resource by @detj
- (**backend**): Trim navigation by @detj
- (**backend**): Trim trim memory by @detj
- (**backend**): Trim http by @detj
- (**backend**): Trim network change by @detj
- (**backend**): Trim cold launch by @detj
- (**backend**): Trim hot launch by @detj
- (**backend**): Organize methods by @detj in #533
- (**backend**): Improve mapping by @detj
- (**backend**): Improve sessionator config by @detj
- (**backend**): Refactor symbols upload by @detj
- (**backend**): Use query builder for get apps (#503) by @detj in #503
- (**backend**): Use query builder for sql query by @detj in #453
- (**backend**): Use query builder to build sql by @detj
- (**backend**): Use query builder for sql query by @detj
- (**backend**): Use query builder for sql query by @detj
- (**backend**): Simplify code by @detj
- (**backend**): Use query builder to build sql by @detj
- (**backend**): Remove dead code (#452) by @detj in #452
- (**backend**): Use query builder for sql query by @detj
- (**backend**): Use query builder to build sql by @detj
- (**backend**): Use query builder for sql query by @detj
- (**backend**): Use query builder for sql query by @detj
- (**backend**): Simplify code by @detj
- (**backend**): Use query builder to build sql by @detj
- (**backend**): Remove dead code (#452) by @detj
- (**backend**): Organize code by @detj
- (**backend**): Add trim function in text pkg by @detj
- (**backend**): Remove dead code by @detj
- (**backend**): Clean up get teams api (#428) by @detj in #428
- (**backend**): Update `go.work` file by @detj in #426
- (**backend**): Update docker-compose.yml by @detj
- (**backend**): Remove symbolicator codebase by @detj
- (**backend**): Organize defer statements by @detj in #390
- (**backend**): Organize query formatting by @detj
- (**backend**): Improve health route by @detj
- (**backend**): Organize dashboard routes better by @detj
- (**backend**): Exceptions & anr schema to store in string format (#360) by @detj in #360
- (**backend**): Organize session ingestion by @detj in #327
- (**backend**): Session attachments insertion by @detj
- (**backend**): Update session insert query by @detj
- (**backend**): Improve exception & anr fingerprinting by @detj
- (**backend**): Remove unused code by @detj in #274
- (**backend**): Update cipher pkg by @detj
- (**backend**): Rename files by @detj
- (**backend**): Add measure pkg by @detj
- (**backend**): Move server into its own package by @detj in #268
- (**backend**): Update team apps get api by @detj
- (**webapp**): Format by @detj

### :books: Documentation

- (**backend**): Update self host guide by @detj
- (**backend**): Update migrations by @detj in #1052
- (**backend**): Update self-host guide by @detj in #990
- (**backend**): Update dashboard api by @detj
- (**backend**): Update sdk api docs by @detj
- (**backend**): Update sessionator readme by @detj
- (**backend**): Update dashboard api by @detj in #812
- (**backend**): Update dashboard api by @detj
- (**backend**): Update dashboard api by @detj
- (**backend**): Update dashboard api by @detj
- (**backend**): Update dashboard api by @detj
- (**backend**): Update dashboard api by @detj in #802
- (**backend**): Update dashboard api by @detj
- (**backend**): Update dashboard api by @detj in #796
- (**backend**): Update dashboard api by @detj in #758
- (**backend**): Update dashboard api by @detj
- (**backend**): Update dashboard api by @detj
- (**backend**): Update dashboard api docs by @detj in #724
- (**backend**): Update dashboard api docs by @detj in #709
- (**backend**): Update dashboard api docs by @detj
- (**backend**): Update dashboard api docs by @detj
- (**backend**): Update dashboard api docs by @detj in #699
- (**backend**): Update dashboard api docs by @detj in #690
- (**backend**): Update dashboard api docs by @detj in #688
- (**backend**): Udpate dashboard api docs by @detj in #675
- (**backend**): Update dashboard api docs by @detj
- (**backend**): Crash group crashes by @detj
- (**backend**): Update self host docs by @anupcowkur in #653
- (**backend**): Update dashboard api by @detj
- (**backend**): Update dashboard api docs by @detj
- (**backend**): Update dashboard api docs by @detj
- (**backend**): Update dashboard api docs by @detj
- (**backend**): Update dashboard api docs by @detj
- (**backend**): Update dashboard api docs by @detj
- (**backend**): Update success message by @detj
- (**backend**): Update sdk api by @detj
- (**backend**): Update sdk docs by @detj
- (**backend**): Update alert prefs docs and fix brokens subsection links by @anupcowkur
- (**backend**): Update sdk api docs by @detj in #590
- (**backend**): Update dashboard api by @detj in #581
- (**backend**): Update dashboard api docs by @detj in #551
- (**backend**): Update dashboard api docs by @detj in #543
- (**backend**): Update dashboard api docs by @detj
- (**backend**): Improve doc comment by @detj
- (**backend**): Update dashboard api by @detj in #516
- (**backend**): Update sdk api docs by @detj
- (**backend**): Update sessionator readme by @detj
- (**backend**): Update dashboard api docs by @detj in #472
- (**backend**): Update api docs by @detj
- (**backend**): Update dashboard api docs (#449) by @detj in #449
- (**backend**): Update dashboard api docs by @detj in #442
- (**backend**): Update doc comment by @detj
- (**backend**): Add docs for replay package by @detj
- (**backend**): Update doc comment by @detj
- (**backend**): Update doc comment by @detj
- (**backend**): Update self host guide by @detj in #441
- (**backend**): Add missing `role` (#438) by @detj in #438
- (**backend**): Update dashboard api docs (#433) by @detj in #433
- (**backend**): Update api docs by @detj in #425
- (**backend**): Update sesionator readme by @detj
- (**backend**): Update sessionator readme by @detj
- (**backend**): Update dashboard api docs by @detj in #411
- (**backend**): Update dashboard api docs by @detj
- (**backend**): Update dashboard api docs by @detj
- (**backend**): Update crash groups crashes api docs by @detj in #408
- (**backend**): Update events in SDK API documentation by @abhaysood in #405
- (**backend**): Update api docs by @detj in #388
- (**backend**): Update api docs by @detj
- (**backend**): Update get anr group's anrs api docs by @detj
- (**backend**): Update get crash group's crashes api docs by @detj
- (**backend**): Update get anr groups api docs by @detj
- (**backend**): Update get crash  groups docs by @detj
- (**backend**): Add code comments by @detj
- (**backend**): Add code comment by @detj
- (**backend**): Update invite api docs by @anupcowkur in #355
- (**backend**): Update API docs with Team APIs by @anupcowkur in #354
- (**backend**): Add docs for 'apps/:id/filters' API by @anupcowkur in #349
- (**backend**): Update code comments by @detj
- (**backend**): Update sessionator readme by @detj in #311
- (**backend**): Add readme by @detj in #297
- (**backend**): Improve code comments by @detj
- (**backend**): Add doc comments by @detj in #280
- (**backend**): Fix typo by @detj
- (**backend**): Update clickhouse readme by @detj in #272
- (**backend**): Update postgres readme by @detj
- (**backend**): Update clickhouse readme by @detj
- (**backend**): Update postgres readme by @detj
- (**backend**): Update postgres readme by @detj
- (**backend**): Update readme by @detj
- (**backend**): Update self host guide by @detj
- (**backend**): Add launch time metrics by @detj in #205
- (**backend**): Fix a mistake by @detj
- Add team section to README by @anupcowkur in #1077
- Update README.md by @anupcowkur in #1065
- Update contributing.md (#1059) by @detj in #1059
- Improve language by @detj in #1054
- Update self host docs by @detj
- Add info about `name` field (#1051) by @detj in #1051
- Update sessionator readme (#1032) by @detj in #1032
- Correct path for Android SDK quick start by @abhaysood in #1009
- Move CONTRIBUTING.md to main docs folder by @anupcowkur in #1004
- Move android docs by @abhaysood
- Fix doc links by @anupcowkur in #996
- Move CONTRIBUTING.md to docs by @anupcowkur in #995
- Add documentation guidelines to CONTRIBUTING.md by @anupcowkur
- Remove quickstart from docs README by @anupcowkur
- Update sessionator README by @anupcowkur in #993
- Add symbolicator-retrace README by @anupcowkur
- Update measure-go README by @anupcowkur
- Update bencmarking README by @anupcowkur
- Update measure-web-app README by @anupcowkur
- Update measure-go README by @anupcowkur
- Remove quickstart empty doc by @anupcowkur
- Update self hosting guide link in main README by @anupcowkur in #991
- Improve self host guide by @detj
- Update self host guide by @detj in #984
- Update contributing.md by @detj
- Update README philosophy by @anupcowkur
- Link new self hosting guide to main README by @anupcowkur
- Update contribution guide by @detj
- Update README with new tagline by @anupcowkur
- Improve README by @anupcowkur in #976
- Update API docs with cpu and memory usage schema changes by @abhaysood
- Add fresh self hosting guide by @detj
- Update self-host guide (#903) by @detj in #903
- Update alertPrefs api docs by @anupcowkur in #892
- Update dashboard api docs indices by @anupcowkur
- Update versioning guide by @anupcowkur in #884
- Add versioning guide by @anupcowkur in #883
- Update self-host guide by @detj
- Update sessionator docs (#833) by @detj in #833
- Update self host guide by @detj in #662
- Update docker compose by @detj
- Format sdk docs by @detj
- Improve docs by @detj
- Update sdk api by @detj
- Remove network props, locale from exception and anr docs by @abhaysood
- Events API proposal by @abhaysood
- Explain network change feature in SDK docs by @abhaysood in #556
- Improve docs by @abhaysood
- Fix typo by @abhaysood
- Explain navigation and lifecycle collection in SDK docs by @abhaysood
- Explain app exit info feature in SDK docs by @abhaysood
- Fix docs by @abhaysood
- Explain memory monitoring in SDK docs by @abhaysood
- Explain gesture tracking in SDK docs by @abhaysood
- Explain CPU usage feature in SDK docs by @abhaysood
- Improve ANR documentation by @abhaysood
- Fix ANR feature doc heading by @abhaysood
- Explain app launch tracking feature in SDK docs by @abhaysood
- Explain network monitoring feature in SDK docs by @abhaysood
- Explain ANR and Crash reporting in SDK docs by @abhaysood
- Update self-host guide (#570) by @detj in #570
- Update session-data readme by @detj in #486
- Update `session-data` readme by @detj
- Update sdk api docs by @detj
- Remove unused target_user_readable_name from gesture_click by @abhaysood in #483
- Update self-host guide (#384) by @detj in #384
- Update self-host guide (#214) by @detj in #214
- Update self-host readme by @detj
- Update docs by @detj
- Update api docs (#191) by @detj in #191
- Talk about session idempotency (#61) by @detj in #61
- Throw some light on tailing clickhouse logs (#60) by @detj in #60
- Update contribution guide (#53) by @detj in #53
- Improve self hosting guide by @detj
- Improve self hosting docs by @detj
- Wrote basic self hosting guide by @detj
- Improve meaning by @detj
- Improve meaning by @detj
- Improve meaning by @detj
- Improve meaning by @detj
- Add success & failure response shapes by @detj
- Improve meaning by @detj
- Improve meaning by @detj
- Add charset utf8 by @detj
- Fix formatting by @detj
- Add named anchors by @detj
- Fix links by @detj
- Add basic api docs by @detj
- Update measure-go readme by @detj
- Add contributing file by @detj
- (**webapp**): Replace team/:id/invite docs with /auth/invite docs by @anupcowkur in #367
- (**webapp**): Add API docs for crash & ANR groups APIs by @anupcowkur in #350

[unreleased]: https://github.com/measure-sh/measure/compare/v0.9.0..HEAD
[0.9.0]: https://github.com/measure-sh/measure/compare/v0.8.2..v0.9.0
[0.8.2]: https://github.com/measure-sh/measure/compare/v0.8.1..v0.8.2
[0.8.1]: https://github.com/measure-sh/measure/compare/v0.8.0..v0.8.1
[0.8.0]: https://github.com/measure-sh/measure/compare/v0.7.0..v0.8.0
[0.7.0]: https://github.com/measure-sh/measure/compare/v0.6.1..v0.7.0
[0.6.1]: https://github.com/measure-sh/measure/compare/v0.6.0..v0.6.1
[0.6.0]: https://github.com/measure-sh/measure/compare/v0.5.0..v0.6.0
[0.5.0]: https://github.com/measure-sh/measure/compare/v0.4.1..v0.5.0
[0.4.1]: https://github.com/measure-sh/measure/compare/v0.4.0..v0.4.1
[0.4.0]: https://github.com/measure-sh/measure/compare/v0.3.0..v0.4.0
[0.3.0]: https://github.com/measure-sh/measure/compare/v0.2.1..v0.3.0
[0.2.1]: https://github.com/measure-sh/measure/compare/v0.2.0..v0.2.1
[0.2.0]: https://github.com/measure-sh/measure/compare/v0.1.1..v0.2.0
[0.1.1]: https://github.com/measure-sh/measure/compare/v0.1.0..v0.1.1
[0.1.0]: https://github.com/measure-sh/measure/compare/v0.0.1..v0.1.0

