package sh.measure.sample.screenshot

import android.app.Activity
import android.os.Bundle
import android.widget.Button
import sh.measure.sample.R

class ViewScreenshotActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_screenshot_test)

        findViewById<Button>(R.id.btn_crash).setOnClickListener {
            throw IllegalAccessException("Exception to test a screenshot")
        }

        findViewById<Button>(R.id.btn_anr).setOnClickListener {
            Thread.sleep(10000)
        }
    }
}