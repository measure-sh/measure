package sh.measure.sample.fragments

import android.annotation.SuppressLint
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
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

class ParentFragment : Fragment() {
    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        return inflater.inflate(R.layout.fragment_parent, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        if (savedInstanceState == null) {
            val childFragment = ChildFragment()
            childFragmentManager.beginTransaction()
                .add(R.id.child_fragment_container, childFragment)
                .commit()
        }
    }
}


class ChildFragment : Fragment() {
    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        return inflater.inflate(R.layout.fragment_child, container, false)
    }
}
