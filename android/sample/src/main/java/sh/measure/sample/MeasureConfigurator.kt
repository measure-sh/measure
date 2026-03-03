package sh.measure.sample

import android.util.Log
import sh.measure.android.Measure

/**
 * Uses reflection to hot-swap Measure SDK credentials at runtime.
 * This is a sample-app-only utility — no SDK code is modified.
 *
 * Reflection path:
 *   Measure (object)
 *     └─ measure: MeasureInternal          (private field)
 *          └─ measure: MeasureInitializer   (private constructor param)
 *               ├─ networkClient: NetworkClient  → call init(newUrl, newApiKey)
 *               └─ configProvider: ConfigProvider → call setMeasureUrl(newUrl)
 */
object MeasureConfigurator {
    private const val TAG = "MeasureConfigurator"

    /**
     * Hot-swaps the SDK's API URL and API key using reflection.
     * Returns true on success, false if reflection fails.
     */
    fun swapCredentials(apiUrl: String, apiKey: String): Boolean {
        return try {
            val initializer = getMeasureInitializer() ?: return false

            val networkClient = initializer.javaClass.getDeclaredField("networkClient").apply {
                isAccessible = true
            }.get(initializer)!!

            // Call networkClient.init(apiUrl, apiKey)
            networkClient.javaClass.getMethod("init", String::class.java, String::class.java)
                .invoke(networkClient, apiUrl, apiKey)

            val configProvider = initializer.javaClass.getDeclaredField("configProvider").apply {
                isAccessible = true
            }.get(initializer)!!

            // Call configProvider.setMeasureUrl(apiUrl)
            configProvider.javaClass.getMethod("setMeasureUrl", String::class.java)
                .invoke(configProvider, apiUrl)

            Log.d(TAG, "Credentials swapped successfully")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to swap credentials", e)
            false
        }
    }

    /**
     * Reads the current baseUrl and apiKey from NetworkClientImpl via reflection.
     * Returns (baseUrl, apiKey) or (null, null) if reflection fails.
     */
    fun getCurrentCredentials(): Pair<String?, String?> {
        return try {
            val initializer = getMeasureInitializer() ?: return Pair(null, null)

            val networkClient = initializer.javaClass.getDeclaredField("networkClient").apply {
                isAccessible = true
            }.get(initializer)!!

            val baseUrl = networkClient.javaClass.getDeclaredField("baseUrl").apply {
                isAccessible = true
            }.get(networkClient)?.toString()

            val apiKey = networkClient.javaClass.getDeclaredField("apiKey").apply {
                isAccessible = true
            }.get(networkClient) as? String

            Pair(baseUrl, apiKey)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to read credentials", e)
            Pair(null, null)
        }
    }

    private fun getMeasureInitializer(): Any? {
        // Measure (companion object) -> measure: MeasureInternal
        val measureClass = Measure::class.java
        val measureInternalField = measureClass.getDeclaredField("measure").apply {
            isAccessible = true
        }
        val measureInternal = measureInternalField.get(Measure) ?: return null

        // MeasureInternal -> measure: MeasureInitializer
        val initializerField = measureInternal.javaClass.getDeclaredField("measure").apply {
            isAccessible = true
        }
        return initializerField.get(measureInternal)
    }
}
