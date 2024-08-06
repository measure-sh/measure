package sh.measure.android

import android.app.Activity
import android.os.Bundle
import sh.measure.android.test.R

class TestActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_test)
    }
}
