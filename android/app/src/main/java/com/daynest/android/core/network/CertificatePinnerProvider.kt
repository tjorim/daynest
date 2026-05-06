package com.daynest.android.core.network

import okhttp3.CertificatePinner

class CertificatePinnerProvider(
    private val host: String,
    private val pins: List<String>,
) {
    fun get(): CertificatePinner {
        if (pins.isEmpty()) return CertificatePinner.DEFAULT
        return CertificatePinner.Builder().apply {
            pins.forEach { pin -> add(host, pin) }
        }.build()
    }
}
