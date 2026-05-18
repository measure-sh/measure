package sh.measure

import org.gradle.api.Project
import org.gradle.api.artifacts.component.ModuleComponentIdentifier
import org.gradle.api.artifacts.component.ModuleComponentSelector
import org.gradle.api.artifacts.result.DependencyResult
import org.gradle.api.artifacts.result.ResolvedComponentResult
import org.gradle.api.artifacts.result.ResolvedDependencyResult
import org.gradle.api.provider.MapProperty
import sh.measure.asm.ModuleInfo

/**
 * Checks if the version of the library is compatible with the given range.
 *
 * @param group The group of the library.
 * @param name The name of the library.
 * @param minVersion The minimum version of the library that is compatible. This version is inclusive.
 * @param maxVersion The maximum version of the library that is compatible. This version is inclusive.
 */
fun Map<ModuleInfo, SemVer>.isVersionCompatible(
    group: String,
    name: String,
    minVersion: SemVer,
    maxVersion: SemVer,
): Boolean {
    val version: SemVer = this.getOrDefault(ModuleInfo(group, name), SemVer())
    return version >= minVersion && version <= maxVersion
}

/**
 * Extracts the versions of the dependencies from the [ResolvedComponentResult] and returns a map
 * of [ModuleInfo] to [SemVer]. Ignores the dependency if it is not a valid SemVer.
 */
fun ResolvedComponentResult.versionsMap(project: Project): MapProperty<ModuleInfo, SemVer> {
    val versionsMap = project.objects.mapProperty(ModuleInfo::class.java, SemVer::class.java)
    dependencies.forEach { dependency: DependencyResult ->
        when (val requested = dependency.requested) {
            is ModuleComponentSelector -> {
                // Try requested version first (direct dependencies)
                var version = try {
                    SemVer.parse(requested.version)
                } catch (e: IllegalArgumentException) {
                    SemVer()
                }

                // If requested version is empty/invalid, try resolved version (BOM case)
                if (version == SemVer() && dependency is ResolvedDependencyResult) {
                    val selected = dependency.selected
                    if (selected.id is ModuleComponentIdentifier) {
                        version = try {
                            SemVer.parse((selected.id as ModuleComponentIdentifier).version)
                        } catch (e: IllegalArgumentException) {
                            SemVer()
                        }
                    }
                }

                versionsMap.put(
                    ModuleInfo(requested.group, requested.module),
                    version,
                )
            }
        }
    }
    return versionsMap
}
