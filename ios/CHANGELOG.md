# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [ios-v0.1.0] - 2025-03-28

### :books: Documentation


- (**ios**): Update readme (#1956)
- (**ios**): Add feature documentation (#1863)

### :bug: Bug fixes


- (**ios**): Skip sdk initialisation if api key or api url is invalid (#1970)
- (**ios**): Update in_app generation logic (#1885)
- (**ios**): Update long press timeout (#1801)
- (**ios**): Data type issue
- (**ios**): Data ingestion failure

### :hammer: Misc


- (**ios**): Add http event configurations to measure config (#1980)
- (**ios**): Log error messages when upload dsym script fails (#1975)
- (**ios**): Create new session if build number or app version is updated (#1972)
- (**ios**): Rename MeasureSDK to Measure (#1957)
- (**ios**): Update plcrashreporter config (#1938)
- (**ios**): Remove fatal errors (#1932)
- (**ios**): Update cpu frequency generation logic
- (**ios**): Prepare sdk release 0.0.1-rc1 (#1877)
- (**ios**): Update release scripts (#1876)
- (**ios**): Add release scripts (#1869)
- (**ios**): Update public apis (#1841)
- (**ios**): Add scripts to upload dsyms (#1823)
- (**ios**): Add binary images to exception (#1802)
- (**ios**): Add spm and cocoapod support (#1796)
- (**ios**): Add layout snapshots to gestures (#1779)
- (**ios**): Add privacy manifest (#1782)
- (**ios**): Add sessionator data (#1749)
- (**ios**): Add public apis to set and unset userid
- (**ios**): Add session sampling and data cleanup (#1733)
- (**ios**): Add screen view event (#1721)
- (**ios**): Add custom event tracking (#1676)
- (**ios**): Track and export network change events (#1683)
- (**ios**): Track and export http events (#1612)
- (**ios**): Track app termination event (#1678)
- (**ios**): Add launch event tracking (#1535)
- (**ios**): Add cpu and memory tracking (#1519)
- (**ios**): Update time provider (#1478)
- (**ios**): Add lifecycle tracking (#1444)
- (**ios**): Update session creation logic (#1398)
- (**ios**): Batch and send events (#1369)
- (**ios**): Update event store to save gesture data (#1365)
- (**ios**): Update project structure (#1328)
- (**ios**): Detect and save gesture events (#1324)
- (**ios**): Save events and sessions to core data (#1307)
- (**ios**): Add crash reporting (#1267)
- (**ios**): Add signpost for performance testing (#1208)
- (**ios**): Add event processor (#1206)
- (**ios**): Add attribute processor (#1192)
- (**ios**): Add session manager (#1162)
- (**ios**): Update sdk initialisation (#1146)
- (**ios**): Update ios sdk initialisation (#1119)
- (**ios**): Add swiftLint to ios

### :recycle: Refactor


- (**ios**): Rename NetworkInterceptor to MsrNetworkInterceptor (#1922)

### :sparkles: New features


- (**ios**): Expose API to get current session ID (#1677)
- (**ios**): Initial project setup  (#1034)


