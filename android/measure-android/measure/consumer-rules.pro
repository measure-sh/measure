-keepattributes SourceFile,LineNumberTable
-keep class sh.measure.android.NativeBridgeImpl { *; }

# Required to check if okhttp is present in runtime classpath
-keepnames class okhttp3.OkHttpClient
# OkHttp is an optional dependency; silence the classes the SDK references when the app doesn't use it.
-dontwarn okhttp3.Call
-dontwarn okhttp3.EventListener
-dontwarn okhttp3.EventListener$Factory
-dontwarn okhttp3.Headers
-dontwarn okhttp3.HttpUrl
-dontwarn okhttp3.Interceptor
-dontwarn okhttp3.Interceptor$Chain
-dontwarn okhttp3.MediaType
-dontwarn okhttp3.Request
-dontwarn okhttp3.Request$Builder
-dontwarn okhttp3.RequestBody
-dontwarn okhttp3.Response
-dontwarn okhttp3.ResponseBody

# Required to check if androidx-fragment is present in runtime classpath
-keepnames class androidx.fragment.app.FragmentActivity

# Required to find gesture targe for composables
-keepnames class androidx.compose.ui.platform.AndroidComposeView

# WorkManager is an optional dependency, only present when the consumer enables ProfilingManager
# uploads. Used to check for its presence in the runtime classpath; silence references when absent.
-keepnames class androidx.work.WorkManager
-dontwarn androidx.work.BackoffPolicy
-dontwarn androidx.work.Constraints
-dontwarn androidx.work.Constraints$Builder
-dontwarn androidx.work.Data
-dontwarn androidx.work.Data$Builder
-dontwarn androidx.work.ExistingWorkPolicy
-dontwarn androidx.work.ListenableWorker
-dontwarn androidx.work.ListenableWorker$Result
-dontwarn androidx.work.NetworkType
-dontwarn androidx.work.OneTimeWorkRequest
-dontwarn androidx.work.OneTimeWorkRequest$Builder
-dontwarn androidx.work.Worker
-dontwarn androidx.work.WorkManager

# ProfilingManager APIs exist only from API 35/36 and are called behind SDK_INT checks.
# Silence them for apps that compile against an older SDK.
-dontwarn android.os.ProfilingManager
-dontwarn android.os.ProfilingResult
-dontwarn android.os.ProfilingTrigger
-dontwarn android.os.ProfilingTrigger$Builder

