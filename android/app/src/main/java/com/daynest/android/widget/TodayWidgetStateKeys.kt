package com.daynest.android.widget

import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey

/**
 * Glance [PreferencesGlanceStateDefinition] keys shared by the small and medium Today widgets.
 *
 * The refresh worker writes these keys; both widgets read them in their composition.
 */
internal object TodayWidgetStateKeys {
    /** 0–100 percentage of items completed today. */
    val COMPLETION_PERCENT = intPreferencesKey("completion_percent")

    /** Total number of today's items (used for display). */
    val TOTAL_COUNT = intPreferencesKey("total_count")

    /** Number of completed items today. */
    val DONE_COUNT = intPreferencesKey("done_count")

    /** Number of overdue items. */
    val OVERDUE_COUNT = intPreferencesKey("overdue_count")

    /** Name of the next scheduled medication dose, or absent when none. */
    val NEXT_MEDICATION_NAME = stringPreferencesKey("next_medication_name")

    /** Title of the 1st top due item, or absent when none. */
    val DUE_ITEM_0 = stringPreferencesKey("due_item_0")

    /** Title of the 2nd top due item, or absent when none. */
    val DUE_ITEM_1 = stringPreferencesKey("due_item_1")

    /** Title of the 3rd top due item, or absent when none. */
    val DUE_ITEM_2 = stringPreferencesKey("due_item_2")

    /** Whether the widget has received its first data update. */
    val DATA_LOADED = booleanPreferencesKey("data_loaded")

    // ── Configurable section visibility (defaults to true) ─────────────────
    /** Show the next-medication chip in the medium widget. */
    val SHOW_MEDICATION = booleanPreferencesKey("show_medication")

    /** Show the top-due-items list in the medium widget. */
    val SHOW_DUE_ITEMS = booleanPreferencesKey("show_due_items")

    /** Show the overdue badge in the medium widget. */
    val SHOW_OVERDUE = booleanPreferencesKey("show_overdue")
}
