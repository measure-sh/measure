-keepattributes SourceFile,LineNumberTable
-keep class sh.measure.android.NativeBridgeImpl { *; }

# Required to check if okhttp is present in runtime classpath
-keepnames class okhttp3.OkHttpClient

# Required to check if androidx-fragment is present in runtime classpath
-keepnames class androidx.fragment.app.FragmentActivity

# Required to find gesture targe for composables
-keepnames class androidx.compose.ui.platform.AndroidComposeView

