package com.daynest.android.core.network

import com.daynest.android.BuildConfig
import org.junit.Assert.assertEquals
import org.junit.Test

class ServerUrlHolderTest {
    @Test
    fun `defaults to BuildConfig API_BASE_URL`() {
        val holder = ServerUrlHolder()
        val expected = BuildConfig.API_BASE_URL.trimEnd('/') + "/"
        assertEquals(expected, holder.currentUrl)
    }

    @Test
    fun `updateUrl with null resets to BuildConfig default`() {
        val holder = ServerUrlHolder()
        holder.updateUrl("https://custom.example.com/")
        assertEquals("https://custom.example.com/", holder.currentUrl)

        holder.updateUrl(null)
        val expected = BuildConfig.API_BASE_URL.trimEnd('/') + "/"
        assertEquals(expected, holder.currentUrl)
    }

    @Test
    fun `updateUrl appends trailing slash when missing`() {
        val holder = ServerUrlHolder()
        holder.updateUrl("https://selfhosted.example.com")
        assertEquals("https://selfhosted.example.com/", holder.currentUrl)
    }
}
