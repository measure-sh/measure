package sh.measure

import org.gradle.api.Action
import org.gradle.api.model.ObjectFactory
import javax.inject.Inject

/**
 * Configuration options (Gradle plugin extensions) for the MeasurePlugin.
 *
 * Measure plugin is enabled by default for all variants, to disable all features
 * of the plugin for a specific variant, for example all debug variants:
 *
 * ```kotlin
 * measure {
 *   variantFilter {
 *      if (name.contains("debug")) {
 *          enabled = false
 *      }
 * }
 * ```
 */
open class MeasurePluginExtension @Inject constructor(objects: ObjectFactory) {
    var httpHeaders: Map<String, String> = emptyMap()

    internal var filter: Action<VariantFilter> = Action {
        if (it.name.lowercase().contains("debug")) {
            it.enabled = true
        }
    }

    /**
     * Allows configuring the Measure gradle plugin for specific variants.
     */
    fun variantFilter(action: Action<VariantFilter>) {
        this.filter = action
    }
}

interface VariantFilter {
    /**
     * The name of the variant.
     */
    val name: String

    /**
     * Allows enabling or disabling the Measure gradle plugin from uploading mapping files
     * generated by Proguard/R8. Note that disabling this will prevent Measure from de-obfuscating
     * stack traces.
     */
    var enabled: Boolean
}

internal class VariantFilterImpl(override val name: String) : VariantFilter {
    override var enabled: Boolean = true
}
