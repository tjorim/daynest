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
    @Named("discovery") private val discoveryClient: OkHttpClient
) {
    fun fetch(serverUrl: String): AuthorizationServiceConfiguration {
        val request = Request.Builder().url(configUrl(serverUrl)).build()
        discoveryClient.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                // Peek a bounded snippet: an arbitrary server behind a user-set URL can
                // return an error page of any size, which must not be fully buffered.
                val errorBody = runCatching { response.peekBody(1024).string() }.getOrElse { "" }
                throw IOException(
                    "OIDC config endpoint returned HTTP ${response.code} ${response.message}: $errorBody"
                )
            }
            val body = runCatching { response.body.string() }.getOrElse { "" }
            if (body.isBlank()) {
                throw IOException("Empty response from OIDC config endpoint")
            }
            return parse(body)
        }
    }

    private fun configUrl(serverUrl: String): String = "${serverUrl.trimEnd('/')}/api/auth/oidc-config"

    private fun parse(body: String): AuthorizationServiceConfiguration = try {
        val json = JSONObject(body)
        AuthorizationServiceConfiguration(
            Uri.parse(json.getString("authorization_url")),
            Uri.parse(json.getString("token_url")),
            null,
            json.optString("end_session_endpoint").takeIf { it.isNotBlank() }?.let { Uri.parse(it) }
        )
    } catch (e: JSONException) {
        throw IOException("Failed to parse OIDC config response", e)
    }
}
