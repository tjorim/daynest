package com.daynest.android.core.notifications

data class PushPayload(
    val type: String,
    val title: String,
    val body: String,
    val itemId: Int?,
) {
    companion object {
        fun fromData(data: Map<String, String>): PushPayload {
            val normalizedType = normalizeType(data["type"] ?: data["notification_type"].orEmpty())
            return PushPayload(
                type = normalizedType,
                title = data["title"].orEmpty(),
                body = data["body"].orEmpty(),
                itemId = data["item_id"]?.toIntOrNull() ?: data["id"]?.toIntOrNull(),
            )
        }

        private fun normalizeType(type: String): String =
            when (type) {
                "medication", "medication_reminder", "missed_medication" -> "medication"
                "overdue_chore", "chore" -> "chore"
                else -> type.ifBlank { "chore" }
            }
    }
}
