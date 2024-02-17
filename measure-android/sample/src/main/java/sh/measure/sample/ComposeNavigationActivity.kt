package sh.measure.sample

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
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
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController

class ComposeNavigationActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            App()
        }
    }
}

@Composable
fun App() {
    val navController = rememberNavController()
    Scaffold { innerPadding ->
        NavGraph(navController = navController, modifier = Modifier.padding(innerPadding))
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppBar(title: String) {
    TopAppBar(title = { Text(text = title) })
}

@Composable
fun NavGraph(navController: NavHostController, modifier: Modifier = Modifier) {
    NavHost(navController = navController, startDestination = "home", modifier = modifier) {
        composable("home") { HomeScreen(navController) }
        composable("checkout") { CheckoutScreen() }
        composable("profile") { ProfileScreen() }
    }
}

@Composable
fun HomeScreen(navController: NavController) {
    Scaffold(topBar = { AppBar(title = "Home") }) { innerPadding ->
        Column(modifier = Modifier.padding(innerPadding)) {
            ListItem(navController, "Checkout", "checkout")
            ListItem(navController, "Profile", "profile")
        }
    }
}

@Composable
fun ListItem(
    navController: NavController, text: String, route: String
) {
    Row(
        Modifier
            .height(48.dp)
            .fillMaxWidth()
            .clickable { navController.navigate(route) },
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(text, modifier = Modifier.padding(start = 16.dp))
    }
}

@Composable
fun CheckoutScreen() {
    Scaffold(topBar = { AppBar(title = "Checkout") }) { innerPadding ->
        Box(
            modifier = Modifier
                .padding(innerPadding)
                .fillMaxHeight()
                .fillMaxWidth(),
            contentAlignment = Alignment.Center
        ) {
            Text("Checkout")
        }
    }
}

@Composable
fun ProfileScreen() {
    Scaffold(topBar = { AppBar(title = "Profile") }) { innerPadding ->
        Box(
            modifier = Modifier
                .padding(innerPadding)
                .fillMaxHeight()
                .fillMaxWidth(),
        ) {
            Text(
                "Profile", modifier = Modifier.align(Alignment.Center)
            )
        }
    }
}
