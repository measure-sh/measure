-keepattributes SourceFile,LineNumberTable
-keep class sh.measure.android.NativeBridgeImpl { *; }

# Required to check if okhttp is present in runtime classpath
-keepnames class okhttp3.OkHttpClient

# Required to check if androidx-fragment is present in runtime classpath
-keepnames class androidx.fragment.app.FragmentActivity

# Required to find gesture targe for composables
-keepnames class androidx.compose.ui.platform.AndroidComposeView

# WorkManager is an optional dependency, only present when the consumer enables ProfilingManager
# uploads. Used to check for its presence in the runtime classpath; silence references when absent.
-keepnames class androidx.work.WorkManager
-dontwarn androidx.work.**

