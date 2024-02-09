package sh.measure.sample

import android.content.Context
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import sh.measure.sample.theme.ComposeTheme
import java.util.WeakHashMap
import kotlin.random.Random

class ComposeActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            ComposeTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background
                ) {
                    InfiniteList()
                }
            }
        }
    }
}

@Composable
fun InfiniteList() {
    val scrollState = rememberLazyListState()
    val context = LocalContext.current
    val colorManager = remember { ColorManager() }

    fun showToast(context: Context, index: Int) {
        Toast.makeText(context, "Item $index clicked", Toast.LENGTH_SHORT).show()
    }

    LazyColumn(state = scrollState) {
        items(Int.MAX_VALUE) { index ->
            val color = colorManager.getColorFor(index)
            Box(modifier = Modifier.fillMaxWidth().height(88.dp).background(color)
                .testTag("item_$index").clickable {
                    showToast(context, index)
                })
        }
    }
}

class ColorManager {
    private val colorCache = WeakHashMap<Int, Color>()

    fun getColorFor(index: Int): Color {
        return colorCache.getOrPut(index) {
            Color(
                Random.nextFloat(), Random.nextFloat(), Random.nextFloat(), 1f
            )
        }
    }
}
