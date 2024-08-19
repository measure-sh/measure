package sh.measure

import com.android.build.api.variant.Variant
import org.gradle.api.Project
import org.gradle.api.artifacts.component.ModuleComponentSelector
import org.gradle.api.artifacts.result.DependencyResult
import org.gradle.api.provider.MapProperty
import sh.measure.asm.ModuleInfo

/**
 * Checks if the version of the library is compatible with the given range.
 *
 * @param group The group of the library.
 * @param name The name of the library.
 * @param minVersion The minimum version of the library that is compatible. This version is inclusive.
 * @param maxVersion The maximum version of the library that is compatible. This version is exclusive.
 */
fun Map<ModuleInfo, SemVer>.isVersionCompatible(
    group: String,
    name: String,
    minVersion: SemVer,
    maxVersion: SemVer,
): Boolean {
    val version: SemVer = this.getOrDefault(ModuleInfo(group, name), SemVer())
    return version >= minVersion && version < maxVersion
}

/**
 * Returns a map of all resolved dependency versions.
 *
 * Note that this function is evaluated lazily by gradle, and is only evaluated when dependency
 * versions are resolved.
 *
 * @param variant The variant for which the dependencies are to be resolved.
 * @return A map of all resolved dependency versions.
 */
fun Project.versionsMap(variant: Variant): MapProperty<ModuleInfo, SemVer> {
    val versionsMap: MapProperty<ModuleInfo, SemVer> =
        objects.mapProperty(ModuleInfo::class.java, SemVer::class.java)
    configurations.named("${variant.name}RuntimeClasspath").configure { configuration ->
        configuration.incoming.afterResolve {
            val dependencies =
                configuration.incoming.resolutionResult.rootComponent.get().dependencies
            dependencies.forEach { dependency: DependencyResult ->
                when (val requested = dependency.requested) {
                    is ModuleComponentSelector -> {
                        versionsMap.put(
                            ModuleInfo(requested.group, requested.module),
                            SemVer.parse(requested.version),
                        )
                    }
                }
            }
        }
    }
    return versionsMap
}