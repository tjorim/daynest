import type { UserSettings } from "@/lib/api/today";

export function seedUserSettings(): UserSettings {
  return {
    timezone: "Europe/Brussels",
    default_snooze_days: 1,
    medication_reminder_minutes: 30,
    quiet_hours_start: "22:00",
    quiet_hours_end: "08:00",
    push_overdue_chores_enabled: true,
    push_medication_reminders_enabled: true,
    push_missed_medications_enabled: true,
  };
}
