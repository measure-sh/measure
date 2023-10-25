package sh.measure.no_fragment_test

import android.app.Activity
import android.os.Bundle
import sh.measure.android.Measure

class MainActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        Measure.init(this)
    }
}