package com.daynest.android.core.auth

import android.net.Uri
import com.daynest.android.BuildConfig

internal data class OidcConfig(
    val clientId: String = BuildConfig.OIDC_CLIENT_ID,
    val redirectUri: Uri = Uri.parse("${BuildConfig.APPLICATION_ID}:/oauth2redirect"),
    val scope: String = "openid profile email offline_access",
)
