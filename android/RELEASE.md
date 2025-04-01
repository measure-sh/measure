# Release Checklist

## Measure SDK

1. Go to GitHub Actions and run the "Prepare Android Release" workflow with the desired version.
2. Review and merge the automatically created PR.
3. Tag the commit that was merged in step 2 with `android-vx.y.z` to trigger the release workflow:
   ```bash
   git tag android-vx.y.z
   git push origin android-vx.y.z
   ```
4. Once the workflow completes:
   - Go to Releases
   - Find the draft release for `android-vx.y.z`
   - Add release notes
   - Publish release
4. Go to GitHub Actions and run the "Prepare Next Android Version" workflow with the next version.
5. Review and merge the automatically created PR.


## Measure Gradle Plugin

1. Go to GitHub Actions and run the "Prepare Android Gradle Plugin Release" workflow with the desired version.
2. Review and merge the automatically created PR.
3. Tag the commit that was merged in step 2 with `android-gradle-plugin-vx.y.z` to trigger the release workflow:
   ```bash
   git tag android-gradle-plugin-vx.y.z
   git push origin android-gradle-plugin-vx.y.z
   ```
4. Once the workflow completes:
   - Go to Releases
   - Find the draft release for `android-gradle-plugin-vx.y.z`
   - Add release notes
   - Publish release
4. Go to GitHub Actions and run the "Prepare Next Android Gradle Plugin Version" workflow with the next version.
5. Review and merge the automatically created PR.
