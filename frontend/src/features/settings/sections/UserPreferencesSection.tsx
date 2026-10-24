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
import { apiErrorMessage } from "@/lib/api/errorMessages";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input, InputGroup } from "@/components/ui/input";

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
      return (
        (Intl as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.(
          "timeZone",
        ) ?? []
      );
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
        const msg = apiErrorMessage(userSettingsQuery.error, m.settings_timezone_load_error());
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
      setTimezoneError(apiErrorMessage(err, m.settings_timezone_save_error()));
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
      field === "push_overdue_chores_enabled"
        ? serverConfirmedOverdue
        : field === "push_medication_reminders_enabled"
          ? serverConfirmedMedReminders
          : serverConfirmedMissedMed;
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
      setNotificationError(apiErrorMessage(err, m.settings_notification_prefs_save_error()));
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
      setNotificationError(apiErrorMessage(err, m.settings_notification_prefs_save_error()));
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
      setCalendarFeedError(apiErrorMessage(err, m.settings_calendar_regenerate_error()));
    }
  };

  return (
    <>
      <Card className="tw:mb-4">
        <CardHeader className="tw:font-semibold tw:py-2">
          {m.settings_user_prefs_header()}
        </CardHeader>
        <CardContent className="tw:grid tw:gap-2">
          <Label className="tw:text-small tw:font-semibold tw:mb-1">{m.settings_language()}</Label>
          <Select
            className="tw:mb-2"
            value={language}
            onChange={(event) => setLanguage(event.target.value as "en" | "nl")}
            aria-label={m.settings_language()}
          >
            <option value="en">{m.settings_language_english()}</option>
            <option value="nl">{m.settings_language_dutch()}</option>
          </Select>
          <Label className="tw:text-small tw:font-semibold tw:mb-1">{m.settings_timezone()}</Label>
          {timezoneLoading ? (
            <div className="tw:text-muted-foreground tw:text-small">
              {m.settings_timezone_loading()}
            </div>
          ) : (
            <div className="tw:flex tw:gap-2 tw:flex-wrap">
              <Select
                className="tw:flex-auto"
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
              </Select>
              <Button
                variant="outline-primary"
                size="sm"
                disabled={timezoneSaving || !timezone}
                onClick={() => void onSaveTimezone()}
              >
                {timezoneSaving ? m.settings_saving() : m.settings_save()}
              </Button>
            </div>
          )}
          <FeedbackBanner
            message={timezoneError}
            tone="danger"
            onDismiss={() => setTimezoneError(null)}
          />
          <FeedbackBanner
            message={timezoneSuccess}
            tone="success"
            onDismiss={() => setTimezoneSuccess(null)}
          />
        </CardContent>
      </Card>

      <Card className="tw:mb-4">
        <CardHeader className="tw:font-semibold tw:py-2">
          {m.settings_notifications_header()}
        </CardHeader>
        <CardContent className="tw:grid tw:gap-2">
          <div className="tw:check-row tw:mb-0.5">
            <Switch
              id="pushOverdueChores"
              checked={pushOverdueChores}
              onChange={(e) =>
                void handlePushToggle("push_overdue_chores_enabled", e.target.checked)
              }
            />
            <label htmlFor="pushOverdueChores">{m.settings_overdue_chore_reminders()}</label>
          </div>
          <div className="tw:check-row tw:mb-0.5">
            <Switch
              id="pushMedReminders"
              checked={pushMedicationReminders}
              onChange={(e) =>
                void handlePushToggle("push_medication_reminders_enabled", e.target.checked)
              }
            />
            <label htmlFor="pushMedReminders">{m.settings_medication_reminders()}</label>
          </div>
          <div className="tw:check-row tw:mb-0.5">
            <Switch
              id="pushMissedMed"
              checked={pushMissedMedications}
              onChange={(e) =>
                void handlePushToggle("push_missed_medications_enabled", e.target.checked)
              }
            />
            <label htmlFor="pushMissedMed">{m.settings_missed_medication_alerts()}</label>
          </div>

          <Label className="tw:text-small tw:font-semibold" htmlFor="medicationReminderMinutes">
            {m.settings_medication_reminder_minutes()}
          </Label>
          <Input
            id="medicationReminderMinutes"
            type="number"
            min={1}
            max={120}
            value={medicationReminderMinutes}
            onChange={(e) => setMedicationReminderMinutes(Number(e.target.value))}
          />

          <Label className="tw:text-small tw:font-semibold">{m.settings_quiet_hours()}</Label>
          <div className="tw:flex tw:gap-2">
            <div className="tw:flex-auto">
              <Label className="tw:text-small tw:mb-1" htmlFor="quietHoursStart">
                {m.settings_quiet_hours_from()}
              </Label>
              <Input
                id="quietHoursStart"
                type="time"
                value={quietHoursStart}
                onChange={(e) => setQuietHoursStart(e.target.value)}
              />
            </div>
            <div className="tw:flex-auto">
              <Label className="tw:text-small tw:mb-1" htmlFor="quietHoursEnd">
                {m.settings_quiet_hours_to()}
              </Label>
              <Input
                id="quietHoursEnd"
                type="time"
                value={quietHoursEnd}
                onChange={(e) => setQuietHoursEnd(e.target.value)}
              />
            </div>
          </div>

          <Button
            variant="outline-primary"
            size="sm"
            onClick={() => void onSaveNotificationPreferences()}
            disabled={notificationSaving}
          >
            {notificationSaving ? m.settings_saving() : m.settings_save_notification_prefs()}
          </Button>
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
            <Button
              variant="outline-primary"
              size="sm"
              onClick={() => void requestPushPermission()}
            >
              {m.settings_enable_browser_notifications()}
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card className="tw:mb-4">
        <CardHeader className="tw:font-semibold tw:py-2">
          {m.settings_calendar_subscription_header()}
        </CardHeader>
        <CardContent className="tw:grid tw:gap-2">
          <p className="tw:text-muted-foreground tw:text-small tw:mb-1">
            {m.settings_calendar_subscription_description()}
          </p>
          <Label className="tw:text-small tw:font-semibold tw:mb-0" htmlFor="calendarFeedUrl">
            {m.settings_calendar_feed_label()}
          </Label>
          <InputGroup>
            <Input
              size="sm"
              id="calendarFeedUrl"
              readOnly
              value={calendarFeedQuery.data?.feed_url ?? ""}
              placeholder={
                calendarFeedQuery.isPending
                  ? m.settings_calendar_feed_loading()
                  : m.settings_calendar_feed_unavailable()
              }
            />
            <Button
              variant="outline-primary"
              size="sm"
              disabled={!calendarFeedQuery.data?.feed_url}
              onClick={() => void copyCalendarFeedUrl()}
            >
              {m.settings_calendar_feed_copy()}
            </Button>
          </InputGroup>
          <div className="tw:flex tw:gap-2 tw:items-center tw:flex-wrap">
            <Button
              variant="outline-danger"
              size="sm"
              disabled={regenerateCalendarFeedMutation.isPending}
              onClick={() => void onRegenerateCalendarFeed()}
            >
              {regenerateCalendarFeedMutation.isPending
                ? m.settings_calendar_regenerating()
                : m.settings_calendar_regenerate()}
            </Button>
            <small className="tw:text-muted-foreground">
              {m.settings_calendar_rotate_warning()}
            </small>
          </div>
          {calendarFeedQuery.error ? (
            <div className="tw:text-danger tw:text-small">
              {apiErrorMessage(calendarFeedQuery.error, m.settings_calendar_load_error())}
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
        </CardContent>
      </Card>
    </>
  );
}
