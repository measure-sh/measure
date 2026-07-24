# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [rn-v0.2.0] - 2026-07-24

### :hammer: Misc


- (**rn**): Add patch version parameter to upload patch script (#4135) by @adwinross in #4135
- (**rn**): Add spm support for measure dependencies (#4029) by @adwinross in #4029
- (**rn**): Add github workflow to prepare release (#3927) by @adwinross in #3927

### :recycle: Refactor


- (**rn**): Use logger instead of internalConsole in collectors by @abhaysood in #4021

### :sparkles: New features


- (**rn**): Implement logging (#4021) by @abhaysood
- (**rn**): Add symbolication support for over the air update (#4005) by @adwinross in #4005

## [rn-v0.1.1] - 2026-06-16

### :hammer: Misc


- (**rn**): Prepare sdk release 0.1.1 (#3916) by @adwinross in #3916
- (**rn**): Update package.json (#3906) by @adwinross in #3906
- (**rn**): Update expo plugin to add sdk initlaisation code (#3904) by @adwinross in #3904
- (**rn**): Keep React Native view class names for gesture target (#3915) by @abhaysood in #3915

## [rn-v0.1.0] - 2026-06-11

### :bug: Bug fixes


- (**rn**): Update http method name to be lowercased (#3682) by @adwinross in #3682
- (**rn**): Convert checkpoint NSNumber values to Int64 in trackSpan (#3662) by @adwinross in #3662
- (**rn**): Implement native module for start and stop sdk apis (#3655) by @adwinross in #3655
- (**rn**): Fix bugs in public API and native bridge layer (#3517) by @adwinross in #3517
- (**rn**): Add proper screenshot masking (#3054) by @adwinross in #3054

### :hammer: Misc


- (**rn**): Prepare rn release 0.1.0 (#3895) by @adwinross in #3895
- (**rn**): Fix typescript lint and typecheck error (#3878) by @adwinross in #3878
- (**rn**): Add upload build script (#3874) by @adwinross in #3874
- (**rn**): Remove enableFullCollectionMode from measure config (#3759) by @adwinross in #3759
- (**rn**): Remove capture layout snapshot api (#3679) by @adwinross in #3679
- (**rn**): Use named parameters instead of positional parameter (#3656) by @adwinross in #3656
- (**rn**): Update package.json (#3652) by @adwinross in #3652
- (**rn**): Update project config (#3354) by @adwinross in #3354
- (**rn**): Update measure config and default event collection (#2961) by @adwinross in #2961
- (**rn**): Update gradle version in example app (#2959) by @adwinross in #2959
- (**rn**): Initialize native sdks in main thread (#2670) by @adwinross in #2670
- (**rn**): Add ci test script (#2623) by @adwinross in #2623
- (**rn**): Setup react native package with ios and android integration (#2463) by @adwinross in #2463

### :recycle: Refactor


- (**rn**): Use signal processor to track exceptions (#2908) by @adwinross in #2908
- (**rn**): Refactor build scripts (#2634) by @abhaysood in #2634

### :sparkles: New features


- (**rn**): Implement crash tracking for react native (#3757) by @adwinross in #3757
- (**rn**): Add diagnostic mode for SDK logging (#3456) by @adwinross in #3456
- (**rn**): Add dynamic config and modify initialization  (#3128) by @adwinross in #3128
- (**rn**): Expose api to get session id (#3045) by @adwinross in #3045
- (**rn**): Implement bug reporting (#3015) by @adwinross in #3015
- (**rn**): Track http events automatically (#2998) by @adwinross in #2998
- (**rn**): Expose api to track http events manually (#2991) by @adwinross in #2991
- (**rn**): Expose apis to set and clear user id (#2976) by @adwinross in #2976
- (**rn**): Implement performance tracing (#2887) by @adwinross in #2887
- (**rn**): Add screen view event tracking (#2757) by @adwinross in #2757
- (**rn**): Track custom events (#2705) by @adwinross in #2705
- (**rn**): Add exception tracking (#2628) by @adwinross in #2628
- (**rn**): Add sdk initialization api (#2505) by @adwinross in #2505

[rn-v0.2.0]: https://github.com/measure-sh/measure/compare/rn-v0.1.1..rn-v0.2.0
[rn-v0.1.1]: https://github.com/measure-sh/measure/compare/rn-v0.1.0..rn-v0.1.1

