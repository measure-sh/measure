package sh.measure.android.utils

import java.util.Locale

internal interface LocaleProvider {
    fun getLocale(): String
}

internal class LocaleProviderImpl : LocaleProvider {
    override fun getLocale(): String = Locale.getDefault().toLanguageTag()
}
