package sh.measure.sample.fragments

import android.annotation.SuppressLint
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import sh.measure.sample.R

class NestedFragmentActivity : AppCompatActivity() {
    @SuppressLint("CommitTransaction")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_nested_fragment)
        if (savedInstanceState == null) {
            val parentFragment = ParentFragment()
            supportFragmentManager.beginTransaction()
                .add(R.id.fragment_container, parentFragment)
                .commit()
        }
    }
}
