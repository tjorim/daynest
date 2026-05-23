@file:Suppress("ktlint:standard:function-naming", "FunctionNaming")

package com.daynest.android.app.session

import android.content.ActivityNotFoundException
import android.content.Intent
import android.provider.Settings
import android.util.Log
import android.widget.Toast
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
    val authenticators =
        BiometricManager.Authenticators.BIOMETRIC_STRONG or
            BiometricManager.Authenticators.DEVICE_CREDENTIAL
    val canAuthenticate =
        BiometricManager.from(activity).canAuthenticate(authenticators)
    when (canAuthenticate) {
        BiometricManager.BIOMETRIC_SUCCESS -> {
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
            val promptInfo =
                BiometricPrompt.PromptInfo.Builder()
                    .setTitle(activity.getString(R.string.biometric_unlock_title))
                    .setSubtitle(activity.getString(R.string.biometric_unlock_subtitle))
                    .setAllowedAuthenticators(authenticators)
                    .build()
            prompt.authenticate(promptInfo)
        }

        BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> {
            val enrollIntent =
                Intent(Settings.ACTION_BIOMETRIC_ENROLL).apply {
                    putExtra(Settings.EXTRA_BIOMETRIC_AUTHENTICATORS_ALLOWED, authenticators)
                }
            runCatching { activity.startActivity(enrollIntent) }
                .onFailure { error ->
                    val messageRes =
                        if (error is ActivityNotFoundException) {
                            R.string.biometric_enrollment_unavailable
                        } else {
                            Log.e("BiometricGate", "Unable to launch biometric enrollment", error)
                            R.string.biometric_error
                        }
                    Toast.makeText(activity, messageRes, Toast.LENGTH_LONG).show()
                }
        }

        BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE,
        BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE,
        BiometricManager.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED,
        BiometricManager.BIOMETRIC_ERROR_UNSUPPORTED,
        BiometricManager.BIOMETRIC_STATUS_UNKNOWN,
        -> {
            Log.w("BiometricGate", "Biometric authentication unavailable: $canAuthenticate")
            Toast.makeText(activity, R.string.biometric_unavailable, Toast.LENGTH_LONG).show()
        }

        else -> {
            Log.e("BiometricGate", "Biometric authentication failed preflight: $canAuthenticate")
            Toast.makeText(activity, R.string.biometric_error, Toast.LENGTH_LONG).show()
        }
    }
}
