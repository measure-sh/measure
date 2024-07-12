# Release Checklist

## Measure SDK

1. Make sure you're on the latest commit on the main branch.
2. Change `MEASURE_VERSION_NAME` in `gradle.properties` to a non-SNAPSHOT version.
3. Update README.md with new release version.
4. Update CHANGELOG.md for the new release.
5. Commit the changes: "chore(android): prepare release x.y.z"
6. Create a tag with the version number: `git tag -a measure-android-x.y.z -m "measure-android-x.y.z"`
7. Change `MEASURE_VERSION_NAME` to next version snapshot.
8. Commit the changes: "chore(android): prepare next development version"
9. Push the tag and two commits to main branch.
10. Create a release on Github with the tag and release notes from CHANGELOG.md.

## Measure Gradle Plugin
1. Make sure you're on the latest commit on the main branch.
2. Run `./gradlew :measure-android-gradle:check` to make sure everything is working. This also runs 
the `functionalTest` task which is only run locally as of now.
3. Change `MEASURE_PLUGIN_VERSION_NAME` in `measure-android-gradle/gradle.properties` to a non-SNAPSHOT version.
4. Update README.md with new release version.
5. Update CHANGELOG.md for the new release.
6. Commit the changes: "chore(android): prepare release x.y.z"
7. Create a tag with the version number: `git tag -a measure-android-gradle-x.y.z -m "measure-android-gradle-x.y.z"`
8. Change `MEASURE_PLUGIN_VERSION_NAME` to next version snapshot.
9. Commit the changes: "chore(android): prepare next development version"
10. Push the tag and two commits to main branch.
11. Create a release on Github with the tag and release notes from CHANGELOG.md.
