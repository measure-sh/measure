package sh.measure.android.attributes

import sh.measure.android.utils.InstallationIdProvider

internal class InstallationIdAttributeProcessor(
    private val installationIdProvider: InstallationIdProvider,
) : ComputeOnceAttributeProcessor() {

    override fun computeAttributes(): Map<String, Any?> = mapOf(Attribute.INSTALLATION_ID_KEY to installationIdProvider.installationId)
}
