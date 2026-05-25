package com.daynest.android.feature.wear

import com.daynest.android.data.today.TodayResponseDto
import kotlin.math.roundToInt

data class WearTodaySnapshot(
    val completionPercent: Int,
    val overdueCount: Int,
    val nextMedication: String?,
    val dueItems: List<WearDueItem>,
)

data class WearDueItem(
    val type: WearDueItemType,
    val id: Int,
    val title: String,
    val subtitle: String? = null,
)

enum class WearDueItemType {
    CHORE,
    MEDICATION,
}

fun TodayResponseDto.toWearTodaySnapshot(): WearTodaySnapshot {
    val totalCount = routines.size + dueToday.size + overdue.size + medication.size
    val completedCount =
        routines.count { it.status.isDoneStatus() } +
            dueToday.count { it.status.isDoneStatus() } +
            overdue.count { it.status.isDoneStatus() } +
            medication.count { it.status.isMedicationDoneStatus() }
    val completionPercent =
        if (totalCount == 0) {
            100
        } else {
            ((completedCount.toFloat() / totalCount.toFloat()) * 100f).roundToInt().coerceIn(0, 100)
        }
    val overdueCount = overdue.count { !it.status.isDoneStatus() }
    val nextMedication =
        medication
            .filter { !it.status.isMedicationDoneStatus() }
            .minByOrNull { it.scheduledAt.ifBlank { "9999-99-99T99:99:99" } }
            ?.name
    val dueItems =
        buildList {
            overdue
                .filter { !it.status.isDoneStatus() }
                .forEach { item ->
                    add(
                        WearDueItem(
                            type = WearDueItemType.CHORE,
                            id = item.choreInstanceId,
                            title = item.title,
                            subtitle = item.overdueSince.takeIf { it.isNotBlank() },
                        ),
                    )
                }
            dueToday
                .filter { !it.status.isDoneStatus() }
                .forEach { item ->
                    add(
                        WearDueItem(
                            type = WearDueItemType.CHORE,
                            id = item.choreInstanceId,
                            title = item.title,
                            subtitle = item.scheduledDate.takeIf { it.isNotBlank() },
                        ),
                    )
                }
            medication
                .filter { !it.status.isMedicationDoneStatus() }
                .forEach { item ->
                    add(
                        WearDueItem(
                            type = WearDueItemType.MEDICATION,
                            id = item.medicationDoseInstanceId,
                            title = item.name,
                            subtitle = item.scheduledAt.takeIf { it.isNotBlank() },
                        ),
                    )
                }
        }
    return WearTodaySnapshot(
        completionPercent = completionPercent,
        overdueCount = overdueCount,
        nextMedication = nextMedication,
        dueItems = dueItems,
    )
}

private fun String.isDoneStatus(): Boolean = equals("done", ignoreCase = true) || equals("completed", ignoreCase = true)

private fun String.isMedicationDoneStatus(): Boolean =
    equals("taken", ignoreCase = true) ||
        equals("skipped", ignoreCase = true)
