package sh.measure.asm

import java.io.Serializable

/**
 * Represents a dependency module.
 *
 * @property group The group of the module, example for `com.google.dagger:dagger:2.35`
 * the group is `com.google.dagger`.
 * @property name The name of the module, example for `com.google.dagger:dagger:2.35` the name
 * is `dagger`.
 */
data class ModuleInfo(
    val group: String,
    val name: String,
) : Serializable
