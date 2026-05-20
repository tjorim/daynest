package com.daynest.android.feature.calendar

import com.daynest.android.data.today.PlannedItemCreateDto
import com.daynest.android.data.today.PlannedItemRepository
import com.daynest.android.data.today.PlannedTodayItemDto
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.Instant

internal class CalendarBackupHandler(
    private val scope: CoroutineScope,
    private val plannedItemRepository: PlannedItemRepository,
    private val uiState: MutableStateFlow<CalendarUiState>,
    private val onRefresh: () -> Unit,
) {
    fun exportMonthBackup(onReady: (PlannedItemBackupDto) -> Unit) {
        val current = uiState.value as? CalendarUiState.Content ?: return
        val startDate = current.displayMonth.withDayOfMonth(1).toString()
        val endDate = current.displayMonth.withDayOfMonth(current.displayMonth.lengthOfMonth()).toString()
        scope.launch {
            val result = plannedItemRepository.listPlannedItems(startDate, endDate)
            result.onSuccess { items ->
                onReady(
                    PlannedItemBackupDto(
                        source = "daynest",
                        schemaVersion = 1,
                        exportedAt = Instant.now().toString(),
                        items = items.map { it.toBackupItem() },
                    ),
                )
            }
        }
    }

    fun importBackup(items: List<PlannedItemCreateDto>) {
        scope.launch {
            val results = mutableListOf<Result<PlannedTodayItemDto>>()
            for (batch in items.chunked(5)) {
                results +=
                    batch
                        .map { item -> async { plannedItemRepository.createPlannedItem(item) } }
                        .awaitAll()
            }
            val imported = results.count { it.isSuccess }
            val failed = results.count { it.isFailure }
            uiState.update { current ->
                if (current is CalendarUiState.Content) {
                    current.copy(backupMessage = CalendarBackupMessage.ImportComplete(imported, failed))
                } else {
                    current
                }
            }
            onRefresh()
        }
    }

    fun updateBackupMessage(message: CalendarBackupMessage) {
        uiState.update { current ->
            if (current is CalendarUiState.Content) {
                current.copy(backupMessage = message)
            } else {
                current
            }
        }
    }
}

private fun PlannedTodayItemDto.toBackupItem() =
    PlannedItemBackupItemDto(
        title = title,
        plannedFor = plannedFor,
        notes = notes,
        moduleKey = moduleKey,
        recurrenceHint = recurrenceHint,
        linkedSource = linkedSource,
        linkedRef = linkedRef,
    )
