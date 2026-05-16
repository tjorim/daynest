package com.daynest.android.core.auth

import android.net.Uri
import com.daynest.android.BuildConfig

internal object OidcConfig {
    val issuerUri: Uri = Uri.parse(BuildConfig.OIDC_ISSUER_URL)
    val clientId: String = BuildConfig.OIDC_CLIENT_ID
    val redirectUri: Uri = Uri.parse(BuildConfig.OIDC_REDIRECT_URI)
    val scopes: List<String> = listOf("openid", "profile", "email")
}
