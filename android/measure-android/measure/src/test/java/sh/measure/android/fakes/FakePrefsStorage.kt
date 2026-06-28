package sh.measure.android.fakes

import sh.measure.android.storage.PrefsStorage
import sh.measure.android.storage.PreviousSession

internal class FakePrefsStorage : PrefsStorage {
    private var installationId: String? = null
    private var userId: String? = null
    private var configFetchTimestamp: Long = 0
    private var configCacheControl: Long = 0
    private var configEtag: String? = null

    private var currentSession: PreviousSession? = null
    private var previous: PreviousSession? = null

    override fun getInstallationId(): String? = installationId

    override fun setInstallationId(installationId: String) {
        this.installationId = installationId
    }

    override fun getUserId(): String? = userId

    override fun setUserId(userId: String?) {
        this.userId = userId
    }

    override fun getConfigFetchTimestamp(): Long = configFetchTimestamp

    override fun getConfigCacheControl(): Long = configCacheControl

    override fun getConfigEtag(): String? = configEtag

    override fun setConfigFetchTimestamp(timestamp: Long) {
        configFetchTimestamp = timestamp
    }

    override fun setConfigCacheControl(cacheControl: Long) {
        configCacheControl = cacheControl
    }

    override fun setConfigEtag(etag: String) {
        configEtag = etag
    }

    override fun rotateSession(
        id: String,
        startTime: Long,
        pid: Int,
        appVersion: String?,
        appBuild: String?,
    ) {
        currentSession?.let { previous = it }
        currentSession = PreviousSession(
            id = id,
            startTime = startTime,
            pid = pid,
            appVersion = appVersion,
            appBuild = appBuild,
        )
    }

    override fun getPreviousSession(): PreviousSession? = previous
}
