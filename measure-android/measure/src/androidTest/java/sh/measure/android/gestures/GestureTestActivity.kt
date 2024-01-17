package sh.measure.android.gestures

import android.app.Activity
import android.os.Bundle
import android.widget.Button
import sh.measure.android.test.R

class GestureTestActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.test_gesture_collector)
        findViewById<Button>(R.id.button).setOnClickListener {
            // No-op
        }
    }
}
