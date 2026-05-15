package com.frankenstein.shared

import androidx.compose.ui.window.ComposeUIViewController

fun CmpViewController(onClose: () -> Unit) =
    ComposeUIViewController { CmpScreen(onClose = onClose) }
