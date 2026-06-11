# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [rn-v0.1.0] - 2026-06-11

### :bug: Bug fixes


- (**rn**): Regenerate frank yarn.lock for yarn 3 (#3872)
- (**rn**): Update http method name to be lowercased (#3682)
- (**rn**): Exclude react text view from masking at sensitive fields only level (#3666)
- (**rn**): Convert checkpoint NSNumber values to Int64 in trackSpan (#3662)
- (**rn**): Implement native module for start and stop sdk apis (#3655)
- (**rn**): Fix bugs in public API and native bridge layer (#3517)
- (**rn**): Add proper screenshot masking (#3054)

### :hammer: Misc


- (**rn**): Fix typescript lint and typecheck error (#3878)
- (**rn**): Add upload build script (#3874)
- (**rn**): Remove enableFullCollectionMode from measure config (#3759)
- (**rn**): Add react native docs (#3688)
- (**rn**): Remove capture layout snapshot api (#3679)
- (**rn**): Use named parameters instead of positional parameter (#3656)
- (**rn**): Update package.json (#3652)
- (**rn**): Update project config (#3354)
- (**rn**): Update measure config and default event collection (#2961)
- (**rn**): Update gradle version in example app (#2959)
- (**rn**): Initialize native sdks in main thread (#2670)
- (**rn**): Add ci test script (#2623)
- (**rn**): Setup react native package with ios and android integration (#2463)

### :recycle: Refactor


- (**rn**): Use signal processor to track exceptions (#2908)
- (**rn**): Refactor build scripts (#2634)

### :sparkles: New features


- (**rn**): Implement crash tracking for react native (#3757)
- (**rn**): Add diagnostic mode for SDK logging (#3456)
- (**rn**): Add dynamic config and modify initialization  (#3128)
- (**rn**): Expose api to get session id (#3045)
- (**rn**): Implement bug reporting (#3015)
- (**rn**): Track http events automatically (#2998)
- (**rn**): Expose api to track http events manually (#2991)
- (**rn**): Expose apis to set and clear user id (#2976)
- (**rn**): Implement performance tracing (#2887)
- (**rn**): Add screen view event tracking (#2757)
- (**rn**): Track custom events (#2705)
- (**rn**): Add exception tracking (#2628)
- (**rn**): Add sdk initialization api (#2505)


