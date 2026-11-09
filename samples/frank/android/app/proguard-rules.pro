# Add project specific ProGuard rules here.

# Flutter plugin registration uses reflection to find this class
-keep class io.flutter.plugins.GeneratedPluginRegistrant { *; }

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

# WorkManager 2.9.1 pulls in Room 2.5, whose keep rule keeps RoomDatabase subclasses but not
# their constructors. AGP 9's R8 then strips WorkDatabase_Impl's constructor and WorkManager
# crashes at startup. Newer Room versions ship this rule themselves.
-keep class * extends androidx.room.RoomDatabase { void <init>(); }
