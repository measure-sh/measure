package sh.measure.android.gestures

import android.os.Bundle
import android.widget.Button
import androidx.activity.ComponentActivity
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Text
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.compose.ui.platform.testTag
import sh.measure.android.test.R

class GestureTestActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.test_gesture_collector)
        findViewById<Button>(R.id.button).setOnClickListener {
            // No-op
        }

        findViewById<ComposeView>(R.id.clickable_compose_view).apply {
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)
            setContent {
                Box(
                    modifier = Modifier
                        .testTag("compose_clickable")
                        .clickable {
                            // No-op
                        },
                ) {
                    Text(
                        text = "Compose Clickable",
                    )
                }
            }
        }

        findViewById<ComposeView>(R.id.non_clickable_compose_view).apply {
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)
            setContent {
                Box(
                    modifier = Modifier.testTag("compose_not_clickable"),
                ) {
                    Text(
                        text = "Compose Not Clickable",
                    )
                }
            }
        }

        findViewById<ComposeView>(R.id.scrollable_compose_view).apply {
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)
            setContent {
                LazyColumn(content = {
                    items(100) {
                        Text(
                            text = "Item $it",
                        )
                    }
                }, modifier = Modifier.testTag("compose_scrollable"))
            }
        }
    }
}
