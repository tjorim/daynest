package com.daynest.android.core.auth

import android.net.Uri
import java.io.IOException
import javax.inject.Inject
import javax.inject.Named
import net.openid.appauth.AuthorizationServiceConfiguration
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONException
import org.json.JSONObject

class OidcServiceConfigurationDiscovery
    @Inject
    constructor(
        @Named("discovery") private val discoveryClient: OkHttpClient,
    ) {
        fun fetch(serverUrl: String): AuthorizationServiceConfiguration {
            val request = Request.Builder().url(configUrl(serverUrl)).build()
            discoveryClient.newCall(request).execute().use { response ->
                val body = response.body.string()
                if (!response.isSuccessful) {
                    throw IOException(
                        "OIDC config endpoint returned HTTP ${response.code} ${response.message}: $body",
                    )
                }
                if (body.isBlank()) {
                    throw IOException("Empty response from OIDC config endpoint")
                }
                return parse(body)
            }
        }

        private fun configUrl(serverUrl: String): String =
            "${serverUrl.trimEnd('/')}/api/v1/auth/oidc-config"

        private fun parse(body: String): AuthorizationServiceConfiguration =
            try {
                val json = JSONObject(body)
                AuthorizationServiceConfiguration(
                    Uri.parse(json.getString("authorization_url")),
                    Uri.parse(json.getString("token_url")),
                )
            } catch (e: JSONException) {
                throw IOException("Failed to parse OIDC config response", e)
            }
    }
