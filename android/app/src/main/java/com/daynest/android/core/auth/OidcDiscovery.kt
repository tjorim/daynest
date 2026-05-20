package com.daynest.android.core.auth

internal data class OidcDiscovery(
    val issuer: String,
    val authorizationUrl: String,
    val tokenUrl: String,
)
