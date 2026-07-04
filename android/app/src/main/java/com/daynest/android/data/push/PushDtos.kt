package com.daynest.android.data.push

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class PushSubscriptionRequestDto(
    val platform: String,
    val endpoint: String,
    val p256dh: String? = null,
    val auth: String? = null
)

@Serializable
data class PushUnsubscribeRequestDto(val endpoint: String)

enum class PushPlatform(val wireValue: String) {
    @SerialName("fcm")
    FCM("fcm"),

    @SerialName("webpush")
    WEBPUSH("webpush")
}
