@file:SuppressLint("ComposableNaming")
package sh.measure.android.navigation

import android.annotation.SuppressLint
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController

@OptIn(ExperimentalMaterial3Api::class, ExperimentalComposeUiApi::class)
@Composable
fun testApp() {
    val navController = rememberNavController().withMeasureNavigationListener()
    Scaffold(
        modifier = Modifier.semantics {
            testTagsAsResourceId = true
        },
    ) { innerPadding ->
        navGraph(navController = navController, modifier = Modifier.padding(innerPadding))
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun appBar(title: String) {
    TopAppBar(title = { Text(text = title) })
}

@Composable
fun navGraph(navController: NavHostController, modifier: Modifier = Modifier) {
    NavHost(navController = navController, startDestination = "home", modifier = modifier) {
        composable("home") { homeScreen(navController) }
        composable("checkout") { checkoutScreen() }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun homeScreen(navController: NavController) {
    Scaffold(topBar = { appBar(title = "Home") }) { innerPadding ->
        Column(modifier = Modifier.padding(innerPadding)) {
            listItem(navController, "Checkout", "checkout")
        }
    }
}

@Composable
fun listItem(
    navController: NavController,
    text: String,
    route: String,
) {
    Row(
        Modifier
            .height(48.dp)
            .fillMaxWidth()
            .testTag(route)
            .clickable { navController.navigate(route) },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(text, modifier = Modifier.padding(start = 16.dp))
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun checkoutScreen() {
    Scaffold(topBar = { appBar(title = "Checkout") }) { innerPadding ->
        Box(
            modifier = Modifier
                .padding(innerPadding)
                .fillMaxHeight()
                .fillMaxWidth(),
            contentAlignment = Alignment.Center,
        ) {
            Text("Checkout")
        }
    }
}
