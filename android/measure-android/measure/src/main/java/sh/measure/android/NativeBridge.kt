package sh.measure.android

import android.util.Log
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger

/**
 * Listener interface for receiving raw SIGQUIT signals.
 *
 * The system raises SIGQUIT every time it collects stack traces for the process, so
 * a single stall can deliver several. Turning these into ANR incidents is the job of
 * [sh.measure.android.anr.AnrCollector], not of this listener's implementers.
 */
internal interface SigquitListener {
    /**
     * Called every time the process receives a SIGQUIT.
     *
     * @param timestamp the timestamp when the signal was received.
     */
    fun onSigquit(timestamp: Long)
}

internal interface NativeBridge {
    fun enableAnrReporting(listener: SigquitListener): Boolean
    fun disableAnrReporting()
}

/**
 * A bridge between Kotlin and native code.
 */
internal class NativeBridgeImpl(private val logger: Logger) : NativeBridge {
    companion object {
        init {
            try {
                System.loadLibrary("measure-ndk")
            } catch (e: UnsatisfiedLinkError) {
                Log.e("Measure", "Failed to load measure-ndk, ANR detection will not work.", e)
            } catch (e: SecurityException) {
                Log.e("Measure", "Failed to load measure-ndk, ANR detection will not work.", e)
            } catch (e: NullPointerException) {
                Log.e("Measure", "Failed to load measure-ndk, ANR detection will not work.", e)
            }
        }
    }

    private var sigquitListener: SigquitListener? = null

    /**
     * Registers a [SigquitListener] to receive SIGQUIT signals.
     *
     * @param listener the listener to register.
     * @return true if ANR reporting was enabled successfully, false otherwise.
     */
    override fun enableAnrReporting(listener: SigquitListener): Boolean {
        if (this.sigquitListener != null) {
            return true
        }
        val success = try {
            enableAnrReportingInternal()
        } catch (e: Throwable) {
            // Catch all exceptions to prevent the app from crashing if the native code fails
            // or the native library fails to load.
            logger.log(LogLevel.Debug, "Failed to enable ANR reporting", e)
            false
        }

        if (success) {
            this.sigquitListener = listener
        }
        return success
    }

    /**
     * Disables ANR reporting and unregisters the [SigquitListener].
     */
    override fun disableAnrReporting() {
        if (sigquitListener == null) {
            logger.log(
                LogLevel.Debug,
                "Attempt to disable ANR reporting when it's already disabled",
            )
            return
        }
        sigquitListener = null
        disableAnrReportingInternal()
    }

    private external fun enableAnrReportingInternal(): Boolean
    private external fun disableAnrReportingInternal()

    /**
     * **IMPORTANT**: This method is called from the native code when an ANR is detected.
     * Do not change the method signature or the method name without updating the native code
     * at `anr_handler.c`.
     *
     * @param timestamp the timestamp when the ANR was detected
     */
    private fun notifyAnrDetected(timestamp: Long) {
        sigquitListener?.onSigquit(timestamp)
    }
}
