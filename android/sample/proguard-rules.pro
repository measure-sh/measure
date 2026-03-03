# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# Keep Measure SDK internals accessed via reflection by MeasureConfigurator
-keepclassmembers class sh.measure.android.Measure {
    private <fields>;
}
-keepclassmembers class sh.measure.android.MeasureInternal {
    private <fields>;
}
-keepclassmembers class sh.measure.android.MeasureInitializerImpl {
    <fields>;
}
-keepclassmembers class sh.measure.android.exporter.NetworkClientImpl {
    <fields>;
    public void init(java.lang.String, java.lang.String);
}
-keepclassmembers class sh.measure.android.config.ConfigProviderImpl {
    public void setMeasureUrl(java.lang.String);
}