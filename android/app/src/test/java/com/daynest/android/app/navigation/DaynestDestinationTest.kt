package com.daynest.android.app.navigation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class DaynestDestinationTest {
    @Test
    fun topLevelDestinations_matchWebApplicationSections() {
        val routes = daynestTopLevelDestinations.map { it.route }

        assertEquals(
            listOf(
                DaynestDestination.HOME,
                DaynestDestination.CALENDAR,
                DaynestDestination.MEDICATION,
                DaynestDestination.TEMPLATES,
                DaynestDestination.SETTINGS,
            ),
            routes,
        )
    }

    @Test
    fun topLevelDestinations_haveUserFacingLabels() {
        daynestTopLevelDestinations.forEach { destination ->
            assertTrue(destination.label.isNotBlank())
        }
    }
}
