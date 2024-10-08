-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
-keep class sh.measure.android.NativeBridgeImpl { *; }

# Required to check if okhttp is present in runtime classpath
-keepnames class okhttp3.OkHttpClient

# Required to check if androidx-fragment is present in runtime classpath
-keepnames class androidx.fragment.app.FragmentActivity
