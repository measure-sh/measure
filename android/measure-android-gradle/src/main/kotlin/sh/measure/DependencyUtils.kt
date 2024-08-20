package sh.measure

import com.android.build.api.variant.Variant
import org.gradle.api.Project
import org.gradle.api.artifacts.component.ModuleComponentSelector
import org.gradle.api.artifacts.result.DependencyResult
import org.gradle.api.provider.MapProperty
import sh.measure.asm.ModuleInfo

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
 *
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