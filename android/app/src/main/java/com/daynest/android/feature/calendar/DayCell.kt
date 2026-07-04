@file:Suppress("ktlint:standard:function-naming", "FunctionNaming")

package com.daynest.android.feature.calendar

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

private const val ITEM_TYPE_ROUTINE = "routine"
private const val ITEM_TYPE_CHORE = "chore"
private const val ITEM_TYPE_MEDICATION = "medication"
private const val ITEM_TYPE_PLANNED = "planned"

@Composable
internal fun DayCell(
    dayNum: Int,
    routines: Int,
    chores: Int,
    medications: Int,
    planned: Int,
    isSelected: Boolean,
    isToday: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val bgColor =
        when {
            isSelected -> MaterialTheme.colorScheme.primary
            isToday -> MaterialTheme.colorScheme.primaryContainer
            else -> Color.Transparent
        }
    val textColor =
        when {
            isSelected -> MaterialTheme.colorScheme.onPrimary
            isToday -> MaterialTheme.colorScheme.onPrimaryContainer
            else -> MaterialTheme.colorScheme.onSurface
        }
    val dotTypes =
        remember(routines, chores, medications, planned) {
            buildList {
                if (routines > 0) add(ITEM_TYPE_ROUTINE)
                if (chores > 0) add(ITEM_TYPE_CHORE)
                if (medications > 0) add(ITEM_TYPE_MEDICATION)
                if (planned > 0) add(ITEM_TYPE_PLANNED)
            }
        }

    Box(
        modifier =
        modifier
            .aspectRatio(1f)
            .padding(2.dp)
            .clip(CircleShape)
            .background(bgColor)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = dayNum.toString(),
                style = MaterialTheme.typography.bodySmall,
                color = textColor
            )
            if (dotTypes.isNotEmpty()) {
                DayCellDots(dotTypes = dotTypes, isSelected = isSelected)
            }
        }
    }
}

@Composable
internal fun DayCellDots(dotTypes: List<String>, isSelected: Boolean) {
    val colorScheme = MaterialTheme.colorScheme
    Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
        dotTypes.forEach { typeKey ->
            val dotColor =
                if (isSelected) {
                    colorScheme.onPrimary
                } else {
                    when (typeKey) {
                        ITEM_TYPE_ROUTINE -> colorScheme.primary
                        ITEM_TYPE_CHORE -> colorScheme.secondary
                        ITEM_TYPE_MEDICATION -> colorScheme.tertiary
                        else -> colorScheme.outline
                    }
                }
            Box(
                modifier =
                Modifier
                    .size(3.dp)
                    .clip(CircleShape)
                    .background(dotColor)
            )
        }
    }
}
