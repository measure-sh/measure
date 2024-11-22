package sh.measure.android

import sh.measure.android.exporter.PeriodicEventExporter

internal class NoopPeriodicEventExporter : PeriodicEventExporter {
    override fun onAppForeground() {
        // No-op
    }

    override fun onAppBackground() {
        // No-op
    }

    override fun unregister() {
        // No-op
    }
}
