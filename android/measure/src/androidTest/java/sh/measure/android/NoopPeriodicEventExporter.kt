package sh.measure.android

import sh.measure.android.exporter.PeriodicEventExporter

internal class NoopPeriodicEventExporter : PeriodicEventExporter {
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
