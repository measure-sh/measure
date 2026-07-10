@file:OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)

package sh.frankenstein.android

import android.os.Bundle
import android.util.Log
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import sh.measure.android.Measure
import sh.measure.android.attributes.AttributesBuilder
import sh.measure.android.logs.LogSeverity

class LogActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MeasureTheme {
                LogScreen(onBack = { finish() })
            }
        }
    }
}

@Composable
private fun LogScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    var body by remember { mutableStateOf("manual log from android native") }
    var severity by remember { mutableStateOf(LogSeverity.Info) }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Track Logs") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            OutlinedTextField(
                value = body,
                onValueChange = { body = it },
                label = { Text("Log body") },
                modifier = Modifier.fillMaxWidth(),
            )
            Text(
                text = "Severity",
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                LogSeverity.entries.forEach { option ->
                    FilterChip(
                        selected = option == severity,
                        onClick = { severity = option },
                        label = { Text(option.name) },
                    )
                }
            }
            Button(
                onClick = {
                    val attributes = AttributesBuilder().put("retry_count", 3).build()
                    Measure.log(body, severity, attributes)
                    Toast.makeText(context, "Log sent", Toast.LENGTH_SHORT).show()
                },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Track Log Manually")
            }
            OutlinedButton(
                onClick = {
                    val tag = "NativeAndroid"
                    val logcatBody = "logcat log from android native"
                    when (severity) {
                        LogSeverity.Debug -> Log.d(tag, logcatBody)
                        LogSeverity.Info -> Log.i(tag, logcatBody)
                        LogSeverity.Warning -> Log.w(tag, logcatBody)
                        LogSeverity.Error -> Log.e(tag, logcatBody)
                        LogSeverity.Fatal -> Log.wtf(tag, logcatBody)
                    }
                    Toast.makeText(context, "Logcat entry written", Toast.LENGTH_SHORT).show()
                },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Track Logcat Log")
            }
        }
    }
}
