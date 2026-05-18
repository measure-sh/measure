package sh.measure

import okhttp3.OkHttpClient
import org.gradle.api.provider.Property
import org.gradle.api.services.BuildService
import org.gradle.api.services.BuildServiceParameters
import java.time.Duration

abstract class MeasureHttpClient : BuildService<MeasureHttpClient.Params>, AutoCloseable {
    val client: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .readTimeout(parameters.timeout.get())
            .writeTimeout(parameters.timeout.get())
            .connectTimeout(parameters.timeout.get())
            .build()
    }

    override fun close() {
        client.dispatcher.executorService.shutdown()
        client.connectionPool.evictAll()
        client.cache?.close()
    }

    interface Params : BuildServiceParameters {
        val timeout: Property<Duration>
    }
}