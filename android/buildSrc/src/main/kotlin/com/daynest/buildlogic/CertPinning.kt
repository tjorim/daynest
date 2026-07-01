package com.daynest.buildlogic

import java.net.URI

/**
 * Release-build certificate-pinning helpers, extracted from app/build.gradle.kts
 * so they can be unit tested (script-local functions in a Kotlin DSL build script
 * cannot be). Property lookups are injected as functions so tests don't need a
 * Gradle project or real environment variables.
 */
object CertPinning {
    fun resolvePins(
        key: String,
        envKey: String,
        localProperty: (String) -> String?,
        gradleProperty: (String) -> String?,
        env: (String) -> String?,
    ): List<String> {
        val value = localProperty(key) ?: gradleProperty(key) ?: env(envKey)
        return value?.split(",")?.map { it.trim() }?.filter { it.isNotBlank() } ?: emptyList()
    }

    fun pinsArrayLiteral(pins: List<String>): String =
        if (pins.isEmpty()) {
            "new String[]{}"
        } else {
            "new String[]{${pins.joinToString(",") { "\"$it\"" }}}"
        }

    fun extractHost(url: String): String? = runCatching { URI(url).host }.getOrNull()

    private val base64Regex = Regex("^[A-Za-z0-9+/_-]+={0,2}$")

    // OkHttp's CertificatePinner requires the base64-decoded hash to be
    // exactly 32 bytes for sha256 or 20 bytes for sha1; a pin that merely has
    // the right prefix but a malformed hash would otherwise fail at runtime
    // instead of at build time.
    fun requireValidPinFormats(pins: List<String>) {
        val invalidPins =
            pins.filter { pin ->
                val parts = pin.split('/', limit = 2)
                if (parts.size != 2) {
                    return@filter true
                }
                val (prefix, encoded) = parts
                if (!base64Regex.matches(encoded)) {
                    return@filter true
                }
                when (prefix) {
                    "sha256" -> encoded.length !in 43..44
                    "sha1" -> encoded.length !in 27..28
                    else -> true
                }
            }
        check(invalidPins.isEmpty()) {
            "Invalid pin format(s): $invalidPins. " +
                "Pins must start with 'sha256/' or 'sha1/' followed by a valid base64-encoded hash."
        }
    }

    fun requireHostForPins(
        pins: List<String>,
        url: String,
    ): String? {
        val host = extractHost(url)
        check(pins.isEmpty() || !host.isNullOrBlank()) {
            "Could not extract host from release URL '$url'. " +
                "Certificate pinning would be ineffective — fix API_BASE_URL_RELEASE."
        }
        return host
    }
}
