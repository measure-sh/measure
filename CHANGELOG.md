# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.2] - 2025-10-30

### :bug: Bug fixes

- (**backend**): Add missing values in daily summary metrics query
- (**backend**): Update daily summary email
- (**backend**): Run cleanup job at the strike of each hour (#2859)
- (**backend**): Scheduling of daily & hourly alert jobs (#2854)

### :hammer: Misc

- (**backend**): Fix pr create
- (**backend**): Fix pr create
- (**backend**): Fix commit step
- (**backend**): Fix bump dashboard
- (**backend**): Complete ship workflow
- (**backend**): Update test release workflow
- (**backend**): Correct a code comment (#2872)
- (**backend**): Update go dependencies (#2871)
- (**backend**): Improve error handling & logging (#2861)
- (**deps**): Bump github.com/wneessen/go-mail in /backend/api (#2868)
- (**deps**): Bump github.com/wneessen/go-mail in /self-host/sessionator (#2867)
- (**deps**): Bump github.com/wneessen/go-mail in /backend/alerts (#2865)

## [0.9.1] - 2025-10-28

### :bug: Bug fixes

- (**backend**): Escape & unescape single quote in user def attr strings (#2843)
- (**backend**): Avoid panic when uploading some attachments (#2830)
- (**backend**): Enable ScreenView sequential chaining in journey (#2826)
- (**backend**): Update measure logo url in email template

### :hammer: Misc

- (**backend**): Update test release workflow
- (**backend**): Rewrite release workflow
- (**backend**): Test version bump
- (**backend**): Print release notes
- (**backend**): Fix print release notes
- (**backend**): Print release notes
- (**backend**): Print release notes
- (**backend**): Print changelog
- (**backend**): Print release notes
- (**backend**): Print release notes
- (**backend**): Print bumped version
- (**backend**): Print bumped version
- (**backend**): Save next version
- (**backend**): Run on push
- (**backend**): Create ship workflow
- (**backend**): Remove hierarchical logic from journey (#2835)
- (**backend**): Update invite validity to 7 days & show it in email
- (**backend**): Deploy to staging cloud on frontend changes (#2834)
- (**frontend**): Update invalid invite copy
- (**frontend**): Only validate invite id if provided
- (**frontend**): Validate invites on login page
- (**frontend**): Hide attachments on fetch failure
- (**frontend**): Fallback to initials on user avatar load failure
- (**frontend**): Remove "Account" title from user avatar menu
- (**frontend**): Fix alpha disclaimer typo
- (**frontend**): Fix landing header button spacing for mobile
- (**frontend**): Reset posthog on redirect to login
- (**frontend**): Make "cloud" -> "Cloud" in alpha disclaimer

### :books: Documentation

- (**backend**): Update self host guide with updated nginx config info (#2821)
- (**backend**): Improve messaging (#2819)
- (**backend**): Update contribution guide (#2813)
- (**backend**): Improve slack integration guide (#2809)

## [0.9.0] - 2025-10-22

### :sparkles: New features

- (**backend**): Implement slack alerts
- (**backend**): Make the project compatible for cloud deployment (#2608)
- (**backend**): Add ability to set custom email domain
- (**backend**): Use screen view events to build journey (#2460)

### :bug: Bug fixes

- (**backend**): Fix google login for some users (#2795)
- (**backend**): Drop and recreate public schema after successful migration (#2750)
- (**backend**): Grant sufficient permissions to clickhouse role (#2735)
- (**backend**): Cloud fix symbolication (#2733)
- (**backend**): Improve concurrency safety of attachment upload operation (#2729)
- (**backend**): Grant appropriate permissions for cleanup service (#2720)
- (**backend**): Show first available user ID in session timeline
- (**backend**): Correctly load lifecycle app and fragment events (#2638)
- (**backend**): Insert metrics asynchronously (#2613)
- (**backend**): Update builds upload endpoint in sessionator (#2612)
- (**frontend**): Fix journey crash when no nodes found while search text filtering
- (**frontend**): Fix typo
- (**frontend**): Update span display to accomodate large values
- (**frontend**): Prevent span cutoff
- (**frontend**): Select timeline event even when no graph is present
- (**frontend**): Add tick rotation to fix overview sessions vs exceptions graph date overlap

### :hammer: Misc

- (**backend**): Make alerts compatible with cloud (#2783)
- (**backend**): Expose posthog environment variables so they become accessible (#2766)
- (**backend**): Add smtp related env vars for upgrading users (#2765)
- (**backend**): Add newly added slack & posthog env vars (#2761)
- (**backend**): Improve clickhouse settings for ingestion (#2749)
- (**backend**): Only deploy on staging on backend changes (#2748)
- (**backend**): Return attachment URLs for already seen requests (#2746)
- (**backend**): Improve symbolicator error logging (#2740)
- (**backend**): Make slack creds prompt optional
- (**backend**): Add option to wait for build processing in sessionator (#2738)
- (**backend**): Remove unused variable for dashboard service (#2722)
- (**backend**): Support json events request (#2710)
- (**backend**): Fix postgres connection for all services (#2717)
- (**backend**): Pin go version for all services (#2715)
- (**backend**): Use go 1.25.0-alpine for api service (#2713)
- (**backend**): Implement an allowlist for filtering authentication (#2711)
- (**backend**): Dispatch deploy on main push (#2699)
- (**backend**): Use attachments for json layout snapshots
- (**backend**): Implement json layout snapshots
- (**backend**): Improve scaling by incorporating learnings from load tests (#2668)
- (**backend**): Update daily summary email schedule & header
- (**backend**): Check for alerts at start of every hour
- (**backend**): Implement metering
- (**backend**): Ingest session start event (#2581)
- (**backend**): Drop crash + anr groups tables from postgres
- (**backend**): Implement alerts
- (**deps**): Bump form-data from 4.0.2 to 4.0.4 in /frontend/dashboard (#2636)
- (**deps**): Bump github.com/ulikunitz/xz in /self-host/sessionator (#2635)
- (**frontend**): Update measure logos in website and email
- (**frontend**): Remove console error log
- (**frontend**): Hide cloud actions + messaging in self host
- (**frontend**): Add posthog for analytics and error tracking
- (**frontend**): Update landing copy
- (**frontend**): Update landing & auth pages
- (**frontend**): Always show login button on dashboard homepage (#2708)
- (**frontend**): Show api level for Android in crash & anr distribution plots
- (**frontend**): Update milis to human readable display format
- (**frontend**): Improve os name & version display formatting
- (**frontend**): Remove "v" prefix from app version

### :coffin: Removed

- (**backend**): Remove fly deploy (#2721)

### :books: Documentation

- (**backend**): Improve slack integration guide (#2791)
- (**backend**): Update self host guide (#2764)
- (**backend**): Update contribution guide (#2763)
- (**backend**): Fix typo and format slack guide (#2736)
- (**backend**): Update slack docs
- (**backend**): Update sessionator example config (#2615)
- (**backend**): Add faq on updating environment variables (#2484)
- Document attribute key restrictions (#2485)
- Update configuration options documentation (#2446)

## [0.8.2] - 2025-07-22

### :hammer: Misc

- (**backend**): Brand team invite, removal & role change emails
- (**frontend**): Update landing page videos & flutter availability
- Ignore flutter tags in cliff config (#2440)
- Revert unwanted changes to root changelog (#2439)

### :books: Documentation

- Update README with flutter support inclusion
- Update README with new feature videos

## [0.8.1] - 2025-07-15

### :bug: Bug fixes

- (**backend**): Builds api would fail when no mappings present (#2420)

### :hammer: Misc

- (**backend**): Upgrade to orhun/git-cliff-action@v4 (#2417)

## [0.8.0] - 2025-07-15

### :sparkles: New features

- (**backend**): Support error in ios handled exceptions
- (**backend**): Add flutter exception symbolication (#2166)
- (**backend**): Implement email invites
- (**frontend**): Show ios handled exceptions in session timeline
- (**frontend**): Update charts UIs
- (**frontend**): Add collapsible sidebar with submenus
- (**frontend**): Show profile pic of logged in user
- (**frontend**): Show logged in user avatar

### :bug: Bug fixes

- (**backend**): Members were not ordered in a predictable manner (#2246)
- (**backend**): Validate & sort by os specific versioning (#2240)
- (**backend**): Remove unwanted warning on sessionator record (#2231)
- (**backend**): Metrics fetch would fail sometimes (#2191)
- (**backend**): Auto rotate compose logs (#2112)
- (**backend**): Check user & member role in team member removal, role change, invite resend & invite revoke
- (**backend**): Prevent removal or role change of member in their default team
- (**backend**): Get own team correctly when user is owner of multiple teams
- (**frontend**): Check window before accessing persisted filters
- (**frontend**): Show google login after nonce calculation
- (**frontend**): Fix sidebar inset padding
- (**frontend**): Fix misaligned chevron in dropdown select
- (**frontend**): Fixes selected app version not updating correctly
- (**frontend**): Update member roles after role change
- (**frontend**): Fix tooltip chevron colour
- (**frontend**): Fix sidebar colour
- (**frontend**): Allow concurrent GET requests
- (**frontend**): Fix infinite loop in dropdown select
- (**frontend**): Fix incorrect parsing of url filters
- (**frontend**): Fix error on app name change
- (**frontend**): Add missing css semicolons
- (**frontend**): Fix metadata for social preview links
- (**frontend**): Select first root span available if url span invalid
- (**frontend**): Update filters on ready state change
- (**frontend**): Relaxes cookie restricitions in dev
- (**frontend**): Improve teams error UI on change role & remove member errors
- (**frontend**): Filters not updating on no data/not onboarded states

### :hammer: Misc

- (**backend**): Modify production dashboard compose (#2410)
- (**backend**): Reverse proxy all dashbaord apis using nextjs rewrites (#2406)
- (**backend**): Update sessionator clean commands
- (**backend**): Add versioning column for bug reports table
- (**backend**): Handle empty dir cases in sessionator (#2329)
- (**backend**): Move crash + anr groups to clickhouse
- (**backend**): Improve workflow security (#2255)
- (**backend**): Remove unused ios session data (#2254)
- (**backend**): Upgrade go dependencies (#2252)
- (**backend**): Remove "Own Team Id" from access token
- (**backend**): Delete stale auth sessions in cleanup
- (**backend**): Use cookies to store access + refresh tokens
- (**deps**): Bump golang.org/x/net from 0.37.0 to 0.38.0 in /backend/api (#2127)
- (**deps**): Bump golang.org/x/net in /backend/cleanup (#2126)
- (**deps**): Bump golang.org/x/net in /self-host/sessionator (#2124)
- (**frontend**): Use circle checkbox for multi select dropdown for clearer selected state differentiation
- (**frontend**): Save journey type as part of url
- (**frontend**): Fix typo in bug reports search placeholder
- (**frontend**): Replace journey with sessions graph in overview
- (**frontend**): Organise imports
- (**frontend**): Update positive toast text copy
- (**frontend**): Select new team on team create
- (**frontend**): Show toast on team name change
- (**frontend**): Adjust apps and teams pages UIs
- (**frontend**): Move team creation to dialog
- (**frontend**): Update loading and error states
- (**frontend**): Use loading spinner instead of loading text
- (**frontend**): Move app creation to dialog flow
- (**frontend**): Update integration guide link
- (**frontend**): Update apps page UI
- (**frontend**): Update session mem & cpu graphs
- (**frontend**): Update apps page ui with better section differentiation
- (**frontend**): Reduce loading spinner size
- (**frontend**): Avoid page reload on app name change
- (**frontend**): Avoid table reload during members, roles & invites updates in team page
- (**frontend**): Remove redundant 'rounded-md' in buttons
- (**frontend**): Update teams page UI
- (**frontend**): Add toasts
- (**frontend**): Update positive & negative toast variants
- (**frontend**): Use new alert dialogs and toasts
- (**frontend**): Make table rows links
- (**frontend**): Make metrics card larger in small screens
- (**frontend**): Update metrics UI
- (**frontend**): Update stacktrace bg + line height
- (**frontend**): Update table UIs
- (**frontend**): Update stack trace UI
- (**frontend**): Standardise buttons, links, inputs using Button component and standard styles
- (**frontend**): Update filter pills ui
- (**frontend**): Show filters focus ring only on keyboard nav
- (**frontend**): Update filters ui
- (**frontend**): Use Button component in sidebar
- (**frontend**): Update social preview links metadata
- (**frontend**): Move gsi client script inside google-sign-in component

### :books: Documentation

- (**backend**): Fix incorrect command in contributing guide (#2414)
- (**backend**): Add smtp configuration to self host guide (#2412)
- (**backend**): Update sdk api documentation
- (**backend**): Update clickhouse migration docs (#2264)
- (**backend**): Add low memory note for podman on macos (#2169)
- (**backend**): Add faq for nginx conf in self host guide (#2146)
- (**backend**): Update self host guide (#2139)
- (**backend**): Add banner in contributing (#2101)
- Improve SDK documentation (#2256)
- Format sdk api docs (#2144)
- Add a faqs page in docs (#2141)
- Remove defunct command from contribution guide (#2137)
- Update github-oauth.md (#2131)

## [0.7.0] - 2025-04-15

### :sparkles: New features

- (**frontend**): Handle nav link clicks on same page
- (**frontend**): Update iOS availability on landing page
- (**frontend**): Update landing page with bug reports feature

### :bug: Bug fixes

- (**backend**): Add podman support (#2055)

### :hammer: Misc

- (**frontend**): Refactor auth utils to MeasureAuth
- (**frontend**): Save page state using urls

### :books: Documentation

- Update sdk api readme (#2045)
- Update bug reports feature video from mov to webm
- Update iOS availability in README
- Update README with bug reports feature

## [0.6.1] - 2025-03-28

### :bug: Bug fixes

- (**backend**): Broken builds api for older android sdks (#1984)

## [0.6.0] - 2025-03-27

### :sparkles: New features

- (**backend**): Symbolicate ttid span classes (#1947)
- (**backend**): Integrate new cross-platform symbolicator with ios support (#1800)
- (**backend**): Implement bug reports
- (**backend**): Add user defined attrs to spans
- (**backend**): Support dsym mapping type in sessionator (#1774)
- (**backend**): Add support for iOS exceptions (#1726)
- (**frontend**): Update bug report details desc text size
- (**frontend**): Adjust bug report table text sizes
- (**frontend**): Update website description
- (**frontend**): Show bug reports in session timeline
- (**frontend**): Show user def attrs in bug report details
- (**frontend**): Add build number to session replay attr display
- (**frontend**): Match bug report attr display style with others
- (**frontend**): Rename button to "Close/Re-Open Bug Report"
- (**frontend**): None selection option in filters dropdown
- (**frontend**): Implement ud attr filters
- (**frontend**): Add discord support link to dashboard nav

### :bug: Bug fixes

- (**backend**): Incorrect data backfill script (#1978)
- (**backend**): Mismatch and duplicate sessions (#1974)
- (**backend**): Filter duplicate ud attribute keys (#1967)
- (**backend**): Broken session pagination with user defined attrs (#1948)
- (**backend**): Anr exception type was not symbolicated (#1944)
- (**backend**): Remove mapping file size validation (#1935)
- (**backend**): Fix partial android symbolication (#1933)
- (**backend**): Fix a panic during anr symbolication (#1927)
- (**backend**): Fix issue with sessionator clean-all flag (#1924)
- (**backend**): Fixed an issue where clock_speed validation was failing for iOS (#1907)
- (**backend**): Fix errors in sessionator record & ingest (#1902)
- (**backend**): Codeql integer conversion error (#1897)
- (**backend**): Sessionator would fail deleting objects (#1891)
- (**backend**): Svg layout attachments are not visible sometimes (#1777)
- (**backend**): Clean up event batches stuck for a long time (#1770)
- (**backend**): Only apply span statuses where clause if available
- (**backend**): Query all user defined attributes (#1738)
- (**frontend**): Improve crash display for ios (#1916)
- (**frontend**): Handle session timeline with no events
- (**frontend**): Handle no events selected case in session timeline
- (**frontend**): Make user def attr dropdown stay in viewport
- (**frontend**): Hide filter pill when no span statuses are selected
- (**frontend**): Set default session type to All

### :hammer: Misc

- (**backend**): Add data backfill for upcoming release (#1977)
- (**backend**): Change compose command detection logic (#1962)
- (**backend**): Update migration script for seamless migration (#1937)
- (**backend**): Support .dylib mapping files in ios (#1914)
- (**backend**): Send attachments for more gesture events
- (**backend**): Clean more resources in sessionator (#1899)
- (**backend**): Update go deps (#1896)
- (**backend**): Update go toolchain version (#1894)
- (**backend**): Update ci changelog (#1893)
- (**backend**): Rename span api endpoints for consistency
- (**backend**): Refactor event, attachment & span cleanup
- (**backend**): Cleanup stale bug reports
- (**backend**): Tidy sessionator `go.mod` (#1776)
- (**backend**): Add sessionator data (#1772)
- (**backend**): Add lifecycle app type for ios (#1767)
- (**backend**): Add `--skip-apps` option (#1744)
- (**backend**): Replace email with new user login log
- (**backend**): Sync `go.work.sync` (#1717)
- (**backend**): Update go dependencies (#1716)
- (**backend**): Update dependencies (#1714)
- (**backend**): Log email instead of sending to waitlist
- (**backend**): Support `flutter` & `rn` in cliff config (#1705)
- (**backend**): Add new scopes to commitlint (#1703)
- (**deps**): Bump github.com/golang-jwt/jwt/v5 in /backend/api (#1964)
- (**deps**): Bump cross-spawn from 7.0.3 to 7.0.6 in /frontend/dashboard (#1711)
- (**deps**): Bump next from 14.2.13 to 14.2.22 in /frontend/dashboard (#1710)
- (**deps**): Bump nanoid from 3.3.7 to 3.3.8 in /frontend/dashboard (#1708)
- (**deps**): Bump golang.org/x/crypto in /backend/cleanup (#1707)
- (**deps**): Bump golang.org/x/crypto in /backend/api (#1701)
- (**frontend**): Update next js to 14.2.26
- (**frontend**): Render attachments for more gesture events
- (**frontend**): Refactor FiltersApiType to FilterSource
- (**frontend**): Upgrade to nivo 0.88
- (**frontend**): Update to tailwind 4.0 with dashboard container file sync
- (**frontend**): Change font-sans to font-body
- (**frontend**): Refactor details link fetch in session timeline event details
- (**frontend**): Rename session 'replay' to 'timeline'
- (**frontend**): Remove 'font-regular'
- (**frontend**): Rename font variables
- (**frontend**): Add .node-version
- (**frontend**): Update iOS lifecycle events display name
- (**frontend**): Rename "None" to "Clear"
- (**frontend**): Allow unchecking last item in dropdown select if "None" is available
- (**frontend**): Remove "None" for app version selection
- (**frontend**): Update landing page + readme with perf traces
- Add wikipedia sessionator data (#1936)
- Add wikipedia sessionator data (#1929)
- Add sessionator data (#1911)
- Add sessionator data (#1908)
- Improve automated changelog formatting (#1706)

### :books: Documentation

- (**backend**): Update sdk api docs (#1918)
- (**backend**): Improve self hosting faq section (#1728)
- (**backend**): Address clickhouse high cpu usage (#1727)
- Update sdk readme (#1118)
- Update readme
- (**readme**): Update banner image

## [0.5.0] - 2025-01-06

### :sparkles: New features

- (**backend**): Show traces in session timeline
- (**backend**): Ios session timeline (#1624)
- (**backend**): Support ios event ingestion (#1587)
- (**backend**): Add span support
- (**backend**): Support custom events (#1554)
- (**backend**): Support user defined attributes (#1529)
- (**frontend**): Add memory usage absolute plot in session timeline (#1625)
- (**frontend**): Make whole checkbox container clickable in dropdown select component
- (**frontend**): Show user defined attrs in session timeline

### :bug: Bug fixes

- (**backend**): Log extra info during ingestion failure (#1686)
- (**backend**): Duplicate sessions shown in sessions overview (#1668)
- (**backend**): Nil pointer dereference in remove apps (#1654)
- (**backend**): Dashboard no longer depends on api service (#1653)
- (**backend**): Handle large numbers in user defined attributes gracefully (#1644)
- (**backend**): Add session id to free text search
- (**backend**): Sessionator ingestion failure (#1622)
- (**backend**): Handle checkpoint parsing in GetTrace
- (**backend**): Unexpected shortcodes gets created sometimes (#1603)
- (**backend**): Improve ios support (#1599)
- (**backend**): Format checkpoints for ingestion
- (**backend**): Make span name query param
- (**backend**): Validate required event & span attributes (#1590)
- (**backend**): Discard batch if it contains duplicate event or span ids (#1588)
- (**backend**): Filter versions and os versions securely (#1563)
- (**frontend**): Handle incorrect http event display in session timeline
- (**frontend**): Show memory usage in mbs in session timeline (#1679)
- (**frontend**): Made api key input read only to fix warnings (#1657)
- (**frontend**): Check onboarding status after filters api call
- (**frontend**): Fix span sorting & null checkpoints handling
- (**frontend**): Place span durations above bar
- (**frontend**): Retain overflowing span name bg color
- (**frontend**): Round millis to nearest int
- (**frontend**): Fix root span names api call
- (**frontend**): Handle empty user_defined_attrs in session timeline
- (**frontend**): Don't update filters on selectedApp change

### :hammer: Misc

- (**backend**): Remove unneeded log lines (#1687)
- (**backend**): Update user defined attributes sample session
- (**backend**): Cleanup expired resources (#1655)
- (**backend**): Remove all app resources in sessionator (#1647)
- (**backend**): Update sessionator example config (#1632)
- (**backend**): Add new sessions
- (**backend**): Add span limits
- (**backend**): Revert deletion of session data with spans
- (**backend**): Support layout_snapshot attachments for gesture click
- (**backend**): Made span queries secure (#1566)
- (**backend**): Update sessionator deps (#1553)
- (**backend**): Remove unused code (#1545)
- (**backend**): Add sample sessions
- (**backend**): Ingest low power and thermal throttling attributes
- (**frontend**): Remove "|| null" from empty metrics sample
- (**frontend**): Remove old journey code
- (**frontend**): Remove clarity
- (**frontend**): Clear span statuses in filters
- (**frontend**): Improve custom event ui in session timeline
- (**frontend**): Improve user def attrs spacing
- (**frontend**): Adjust dropdown select popup position & width
- (**frontend**): Remove cursor pointer style
- (**frontend**): Support attachments for gesture click
- (**frontend**): Truncate class names in session timeline event titles
- (**frontend**): Delete unused url filters code

### :recycle: Refactor

- (**backend**): Use aws-sdk-go-v2 for object uploads (#1675)

### :books: Documentation

- (**backend**): Document short filters api (#1552)
- (**backend**): Document rename app api (#1547)

## [0.4.1] - 2024-11-11

### :bug: Bug fixes

- (**backend**): Use specific clickhouse image version (#1517)

### :books: Documentation

- (**backend**): Fix typos and missing info (#1513)

## [0.4.0] - 2024-11-07

### :sparkles: New features

- (**backend**): Use short codes for list filters

### :bug: Bug fixes

- (**backend**): Validate limit to not be zero (#1500)
- (**backend**): Incorrect pagination when no data (#1499)
- (**backend**): Optimize session detail apis and overall loading experience (#1490)
- (**frontend**): Handle no data case for sessions list
- (**frontend**): Truncate matched free text
- (**frontend**): Better pagination in session detail (#1491)
- (**frontend**): Handle empty attr distributions

### :hammer: Misc

- (**backend**): Add migration guide & script for next version (#1512)
- (**backend**): Remove backfilling migrations (#1511)
- (**backend**): Change postgres compose config (#1509)
- (**backend**): Change index type in sessions table (#1505)
- (**backend**): Add skip indexes for sessions table (#1492)
- (**frontend**): Set default session type filter to all issues
- (**frontend**): Update landing page exceptions video
- (**frontend**): Standardise paginator UI
- (**frontend**): Cancel in-flight requests
- (**frontend**): Update exceptions landing video

### :books: Documentation

- (**backend**): Document sessions overview list api (#1502)
- Update exceptions demo video in README
- Update exceptions demo video in README

## [0.3.0] - 2024-11-01

### :sparkles: New features

- (**frontend**): Replace exception detail journey with attr distribution plot
- (**frontend**): Add new UI for session replay
- (**frontend**): Persist paginator on master detail nav
- (**frontend**): Add search bar to dropdown component
- (**frontend**): Use sankey graphs for journeys
- (**frontend**): Add filters to urls

### :bug: Bug fixes

- (**backend**): Improve crash/anr detail experience (#1451)
- (**backend**): Improve dashboard api response times (#1404)
- (**backend**): Occasional runtime panic during ingestion (#1345)
- (**backend**): Increase app version character limit (#1342)
- (**backend**): Increase thread name character limit (#1341)
- (**backend**): Prevent duplicate ingestion of events (#1331)
- (**backend**): Improve security posture (#1303)
- (**frontend**): Crash detail not showing id (#1453)
- (**frontend**): Hot launch metric was incorrectly showing warm launch metric (#1448)
- (**frontend**): Some dashboard apis were failing due to lack of url encoding (#1449)
- (**frontend**): Handle empty mem/cpu graph in session replay
- (**frontend**): Calculate time diff b/w filtered events
- (**frontend**): Fix nav aside scroll on detail content exceeding screen area
- (**frontend**): Handle empty file/method name
- (**frontend**): Handle empty file/method name for crashes/anrs
- (**frontend**): Limit height of dropdown component
- (**frontend**): Improve exception/anr details plot ui
- (**frontend**): Disable appending filters to URLs
- (**frontend**): Update app name on selected app change
- (**frontend**): Improve security posture (#1305)

### :hammer: Misc

- (**backend**): Remove deprecated cliff feature (#1462)
- (**backend**): Apply suitable restart policy (#1458)
- (**backend**): Add data skipping indexes for fingerprints (#1455)
- (**backend**): Prevent db statement leaks (#1318)
- (**backend**): Search sessions by screen view
- (**backend**): Integrate screen view event with session replay
- (**backend**): Ingest screen view event
- (**backend**): Add screen view sample sessions
- (**frontend**): Improve exception details loading state
- (**frontend**): Update default time filter to last 6 hours
- (**frontend**): Update landing page videos
- (**frontend**): Add loading states
- (**frontend**): Remove legends & add versions in tooltips to exception & sessions overview plots
- (**frontend**): Add loading spinners for plot components
- (**frontend**): Go directly to dashboard if logged in

### :books: Documentation

- (**backend**): Update incorrect json key name (#1363)
- Improve spelling in readme (#1460)
- Add videos to README
- Add call to action for star to README

## [0.2.1] - 2024-09-25

### :bug: Bug fixes

- (**backend**): Crash/anr details instances plot won't load sometimes (#1298)
- (**frontend**): Add option to handle no data & not onboarded in filters

### :books: Documentation

- Update release one liner command (#1294)

## [0.2.0] - 2024-09-24

### :sparkles: New features

- (**backend**): Update warm launch schema and duration calculation
- (**backend**): Track email on new user sign in
- (**backend**): Improve session explorer
- (**backend**): Add session explorer with text search filter
- (**frontend**): Add custom error page
- (**frontend**): Add custom 404 page
- (**frontend**): Update tooltips
- (**frontend**): Link to crash/anr details from session replay
- (**frontend**): Add 'Last 6 months' date range option
- (**frontend**): Add detailed filters to crash + anr overview pages
- (**frontend**): Add filter for OS versions
- (**frontend**): Add 'All', 'Latest' options + 'at least 1' enforcement
- (**frontend**): Redesign apps page

### :bug: Bug fixes

- (**backend**): Overview instance plot would not load for some cases (#1288)
- (**backend**): Round crash rate metrics to 2 decimal places
- (**backend**): Update warm_launch ingest
- (**backend**): Set warm launch duration threshold to 10s
- (**backend**): Use client timezone for plots
- (**backend**): Round crash and anr contribution percentage to 2 decimal places (#1221)
- (**backend**): Addressed ingestion failures related to ip inspection (#1197)
- (**backend**): Nil pointer dereference when ingesting `low_memory` events (#1190)
- (**frontend**): Hide attachment data in session replay event body
- (**frontend**): Only attempt to show attachments for crashes/anrs in sesion replay
- (**frontend**): Add missing useEffect deps for journey
- (**frontend**): Use whole int left axes for crash + anr instances plots

### :hammer: Misc

- (**backend**): Capture more details in otel traces (#1289)
- (**backend**): Add new sessions
- (**backend**): Remove compose profile
- (**backend**): Enable sessionator parallel ingest (#1220)
- (**backend**): Add os_page_size attribute
- (**backend**): Additional log for anomalous cold launch duration (#1199)
- (**backend**): Format log line (#1189)
- (**backend**): Sessionator `--clean-all` flag (#1187)
- (**frontend**): Use selected filters instead of expanded params
- (**frontend**): Fix table column widths and move paginator to top right
- (**frontend**): Refactor filter application to api calls
- (**frontend**): Refactor time utils to have separate functions for human readable datetime, date only and time only

### :books: Documentation

- (**backend**): Add self host upgrade guide (#1291)
- (**backend**): Improve sessionator readme (#1188)
- Update README.md
- Improved language and formatting for working with databases (#1198)
- Update discord link

## [0.1.1] - 2024-08-31

### :bug: Bug fixes

- (**backend**): Handle no selected versions for app journey & metrics

## [0.1.0] - 2024-08-30

### :sparkles: New features

- (**frontend**): Add "Copy AI context" button

### :bug: Bug fixes

- (**backend**): Fix incorrect filter query for crash & anr groups
- (**backend**): Proceed with event ingestion on symbolication failure
- (**backend**): Handle exception/anr groups with no events

### :hammer: Misc

- (**backend**): Reorder & cleanup postgres migrations (#1155)
- (**backend**): Remove eventIds array from crash + anr groups
- (**backend**): Fix session data (#1141)
- (**frontend**): Remove commented code
- (**frontend**): Update landing hero animation
- Update root `package.json`

### :books: Documentation

- Add specific types to numbers in SDK API docs
- Fix typo in README
- Update self host guide
- Update contributing guide
- Add code of conduct
- Add PR template
- Add issue template
- Add feature request template
- Add security policy
- Add discord link to README
- Fix formatting (#1094)
- Fix broken link
- Update self host guide
- Improve self host guide

## [0.0.1] - 2024-08-20

### :sparkles: New features

- (**backend**): Add stale data cleanup service
- (**backend**): Improve crash + anr grouping
- (**backend**): Add app settings read/write api
- (**backend**): Add get usage stats api
- (**backend**): Implement new schema for navigation event
- (**backend**): Migrate to self-hosted postgres
- (**backend**): Update alert perfs to be per user per app
- (**backend**): Add alert_prefs table with read+write APIs
- (**backend**): Support http request and response body
- (**backend**): Add navigation event
- (**backend**): Ingest cpu and memory performance metrics
- (**backend**): Ingest http event
- (**backend**): Remove http_request and http_response events
- (**backend**): Ingest device_locale with ANR & exception
- (**backend**): Ingest device_locale with resource
- (**backend**): Add network properties to resource
- (**backend**): Track n/w props for ANR & exception
- (**backend**): Ingest network change event
- (**backend**): Ingest cold, warm and hot launch
- (**backend**): Add new attachment type: android_method_trace
- (**backend**): Ingest cold launch event (#158)
- (**backend**): Ingest lifecycle events (#134)
- (**backend**): Upload session attachments (#124)
- (**backend**): Implement symbolicator with retrace (#126)
- (**backend**): Add symbolication (#79)
- (**webapp**): Enable retention period app setting
- (**webapp**): Add date selection presets to filters
- (**webapp**): Update exceptions overview list format
- (**webapp**): Show title & description for exception groups
- (**webapp**): Add base url to apps page
- (**webapp**): Add data retention read/write to apps page
- (**webapp**): Show usage stats in pie chart
- (**webapp**): Add usage stats UI
- (**webapp**): Add different colour for handled exceptions in session replay
- (**webapp**): Fade out non-path journey nodes on hover
- (**webapp**): Hightlight path to hovered node in journey
- (**webapp**): Persist selected app & dates filters across pages
- (**webapp**): Update navigation event title
- (**webapp**): Add screenshots to exception details + session events
- (**webapp**): Add custom tooltip for crash/anr group details plot
- (**webapp**): Update exceptions overview plot with api data
- (**webapp**): Add detailed filters support for exception detail journey plot
- (**webapp**): Add exception detail journey plot
- (**webapp**): Make journey unidirectional
- (**webapp**): Update crash/anr group details plot with api data
- (**webapp**): Add multi app version select to overview page
- (**webapp**): Set journey min zoom
- (**webapp**): Add zoom buttons to journey map
- (**webapp**): Remove hack to animate title in journey node
- (**webapp**): Color journey bg reflecting issue contribution
- (**webapp**): Change journey error node & contrib indicator colours
- (**webapp**): Update journey ui & data format
- (**webapp**): Remove slack from alert prefs UI
- (**webapp**): Clear updatePrefsMsg on selected app change
- (**webapp**): Integrate alert prefs APIs
- (**webapp**): Add slack connect button & status indicator to Alerts UI
- (**webapp**): Remove team member & role change alerts UI
- (**webapp**): Update checkbox styles
- (**webapp**): Add an alerts page to configure notification options
- (**webapp**): Improve journey node expansion animation
- (**webapp**): Update journey to flow graph in overview page
- (**webapp**): Change overview journey to network graph
- (**webapp**): Update overview page to show session metrics
- (**webapp**): Format session replay timeline event bodies
- (**webapp**): Implement version codes in filters
- (**webapp**): Change session replay events timeline animation
- (**webapp**): Improve session replay event details UI
- (**webapp**): Format sesssion replay event titles based on event types
- (**webapp**): Format & use localised, readable date times everywhere
- (**webapp**): Improve small screen UI for session replay
- (**webapp**): Use params to persist and pass around dates
- (**webapp**): Add filters to session replay event timeline
- (**webapp**): Update session replay event timeline scale
- (**webapp**): Add scrolling animations to session replay event timeline
- (**webapp**): Show session duration in session replay
- (**webapp**): Animate cpu + mem charts in session replay
- (**webapp**): Add more event type based colours to session replay timeline
- (**webapp**): Add time diff based vertical dividers to session replay event timeline
- (**webapp**): Update memory + cpu graphs in session replay
- (**webapp**): Change from thread chart to basic event timeline for session replay
- (**webapp**): Use millisecond precision for session replay charts
- (**webapp**): Implement session replay with API data
- (**webapp**): Implement session replay with API data
- (**webapp**): Show team creation success dialog in Teams page
- (**webapp**): Add create team functionality to Team page
- (**webapp**): Improve pagination loading state handling in Crashes + ANRs overview
- (**webapp**): Implement ANRs overview and details
- (**webapp**): Integrate apps, filters and crash details APIs into Crash Details page
- (**webapp**): Use paginated crashes API in Crashes page
- (**webapp**): Add pagination to Crashes page
- (**webapp**): Update CheckboxDropdown component and select all version filters in Crashes on init
- (**webapp**): Update landing page animations
- (**webapp**): Fetch crash groups list in Crashes page from API
- (**webapp**): Fetch apps+filters from API in Crashes page
- (**webapp**): Highlight team, role & member better in Team confirmation dialogs
- (**webapp**): Show member email & team name in Team member removal confirmation dialog
- (**webapp**): Show member email, old & new roles in Team member role change confirmation dialog
- (**webapp**): Include old & new names in Team name change confirmation dialog
- (**webapp**): Hide change role & remove user for current user in Team page
- (**webapp**): Add ability to remove team members
- (**webapp**): Change role using API in Team page
- (**webapp**): Fetch authz roles from API and set invite roles dropdown accordingly
- (**webapp**): Fetch team members from API
- (**webapp**): Handle invite member states - success, error, loading and auth error
- (**webapp**): Add team rename feature in Team page
- (**webapp**): Add copy API key functionality to CreateApp component & Apps page
- (**webapp**): Fetch & display apps from api in Apps page
- (**webapp**): Add CreateApp to apps page
- (**webapp**): Handle no apps/no data for app cases in Overview page
- (**webapp**): Use supabase auth token to make API calls
- (**webapp**): Update navigation to use API retrieved app ids
- (**webapp**): Fetch overview filters from filters api
- (**webapp**): Fetch app launch time overview metrics from API
- (**webapp**): Fetch metrics overview data from API
- (**webapp**): Fetch user flow data from API in overview page
- (**webapp**): Add "Sign-in and sign-up with Google" (#163)
- (**webapp**): Logout (#153)
- (**webapp**): Add basic signup/in flow (#150)

### :bug: Bug fixes

- (**backend**): Google auth (#1022)
- (**backend**): Update memory usage struct
- (**backend**): Remove validation for 0 percentage usage as it's valid value
- (**backend**): Update app.go with new percwentage_usage field
- (**backend**): Allow zero interval as it's valid value for first event
- (**backend**): Ignore cold launch greater than 30s for metrics calculation
- (**backend**): Update method comments to match code
- (**backend**): Authn issue
- (**backend**): Handle no teams
- (**backend**): Anr overview mismatch
- (**backend**): Exception overview mismatch
- (**backend**): Anr not found
- (**backend**): Exception not found
- (**backend**): Update sesssion replay
- (**backend**): Incorrect launch metrics delta (#811)
- (**backend**): Filter using time range
- (**backend**): Anr overview plot instances
- (**backend**): Exception overview plot instances
- (**backend**): Modify anr grouping
- (**backend**): Update exception groups query
- (**backend**): Journey grap build (#803)
- (**backend**): Make from and source optional for navigation event
- (**backend**): Fix missing fields in session replay
- (**backend**): Use correct index when iterating exceptions and anrs
- (**backend**): Fix network type validation
- (**backend**): Modify session data to use non-nullable network properties
- (**backend**): Update session replay (#765)
- (**backend**): Metrics api errorneous 500 (#766)
- (**backend**): Attachment processing
- (**backend**): Anr overview plot query
- (**backend**): Crash overview plot query
- (**backend**): Response of anr plot
- (**backend**): Response of crash plot
- (**backend**): Journey issue count (#679)
- (**backend**): Format anr stacktrace
- (**backend**): Modify stacktrace
- (**backend**): Add authz in metrics (#658)
- (**backend**): Fix failing test
- (**backend**): No data for size
- (**backend**): No data for perceived anr free
- (**backend**): No data for perceived crash free
- (**backend**): No data for anr free sessions
- (**backend**): No data for crash free sessions
- (**backend**): Handle no data for adoption
- (**backend**): Add missing query close
- (**backend**): Broken crash group list api (#545)
- (**backend**): Broken sesion replay api (#540)
- (**backend**): Make mapping file optional
- (**backend**): Ingest http client
- (**backend**): Fix clickhouse schema
- (**backend**): Issue with uploading build
- (**backend**): Update cpu usage compute
- (**backend**): Bug with launch time processing
- (**backend**): Add validation check
- (**backend**): Handle error when no teams (#498)
- (**backend**): `app_exit` validation (#479)
- (**backend**): Incorrect struct tag
- (**backend**): Unused code
- (**backend**): Extra parameter
- (**backend**): Add missing `defer` keyword
- (**backend**): Incorrect struct tag
- (**backend**): Unused code
- (**backend**): Extra parameter
- (**backend**): Non-consistent pagination issues
- (**backend**): Non-consistent pagination issues
- (**backend**): Consistent grouping pagination
- (**backend**): Set default limit for filters api (#386)
- (**backend**): Incorrect query syntax
- (**backend**): Incorrect counting of exceptions/anrs grouping (#336)
- (**backend**): Accept zero events session (#328)
- (**backend**): Update anr group filters api
- (**backend**): Update crash group filters api
- (**backend**): Remove time range in event filters query
- (**backend**): Remove time range in app filters query
- (**backend**): Change time range validation behavior
- (**backend**): Don't set default time range
- (**backend**): Session ingestion failure with http request & response
- (**backend**): Nonce mismatch with google signin
- (**backend**): Anr grouping
- (**backend**): Revamp symbolication need detection logic (#305)
- (**backend**): Retrace frame parsing (#300)
- (**backend**): Lookup country by ip (#291)
- (**backend**): Respond with bad request on team not found (#281)
- (**backend**): Handle existing & new invitee(s)
- (**backend**): Panics if api key is supplied in place of access token (#279)
- (**backend**): Role validation logic (#270)
- (**backend**): Add validation for thread name in anr and exception
- (**backend**): Increase thread name max size to 64
- (**backend**): Pre authz logic for teams
- (**backend**): Change teamId to id to match client response expectation
- (**backend**): Use correct table name in CH migrations
- (**backend**): Invalid error format (#215)
- (**backend**): Use correct column name in query to get mapping key
- (**backend**): Validate all events (#142)
- (**backend**): Resolve go-staticcheck warnings (#116)
- (**backend**): Partial symbolication should work (#113)
- (**backend**): Separate anrs (#110)
- (**backend**): Issues with types (#107)
- (**backend**): Fix schema for gestures (#101)
- (**backend**): Accept session if no mapping file (#97)
- (**backend**): Retrace symbolication algorithm (#93)
- (**backend**): App_exit symbolication (#91)
- (**backend**): Change names of exception columns (#52)
- (**frontend**): Use node env for auth.ts jest test
- (**webapp**): Remove env checks causing vercel build failure
- (**webapp**): Import lottie dynamically to fix ssr error
- (**webapp**): Incorrect landing page video borders
- (**webapp**): Add missing id attribute to inline script
- (**webapp**): Use &apos; instead of apostrophe
- (**webapp**): Lottie-react wrongfully added to project root
- (**webapp**): Show formatted y value in tooltip in cpu usage graph
- (**webapp**): Set max height for session replay event vertical connectors
- (**webapp**): Handle 0 delta cases in metrics display
- (**webapp**): Fix launch time showing '0x faster' as delta
- (**webapp**): Handle invalid selected app in persisted filters
- (**webapp**): Remove hover,active & focus states on disabled buttons
- (**webapp**): Self-hosted check
- (**webapp**): Prevent unnecessary useEffect calls
- (**webapp**): Expand journey node on title hover only
- (**webapp**): Decode title in exceptions details page
- (**webapp**): Use slices tooltips for exceptions plots
- (**webapp**): Fix typo in perceived anr free sessions metric tooltip
- (**webapp**): Use full width in exception pages
- (**webapp**): Handle null app size metrics
- (**webapp**): Remove session replay event timeline animation
- (**webapp**): Fix area gradient opacity in cpu chart
- (**webapp**): Rotate mem & cpu chart ticks to reduce overlap
- (**webapp**): Set cpu graph max value to 100 and 5 ticks
- (**webapp**): Remove decimal precision from memory graph tooltip
- (**webapp**): Make filter end date include all day
- (**webapp**): Hide detail filters in exception overview page
- (**webapp**): Show crash or anr legend correctly in group details plot
- (**webapp**): Handle invalid date input in date filters
- (**webapp**): Update UI to handle chained exceptions
- (**webapp**): Pick exception thread name correctly in crash/anr details
- (**webapp**): Improve messaging for no Crashes/ANRs
- (**webapp**): Fix date selectors allowing dates later than today
- (**webapp**): Append crash or anr query param to filters api
- (**webapp**): Handle null cpu & memory data in session replay
- (**webapp**): Update api response handling
- (**webapp**): Set mock timezone for time_utils tests
- (**webapp**): Fix incorrect session replay event timestamp state format
- (**webapp**): Fix chart datetime format
- (**webapp**): Updated alert prefs not reflecting in UI
- (**webapp**): Set updatedAlertPrefs on fetch alert prefs API success
- (**webapp**): Fix version and codes query params in metrics API call
- (**webapp**): Fix change role being incorrectly enabled
- (**webapp**): Avoid calling APIs that need app id before it's set
- (**webapp**): Ellipsize overflowing dropdown items
- (**webapp**): Fix session duration human readable display
- (**webapp**): Fix session replay event timeline sorting
- (**webapp**): Display correct stacktrace thread name
- (**webapp**): Disable side nav link if current page is same as link
- (**webapp**): Fix event timeline animation jittering
- (**webapp**): Sort events by timestamp in session replay event timeline
- (**webapp**): Remove unneeded IDs in DangerConfirmationModal comoponent
- (**webapp**): Fix placeholder text in create new team input field
- (**webapp**): Fix typo in method name
- (**webapp**): Add key id + timestamp only when pagination has actually occured
- (**webapp**): Select all versions on filters fetch in Crashes page
- (**webapp**): Handle empty state of crash groups list fetch in Crashes page
- (**webapp**): Update nivo charts to latest version to fix rendering issues
- (**webapp**): Update invite API
- (**webapp**): Refresh team members after inviting
- (**webapp**): Fix invite member api call & update docs
- (**webapp**): Upadte apps fetch API error msg
- (**webapp**): Fix invite member request failing
- (**webapp**): Handle not onboarded & no data cases separately
- (**webapp**): Use 'onboarded' flag in apps API response to set filter status
- (**webapp**): Update filters api json response parsing in Overview page
- (**webapp**): Hide Team change role confirmation dialog on cancel click
- (**webapp**): Handle existing invite flow
- (**webapp**): Set remove member API error message correctly
- (**webapp**): Handle can_change_roles being null in Team page
- (**webapp**): Incorrect formatting in invite message
- (**webapp**): Fix TeamSwitcher text overflow
- (**webapp**): Show API key in create app from new apps API response format
- (**webapp**): Fix typo
- (**webapp**): Put conditional state inside useState to avoid calling useState conditionally
- (**webapp**): Add missing return on overview filters api failure
- (**webapp**): Update param names for journey & metrics apis
- (**webapp**): Set max & min limits for date filters
- (**webapp**): Update date & uuids format to match journey & metrics api formats
- (**webapp**): Fix server renderd HTML mismatch error for date filter pills
- (**webapp**): Save date filter state in crash details page
- (**webapp**): Change env var name (#165)
- (**webapp**): Fix comment syntax
- (**webapp**): Change text to black on side nav button on focus visible
- (**webapp**): Set header z-index so it's always on top
- (**webapp**): Center align section headers on small screens

### :hammer: Misc

- (**backend**): Fix dashboard healthcheck
- (**backend**): Fix dashboard healthcheck
- (**backend**): Fix incorrect path
- (**backend**): Update dashboard github workflow
- (**backend**): Fix dockerfile
- (**backend**): Fix dashboard docker compose
- (**backend**): Update compose.yml
- (**backend**): Update rigmarole script
- (**backend**): Remove stale files
- (**backend**): Update go.work.sum (#1050)
- (**backend**): Move dashboard directory
- (**backend**): Update cleanup deps
- (**backend**): Update cleanup service
- (**backend**): Change health check
- (**backend**): Update github workflow
- (**backend**): Update docker compose
- (**backend**): Rename directory & service names
- (**backend**): Rename directory & service names
- (**backend**): Tidy go.mod
- (**backend**): Change default retention period to 90 days
- (**backend**): Extend access token expiry (#1031)
- (**backend**): Update `config.sh`
- (**backend**): Proxy attachments by default
- (**backend**): Fix typos
- (**backend**): Rename web env vars
- (**backend**): Fix a sessionator edge case (#1026)
- (**backend**): Consistent healthcheck (#997)
- (**backend**): Add healthchecks (#989)
- (**backend**): Remove example env (#985)
- (**backend**): Add otel instrumentation to api server
- (**backend**): Add new sessions with real cpu usage data
- (**backend**): Add dummy percentage usage in session data
- (**backend**): Update interval_config to interval in session data
- (**backend**): Update cpu and memory usage events schema
- (**backend**): Refactor cpu usage calculation for clarity
- (**backend**): Rename msg column to message in anr/exception groups
- (**backend**): Remove redundant parameter types
- (**backend**): Make getDisplayTitle method to encapsulate exception group naming
- (**backend**): Standardise migration file names
- (**backend**): Store exception/anr group name in separate columns
- (**backend**): Update config.sh
- (**backend**): Update config.sh
- (**backend**): Mod github auth
- (**backend**): Mod github auth
- (**backend**): Update compose.yml
- (**backend**): Fix a typo
- (**backend**): Parameterized cors settings
- (**backend**): Update self-host settings
- (**backend**): Update installation script
- (**backend**): Update config.sh
- (**backend**): Update config.sh
- (**backend**): Update config.sh
- (**backend**): Update config.sh
- (**backend**): Reorganize install.sh
- (**backend**): Update install.sh
- (**backend**): Update dbmate.sh
- (**backend**): Update config.sh
- (**backend**): Update compose.yml
- (**backend**): Update .env.example
- (**backend**): Update compose.yml
- (**backend**): Install.sh
- (**backend**): Config.sh script
- (**backend**): Update prod compose
- (**backend**): Update container naming
- (**backend**): Update dockerfiles
- (**backend**): Improve clickhouse close handling
- (**backend**): Remove ipinfo env variable
- (**backend**): Use local geoip db
- (**backend**): Update dockerfile
- (**backend**): Update dockerfile
- (**backend**): Update measure-go dockerfile
- (**backend**): Update labels in dockerfile
- (**backend**): Update dockerfile
- (**backend**): Update measure-go workflow
- (**backend**): Reorg dockerfiles
- (**backend**): Add label to dockerfile
- (**backend**): Rename dockerfile
- (**backend**): Consolidate env vars
- (**backend**): Add gitignore
- (**backend**): Remove example env file
- (**backend**): Improve migrations
- (**backend**): Mod compose
- (**backend**): Change env vars
- (**backend**): Remove put users endpoint
- (**backend**): Add team id
- (**backend**): Improve create team
- (**backend**): Remove unused field
- (**backend**): Add google signin
- (**backend**): Update deps
- (**backend**): Update dot env example
- (**backend**): Update server
- (**backend**): Add google user struct
- (**backend**): Update cipher pkg
- (**backend**): Revamp invite flow
- (**backend**): Set last sign in time
- (**backend**): Remove stale logic
- (**backend**): Handle signups
- (**backend**): Update postgres ddl
- (**backend**): Refresh session automatically
- (**backend**): Remove log
- (**backend**): Update github callback
- (**backend**): Add authn routes
- (**backend**): Update deps
- (**backend**): Update server
- (**backend**): Modify authentication
- (**backend**): Add a user method
- (**backend**): Update `.env.example`
- (**backend**): Add tables for auth
- (**backend**): Update session replay api
- (**backend**): Update session replay api
- (**backend**): Mod event ingestion
- (**backend**): Mod events table
- (**backend**): Tidy go mods
- (**backend**): Update example config.toml
- (**backend**): Add --clean flag
- (**backend**): Add go mods
- (**backend**): Remove mapping cache
- (**backend**): Misc improvements
- (**backend**): Change docker registry (#818)
- (**backend**): Modify frame location method
- (**backend**): Send display title in anr
- (**backend**): Set exception group name
- (**backend**): Send exception display title
- (**backend**): Anr location method
- (**backend**): Exception location method
- (**backend**): Remove unused code
- (**backend**): Modify anr groups table
- (**backend**): Set older event timestamp
- (**backend**): Modify exception grouping
- (**backend**): Modify unhandled exception groups table
- (**backend**): Delta in metrics
- (**backend**): Multi version filtering (#776)
- (**backend**): Record new events
- (**backend**): Validate network type & generation
- (**backend**): Use non-nullable network properties
- (**backend**): Update session replay api
- (**backend**): Update anr detail api
- (**backend**): Update crash detail api
- (**backend**): Presign url
- (**backend**): Compute attachment mime
- (**backend**): Add attachments in response
- (**backend**): Update server
- (**backend**): Update .env.example
- (**backend**): Update symbolicator-retrace docker
- (**backend**): Clickhouse:24 (#739)
- (**backend**): Anr overview plot instances route
- (**backend**): Add anr plot instances method
- (**backend**): Crash overview instance plot route
- (**backend**): Add query function
- (**backend**): Rename methods
- (**backend**): Update dependencies in symbolicator
- (**backend**): Tidy go mod (#715)
- (**backend**): Remove unused route
- (**backend**): Remove unused route
- (**backend**): Anr detail journey plot api
- (**backend**): Minor refactor
- (**backend**): Add full filter support
- (**backend**): Remove unused code
- (**backend**): Add crash detail journey plot
- (**backend**): Add journey in filter pkg
- (**backend**): Add journey options
- (**backend**): Add anr instance plot api
- (**backend**): Add crash plot route
- (**backend**): Add exceptions plot method
- (**backend**): Fix typo
- (**backend**): Doc comments
- (**backend**): Add doc comments
- (**backend**): Remove hardcoded prefix
- (**backend**): Modify response
- (**backend**): Modify response
- (**backend**): Change variable name
- (**backend**): Add doc comment
- (**backend**): Rename function
- (**backend**): Organize method
- (**backend**): Optimize journey events
- (**backend**): Add doc comment
- (**backend**): Update get journey
- (**backend**): New method in journey
- (**backend**): Update group
- (**backend**): Authz checks in journey
- (**backend**): Fix typo
- (**backend**): Change method names
- (**backend**): Create journey interface
- (**backend**): Journey map api
- (**backend**): Add set pkg
- (**backend**): Update group
- (**backend**): Update group
- (**backend**): Compute issues to journey
- (**backend**): Update doc comments
- (**backend**): Doc comments
- (**backend**): Store session ids in graph
- (**backend**): Dedup fragments
- (**backend**): Modify app journey route
- (**backend**): Add journey pkg
- (**backend**): Add uuid set
- (**backend**): Add graph pkg
- (**backend**): Get journey events
- (**backend**): Lifecycle events constants
- (**backend**): Remove dead code
- (**backend**): Update app metrics api
- (**backend**): Validate app journey
- (**backend**): Improve app metrics
- (**backend**): Add validate versions
- (**backend**): Improve app metrics
- (**backend**): Doc comments for app filter
- (**backend**): Update dashboard api docs (#644)
- (**backend**): Update event validation
- (**backend**): Fix app onboarding
- (**backend**): Remove unused tables
- (**backend**): Fix broken code
- (**backend**): Fix context in get team
- (**backend**): Remove unnecessary error return
- (**backend**): Update schema.sql with alert_prefs table
- (**backend**): Add missing sqlf statement close method
- (**backend**): Remove print statement
- (**backend**): Add doc comments
- (**backend**): Remove old session api
- (**backend**): Remove old app's get method
- (**backend**): Remove old symbolicate
- (**backend**): Update old symbolicate
- (**backend**): Rewire session replay
- (**backend**): Network events thread name
- (**backend**): Nav events thread name
- (**backend**): Memory events thread name
- (**backend**): Log events thread name
- (**backend**): Lifecycle events thread name
- (**backend**): Launch events thread name
- (**backend**): Gesture events thread name
- (**backend**): Exit events thread name
- (**backend**): Critical events thread name
- (**backend**): Add missing context
- (**backend**): Update events schema
- (**backend**): Additional events
- (**backend**): Rewire metricsa api
- (**backend**): Fix anr symbolication
- (**backend**): Modify attachment
- (**backend**): Contextified get team
- (**backend**): Rewire anr groups anrs api
- (**backend**): Update crash group with crashes
- (**backend**): Rewire crash groups crashes api
- (**backend**): Fix missing ctx
- (**backend**): Update references
- (**backend**): Rewire get crash groups api
- (**backend**): App filters request context
- (**backend**): Context in app filters
- (**backend**): Update get app filters api
- (**backend**): Fix bucketting
- (**backend**): Remove background context
- (**backend**): Remove unused code
- (**backend**): Format doc comments
- (**backend**): Remove older put sessions route
- (**backend**): Save event req to db
- (**backend**): Idempotecy of request id
- (**backend**): Remove extra newline
- (**backend**): Add event_reqs db table
- (**backend**): Modify events table schema
- (**backend**): Fix event ingestion
- (**backend**): Fix app onboarding
- (**backend**): Improve reporting
- (**backend**): Fix hand during bucketting
- (**backend**): Measure ingest duration
- (**backend**): Fix hang during bucketting
- (**backend**): More metrics during ingestion
- (**backend**): Fix hang up during bucketting
- (**backend**): Fix symbolication issues
- (**backend**): Fix multipart event processing
- (**backend**): Fix event request
- (**backend**): Fix event batching
- (**backend**): Close writer
- (**backend**): Add fresh events
- (**backend**): Add event req id
- (**backend**): Modify ingest to send events
- (**backend**): Remove session from scanning
- (**backend**): Remove session recording
- (**backend**): Change scan logic to read blobs
- (**backend**): Attribute as key name instead of attributes
- (**backend**): Fix invalid json bug
- (**backend**): Fix error message
- (**backend**): Update session recording
- (**backend**): Improve code comments
- (**backend**): Support transactions in bucketting
- (**backend**): Add app onboarding
- (**backend**): Update field name
- (**backend**): Update bucketting
- (**backend**): Rewire event ingestion
- (**backend**): Update events table schema
- (**backend**): Bucket exceptions, anrs
- (**backend**): Rewire attachment processing
- (**backend**): Remove unused code
- (**backend**): Add new events route
- (**backend**): Rewire symbolication
- (**backend**): Update session
- (**backend**): Delete old attachment
- (**backend**): Add attachment
- (**backend**): Rewire country lookup
- (**backend**): Update event struct
- (**backend**): Add events route
- (**backend**): Update db schema
- (**backend**): Update attribute validation
- (**backend**): Define attributes
- (**backend**): Wip - attribute
- (**backend**): Remove `/events` route
- (**backend**): Organize response
- (**backend**): Sessionator request interface (#572)
- (**backend**): Sort only by version code (#569)
- (**backend**): Format response
- (**backend**): Add launch time metrics
- (**backend**): Compute hot launch duration
- (**backend**): Add hot launch duration column
- (**backend**): Compute warm launch duration
- (**backend**): Add warm launch duration column
- (**backend**): Compute cold launch duration
- (**backend**): Add cold launch duration column
- (**backend**): Send metrics response
- (**backend**): Add perceived anr free metrics
- (**backend**): Add perceived crash free metrics
- (**backend**): Add anr free metrics
- (**backend**): Add crash free sessions
- (**backend**): Modify adoption metric
- (**backend**): Modify size metric
- (**backend**): Wip - metrics api
- (**backend**): Club version name & code
- (**backend**): Version code in anr detail api
- (**backend**): Version code in crash detail api
- (**backend**): Version code in crash/anr groups
- (**backend**): Add version code in app filter
- (**backend**): Remove unneeded logs
- (**backend**): Add pocket cast sessions
- (**backend**): Improve sessionator
- (**backend**): Update `cold_launch` event
- (**backend**): Update `http` event
- (**backend**): Update `hot_launch` event
- (**backend**): Fix `warm_launch` duration compute
- (**backend**): Update `warm_launch` event
- (**backend**): Update `gesture_scroll` event
- (**backend**): Update `gesture_long_click` event
- (**backend**): Update `gesture_click` event
- (**backend**): Update `anr` event
- (**backend**): Update `exception` event
- (**backend**): Update record command to capture build size
- (**backend**): Mapping is optional
- (**backend**): Improve error messages
- (**backend**): Support build info in sessionator
- (**backend**): Update mapping key fetch
- (**backend**): Add transaction to builds api
- (**backend**): Upsert `build_sizes`
- (**backend**): Update `build_sizes` relation
- (**backend**): Add `build_type` column
- (**backend**): Add `build_sizes` relation
- (**backend**): Use `app_id` for build mappings
- (**backend**): Modify `build_mappings` relation
- (**backend**): Upgrade go version
- (**backend**): Use go v1.22.x
- (**backend**): Fix paths patterns (#500)
- (**backend**): Add `foreground` to session replay
- (**backend**): Add `foreground` to session replay
- (**backend**): Update session-data sessions
- (**backend**): Add `foreground` to anr
- (**backend**): Add `foreground` to exception
- (**backend**): Update clickhouse schema
- (**backend**): Change job trigger file list (#450)
- (**backend**): Change mapping file key query
- (**backend**): Add `low_memory` event
- (**backend**): Remove `app_exit.timestamp`
- (**backend**): Handle updated `low_memory` events
- (**backend**): Expand `low_memory` click schema
- (**backend**): Bring back duration
- (**backend**): Change job trigger file list (#450)
- (**backend**): Send first/last event time
- (**backend**): Add `http` event
- (**backend**): Modify structure of thread groups
- (**backend**): Fix issue with anr events
- (**backend**): Add `anr` event
- (**backend**): Add `exception` event
- (**backend**): Fix a typo
- (**backend**): Fix a typo
- (**backend**): Add `app_exit` event
- (**backend**): Add `trim_memory` event
- (**backend**): Add `lifecycle_app` event
- (**backend**): Add `lifecycle_fragment` event
- (**backend**): Add `lifecycle_activity` event
- (**backend**): Add `hot_launch` event
- (**backend**): Add `warm_launch` event
- (**backend**): Trim string event
- (**backend**): Add `cold_launch` event
- (**backend**): Add `network_change` event
- (**backend**): Add `string` event
- (**backend**): Fix bad file name
- (**backend**): Add `navigation` event
- (**backend**): Add `gesture_scroll` events
- (**backend**): Add `gesture_long_click` events
- (**backend**): Add `gesture_click` events
- (**backend**): Add `memory usage` data points
- (**backend**): Rename `cpu` pkg to `replay`
- (**backend**): Add `resource` in session replay response
- (**backend**): Add `cpu_usage` calculation for session replay
- (**backend**): Add `text` package
- (**backend**): Add `cpu` package
- (**backend**): Update `chrono` package
- (**backend**): Add session replay api route
- (**backend**): Add init compose profile
- (**backend**): Update `go.work.sum` (#440)
- (**backend**): Ignore existing buckets (#432)
- (**backend**): Fix minio bucket creation
- (**backend**): Add create team api
- (**backend**): Add session-data
- (**backend**): Rename session-data app name to use app-unique-id
- (**backend**): Add record command to sessionator
- (**backend**): Update docker compose
- (**backend**): Support local s3 fetching in symbolicator-retrace
- (**backend**): Update symbolicator-retrace's env file
- (**backend**): Files now uploads locally
- (**backend**): Update `.env.example`
- (**backend**): Remove dead code
- (**backend**): Upload files locally if in debug mode
- (**backend**): Network_generations in anr groups anr
- (**backend**): Network_types in anr groups anr
- (**backend**): Fix incorrect column name
- (**backend**): Network_providers in anr groups anr
- (**backend**): Locales in anr groups anr
- (**backend**): Device_manufacturers in anr groups anr
- (**backend**): Device_names in anr groups anr
- (**backend**): Countries in anr groups anrs
- (**backend**): Countries in crash groups crashes
- (**backend**): Add `countries` filter
- (**backend**): Network_generations in crash groups crashes
- (**backend**): Add `network_generations` filter
- (**backend**): Network_types in crash groups crashes
- (**backend**): Add `network_types` filter
- (**backend**): Network_providers in crash groups crashes
- (**backend**): Add `network_providers` filter
- (**backend**): Locales in crash groups crashes
- (**backend**): Add `locales` filter
- (**backend**): Device_manufacturers in crash groups crashes
- (**backend**): Add `device_manufacturers` filter
- (**backend**): Device_names in crash groups crashes
- (**backend**): Add `device_names` filter
- (**backend**): Update dashboard api docs
- (**backend**): Add session_id in anr groups anrs api
- (**backend**): Add session_id in crash groups crasshes api
- (**backend**): Add time range support anr groups anr get
- (**backend**): Add time range support crash groups crashes get
- (**backend**): Fix an edge case
- (**backend**): Add navigation sample
- (**backend**): Use non deprecated API to read response error
- (**backend**): Log error when sessionator ingestion fails
- (**backend**): Update go workspace
- (**backend**): Upgrade measure-go dependencies
- (**backend**): Update gh actions/setup-go (#399)
- (**backend**): Reduce error chance (#397)
- (**backend**): Organize routes (#396)
- (**backend**): Update clickhouse schema file
- (**backend**): Reverting route re-org
- (**backend**): Update app filter validation
- (**backend**): Upgrade uuid pkg
- (**backend**): Modify grouping schema
- (**backend**): Rearrange events table columns (#385)
- (**backend**): Remove `key` query parameter
- (**backend**): Remove `version` field from app filter
- (**backend**): Add get anr group detail api
- (**backend**): Remove unused code
- (**backend**): Add get crash group detail api
- (**backend**): Modify pagination behavior
- (**backend**): Add keyset pagination
- (**backend**): Add keyset pagination
- (**backend**): Omit fields from api response
- (**backend**): Omit fields from api response
- (**backend**): Update list anr groups api
- (**backend**): Update anr_groups table schema
- (**backend**): Remove app version from exception grouping
- (**backend**): Remove `app_version` field
- (**backend**): Modify crash groups list api
- (**backend**): Change event group field name
- (**backend**): Change event group schemas
- (**backend**): Update crash groups list api
- (**backend**): Add trim method to resource
- (**backend**): Add function to fetch exception group events
- (**backend**): Add function expand filters
- (**backend**): Remove unused app apis (#351)
- (**backend**): Reorder event columns (#346)
- (**backend**): Sort anr groups
- (**backend**): Sort crash groups
- (**backend**): Add 2 sessions from pocketcast app
- (**backend**): Check presence of unhandled_exceptions & anrs
- (**backend**): Add new methods to session
- (**backend**): Modify anr group query
- (**backend**): Modify exception group query
- (**backend**): Delete unneeded code
- (**backend**): Change handling of attribute map
- (**backend**): Update help text of ingest command
- (**backend**): Update ingest command
- (**backend**): Change config to a flag
- (**backend**): Update help of ingest command
- (**backend**): Modify root command
- (**backend**): Generate nonce only when required
- (**backend**): Use api keys from config
- (**backend**): Add a config package to sessionator
- (**backend**): Add sample config file
- (**backend**): Add toml package
- (**backend**): Remove unwanted logging
- (**backend**): Tests are being silently skipped (#302)
- (**backend**): Add sessionator
- (**backend**): Add version filter support
- (**backend**): Add `app_version` to `anr_groups` table
- (**backend**): Add version filter support
- (**backend**): Add `app_version` to `unhandled_exception_groups` table
- (**backend**): Add single anr group filters api
- (**backend**): Add single crash group filters api
- (**backend**): Dedup slice of event ids
- (**backend**): Add identity package
- (**backend**): Get anr filters api
- (**backend**): Get filters for crashes api
- (**backend**): Get anr groups api
- (**backend**): Add app filter to anr group query
- (**backend**): Get crash groups api
- (**backend**): App app filter to exception group query
- (**backend**): Add anr grouping
- (**backend**): Add methods to get type, message & location of ANR
- (**backend**): Add method to get app's anr groups
- (**backend**): Refactor exception grouping
- (**backend**): Implement exception grouping
- (**backend**): Modify anr and exception group relation schema
- (**backend**): Create exception & anr grouping relations
- (**backend**): Compute fingerprint
- (**backend**): Add simhash pkg
- (**backend**): Modify events relation
- (**backend**): Add caching & default client
- (**backend**): Lookup country from ip
- (**backend**): Modify events schema
- (**backend**): Add ipinfo pkg
- (**backend**): Add `inet` package
- (**backend**): Support querying unhandled exceptions
- (**backend**): Add get filters api
- (**backend**): Remove unused const (#282)
- (**backend**): Remove `apps.first_seen_at` field
- (**backend**): Set onboarded_at field
- (**backend**): Remove latest version
- (**backend**): Update clickhouse schema
- (**backend**): Update apps after session save
- (**backend**): Add platform package
- (**backend**): Add support for `appId`
- (**backend**): Update cipher pkg
- (**backend**): Update clickhouse schema
- (**backend**): Modify postgres schema
- (**backend**): Update clickhouse schema dump
- (**backend**): Add rigmarole.sh to clickhouse migrations
- (**backend**): Remove all clickhouse migrations
- (**backend**): Remove invitation related db modifications
- (**backend**): Remove invitations relation sql
- (**backend**): Add change member role api
- (**backend**): Add method to validate role
- (**backend**): Add remove team member api
- (**backend**): Use chrono package for time
- (**backend**): Create custom time package
- (**backend**): Add get team members api
- (**backend**): Change method name
- (**backend**): Update `/teams/:id/authz` rbac logic
- (**backend**): Change method name
- (**backend**): Add `/teams/:id/authz` api
- (**backend**): Update rbac logic
- (**backend**): Modify postgres table definitions
- (**backend**): Update json response
- (**backend**): Add team rename api
- (**backend**): Suspend invite record creation
- (**backend**): Implement rbac for team invite
- (**backend**): Add team invite api
- (**backend**): Add sqlf package
- (**backend**): Handle custom rank json marshalling and unmarshalling
- (**backend**): Modify team_invitations schema
- (**backend**): Add cipher package
- (**backend**): Update get team apps api
- (**backend**): Remove unneeded statements
- (**backend**): Update get app details api
- (**backend**): Increase access token expiration
- (**backend**): Add app details api
- (**backend**): Handle not found condition (#235)
- (**backend**): Remove log line
- (**backend**): Return apps from db
- (**backend**): Wip get team apps api
- (**backend**): Change name of app key
- (**backend**): Fix types of create app response
- (**backend**): Return response in app create api
- (**backend**): Add create app
- (**backend**): Update jwt package
- (**backend**): Add api keys
- (**backend**): Add rbac
- (**backend**): Move server into a separate package
- (**backend**): Schema changes for creating app
- (**backend**): Add env var (#220)
- (**backend**): Rename migration files
- (**backend**): Add github oauth redirection (#219)
- (**backend**): Remove old sql files
- (**backend**): Update docker compose
- (**backend**): Drop old clickhouse table
- (**backend**): Change a column in `mapping_files`
- (**backend**): Change events table name
- (**backend**): Add migrations infra
- (**backend**): Change container names
- (**backend**): Change mapping files parameter (#204)
- (**backend**): Add app filters stub api
- (**backend**): Add teams stub apis (#199)
- (**backend**): App request filtering (#198)
- (**backend**): Add missing metrics
- (**backend**): Change cors origin (#188)
- (**backend**): Add cors config (#187)
- (**backend**): Fix incorrect version in go.mod (#186)
- (**backend**): Add api server build action (#179)
- (**backend**): Fix syntax (#176)
- (**backend**): Add rest of the events to symbolication (#141)
- (**backend**): Refactor magic strings (#139)
- (**backend**): Symbolication codec (#137)
- (**backend**): Modify docker compose (#128)
- (**backend**): Count session payload size (#122)
- (**backend**): Improve example dotenv files (#123)
- (**frontend**): Revert google ux_mode
- (**frontend**): Remove commented code
- (**frontend**): Lazy load landing page videos
- (**frontend**): Adjust landing hero anim dimensions
- (**frontend**): Change android availability on landing page
- (**frontend**): Remove unity section from landing page
- Rename directory and service names
- Update installation script (#1037)
- Delete self host `.env.example` (#1033)
- Update .commitlintrc.js
- Update compose.yml (#1023)
- Remove dotenv
- Remove supabase
- Update .gitignore (#850)
- Update root go work sum
- Report status and errors (#324)
- Remove supabase dependency from root folder
- Update supabase config (#216)
- Move docker compose
- Streamline self-host
- Change commitlint config (#54)
- Add husky & commitlint (#36)
- Improve landing page copy
- Expose clickhouse http port
- Remove unused imports
- Link contribution guidelines in README
- Improve security
- Add docker-compose script
- Improve kdoc
- Rearrange sinks to have DbSink initialized first
- Rename package in test source
- Abstract session ID management to separate class
- Add measure SDK version to resource
- Improve event validation
- Fix incorrect data type
- Update benchmark
- Accepts arrays in events endpoint
- Remove extra nesting
- Restructure events request
- Remove use of dotenv
- Update events and deploy settings
- Upgrade clickhouse-go
- Add /events endpoint
- Add api endpoints and sql statements
- Add initial backend code
- Rename bodyValue to value for brevity
- Fix incorrect package name
- (**webapp**): Limit filter pill width & show tooltip
- (**webapp**): Update dockerfile
- (**webapp**): Update landing page with new tagline
- (**webapp**): Update landing page tagline
- (**webapp**): Update 'App Hangs' to 'ANRs' in landing copy
- (**webapp**): Update landing copy for session timelines
- (**webapp**): Update 'timeline' to 'Timelines' in session landing copy
- (**webapp**): Add favicon
- (**webapp**): Add measure logo to landing header
- (**webapp**): Update landing page layout for smaller screens
- (**webapp**): Hide retention period settings
- (**webapp**): Update landing copy
- (**webapp**): Update landing page hero animation
- (**webapp**): Add highlight instrumentation
- (**webapp**): Add clarity instrumentation
- (**webapp**): Update exceptions product video on landing page
- (**webapp**): Change laneing page features to vertical layout
- (**webapp**): Remove redudant if statement
- (**webapp**): Ellipsize long session replay event titles
- (**webapp**): Remove google auto sign in
- (**webapp**): Update npm packages to latest
- (**webapp**): Add dockerfile
- (**webapp**): Change build settings
- (**webapp**): Add dockerignore
- (**webapp**): Update env var
- (**webapp**): Consolidate auth utils
- (**webapp**): Update Github sign in button text
- (**webapp**): Update auth flow
- (**webapp**): Update Accordion ui
- (**webapp**): Update exceptions overview table ui
- (**webapp**): Remove disabled states on link
- (**webapp**): Adjust button margin
- (**webapp**): Replace create app integration steps with integration guide link
- (**webapp**): Update nivo packages
- (**webapp**): Use &apos; instead of ' in landing copy
- (**webapp**): Update landing copy
- (**webapp**): Update landing OSS & Self hosted section
- (**webapp**): Add containers around landing videos
- (**webapp**): Update landing copy
- (**webapp**): Add login button to landing page header
- (**webapp**): Replace email waitlist with Github link
- (**webapp**): Remove supabase packages
- (**webapp**): Remove supabase related pieces
- (**webapp**): Fix logout
- (**webapp**): Revamp auth
- (**webapp**): Remove auth routes
- (**webapp**): Update auth callbacks
- (**webapp**): Update auth
- (**webapp**): Remove unused field
- (**webapp**): Add google signin
- (**webapp**): Add next parameter
- (**webapp**): Remove unused code
- (**webapp**): Revamp invite flow
- (**webapp**): Remove unused code
- (**webapp**): Revamp authn
- (**webapp**): Add authn utils
- (**webapp**): Use esnext
- (**webapp**): Update landing page
- (**webapp**): Hide alerts page from nav bar
- (**webapp**): Remove console.log
- (**webapp**): Rename variable for clarity
- (**webapp**): Add flower brackets for if statement
- (**webapp**): Update journey positive node colour
- (**webapp**): Update journey hightlight edge colour
- (**webapp**): Center journey node titles
- (**webapp**): Use rounded indicators in memory graph slices tooltip
- (**webapp**): Reduce point size in exceptions plots
- (**webapp**): Make current page clickable in sidebar
- (**webapp**): Improve quality and adjust size of screenshots
- (**webapp**): Improve display of app metrics deltas
- (**webapp**): Remove unused component
- (**webapp**): Refactor 'crashOrAnr' to 'exceptions'
- (**webapp**): Use correct types for exception plots states
- (**webapp**): Remove console.log statement
- (**webapp**): Add app versions only if present in api calls
- (**webapp**): Update metrics tooltips & delta display
- (**webapp**): Set exception title in session replay using updated api
- (**webapp**): Select latest version only in overview on init
- (**webapp**): Remove unused import
- (**webapp**): Show app size metrics only on single app version selection
- (**webapp**): Move app size metrics to last position
- (**webapp**): Add custom tooltip to memory chart
- (**webapp**): Remove semicolons
- (**webapp**): Remove unused import
- (**webapp**): Set mem & cpu chart precision to seconds instead of milliseconds
- (**webapp**): Remove 0 padding from x-axis hours in mem & cpu charts
- (**webapp**): Remove log statement
- (**webapp**): Add custom tooltip for cpu chart
- (**webapp**): Increase cpu chart size
- (**webapp**): Remove semicolons
- (**webapp**): Add time util function to format chart format timestamp to human readable
- (**webapp**): Set tick rotation to 90 in exceptions overview & details charts
- (**webapp**): Remove cpu & mem chart animations
- (**webapp**): Update exception details plot endpoint
- (**webapp**): Extract filters to a component
- (**webapp**): Adjust tick padding in crash or anr group details plot
- (**webapp**): Add Paginator component tests
- (**webapp**): Fix FilterPill test name
- (**webapp**): Add FilterPill component tests
- (**webapp**): Add TeamSwitcher component tests
- (**webapp**): Decouple TeamSwitcher component from API
- (**webapp**): Remove unused import
- (**webapp**): Add DangerConfirmationModal tests
- (**webapp**): Add AlertDialogModal component tests
- (**webapp**): Fix accordion test file name
- (**webapp**): Add test for accordion component
- (**webapp**): Remove unused import in auth utils test
- (**webapp**): Add snapshot tests for accordion component
- (**webapp**): Add webapp github action ci pipeline
- (**webapp**): Add unit tests for scroll_utils
- (**webapp**): Use scrollY insead of deprecated pageYOffset
- (**webapp**): Add auth_utils unit tests
- (**webapp**): Externalise supabase client dependency in auth_utils
- (**webapp**): Update files to have correct ts extension
- (**webapp**): Add router utils unit tests
- (**webapp**): Enable vercel build to run tests by adding ts-node dev dependency
- (**webapp**): Use luxon for all datetime calculations
- (**webapp**): Add tests for formatTimestampToChartFormat in time_utils
- (**webapp**): Add tests for formatTimeToHumanReadable in time_utils
- (**webapp**): Add tests for formatDateToHumanReadable in time_utils
- (**webapp**): Throw error on invalid date in time_utils
- (**webapp**): Add tests for formatMillisToHumanReadable in time_utils
- (**webapp**): Use luxon lib to handle dates/times in time_utils
- (**webapp**): Fix string_utils test file extension
- (**webapp**): Add unit tests for utils/string_utils
- (**webapp**): Set up jest for testing with NextJs
- (**webapp**): Remove unused state in journey component
- (**webapp**): Handle no data cases in metrics API
- (**webapp**): Handle new response metrics API response format
- (**webapp**): Refactor multiple dropdown components into one
- (**webapp**): Remove unused import
- (**webapp**): Adjust spacing in session replay page
- (**webapp**): Extract camel case formatting function to util file
- (**webapp**): Remove unused imports
- (**webapp**): Extract scroll direction detection into a util function
- (**webapp**): Fix case  of ref variable in TeamSwitcher
- (**webapp**): Fix typo in formatMillisToHumanReadable util function
- (**webapp**): Remove empty line
- (**webapp**): Extract utility function to format milliseconds to human readable format
- (**webapp**): Refactor TeamSwitcher to handle loading & error states internally
- (**webapp**): Improve team switcher title & arrow alignment
- (**webapp**): Refactor CreateApp and move api call to common api calls file
- (**webapp**): Upgrade to NexJs version 14
- (**webapp**): Pass initial selected item instead of index in Dropdown component
- (**webapp**): Refactor UI rendering in response to API statuses in Apps, Crashes & Overview pages
- (**webapp**): Remove unused imports
- (**webapp**): Extract team management APIs into centralised api calls file
- (**webapp**): Extract crash groups API into centralised API calls file
- (**webapp**): Extract metrics API into centralised API calls file
- (**webapp**): Extract journey API to centralised api calls file
- (**webapp**): Rename UserFlow component to Journey
- (**webapp**): Fetch teams using centralised API in layout
- (**webapp**): Fetch teams using centralised API in Teams page
- (**webapp**): Extract fetch teams api in centralised api calls file
- (**webapp**): Fetch apps + filters from centralised APIs in Crashes page
- (**webapp**): Fetch apps + filters from centralised APIs in Apps page
- (**webapp**): Fetch apps + filters from centralised APIs in overview page
- (**webapp**): Extract apps and filters fetch apis in separate file
- (**webapp**): Remove unnecessary div
- (**webapp**): Update supabase js npm package
- (**webapp**): Remove unnecessary logout call from route
- (**webapp**): Remove logs
- (**webapp**): Remove unnecessary onAuthStateChanged method
- (**webapp**): Remove unnecessary setSession call in github auth callback
- (**webapp**): Refactor role names camel case conversions into a function
- (**webapp**): Update change role/remove member error msg alignment in Team page
- (**webapp**): Fetch members + authz roles from same API in teams page
- (**webapp**): Remove unnecessary 'text-black' classes
- (**webapp**): Handle invalid invites
- (**webapp**): Rename variables for clarity
- (**webapp**): Fetch team from API in Team page
- (**webapp**): Format code
- (**webapp**): Set session on invite redirect
- (**webapp**): Remove old auth handler
- (**webapp**): Add logout
- (**webapp**): Modify github signin
- (**webapp**): Modify supabase auth routes
- (**webapp**): Add new environment variable
- (**webapp**): Upgrade dependencies
- (**webapp**): Update supabase email templates
- (**webapp**): Adjust spacing in Apps page
- (**webapp**): Update spacing in Apps page
- (**webapp**): Update ui + add comments to overview page ui
- (**webapp**): Update CreateApp ui
- (**webapp**): Open first step of create app setup by default
- (**webapp**): Use &apos instead of apostrophe
- (**webapp**): Add CreateApp component
- (**webapp**): Add example env var (#225)
- (**webapp**): Improve sign-in flow error handling (#221)
- (**webapp**): Handle error on logout (#222)
- (**webapp**): Remove unused function
- (**webapp**): Use env variable for API base URL
- (**webapp**): Improve error message in UserFlow
- (**webapp**): Fetch apps list in overview from API
- (**webapp**): Disable react hooks exhaustive deps rule
- (**webapp**): Store selected team state in side nav
- (**webapp**): Fix indent in Dropdown component
- (**webapp**): Add onChangeSelectedItemListener & initialItemIndex params to TeamSwitcher
- (**webapp**): Fetch teams from API
- (**webapp**): Update TeamSwitcher layout
- (**webapp**): Add new line
- (**webapp**): Handle metrics api status with enum
- (**webapp**): Handle journey api status with enum
- (**webapp**): Handle filters api status with enum
- (**webapp**): Store & use app id + app name in overview app filter
- (**webapp**): Update date filter pill format in overview page
- (**webapp**): Save filter states in crashes and crash details pages
- (**webapp**): Remove interactivity from FilterPills
- (**webapp**): Save selected filter states in overview page
- (**webapp**): Auth ui improvements (#173)
- (**webapp**): Add google auth log (#172)
- (**webapp**): Add API key field to Apps page
- (**webapp**): Add basic sign in with github (#168)
- (**webapp**): Add Apps page ui
- (**webapp**): Fix indent
- (**webapp**): Add landing page animation for app health section
- (**webapp**): Update landing page hero animation
- (**webapp**): Remove nav right border on small screens
- (**webapp**): Add change team name field to Team page
- (**webapp**): Remove text-center alignment from remove button in team page
- (**webapp**): Fix width of role selector button in team page
- (**webapp**): Fix dropdown components z-index so that they are always on top of other UI
- (**webapp**): Add team page ui
- (**webapp**): Combine thread events into single chart in session replay
- (**webapp**): Show only time on x-axis in session replay
- (**webapp**): Add info fields to session replay
- (**webapp**): Add session replay
- (**webapp**): Add multithread stack traces with accordiong to crash details
- (**webapp**): Add exception count chart instead of rate chart to crash details
- (**webapp**): Add user id to crash details session list
- (**webapp**): Remove hover styling on session list table column
- (**webapp**): Add crash details page
- (**webapp**): Keep side nav link highlighted even when navigating to sub paths
- (**webapp**): Fix user flow tooltip anr length check
- (**webapp**): Fix crash details route
- (**webapp**): Remove unused imports
- (**webapp**): Add selected date filter pill to crashes
- (**webapp**): Add selected filters pills to overview
- (**webapp**): Change grid gap in overview filters
- (**webapp**): Add selected filters pills to crashes
- (**webapp**): Update search field text in crashes
- (**webapp**): Remove network provider and type filter from crashes
- (**webapp**): Add crash list to crashes page
- (**webapp**): Add country, network provider, network type and free search filters to crashes
- (**webapp**): Adjust crashes page padding and element sizes
- (**webapp**): Adjusting overview page padding and element sizes
- (**webapp**): Adjust crash rate chart positioning
- (**webapp**): Add crash rate line chart and app version checkbox dropdown to crashes page
- (**webapp**): Remove unnecessary items-center class on info circle flex wrap
- (**webapp**): Reduce horiontal gap between info circles on smaller screens
- (**webapp**): Remove unnecessary flex-1 from dashboard side nav
- (**webapp**): Change main to div in overview page
- (**webapp**): Make dashboard side nav stick on medium+ screen sizes
- (**webapp**): Add app size info circle to overview
- (**webapp**): Update app adoption tooltip text in overview
- (**webapp**): Add warm and hot launch time to overview
- (**webapp**): Update user flow tooltips with issues and ui changes
- (**webapp**): Adjust user flow diagram margins
- (**webapp**): Make tooltip show up only on hover over info circle
- (**webapp**): Add hover effects for info circles
- (**webapp**): Adjust tooltip positioning for info circles
- (**webapp**): Add multiple crash & ANR info circles
- (**webapp**): Add tooltips to info circles
- (**webapp**): Add user flow diagram to overview
- (**webapp**): Reduce text size for delta value in info circles
- (**webapp**): Add version users & total users for to adoption info circle
- (**webapp**): Add info circles to overview
- (**webapp**): Add high level filters for ovrview page
- (**webapp**): Add team switcher to side nav
- (**webapp**): Change z-index and bg color for dropdown component
- (**webapp**): Change side nav selected button color to neutral-950
- (**webapp**): Add side nav with dashboard page links
- (**webapp**): Adjust landing page spacing
- (**webapp**): Add hero animation to landing page

### :recycle: Refactor

- (**backend**): Minor refactor to google auth (#1038)
- (**backend**): Improve interval calculation function for cpu and memory usage collectors
- (**backend**): Rename authsession path
- (**backend**): Organize function order
- (**backend**): Fix typo
- (**backend**): Improve query
- (**backend**): Rename route functions
- (**backend**): Organize events
- (**backend**): Organize group methods
- (**backend**): Group pkg
- (**backend**): Filter pkg
- (**backend**): Journey
- (**backend**): Remove resource
- (**backend**): Organize group
- (**backend**): Rearrange methods
- (**backend**): Organize methods
- (**backend**): Update text pkg
- (**backend**): Trim exception event
- (**backend**): Trim exception
- (**backend**): Trim lifecycle app
- (**backend**): Trim lifecycle fragment
- (**backend**): Trim lifecycle activity
- (**backend**): Trim gesture clicks
- (**backend**): Trim gesture scroll
- (**backend**): Trim gesture long click
- (**backend**): Trim app exit
- (**backend**): Trim string
- (**backend**): Trim anr
- (**backend**): Trim resource fields
- (**backend**): Trim resource
- (**backend**): Trim navigation
- (**backend**): Trim trim memory
- (**backend**): Trim http
- (**backend**): Trim network change
- (**backend**): Trim cold launch
- (**backend**): Trim hot launch
- (**backend**): Organize methods
- (**backend**): Improve mapping
- (**backend**): Improve sessionator config
- (**backend**): Refactor symbols upload
- (**backend**): Use query builder for get apps (#503)
- (**backend**): Use query builder for sql query
- (**backend**): Use query builder to build sql
- (**backend**): Use query builder for sql query
- (**backend**): Use query builder for sql query
- (**backend**): Simplify code
- (**backend**): Use query builder to build sql
- (**backend**): Remove dead code (#452)
- (**backend**): Use query builder for sql query
- (**backend**): Use query builder to build sql
- (**backend**): Use query builder for sql query
- (**backend**): Use query builder for sql query
- (**backend**): Simplify code
- (**backend**): Use query builder to build sql
- (**backend**): Remove dead code (#452)
- (**backend**): Organize code
- (**backend**): Add trim function in text pkg
- (**backend**): Remove dead code
- (**backend**): Clean up get teams api (#428)
- (**backend**): Update `go.work` file
- (**backend**): Update docker-compose.yml
- (**backend**): Remove symbolicator codebase
- (**backend**): Organize defer statements
- (**backend**): Organize query formatting
- (**backend**): Improve health route
- (**backend**): Organize dashboard routes better
- (**backend**): Exceptions & anr schema to store in string format (#360)
- (**backend**): Organize session ingestion
- (**backend**): Session attachments insertion
- (**backend**): Update session insert query
- (**backend**): Improve exception & anr fingerprinting
- (**backend**): Remove unused code
- (**backend**): Update cipher pkg
- (**backend**): Rename files
- (**backend**): Add measure pkg
- (**backend**): Move server into its own package
- (**backend**): Update team apps get api
- (**webapp**): Format

### :books: Documentation

- (**backend**): Update self host guide
- (**backend**): Update migrations
- (**backend**): Update self-host guide
- (**backend**): Update dashboard api
- (**backend**): Update sdk api docs
- (**backend**): Update sessionator readme
- (**backend**): Update dashboard api
- (**backend**): Update dashboard api
- (**backend**): Update dashboard api
- (**backend**): Update dashboard api
- (**backend**): Update dashboard api
- (**backend**): Update dashboard api
- (**backend**): Update dashboard api
- (**backend**): Update dashboard api
- (**backend**): Update dashboard api
- (**backend**): Update dashboard api
- (**backend**): Update dashboard api
- (**backend**): Update dashboard api docs
- (**backend**): Update dashboard api docs
- (**backend**): Update dashboard api docs
- (**backend**): Update dashboard api docs
- (**backend**): Update dashboard api docs
- (**backend**): Update dashboard api docs
- (**backend**): Update dashboard api docs
- (**backend**): Udpate dashboard api docs
- (**backend**): Update dashboard api docs
- (**backend**): Crash group crashes
- (**backend**): Update self host docs
- (**backend**): Update dashboard api
- (**backend**): Update dashboard api docs
- (**backend**): Update dashboard api docs
- (**backend**): Update dashboard api docs
- (**backend**): Update dashboard api docs
- (**backend**): Update dashboard api docs
- (**backend**): Update success message
- (**backend**): Update sdk api
- (**backend**): Update sdk docs
- (**backend**): Update alert prefs docs and fix brokens subsection links
- (**backend**): Update sdk api docs
- (**backend**): Update dashboard api
- (**backend**): Update dashboard api docs
- (**backend**): Update dashboard api docs
- (**backend**): Update dashboard api docs
- (**backend**): Improve doc comment
- (**backend**): Update dashboard api
- (**backend**): Update sdk api docs
- (**backend**): Update sessionator readme
- (**backend**): Update dashboard api docs
- (**backend**): Update api docs
- (**backend**): Update dashboard api docs (#449)
- (**backend**): Update dashboard api docs
- (**backend**): Update doc comment
- (**backend**): Add docs for replay package
- (**backend**): Update doc comment
- (**backend**): Update doc comment
- (**backend**): Update self host guide
- (**backend**): Add missing `role` (#438)
- (**backend**): Update dashboard api docs (#433)
- (**backend**): Update api docs
- (**backend**): Update sesionator readme
- (**backend**): Update sessionator readme
- (**backend**): Update dashboard api docs
- (**backend**): Update dashboard api docs
- (**backend**): Update dashboard api docs
- (**backend**): Update crash groups crashes api docs
- (**backend**): Update events in SDK API documentation
- (**backend**): Update api docs
- (**backend**): Update api docs
- (**backend**): Update get anr group's anrs api docs
- (**backend**): Update get crash group's crashes api docs
- (**backend**): Update get anr groups api docs
- (**backend**): Update get crash  groups docs
- (**backend**): Add code comments
- (**backend**): Add code comment
- (**backend**): Update invite api docs
- (**backend**): Update API docs with Team APIs
- (**backend**): Add docs for 'apps/:id/filters' API
- (**backend**): Update code comments
- (**backend**): Update sessionator readme
- (**backend**): Add readme
- (**backend**): Improve code comments
- (**backend**): Add doc comments
- (**backend**): Fix typo
- (**backend**): Update clickhouse readme
- (**backend**): Update postgres readme
- (**backend**): Update clickhouse readme
- (**backend**): Update postgres readme
- (**backend**): Update postgres readme
- (**backend**): Update readme
- (**backend**): Update self host guide
- (**backend**): Add launch time metrics
- (**backend**): Fix a mistake
- Add team section to README
- Update README.md
- Update contributing.md (#1059)
- Improve language
- Update self host docs
- Add info about `name` field (#1051)
- Update sessionator readme (#1032)
- Correct path for Android SDK quick start
- Move CONTRIBUTING.md to main docs folder
- Move android docs
- Fix doc links
- Move CONTRIBUTING.md to docs
- Add documentation guidelines to CONTRIBUTING.md
- Remove quickstart from docs README
- Update sessionator README
- Add symbolicator-retrace README
- Update measure-go README
- Update bencmarking README
- Update measure-web-app README
- Update measure-go README
- Remove quickstart empty doc
- Update self hosting guide link in main README
- Improve self host guide
- Update self host guide
- Update contributing.md
- Update README philosophy
- Link new self hosting guide to main README
- Update contribution guide
- Update README with new tagline
- Improve README
- Update API docs with cpu and memory usage schema changes
- Add fresh self hosting guide
- Update self-host guide (#903)
- Update alertPrefs api docs
- Update dashboard api docs indices
- Update versioning guide
- Add versioning guide
- Update self-host guide
- Update sessionator docs (#833)
- Update self host guide
- Update docker compose
- Format sdk docs
- Improve docs
- Update sdk api
- Remove network props, locale from exception and anr docs
- Events API proposal
- Explain network change feature in SDK docs
- Improve docs
- Fix typo
- Explain navigation and lifecycle collection in SDK docs
- Explain app exit info feature in SDK docs
- Fix docs
- Explain memory monitoring in SDK docs
- Explain gesture tracking in SDK docs
- Explain CPU usage feature in SDK docs
- Improve ANR documentation
- Fix ANR feature doc heading
- Explain app launch tracking feature in SDK docs
- Explain network monitoring feature in SDK docs
- Explain ANR and Crash reporting in SDK docs
- Update self-host guide (#570)
- Update session-data readme
- Update `session-data` readme
- Update sdk api docs
- Remove unused target_user_readable_name from gesture_click
- Update self-host guide (#384)
- Update self-host guide (#214)
- Update self-host readme
- Update docs
- Update api docs (#191)
- Talk about session idempotency (#61)
- Throw some light on tailing clickhouse logs (#60)
- Update contribution guide (#53)
- Improve self hosting guide
- Improve self hosting docs
- Wrote basic self hosting guide
- Improve meaning
- Improve meaning
- Improve meaning
- Improve meaning
- Add success & failure response shapes
- Improve meaning
- Improve meaning
- Add charset utf8
- Fix formatting
- Add named anchors
- Fix links
- Add basic api docs
- Update measure-go readme
- Add contributing file
- (**webapp**): Replace team/:id/invite docs with /auth/invite docs
- (**webapp**): Add API docs for crash & ANR groups APIs

[0.9.2]: https://github.com///compare/v0.9.1..v0.9.2
[0.9.1]: https://github.com///compare/v0.9.0..v0.9.1
[0.9.0]: https://github.com///compare/v0.8.2..v0.9.0
[0.8.2]: https://github.com///compare/v0.8.1..v0.8.2
[0.8.1]: https://github.com///compare/v0.8.0..v0.8.1
[0.8.0]: https://github.com///compare/v0.7.0..v0.8.0
[0.7.0]: https://github.com///compare/v0.6.1..v0.7.0
[0.6.1]: https://github.com///compare/v0.6.0..v0.6.1
[0.6.0]: https://github.com///compare/v0.5.0..v0.6.0
[0.5.0]: https://github.com///compare/v0.4.1..v0.5.0
[0.4.1]: https://github.com///compare/v0.4.0..v0.4.1
[0.4.0]: https://github.com///compare/v0.3.0..v0.4.0
[0.3.0]: https://github.com///compare/v0.2.1..v0.3.0
[0.2.1]: https://github.com///compare/v0.2.0..v0.2.1
[0.2.0]: https://github.com///compare/v0.1.1..v0.2.0
[0.1.1]: https://github.com///compare/v0.1.0..v0.1.1
[0.1.0]: https://github.com///compare/v0.0.1..v0.1.0

