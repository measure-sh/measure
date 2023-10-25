package sh.measure.android

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric.buildActivity
import sh.measure.no_fragment_test.MainActivity

@RunWith(AndroidJUnit4::class)
class MainActivityTest {

    @Test
    fun `initializes measure in a project without androidx fragment dependency`() {
        buildActivity(MainActivity::class.java).setup()
    }
}