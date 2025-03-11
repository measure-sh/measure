# Release

## Measure SDK

To release the iOS SDK, follow the below steps.

1. Make sure you're on the latest commit on the main branch.
2. Build and run tests before.
3. Run `./ios/Scripts/release.sh <major/minor/patch>`. This script is executed in below 3 steps:
   1. Update local versions
        - First the script will get the current SDK version from `FrameworkInfo.swift` and increment it.
        - It will then update the SDK versions in `MeasureSDK.podspec`, `FrameworkInfo.swift` and `README.md`.
        - Verify these before moving forward.
   2. Update CHANGELOG.md
        - We use git-cliff to generate change logs. This step might require you to add github-token with `public_repo` permission if the changes are too long.
   3. Create tags.
        - In the last step of the script, all the changes are commited with the message `chore(ios): prepare sdk release <x.y.z>`. 
        - A tag is created with the name `ios-v<x.y.z>`
        - The commit and tags are pushed to remote.
4. Once the tag is pushed to remote, a github action is triggered which pushes the podspec to cocoapods.
