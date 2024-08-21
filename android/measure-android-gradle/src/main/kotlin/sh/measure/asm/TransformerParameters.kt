package sh.measure.asm

import com.android.build.api.instrumentation.InstrumentationParameters
import org.gradle.api.provider.Property
import org.gradle.api.provider.Provider
import org.gradle.api.tasks.Input
import sh.measure.SemVer

interface TransformerParameters : InstrumentationParameters {
    @get:Input
    val versions: Property<Provider<Map<ModuleInfo, SemVer>>>

    @get:Input
    val minVersion: Property<SemVer>

    @get:Input
    val maxVersion: Property<SemVer>
}
