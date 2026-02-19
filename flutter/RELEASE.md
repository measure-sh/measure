# Release

## Pre-release Checklist

- Ensure Measure Android SDK has been released and is available in Maven Central.
- Ensure Measure iOS SDK has been released and is available in CocoaPods.

## measure_flutter

- Checkout a new branch named `measure_flutter-vx.y.z` from the `main` branch.
- Update the `pubspec.yaml` file with the new version number.
- Update the `CHANGELOG.md` file with the new version number and release notes.
- Update the `flutter/packages/measure_flutter/android/build.gradle` file with the required Measure Android SDK version.
- Update the `flutter/packages/measure_flutter/ios/Podfile` file with the required Measure iOS SDK version.
- Commit the changes `git commit -m "chore(flutter): prepare measure_flutter-vx.y.z"`.
- Push the branch to the remote repository `git push origin measure_flutter-vx.y.z`.
- Create a pull request from `measure_flutter-vx.y.z` to `main`.
- Review and merge the pull request.
- Tag the commit that was merged in the pull request with `measure_flutter-vx.y.z` to trigger the release workflow:
  ```bash
  git tag measure_flutter-vx.y.z
  git push origin measure_flutter-vx.y.z
  ```
- Once the workflow completes:
    - Go to Releases
    - Find the draft release for `measure_flutter-vx.y.z`
    - Add release notes
    - Publish release

- Checkout a new branch named `measure_flutter-next` from the `main` branch.
- Update the `pubspec.yaml` file with the next version number.
- Update the `flutter/packages/measure_flutter/android/build.gradle` file with the next snapshot version.
- Update the `flutter/packages/measure_flutter/ios/Podfile` file with path to iOS SDK.
- Commit the changes `git commit -m "chore(flutter): prepare next measure_flutter version"`.
- Push the branch to the remote repository `git push origin measure_flutter-next`.
- Create a pull request from `measure_flutter-next` to `main`.
- Review and merge the pull request.

## measure_build

- Checkout a new branch named `measure_build-vx.y.z` from the `main` branch.
- Update the `pubspec.yaml` file with the new version number.
- Commit the changes `git commit -m "chore(flutter): prepare measure_build-vx.y.z"`.
- Push the branch to the remote repository `git push origin measure_build-vx.y.z`.
- Create a pull request from `measure_build-vx.y.z` to `main`.
- Review and merge the pull request.
- Tag the commit that was merged in the pull request with `measure_build-vx.y.z` to trigger the release workflow:
  ```bash
  git tag measure_build-vx.y.z
  git push origin measure_build-vx.y.z
  ```
- Once the workflow completes:
  - Go to Releases
  - Find the draft release for `measure_build-vx.y.z`
  - Add release notes
  - Publish release


## measure_dio

- Ensure `measure_flutter` is released and available in the pub.dev.
- Checkout a new branch named `measure_dio-vx.y.z` from the `main` branch.
- Update the `pubspec.yaml` file with the new version number.
- Update the `pubspec.yaml` file required `measure_flutter` version.
- Update the `CHANGELOG.md` file with the new version number and release notes.
- Commit the changes `git commit -m "chore(dio): prepare measure_dio-vx.y.z"`.
- Push the branch to the remote repository `git push origin measure_dio-vx.y.z`.
- Create a pull request from `measure_dio-vx.y.z` to `main`.
- Review and merge the pull request.
- Tag the commit that was merged in the pull request with `measure_dio-vx.y.z` to trigger the release workflow:
  ```bash
  git tag measure_dio-vx.y.z
  git push origin measure_dio-vx.y.z
  ```
- Once the workflow completes:
    - Go to Releases
    - Find the draft release for `measure_dio-vx.y.z`
    - Add release notes
    - Publish release
