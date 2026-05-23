package com.daynest.android.feature.templates

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

fun String.toEpochMillisOrNull(): Long? =
    runCatching {
        LocalDate.parse(this)
            .atStartOfDay(ZoneId.systemDefault())
            .toInstant()
            .toEpochMilli()
    }.getOrNull()

fun Long.toLocalDateString(): String =
    Instant.ofEpochMilli(this)
        .atZone(ZoneId.systemDefault())
        .toLocalDate()
        .toString()

fun String.timePartAt(
    index: Int,
    defaultValue: Int,
    range: IntRange,
): Int =
    split(":")
        .getOrNull(index)
        ?.toIntOrNull()
        ?.coerceIn(range) ?: defaultValue
