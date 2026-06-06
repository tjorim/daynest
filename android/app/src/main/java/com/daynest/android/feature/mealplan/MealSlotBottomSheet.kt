@file:Suppress("ktlint:standard:function-naming", "FunctionNaming")

package com.daynest.android.feature.mealplan

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.daynest.android.R

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MealSlotBottomSheet(
    draft: MealSlotDraft,
    onDraftChange: (MealSlotDraft) -> Unit,
    onDismiss: () -> Unit,
    onSave: () -> Unit,
    modifier: Modifier = Modifier,
) {
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = modifier.padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(text = stringResource(id = R.string.meal_plan_edit_slot_title))
            OutlinedTextField(
                value = draft.title,
                onValueChange = { onDraftChange(draft.copy(title = it)) },
                modifier = Modifier.fillMaxWidth(),
                label = { Text(text = stringResource(id = R.string.meal_plan_slot_title_label)) },
                singleLine = true,
            )
            OutlinedTextField(
                value = draft.recipeUrl,
                onValueChange = { onDraftChange(draft.copy(recipeUrl = it)) },
                modifier = Modifier.fillMaxWidth(),
                label = { Text(text = stringResource(id = R.string.meal_plan_recipe_url_label)) },
                singleLine = true,
            )
            OutlinedTextField(
                value = draft.ingredients,
                onValueChange = { onDraftChange(draft.copy(ingredients = it)) },
                modifier = Modifier.fillMaxWidth(),
                label = { Text(text = stringResource(id = R.string.meal_plan_ingredients_label)) },
                minLines = 4,
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
            ) {
                TextButton(onClick = onDismiss) {
                    Text(text = stringResource(id = R.string.action_cancel))
                }
                Button(onClick = onSave) {
                    Text(text = stringResource(id = R.string.action_save))
                }
            }
        }
    }
}
