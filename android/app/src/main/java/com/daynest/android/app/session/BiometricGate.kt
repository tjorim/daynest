@file:Suppress("ktlint:standard:function-naming", "FunctionNaming")

package com.daynest.android.app.session

import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.platform.LocalContext
import androidx.fragment.app.FragmentActivity
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.daynest.android.R
import java.util.concurrent.Executor
import androidx.compose.ui.res.stringResource
import androidx.core.content.ContextCompat

@Composable
fun BiometricGate(
    viewModel: BiometricGateViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    DisposableEffect(lifecycleOwner) {
        val observer =
            LifecycleEventObserver { _, event ->
                if (event == Lifecycle.Event.ON_START) {
                    viewModel.onAppResumed()
                }
            }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
        }
    }

    if (uiState.requireAuthentication) {
        AlertDialog(
            onDismissRequest = {},
            title = { Text(text = stringResource(id = R.string.biometric_unlock_title)) },
            text = { Text(text = stringResource(id = R.string.biometric_unlock_subtitle)) },
            confirmButton = {
                TextButton(
                    onClick = {
                        (context as? FragmentActivity)?.let { activity ->
                            showBiometricPrompt(
                                activity = activity,
                                onAuthenticated = viewModel::onAuthenticated,
                            )
                        }
                    },
                ) {
                    Text(text = stringResource(id = R.string.biometric_unlock_action))
                }
            },
        )
    }
}

private fun showBiometricPrompt(
    activity: FragmentActivity,
    onAuthenticated: () -> Unit,
) {
    val executor: Executor = ContextCompat.getMainExecutor(activity)
    val prompt =
        BiometricPrompt(
            activity,
            executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    onAuthenticated()
                }
            },
        )
    val canAuthenticate =
        BiometricManager.from(activity).canAuthenticate(
            BiometricManager.Authenticators.BIOMETRIC_STRONG or
                BiometricManager.Authenticators.DEVICE_CREDENTIAL,
        )
    if (canAuthenticate == BiometricManager.BIOMETRIC_SUCCESS) {
        val promptInfo =
            BiometricPrompt.PromptInfo.Builder()
                .setTitle(activity.getString(R.string.biometric_unlock_title))
                .setSubtitle(activity.getString(R.string.biometric_unlock_subtitle))
                .setAllowedAuthenticators(
                    BiometricManager.Authenticators.BIOMETRIC_STRONG or
                        BiometricManager.Authenticators.DEVICE_CREDENTIAL,
                ).build()
        prompt.authenticate(promptInfo)
    } else {
        onAuthenticated()
    }
}
