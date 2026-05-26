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

fun TodayResponseDto.toWearTodaySnapshot(): WearTodaySnapshot =
    WearTodaySnapshot(
        completionPercent = completionPercent(),
        overdueCount = overdue.count { !it.status.isDoneStatus() },
        nextMedication = nextMedicationName(),
        dueItems = dueItems(),
    )

private fun TodayResponseDto.completionPercent(): Int {
    val totalCount =
        routines.size +
            dueToday.size +
            overdue.size +
            medication.size
    val completedCount =
        routines.count { it.status.isDoneStatus() } +
            dueToday.count { it.status.isDoneStatus() } +
            overdue.count { it.status.isDoneStatus() } +
            medication.count { it.status.isMedicationDoneStatus() }
    return if (totalCount == 0) {
        FULL_COMPLETION_PERCENT
    } else {
        ((completedCount.toFloat() / totalCount.toFloat()) * FULL_COMPLETION_PERCENT_FLOAT)
            .roundToInt()
            .coerceIn(MIN_COMPLETION_PERCENT, FULL_COMPLETION_PERCENT)
    }
}

private fun TodayResponseDto.nextMedicationName(): String? =
    medication
        .filter { !it.status.isMedicationDoneStatus() }
        .minByOrNull { it.scheduledAt.ifBlank { LAST_SORT_KEY } }
        ?.name

private fun TodayResponseDto.dueItems(): List<WearDueItem> =
    overdueChoreItems() +
        dueTodayChoreItems() +
        medicationItems()

private fun TodayResponseDto.overdueChoreItems(): List<WearDueItem> =
    overdue
        .filter { !it.status.isDoneStatus() }
        .map { item ->
            WearDueItem(
                type = WearDueItemType.CHORE,
                id = item.choreInstanceId,
                title = item.title,
                subtitle = item.overdueSince.takeIf { it.isNotBlank() },
            )
        }

private fun TodayResponseDto.dueTodayChoreItems(): List<WearDueItem> =
    dueToday
        .filter { !it.status.isDoneStatus() }
        .map { item ->
            WearDueItem(
                type = WearDueItemType.CHORE,
                id = item.choreInstanceId,
                title = item.title,
                subtitle = item.scheduledDate.takeIf { it.isNotBlank() },
            )
        }

private fun TodayResponseDto.medicationItems(): List<WearDueItem> =
    medication
        .filter { !it.status.isMedicationDoneStatus() }
        .map { item ->
            WearDueItem(
                type = WearDueItemType.MEDICATION,
                id = item.medicationDoseInstanceId,
                title = item.name,
                subtitle = item.scheduledAt.takeIf { it.isNotBlank() },
            )
        }

private fun String.isDoneStatus(): Boolean = equals("done", ignoreCase = true) || equals("completed", ignoreCase = true)

private fun String.isMedicationDoneStatus(): Boolean =
    equals("taken", ignoreCase = true) ||
        equals("skipped", ignoreCase = true)

private const val LAST_SORT_KEY = "9999-99-99T99:99:99"
private const val MIN_COMPLETION_PERCENT = 0
private const val FULL_COMPLETION_PERCENT = 100
private const val FULL_COMPLETION_PERCENT_FLOAT = 100f
