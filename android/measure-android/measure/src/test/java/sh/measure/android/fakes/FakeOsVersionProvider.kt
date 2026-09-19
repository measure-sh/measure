package sh.measure.android.fakes

import android.os.Build
import sh.measure.android.utils.OsVersionProvider

internal class FakeOsVersionProvider(
    override var sdkInt: Int = Build.VERSION_CODES.P,
) : OsVersionProvider
