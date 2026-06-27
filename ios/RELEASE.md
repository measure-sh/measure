# Release

## Measure SDK

To release the iOS SDK, follow the below steps.

1. Go to **Actions → Prepare iOS Release → Run workflow** and enter the version number (e.g. `0.9.0`).
   - The workflow will run the test suite, bump versions in all relevant files, generate the changelog, and open a PR.
2. Review and merge the PR.
3. Push the release tag:
   ```
   git tag ios-v<version>
   git push origin ios-v<version>
   ```
4. Run `pod trunk register <email> 'measure.sh' --description='<description>'` to authenticate to the CocoaPods server.
5. Run `pod spec lint measure-sh.podspec` to check the podspec configuration is correct.
6. Run `pod trunk push measure-sh.podspec` to push the pod to CocoaPods.
7. Go to the releases tab and create a new release using the pushed tag.
