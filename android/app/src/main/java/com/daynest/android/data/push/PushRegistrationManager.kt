package com.daynest.android.data.push

import android.content.Context
import android.util.Log
import com.daynest.android.core.auth.OidcAuthService
import com.daynest.android.core.storage.preferences.UserPreferencesRepository
import com.google.firebase.messaging.FirebaseMessaging
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.suspendCancellableCoroutine
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

@Singleton
class PushRegistrationManager
    @Inject
    constructor(
        private val pushApi: PushApi,
        private val userPreferencesRepository: UserPreferencesRepository,
        private val oidcAuthService: OidcAuthService,
        @ApplicationContext private val context: Context,
    ) {
        suspend fun registerIfEnabled() {
            if (!userPreferencesRepository.preferences.first().pushNotificationsEnabled) return
            if (!oidcAuthService.isAuthorized) return
            runCatching { firebaseToken() }
                .onSuccess { token -> registerFcmToken(token) }
                .onFailure { error -> Log.w(TAG, "FCM token unavailable", error) }
            requestUnifiedPushRegistration()
        }

        suspend fun registerFcmToken(token: String) {
            if (token.isBlank()) return
            pushApi.subscribe(
                PushSubscriptionRequestDto(
                    platform = PushPlatform.FCM.wireValue,
                    endpoint = token,
                ),
            )
            userPreferencesRepository.updateLastFcmEndpoint(token)
        }

        suspend fun registerUnifiedPushEndpoint(
            endpoint: String,
            p256dh: String?,
            auth: String?,
        ) {
            if (endpoint.isBlank()) return
            pushApi.subscribe(
                PushSubscriptionRequestDto(
                    platform = PushPlatform.WEBPUSH.wireValue,
                    endpoint = endpoint,
                    p256dh = p256dh,
                    auth = auth,
                ),
            )
            userPreferencesRepository.updateLastUnifiedPushEndpoint(endpoint)
        }

        suspend fun unregisterEndpoint(endpoint: String) {
            if (endpoint.isBlank()) return
            pushApi.unsubscribe(PushUnsubscribeRequestDto(endpoint = endpoint))
        }

        suspend fun unregisterCurrentFcmToken() {
            val current = runCatching { firebaseToken() }.getOrNull()
            val stored = userPreferencesRepository.preferences.first().lastFcmEndpoint
            listOfNotNull(current, stored).distinct().forEach { endpoint ->
                runCatching { unregisterEndpoint(endpoint) }
                    .onFailure { error -> Log.w(TAG, "Unable to unregister FCM token", error) }
            }
            userPreferencesRepository.updateLastFcmEndpoint(null)
        }

        suspend fun unregisterAllKnownEndpoints() {
            unregisterCurrentFcmToken()
            userPreferencesRepository.preferences.first().lastUnifiedPushEndpoint?.let { endpoint ->
                runCatching { unregisterEndpoint(endpoint) }
                    .onFailure { error -> Log.w(TAG, "Unable to unregister Unified Push endpoint", error) }
            }
            userPreferencesRepository.updateLastUnifiedPushEndpoint(null)
        }

        private suspend fun firebaseToken(): String =
            suspendCancellableCoroutine { cont ->
                val tokenTask = FirebaseMessaging.getInstance().token
                tokenTask.addOnSuccessListener { token -> cont.resume(token) }
                tokenTask.addOnFailureListener { error -> cont.resumeWithException(error) }
            }

        private fun requestUnifiedPushRegistration() {
            context.sendBroadcast(
                android.content.Intent(ACTION_UNIFIED_PUSH_REGISTER).apply {
                    putExtra(EXTRA_APPLICATION, context.packageName)
                },
            )
        }

        companion object {
            private const val TAG = "PushRegistration"
            private const val ACTION_UNIFIED_PUSH_REGISTER = "org.unifiedpush.android.connector.REGISTER"
            private const val EXTRA_APPLICATION = "application"
        }
    }
