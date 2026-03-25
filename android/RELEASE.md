# Release Checklist

```mermaid
graph LR
    A["1. Run prepare-release\nworkflow (manual)"]:::manual --> B["2. Review & merge\nPR (manual)"]:::manual
    B --> C["3. Tag & push\n(manual)"]:::manual
    C --> D[Publish to\nMaven Central /\nGradle Plugin Portal]:::auto
    D --> E[Create draft\nGitHub Release]:::auto
    D --> F[Trigger prepare-next\nworkflow]:::auto
    E --> G["4. Publish\nGitHub Release (manual)"]:::manual
    F --> H["5. Review & merge\nprepare-next PR (manual)"]:::manual

    classDef manual fill:#fff3cd,stroke:#856404
    classDef auto fill:#d1e7dd,stroke:#0f5132
```

## Measure SDK

1. Go to GitHub Actions and run the **Prepare Android Release** workflow with the desired version and next SNAPSHOT version.
2. Review and merge the automatically created PR.
3. Tag the merge commit and push:
   ```bash
   git tag android-vX.Y.Z
   git push origin android-vX.Y.Z
   ```
4. The tag push triggers the release workflow which:
   - Publishes to Maven Central
   - Creates a draft GitHub Release with auto-generated changelog
   - Triggers the prepare-next workflow automatically
5. Go to Releases, review the draft, and publish it.
6. Review and merge the prepare-next PR.

## Measure Gradle Plugin

1. Go to GitHub Actions and run the **Prepare Android Gradle Plugin Release** workflow with the desired version and next SNAPSHOT version.
2. Review and merge the automatically created PR.
3. Tag the merge commit and push:
   ```bash
   git tag android-gradle-plugin-vX.Y.Z
   git push origin android-gradle-plugin-vX.Y.Z
   ```
4. The tag push triggers the release workflow which:
   - Publishes to Gradle Plugin Portal
   - Creates a draft GitHub Release with auto-generated changelog
   - Triggers the prepare-next workflow automatically
5. Go to Releases, review the draft, and publish it.
6. Review and merge the prepare-next PR.
