package sh.measure.kmp.android

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import sh.measure.kmp.shared.triggerSharedCrash

fun triggerPlatformCrash() {
    throw RuntimeException("Artificial crash from Android platform")
}

data class DemoItem(val title: String, val action: () -> Unit)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun App() {
    val demoItems = listOf(
        DemoItem("Crash platform") { triggerPlatformCrash() },
        DemoItem("Crash shared") { triggerSharedCrash() },
    )

    MaterialTheme {
        Scaffold(
            topBar = {
                TopAppBar(title = { Text("Measure") })
            },
        ) { padding ->
            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(padding),
            ) {
                items(demoItems) { item ->
                    Text(
                        text = item.title,
                        style = MaterialTheme.typography.bodyLarge,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { item.action() }
                            .padding(16.dp),
                    )
                }
            }
        }
    }
}
