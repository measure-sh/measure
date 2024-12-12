package sh.measure.android

import sh.measure.android.exporter.PeriodicExporter

internal class NoopPeriodicExporter : PeriodicExporter {
    override fun register() {
        // No-op
    }

    override fun resume() {
        // No-op
    }

    override fun pause() {
        // No-op
    }

    override fun unregister() {
        // No-op
    }
}
