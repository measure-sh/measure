package sh.measure.android.fakes

import sh.measure.android.utils.PackageInfoProvider

internal class FakePackageInfoProvider : PackageInfoProvider {
    override var appVersion: String? = "app-version"

    override fun getVersionCode(): String = "1000"
}
