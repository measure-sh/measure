# App Size Monitoring

* [**Android**](#android)
* [**iOS**](#ios)

Measure automatically calculates and tracks the size of your app over time.

## Android

Measure supports tracking size for both APKs
and AABs. The Measure Gradle Plugin automatically uploads the size information to Measure after an `assemble<Variant>`
or `bundle<Variant>`task completes successfully.

#### APK Size

The plugin calculates APK size by using
apkanalyzer [download-size](https://developer.android.com/tools/apkanalyzer#commands) command, which is the same tool
used by Android Studio to calculate APK sizes. The APK size captured represents the estimated download size of the APK
for the end user.

#### AAB Size

The plugin calculates AAB size by using bundletool's [get-size total](https://developer.android.com/tools/bundletool)
command. The AAB size captured represents the maximum size of the APK that can be generated from the AAB.

Read more about AAB format [here](https://developer.android.com/guide/app-bundle).

## iOS

Measure automatically tracks size of the IPA file for each version when you upload dSYMs via the [upload_dsyms.sh](../../ios/Scripts/upload_dsyms.sh) script.

> [!NOTE]
> This represents the size of the generated .ipa, not the actual App Store download size.
