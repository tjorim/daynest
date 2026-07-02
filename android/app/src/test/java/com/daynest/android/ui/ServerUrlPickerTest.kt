package com.daynest.android.ui

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ServerUrlPickerTest {
    @Test
    fun `valid http url is accepted`() {
        assertTrue(isValidServerUrl("http://10.0.2.2:8000/"))
    }

    @Test
    fun `valid https url is accepted`() {
        assertTrue(isValidServerUrl("https://api.example.com/"))
    }

    @Test
    fun `blank url is rejected`() {
        assertFalse(isValidServerUrl(""))
    }

    @Test
    fun `malformed url is rejected`() {
        assertFalse(isValidServerUrl("not-a-url"))
    }

    @Test
    fun `url without scheme is rejected`() {
        assertFalse(isValidServerUrl("example.com"))
    }
}
