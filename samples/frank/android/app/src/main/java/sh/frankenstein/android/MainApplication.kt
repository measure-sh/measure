package sh.frankenstein.android

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import sh.measure.android.Measure
import sh.measure.android.config.MeasureConfig

class MainApplication : Application(), ReactApplication {

    override val reactHost: ReactHost by lazy {
        getDefaultReactHost(
            context = applicationContext,
            packageList = PackageList(this).packages,
        )
    }

    override fun onCreate() {
        super.onCreate()
        Measure.init(
            this, MeasureConfig(
                enableLogging = true,
                enableFullCollectionMode = true,
                enableDiagnosticMode = true,
            )
        )
        val savedUrl = CredentialOverrides.getSavedApiUrl(this)
        val savedKey = CredentialOverrides.getSavedApiKey(this)
        if (savedUrl != null && savedKey != null) {
            MeasureConfigurator.swapCredentials(savedUrl, savedKey)
        }
        registerActivityLifecycleCallbacks(AssetPrefetcher)
        loadReactNative(this)
    }
}
