package com.daynest.android.feature.wear

import com.daynest.android.data.today.DueTodayItemDto
import com.daynest.android.data.today.MedicationTodayItemDto
import com.daynest.android.data.today.OverdueTodayItemDto
import com.daynest.android.data.today.RoutineTodayItemDto
import com.daynest.android.data.today.TodayResponseDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class WearTodaySnapshotTest {
    @Test
    fun `toWearTodaySnapshot computes completion overdue and actions`() {
        val today =
            TodayResponseDto(
                routines =
                    listOf(
                        RoutineTodayItemDto(taskInstanceId = 1, title = "Routine done", status = "done"),
                        RoutineTodayItemDto(taskInstanceId = 2, title = "Routine pending", status = "pending"),
                    ),
                overdue =
                    listOf(
                        OverdueTodayItemDto(choreInstanceId = 10, title = "Late chore", status = "pending"),
                        OverdueTodayItemDto(choreInstanceId = 11, title = "Done overdue", status = "done"),
                    ),
                dueToday = listOf(DueTodayItemDto(choreInstanceId = 12, title = "Due chore", status = "pending")),
                medication =
                    listOf(
                        MedicationTodayItemDto(
                            medicationDoseInstanceId = 21,
                            name = "Vitamin D",
                            scheduledAt = "2026-05-25T09:00:00",
                            status = "taken",
                        ),
                        MedicationTodayItemDto(
                            medicationDoseInstanceId = 22,
                            name = "Omega 3",
                            scheduledAt = "2026-05-25T19:00:00",
                            status = "scheduled",
                        ),
                    ),
            )

        val snapshot = today.toWearTodaySnapshot()

        assertEquals(43, snapshot.completionPercent)
        assertEquals(1, snapshot.overdueCount)
        assertEquals("Omega 3", snapshot.nextMedication)
        assertEquals(3, snapshot.dueItems.size)
        assertEquals(WearDueItemType.CHORE, snapshot.dueItems[0].type)
        assertEquals(10, snapshot.dueItems[0].id)
        assertEquals(WearDueItemType.CHORE, snapshot.dueItems[1].type)
        assertEquals(12, snapshot.dueItems[1].id)
        assertEquals(WearDueItemType.MEDICATION, snapshot.dueItems[2].type)
        assertEquals(22, snapshot.dueItems[2].id)
    }

    @Test
    fun `toWearTodaySnapshot handles empty payload`() {
        val snapshot = TodayResponseDto().toWearTodaySnapshot()

        assertEquals(100, snapshot.completionPercent)
        assertEquals(0, snapshot.overdueCount)
        assertNull(snapshot.nextMedication)
        assertEquals(0, snapshot.dueItems.size)
    }
}
