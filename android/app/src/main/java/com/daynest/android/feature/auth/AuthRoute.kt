@file:Suppress("ktlint:standard:function-naming", "FunctionNaming")

package com.daynest.android.feature.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.daynest.android.R

@Composable
fun AuthRoute(
    onSignedIn: () -> Unit,
    viewModel: AuthViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(uiState.isSignedIn) {
        if (uiState.isSignedIn) {
            onSignedIn()
        }
    }

    AuthScreen(
        uiState = uiState,
        onEvent = viewModel::onEvent,
    )
}

@Composable
@Suppress("LongMethod")
internal fun AuthScreen(
    uiState: AuthUiState,
    onEvent: (AuthUiEvent) -> Unit,
) {
    Scaffold(modifier = Modifier.fillMaxSize()) { innerPadding ->
        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .padding(24.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                text = stringResource(R.string.auth_title),
                style = MaterialTheme.typography.headlineMedium,
            )
            OutlinedTextField(
                value = uiState.email,
                onValueChange = { onEvent(AuthUiEvent.EmailChanged(it)) },
                modifier = Modifier.padding(top = 16.dp),
                label = { Text(stringResource(id = R.string.auth_email_label)) },
                enabled = !uiState.isSubmitting,
                singleLine = true,
            )
            OutlinedTextField(
                value = uiState.password,
                onValueChange = { onEvent(AuthUiEvent.PasswordChanged(it)) },
                modifier = Modifier.padding(top = 12.dp),
                label = { Text(stringResource(id = R.string.auth_password_label)) },
                visualTransformation = PasswordVisualTransformation(),
                enabled = !uiState.isSubmitting,
                singleLine = true,
            )
            if (uiState.error != null) {
                Text(
                    text =
                        when (uiState.error) {
                            AuthError.MissingCredentials -> stringResource(R.string.auth_error_missing_credentials)
                            AuthError.SignInFailed -> stringResource(R.string.auth_error_sign_in_failed)
                        },
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(top = 12.dp),
                )
            }

            Button(
                onClick = { onEvent(AuthUiEvent.SignInClicked) },
                enabled = !uiState.isSubmitting,
                modifier = Modifier.padding(top = 20.dp),
            ) {
                if (uiState.isSubmitting) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(24.dp),
                        strokeWidth = 2.dp,
                    )
                } else {
                    Text(text = stringResource(id = R.string.auth_sign_in_button))
                }
            }
        }
    }
}
