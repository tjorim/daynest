import { useEffect, useMemo, useState } from "react";
import * as m from "@/paraglide/messages";
import { useLanguage } from "@/i18n/LanguageProvider";
import { FeedbackBanner } from "@/components/common/FeedbackBanner";
import {
  useCalendarFeedQuery,
  useRegenerateCalendarFeedMutation,
  useUpdateUserSettingsMutation,
  useUserSettingsQuery,
} from "@/features/settings/useSettingsQueries";

export function UserPreferencesSection() {
  const { language, setLanguage } = useLanguage();
  const [timezone, setTimezone] = useState("");
  const [hasInitializedUserSettings, setHasInitializedUserSettings] = useState(false);
  const [timezoneSaving, setTimezoneSaving] = useState(false);
  const [timezoneError, setTimezoneError] = useState<string | null>(null);
  const [timezoneSuccess, setTimezoneSuccess] = useState<string | null>(null);
  const [pushOverdueChores, setPushOverdueChores] = useState(true);
  const [pushMedicationReminders, setPushMedicationReminders] = useState(true);
  const [pushMissedMedications, setPushMissedMedications] = useState(true);
  const [serverConfirmedOverdue, setServerConfirmedOverdue] = useState(true);
  const [serverConfirmedMedReminders, setServerConfirmedMedReminders] = useState(true);
  const [serverConfirmedMissedMed, setServerConfirmedMissedMed] = useState(true);
  const [medicationReminderMinutes, setMedicationReminderMinutes] = useState(30);
  const [quietHoursStart, setQuietHoursStart] = useState("");
  const [quietHoursEnd, setQuietHoursEnd] = useState("");
  const [notificationSaving, setNotificationSaving] = useState(false);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [notificationSuccess, setNotificationSuccess] = useState<string | null>(null);
  const [notificationPermission, setNotificationPermission] = useState(() =>
    typeof Notification === "undefined" ? "denied" : Notification.permission,
  );
  const [calendarFeedCopyStatus, setCalendarFeedCopyStatus] = useState<string | null>(null);
  const [calendarFeedError, setCalendarFeedError] = useState<string | null>(null);
  const calendarFeedQuery = useCalendarFeedQuery();
  const userSettingsQuery = useUserSettingsQuery();
  const regenerateCalendarFeedMutation = useRegenerateCalendarFeedMutation();
  const updateUserSettingsMutation = useUpdateUserSettingsMutation();
  const timezoneLoading = userSettingsQuery.isPending && !hasInitializedUserSettings;

  const timezones = useMemo<string[]>(() => {
    try {
      return (Intl as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
    } catch {
      return [];
    }
  }, []);

  const timezoneOptions = useMemo(
    () =>
      timezones.map((tz) => {
        let label = tz;
        try {
          const parts = new Intl.DateTimeFormat("en", {
            timeZone: tz,
            timeZoneName: "shortOffset",
          }).formatToParts(new Date());
          const tzPart = parts.find((p) => p.type === "timeZoneName");
          if (tzPart) label = `${tz} (${tzPart.value})`;
        } catch {
          // ignore unsupported timezone labels
        }
        return { value: tz, label };
      }),
    [timezones],
  );

  useEffect(() => {
    if (hasInitializedUserSettings) return;
    if (!userSettingsQuery.data) {
      if (userSettingsQuery.error) {
        const msg = userSettingsQuery.error instanceof Error
          ? userSettingsQuery.error.message
          : m.settings_timezone_load_error();
        setTimezoneError(msg);
      }
      return;
    }
    const settings = userSettingsQuery.data;
    setTimezoneError(null);
    const overdueEnabled = settings.push_overdue_chores_enabled ?? true;
    const medRemindersEnabled = settings.push_medication_reminders_enabled ?? true;
    const missedMedEnabled = settings.push_missed_medications_enabled ?? true;
    setTimezone(settings.timezone);
    setPushOverdueChores(overdueEnabled);
    setPushMedicationReminders(medRemindersEnabled);
    setPushMissedMedications(missedMedEnabled);
    setServerConfirmedOverdue(overdueEnabled);
    setServerConfirmedMedReminders(medRemindersEnabled);
    setServerConfirmedMissedMed(missedMedEnabled);
    setMedicationReminderMinutes(settings.medication_reminder_minutes ?? 30);
    setQuietHoursStart(settings.quiet_hours_start ?? "");
    setQuietHoursEnd(settings.quiet_hours_end ?? "");
    setHasInitializedUserSettings(true);
  }, [userSettingsQuery.data, userSettingsQuery.error, hasInitializedUserSettings]);

  const onSaveTimezone = async () => {
    if (!timezone) return;
    setTimezoneSaving(true);
    setTimezoneError(null);
    setTimezoneSuccess(null);
    try {
      await updateUserSettingsMutation.mutateAsync({ timezone });
      setTimezoneSuccess(m.settings_timezone_saved());
    } catch (err) {
      setTimezoneError(err instanceof Error ? err.message : m.settings_timezone_save_error());
    } finally {
      setTimezoneSaving(false);
    }
  };

  const handlePushToggle = async (
    field:
      | "push_overdue_chores_enabled"
      | "push_medication_reminders_enabled"
      | "push_missed_medications_enabled",
    checked: boolean,
  ) => {
    setNotificationError(null);
    setNotificationSuccess(null);
    if (field === "push_overdue_chores_enabled") setPushOverdueChores(checked);
    if (field === "push_medication_reminders_enabled") setPushMedicationReminders(checked);
    if (field === "push_missed_medications_enabled") setPushMissedMedications(checked);

    const serverValue =
      field === "push_overdue_chores_enabled" ? serverConfirmedOverdue :
      field === "push_medication_reminders_enabled" ? serverConfirmedMedReminders :
      serverConfirmedMissedMed;
    if (checked === serverValue) return;

    const prevOverdue = pushOverdueChores;
    const prevMed = pushMedicationReminders;
    const prevMissed = pushMissedMedications;
    try {
      await updateUserSettingsMutation.mutateAsync({ [field]: checked });
      if (field === "push_overdue_chores_enabled") setServerConfirmedOverdue(checked);
      if (field === "push_medication_reminders_enabled") setServerConfirmedMedReminders(checked);
      if (field === "push_missed_medications_enabled") setServerConfirmedMissedMed(checked);
    } catch (err) {
      setPushOverdueChores(prevOverdue);
      setPushMedicationReminders(prevMed);
      setPushMissedMedications(prevMissed);
      setNotificationError(
        err instanceof Error ? err.message : m.settings_notification_prefs_save_error(),
      );
    }
  };

  const onSaveNotificationPreferences = async () => {
    setNotificationSaving(true);
    setNotificationError(null);
    setNotificationSuccess(null);
    try {
      await updateUserSettingsMutation.mutateAsync({
        medication_reminder_minutes: medicationReminderMinutes,
        quiet_hours_start: quietHoursStart || null,
        quiet_hours_end: quietHoursEnd || null,
      });
      setNotificationSuccess(m.settings_notification_prefs_saved());
    } catch (err) {
      setNotificationError(
        err instanceof Error ? err.message : m.settings_notification_prefs_save_error(),
      );
    } finally {
      setNotificationSaving(false);
    }
  };

  const requestPushPermission = async () => {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setNotificationPermission(result);
  };

  const copyCalendarFeedUrl = async () => {
    const feedUrl = calendarFeedQuery.data?.feed_url;
    if (!feedUrl) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(feedUrl);
        setCalendarFeedCopyStatus(m.settings_calendar_feed_copied());
      } else {
        setCalendarFeedCopyStatus(m.settings_calendar_clipboard_unsupported());
      }
    } catch {
      setCalendarFeedCopyStatus(m.settings_calendar_clipboard_error());
    }
    setTimeout(() => setCalendarFeedCopyStatus(null), 3000);
  };

  const onRegenerateCalendarFeed = async () => {
    const confirmed = window.confirm(m.settings_calendar_regenerate_confirm());
    if (!confirmed) return;
    setCalendarFeedError(null);
    setCalendarFeedCopyStatus(null);
    try {
      await regenerateCalendarFeedMutation.mutateAsync();
      setCalendarFeedCopyStatus(m.settings_calendar_regenerated());
    } catch (err) {
      setCalendarFeedError(err instanceof Error ? err.message : m.settings_calendar_regenerate_error());
    }
  };

  return (
    <>
      <div className="card mb-3">
        <div className="card-header fw-semibold py-2">{m.settings_user_prefs_header()}</div>
        <div className="card-body d-grid gap-2">
          <label className="form-label small fw-semibold mb-1">{m.settings_language()}</label>
          <select
            className="form-select mb-2"
            value={language}
            onChange={(event) => setLanguage(event.target.value as "en" | "nl")}
            aria-label={m.settings_language()}
          >
            <option value="en">{m.settings_language_english()}</option>
            <option value="nl">{m.settings_language_dutch()}</option>
          </select>
          <label className="form-label small fw-semibold mb-1">{m.settings_timezone()}</label>
          {timezoneLoading ? (
            <div className="text-muted small">{m.settings_timezone_loading()}</div>
          ) : (
            <div className="d-flex gap-2 flex-wrap">
              <select
                className="form-select flex-fill"
                value={timezone}
                onChange={(e) => {
                  setTimezone(e.target.value);
                  setTimezoneSuccess(null);
                  setTimezoneError(null);
                }}
                aria-label={m.settings_timezone()}
              >
                {timezone && !timezones.includes(timezone) ? (
                  <option value={timezone}>{timezone}</option>
                ) : null}
                {timezoneOptions.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-outline-primary btn-sm"
                disabled={timezoneSaving || !timezone}
                onClick={() => void onSaveTimezone()}
              >
                {timezoneSaving ? m.settings_saving() : m.settings_save()}
              </button>
            </div>
          )}
          <FeedbackBanner message={timezoneError} tone="danger" onDismiss={() => setTimezoneError(null)} />
          <FeedbackBanner message={timezoneSuccess} tone="success" onDismiss={() => setTimezoneSuccess(null)} />
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-header fw-semibold py-2">{m.settings_notifications_header()}</div>
        <div className="card-body d-grid gap-2">
          <div className="form-check form-switch">
            <input
              type="checkbox"
              className="form-check-input"
              id="pushOverdueChores"
              checked={pushOverdueChores}
              onChange={(e) => void handlePushToggle("push_overdue_chores_enabled", e.target.checked)}
            />
            <label className="form-check-label" htmlFor="pushOverdueChores">
              {m.settings_overdue_chore_reminders()}
            </label>
          </div>
          <div className="form-check form-switch">
            <input
              type="checkbox"
              className="form-check-input"
              id="pushMedReminders"
              checked={pushMedicationReminders}
              onChange={(e) => void handlePushToggle("push_medication_reminders_enabled", e.target.checked)}
            />
            <label className="form-check-label" htmlFor="pushMedReminders">
              {m.settings_medication_reminders()}
            </label>
          </div>
          <div className="form-check form-switch">
            <input
              type="checkbox"
              className="form-check-input"
              id="pushMissedMed"
              checked={pushMissedMedications}
              onChange={(e) => void handlePushToggle("push_missed_medications_enabled", e.target.checked)}
            />
            <label className="form-check-label" htmlFor="pushMissedMed">
              {m.settings_missed_medication_alerts()}
            </label>
          </div>

          <label className="form-label small fw-semibold" htmlFor="medicationReminderMinutes">
            {m.settings_medication_reminder_minutes()}
          </label>
          <input
            id="medicationReminderMinutes"
            type="number"
            className="form-control"
            min={1}
            max={120}
            value={medicationReminderMinutes}
            onChange={(e) => setMedicationReminderMinutes(Number(e.target.value))}
          />

          <label className="form-label small fw-semibold">{m.settings_quiet_hours()}</label>
          <div className="d-flex gap-2">
            <div className="flex-fill">
              <label htmlFor="quietHoursStart" className="form-label small mb-1">
                {m.settings_quiet_hours_from()}
              </label>
              <input
                id="quietHoursStart"
                type="time"
                className="form-control"
                value={quietHoursStart}
                onChange={(e) => setQuietHoursStart(e.target.value)}
              />
            </div>
            <div className="flex-fill">
              <label htmlFor="quietHoursEnd" className="form-label small mb-1">
                {m.settings_quiet_hours_to()}
              </label>
              <input
                id="quietHoursEnd"
                type="time"
                className="form-control"
                value={quietHoursEnd}
                onChange={(e) => setQuietHoursEnd(e.target.value)}
              />
            </div>
          </div>

          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={() => void onSaveNotificationPreferences()}
            disabled={notificationSaving}
          >
            {notificationSaving ? m.settings_saving() : m.settings_save_notification_prefs()}
          </button>
          <FeedbackBanner
            message={notificationError}
            tone="danger"
            onDismiss={() => setNotificationError(null)}
          />
          <FeedbackBanner
            message={notificationSuccess}
            tone="success"
            onDismiss={() => setNotificationSuccess(null)}
          />
          {notificationPermission === "default" ? (
            <button
              type="button"
              className="btn btn-sm btn-outline-primary"
              onClick={() => void requestPushPermission()}
            >
              {m.settings_enable_browser_notifications()}
            </button>
          ) : null}
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-header fw-semibold py-2">{m.settings_calendar_subscription_header()}</div>
        <div className="card-body d-grid gap-2">
          <p className="text-muted small mb-1">{m.settings_calendar_subscription_description()}</p>
          <label className="form-label small fw-semibold mb-0" htmlFor="calendarFeedUrl">
            {m.settings_calendar_feed_label()}
          </label>
          <div className="input-group input-group-sm">
            <input
              id="calendarFeedUrl"
              className="form-control"
              readOnly
              value={calendarFeedQuery.data?.feed_url ?? ""}
              placeholder={
                calendarFeedQuery.isPending
                  ? m.settings_calendar_feed_loading()
                  : m.settings_calendar_feed_unavailable()
              }
            />
            <button
              type="button"
              className="btn btn-outline-primary"
              disabled={!calendarFeedQuery.data?.feed_url}
              onClick={() => void copyCalendarFeedUrl()}
            >
              {m.settings_calendar_feed_copy()}
            </button>
          </div>
          <div className="d-flex gap-2 align-items-center flex-wrap">
            <button
              type="button"
              className="btn btn-outline-danger btn-sm"
              disabled={regenerateCalendarFeedMutation.isPending}
              onClick={() => void onRegenerateCalendarFeed()}
            >
              {regenerateCalendarFeedMutation.isPending
                ? m.settings_calendar_regenerating()
                : m.settings_calendar_regenerate()}
            </button>
            <small className="text-muted">{m.settings_calendar_rotate_warning()}</small>
          </div>
          {calendarFeedQuery.error ? (
            <div className="text-danger small">
              {calendarFeedQuery.error instanceof Error
                ? calendarFeedQuery.error.message
                : m.settings_calendar_load_error()}
            </div>
          ) : null}
          <FeedbackBanner
            message={calendarFeedError}
            tone="danger"
            onDismiss={() => setCalendarFeedError(null)}
          />
          <FeedbackBanner
            message={calendarFeedCopyStatus}
            tone="success"
            onDismiss={() => setCalendarFeedCopyStatus(null)}
          />
        </div>
      </div>
    </>
  );
}
