package com.daynest.android.feature.templates

import com.daynest.android.data.templates.ChoreTemplateDto
import com.daynest.android.data.templates.ChoreTemplateInputDto
import com.daynest.android.data.templates.RoutineTemplateDto
import com.daynest.android.data.templates.RoutineTemplateInputDto
import java.time.LocalDate

private const val DUE_TIME_DISPLAY_LENGTH = 5

data class RoutineFormState(
    val name: String,
    val description: String,
    val startDate: String,
    val everyNDays: String,
    val dueTime: String,
    val isActive: Boolean
) {
    fun toInput(): RoutineTemplateInputDto = RoutineTemplateInputDto(
        name = name.trim(),
        description = description.trim().ifBlank { null },
        startDate = startDate.trim().ifBlank { LocalDate.now().toString() },
        everyNDays = everyNDays.toIntOrNull() ?: 1,
        dueTime = dueTime.trim().ifBlank { null },
        isActive = isActive
    )

    companion object {
        fun new(): RoutineFormState = RoutineFormState(
            name = "",
            description = "",
            startDate = LocalDate.now().toString(),
            everyNDays = "1",
            dueTime = "",
            isActive = true
        )

        fun from(routine: RoutineTemplateDto): RoutineFormState = RoutineFormState(
            name = routine.name,
            description = routine.description.orEmpty(),
            startDate = routine.startDate,
            everyNDays = routine.everyNDays.toString(),
            dueTime = routine.dueTime?.take(DUE_TIME_DISPLAY_LENGTH).orEmpty(),
            isActive = routine.isActive
        )
    }
}

data class ChoreFormState(
    val name: String,
    val description: String,
    val startDate: String,
    val everyNDays: String,
    val isActive: Boolean
) {
    fun toInput(): ChoreTemplateInputDto = ChoreTemplateInputDto(
        name = name.trim(),
        description = description.trim().ifBlank { null },
        startDate = startDate.trim().ifBlank { LocalDate.now().toString() },
        everyNDays = everyNDays.toIntOrNull() ?: 1,
        isActive = isActive
    )

    companion object {
        fun new(): ChoreFormState = ChoreFormState(
            name = "",
            description = "",
            startDate = LocalDate.now().toString(),
            everyNDays = "1",
            isActive = true
        )

        fun from(chore: ChoreTemplateDto): ChoreFormState = ChoreFormState(
            name = chore.name,
            description = chore.description.orEmpty(),
            startDate = chore.startDate,
            everyNDays = chore.everyNDays.toString(),
            isActive = chore.isActive
        )
    }
}
