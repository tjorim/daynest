package com.daynest.buildlogic

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class CertPinningTest {
    private val noLocal: (String) -> String? = { null }
    private val noGradle: (String) -> String? = { null }
    private val noEnv: (String) -> String? = { null }

    // ── extractHost ──────────────────────────────────────────────────────────

    @Test
    fun `extractHost returns host for a normal URL`() {
        assertEquals("api.example.com", CertPinning.extractHost("https://api.example.com/v1/"))
    }

    @Test
    fun `extractHost returns null for a malformed URL`() {
        assertNull(CertPinning.extractHost("http://exa mple.com/"))
    }

    @Test
    fun `extractHost returns null for a URL without a host`() {
        assertNull(CertPinning.extractHost("/relative/path"))
    }

    @Test
    fun `extractHost returns null for an empty string`() {
        assertNull(CertPinning.extractHost(""))
    }

    // ── resolvePins ──────────────────────────────────────────────────────────

    @Test
    fun `resolvePins prefers local properties over Gradle property and env var`() {
        val pins =
            CertPinning.resolvePins(
                key = "apiProdPins",
                envKey = "API_PROD_PINS",
                localProperty = { key -> "sha256/local".takeIf { key == "apiProdPins" } },
                gradleProperty = { "sha256/gradle" },
                env = { "sha256/env" },
            )
        assertEquals(listOf("sha256/local"), pins)
    }

    @Test
    fun `resolvePins falls back to Gradle property when local properties has no value`() {
        val pins =
            CertPinning.resolvePins(
                key = "apiProdPins",
                envKey = "API_PROD_PINS",
                localProperty = noLocal,
                gradleProperty = { key -> "sha256/gradle".takeIf { key == "apiProdPins" } },
                env = { "sha256/env" },
            )
        assertEquals(listOf("sha256/gradle"), pins)
    }

    @Test
    fun `resolvePins falls back to env var when local properties and Gradle property have no value`() {
        val pins =
            CertPinning.resolvePins(
                key = "apiProdPins",
                envKey = "API_PROD_PINS",
                localProperty = noLocal,
                gradleProperty = noGradle,
                env = { key -> "sha256/env".takeIf { key == "API_PROD_PINS" } },
            )
        assertEquals(listOf("sha256/env"), pins)
    }

    @Test
    fun `resolvePins returns empty list when no source has a value`() {
        val pins =
            CertPinning.resolvePins(
                key = "apiProdPins",
                envKey = "API_PROD_PINS",
                localProperty = noLocal,
                gradleProperty = noGradle,
                env = noEnv,
            )
        assertEquals(emptyList<String>(), pins)
    }

    @Test
    fun `resolvePins splits on commas, trims whitespace, and drops blank entries`() {
        val pins =
            CertPinning.resolvePins(
                key = "apiProdPins",
                envKey = "API_PROD_PINS",
                localProperty = { " sha256/abc , sha1/def ,, " },
                gradleProperty = noGradle,
                env = noEnv,
            )
        assertEquals(listOf("sha256/abc", "sha1/def"), pins)
    }

    // ── pinsArrayLiteral ─────────────────────────────────────────────────────

    @Test
    fun `pinsArrayLiteral renders an empty Java array for no pins`() {
        assertEquals("new String[]{}", CertPinning.pinsArrayLiteral(emptyList()))
    }

    @Test
    fun `pinsArrayLiteral renders quoted comma-separated entries`() {
        assertEquals(
            "new String[]{\"sha256/abc\",\"sha1/def\"}",
            CertPinning.pinsArrayLiteral(listOf("sha256/abc", "sha1/def")),
        )
    }

    // ── requireValidPinFormats ───────────────────────────────────────────────

    // 44-char base64 (32 zero bytes) and 28-char base64 (20 zero bytes) — the
    // exact lengths OkHttp's CertificatePinner expects for sha256/sha1 hashes.
    private val validSha256Pin = "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
    private val validSha1Pin = "sha1/AAAAAAAAAAAAAAAAAAAAAAAAAAA="

    @Test
    fun `requireValidPinFormats accepts sha256 and sha1 pins`() {
        CertPinning.requireValidPinFormats(listOf(validSha256Pin, validSha1Pin))
    }

    @Test
    fun `requireValidPinFormats accepts an empty pin list`() {
        CertPinning.requireValidPinFormats(emptyList())
    }

    @Test
    fun `requireValidPinFormats rejects pins without a sha256 or sha1 prefix`() {
        val exception =
            assertThrows(IllegalStateException::class.java) {
                CertPinning.requireValidPinFormats(listOf(validSha256Pin, "md5/AAAAAAAAAAAAAAAAAAAAAAAAAAA="))
            }
        assertTrue(exception.message.orEmpty().contains("md5/AAAAAAAAAAAAAAAAAAAAAAAAAAA="))
    }

    @Test
    fun `requireValidPinFormats rejects a bare digest without a prefix`() {
        assertThrows(IllegalStateException::class.java) {
            CertPinning.requireValidPinFormats(listOf("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="))
        }
    }

    @Test
    fun `requireValidPinFormats rejects a pin with the wrong decoded length`() {
        val exception =
            assertThrows(IllegalStateException::class.java) {
                CertPinning.requireValidPinFormats(listOf("sha256/too-short"))
            }
        assertTrue(exception.message.orEmpty().contains("sha256/too-short"))
    }

    @Test
    fun `requireValidPinFormats rejects a pin with non-base64 characters`() {
        assertThrows(IllegalStateException::class.java) {
            CertPinning.requireValidPinFormats(listOf("sha256/not valid base64!!"))
        }
    }

    @Test
    fun `requireValidPinFormats rejects an empty hash after the prefix`() {
        assertThrows(IllegalStateException::class.java) {
            CertPinning.requireValidPinFormats(listOf("sha256/"))
        }
    }

    // ── requireHostForPins ───────────────────────────────────────────────────

    @Test
    fun `requireHostForPins returns the host when pins are configured and the URL is valid`() {
        assertEquals(
            "api.example.com",
            CertPinning.requireHostForPins(listOf("sha256/abc"), "https://api.example.com/"),
        )
    }

    @Test
    fun `requireHostForPins fails when pins are configured but the host is not extractable`() {
        val exception =
            assertThrows(IllegalStateException::class.java) {
                CertPinning.requireHostForPins(listOf("sha256/abc"), "not a valid url")
            }
        assertTrue(exception.message.orEmpty().contains("not a valid url"))
    }

    @Test
    fun `requireHostForPins fails when pins are configured but the URL is empty`() {
        assertThrows(IllegalStateException::class.java) {
            CertPinning.requireHostForPins(listOf("sha256/abc"), "")
        }
    }

    @Test
    fun `requireHostForPins allows an unextractable host when no pins are configured`() {
        assertNull(CertPinning.requireHostForPins(emptyList(), "not a valid url"))
    }
}
