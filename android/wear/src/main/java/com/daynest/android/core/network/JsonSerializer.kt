package com.daynest.android.core.network

import kotlinx.serialization.json.Json

object JsonSerializer {
    val config: Json =
        Json {
            ignoreUnknownKeys = true
        }
}
