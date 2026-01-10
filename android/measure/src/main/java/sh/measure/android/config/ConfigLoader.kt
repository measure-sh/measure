package sh.measure.android.config

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.json.decodeFromStream
import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.exporter.NetworkClient
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.serialization.jsonSerializer
import sh.measure.android.storage.FileStorage
import sh.measure.android.storage.PrefsStorage
import sh.measure.android.tracing.InternalTrace
import sh.measure.android.utils.TimeProvider

internal interface ConfigLoader {
    fun loadDynamicConfig(onLoaded: (DynamicConfig?) -> Unit)
}

internal class ConfigLoaderImpl(
    private val ioExecutor: MeasureExecutorService,
    private val exportExecutor: MeasureExecutorService,
    private val networkClient: NetworkClient,
    private val fileStorage: FileStorage,
    private val prefsStorage: PrefsStorage,
    private val timeProvider: TimeProvider,
    private val logger: Logger,
) : ConfigLoader {
    override fun loadDynamicConfig(onLoaded: (DynamicConfig?) -> Unit) {
        loadConfigFromDisk {
            onLoaded(it)
            refreshConfigFromServer()
        }
    }

    private fun refreshConfigFromServer() {
        exportExecutor.submit {
            val configFile = fileStorage.getConfigFile()
            if (configFile == null) {
                return@submit
            }

            val lastFetchTimestamp = prefsStorage.getConfigFetchTimestamp()
            val cacheControlDuration = prefsStorage.getConfigCacheControl()
            val shouldRefreshConfig = timeProvider.now() - lastFetchTimestamp > cacheControlDuration
            val eTag = prefsStorage.getConfigEtag()

            if (shouldRefreshConfig) {
                val response = networkClient.getConfig(eTag)
                when (response) {
                    is ConfigResponse.Success -> {
                        configFile.writeText(response.body)
                        prefsStorage.setConfigFetchTimestamp(timeProvider.now())
                        response.eTag?.let { prefsStorage.setConfigEtag(it) }
                        prefsStorage.setConfigCacheControl(response.cacheControl)
                        logger.log(
                            LogLevel.Debug,
                            "ConfigLoader: New config loaded from server successfully",
                        )
                    }

                    is ConfigResponse.Error -> {
                        logger.log(
                            LogLevel.Error,
                            "ConfigLoader: Failed to load config from server",
                            response.exception,
                        )
                    }

                    ConfigResponse.NotModified -> {
                        logger.log(LogLevel.Debug, "ConfigLoader: 304 Not Modified")
                    }
                }
            } else {
                logger.log(
                    LogLevel.Debug,
                    "ConfigLoader: CacheControl not expired, skipping refresh",
                )
            }
        }
    }

    @OptIn(ExperimentalSerializationApi::class)
    private fun loadConfigFromDisk(onLoaded: (DynamicConfig?) -> Unit) {
        ioExecutor.submit {
            InternalTrace.trace(
                { "msr-load-config" },
                {
                    val file = fileStorage.getConfigFile()
                    if (file != null && file.exists() && file.length() > 0) {
                        try {
                            val config = file.inputStream().use { stream ->
                                jsonSerializer.decodeFromStream<DynamicConfig?>(stream)
                            }
                            logger.log(
                                LogLevel.Debug,
                                "ConfigLoader: Config loaded successfully from disk",
                            )
                            onLoaded(config)
                        } catch (e: Exception) {
                            logger.log(LogLevel.Error, "ConfigLoader: Failed to load config", e)
                            onLoaded(null)
                        }
                    } else {
                        logger.log(LogLevel.Debug, "ConfigLoader: No config found on disk, falling back to defaults")
                        onLoaded(null)
                    }
                },
            )
        }
    }
}
