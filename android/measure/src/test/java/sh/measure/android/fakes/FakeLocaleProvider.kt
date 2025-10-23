package sh.measure.android.fakes

import sh.measure.android.utils.LocaleProvider

internal class FakeLocaleProvider(private val locale: String = "en-US") : LocaleProvider {
    override fun getLocale(): String = locale
}
