package com.daynest.android.core.network

import okhttp3.CertificatePinner
import okio.ByteString.Companion.decodeBase64
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CertificatePinnerProviderTest {
    @Test
    fun `empty pin list returns CertificatePinner DEFAULT`() {
        val provider = CertificatePinnerProvider(host = "api.daynest.com", pins = emptyList())
        assertEquals(CertificatePinner.DEFAULT, provider.get())
    }

    @Test
    fun `non-empty pin list returns pinner with expected entries`() {
        // Synthetic test-only pins — valid base64-encoded 32-byte (SHA-256) values
        val pin1 = "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
        val pin2 = "sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB="
        val host = "api.daynest.com"

        val provider = CertificatePinnerProvider(host = host, pins = listOf(pin1, pin2))
        val pinner = provider.get()

        val pins = pinner.pins
        assertEquals(2, pins.size)
        assertTrue(pins.all { it.pattern == host })
        val expectedHashes = setOf(
            pin1.substringAfter('/').decodeBase64()!!,
            pin2.substringAfter('/').decodeBase64()!!,
        )
        assertEquals(expectedHashes, pins.map { it.hash }.toSet())
    }
}
