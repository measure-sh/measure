package sh.measure.android.fakes

import sh.measure.android.utils.InstallationIdProvider

internal class FakeInstallationIdProvider(
    override val installationId: String = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
) : InstallationIdProvider
