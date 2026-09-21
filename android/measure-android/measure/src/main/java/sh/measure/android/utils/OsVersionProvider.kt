package sh.measure.android.utils

import android.os.Build

internal interface OsVersionProvider {
    val sdkInt: Int
}

internal class OsVersionProviderImpl : OsVersionProvider {
    override val sdkInt: Int
        get() = Build.VERSION.SDK_INT
}
