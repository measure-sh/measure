package sh.measure.test.benchmark

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import sh.measure.test.benchmark.ui.theme.MyApplicationTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MyApplicationTheme {
                // A surface container using the 'background' color from the theme
                Surface(
                    modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background
                ) {
                    Launchpad()
                }
            }
        }
    }
}

@Composable
fun Launchpad() {
    val context = LocalContext.current

    LazyColumn {
        item {
            LaunchItem("View Target Finder Benchmark", onClick = {
                context.startActivity(
                    Intent(
                        context,
                        ViewTargetFinderBenchmarkActivity::class.java
                    )
                )
            })
            LaunchItem("Compose Target Finder Benchmark", onClick = {
                context.startActivity(
                    Intent(
                        context,
                        ComposeTargetFinderBenchmarkActivity::class.java
                    )
                )
            })
        }
    }

}

@Composable
fun LaunchItem(text: String, onClick: () -> Unit) {
    Row(modifier = Modifier
        .clickable {
            onClick()
        }
        .fillMaxWidth()
        .padding(16.dp),
        Arrangement.Absolute.SpaceBetween,
        Alignment.CenterVertically) {
        Text(text)
        Icon(
            Icons.AutoMirrored.Filled.KeyboardArrowLeft,
            contentDescription = stringResource(id = R.string.next),
            tint = Color.Gray,
        )
    }
}
