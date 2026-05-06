package com.daynest.android.core.network

import okhttp3.CertificatePinner
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CertificatePinnerProviderTest {
    @Test
    fun `empty pin list returns CertificatePinner DEFAULT`() {
        val provider = CertificatePinnerProvider(host = "api.daynest.com", pins = emptyArray())
        assertEquals(CertificatePinner.DEFAULT, provider.get())
    }

    @Test
    fun `non-empty pin list returns pinner with expected entries`() {
        val pin1 = "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
        val pin2 = "sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB="
        val host = "api.daynest.com"

        val provider = CertificatePinnerProvider(host = host, pins = arrayOf(pin1, pin2))
        val pinner = provider.get()

        val pins = pinner.pins
        assertEquals(2, pins.size)
        assertTrue(pins.all { it.pattern == host })
    }
}
