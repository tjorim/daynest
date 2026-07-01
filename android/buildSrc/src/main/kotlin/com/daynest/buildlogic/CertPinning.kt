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

    fun requireValidPinFormats(pins: List<String>) {
        val invalidPins = pins.filter { !it.startsWith("sha256/") && !it.startsWith("sha1/") }
        check(invalidPins.isEmpty()) {
            "Invalid pin format(s): $invalidPins. " +
                "Pins must start with 'sha256/' or 'sha1/'."
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
