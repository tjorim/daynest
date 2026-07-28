@file:Suppress("ktlint:standard:function-naming", "FunctionNaming")

package com.daynest.android.feature.auth

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.daynest.android.R
import com.daynest.android.feature.settings.ApiBaseUrlOverrideCard

@Composable
fun AuthRoute(onSignedIn: () -> Unit, viewModel: AuthViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    val launcher =
        rememberLauncherForActivityResult(
            contract = ActivityResultContracts.StartActivityForResult()
        ) { result ->
            viewModel.handleAuthorizationResult(result.resultCode, result.data)
        }

    LaunchedEffect(Unit) {
        viewModel.signInIntent.collect { intent ->
            launcher.launch(intent)
        }
    }

    LaunchedEffect(uiState.isSignedIn) {
        if (uiState.isSignedIn) onSignedIn()
    }

    AuthScreen(
        uiState = uiState,
        onSignInClicked = viewModel::onSignInClicked,
        onServerUrlChanged = viewModel::updateServerUrl
    )
}

@Composable
internal fun AuthScreen(uiState: AuthUiState, onSignInClicked: () -> Unit, onServerUrlChanged: (String?) -> Unit) {
    Scaffold(modifier = Modifier.fillMaxSize()) { innerPadding ->
        Column(
            modifier =
            Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(24.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = stringResource(R.string.auth_title),
                style = MaterialTheme.typography.headlineMedium
            )
            if (uiState.error != null) {
                Text(
                    text = stringResource(R.string.auth_error_sign_in_failed),
                    color = MaterialTheme.colorScheme.error,
                    modifier =
                    Modifier
                        .padding(top = 12.dp)
                        .semantics { liveRegion = LiveRegionMode.Polite }
                )
            }
            Button(
                onClick = onSignInClicked,
                enabled = !uiState.isLoading,
                modifier = Modifier.padding(top = 20.dp)
            ) {
                // The label stays laid out under the spinner so the button keeps
                // its width; swapping it for a bare indicator makes the primary
                // action jump on every tap.
                Box(contentAlignment = Alignment.Center) {
                    Text(
                        text = stringResource(R.string.auth_sign_in_button),
                        modifier = Modifier.alpha(if (uiState.isLoading) 0f else 1f)
                    )
                    if (uiState.isLoading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(24.dp),
                            strokeWidth = 2.dp,
                            color = MaterialTheme.colorScheme.onPrimary
                        )
                    }
                }
            }
            // Self-hosting affordance, below the primary action: it matters on a
            // custom deployment but should not be the first thing a first run
            // asks someone to think about.
            ApiBaseUrlOverrideCard(
                defaultServerUrl = uiState.defaultServerUrl,
                customServerUrl = uiState.customServerUrl,
                onServerUrlChanged = onServerUrlChanged,
                modifier = Modifier.padding(top = 32.dp)
            )
        }
    }
}
