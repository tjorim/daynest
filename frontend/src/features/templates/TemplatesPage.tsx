import { useMemo, useState } from "react";
import * as m from "@/paraglide/messages";
import {
  isRetryableApiError,
} from "@/lib/api/today";
import { formatDate, toIsoDate } from "@/lib/dateUtils";
import {
  useChoreTemplatesQuery,
  useCreateChoreTemplateMutation,
  useCreateRoutineTemplateMutation,
  useDeleteChoreTemplateMutation,
  useDeleteRoutineTemplateMutation,
  useRoutineTemplatesQuery,
  useTemplateAnalyticsQuery,
  useUpdateChoreTemplateMutation,
  useUpdateRoutineTemplateMutation,
} from "@/features/templates/useTemplateQueries";

export function TemplatesPage() {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const routinesQuery = useRoutineTemplatesQuery();
  const choresQuery = useChoreTemplatesQuery();
  const analyticsQuery = useTemplateAnalyticsQuery();
  const createRoutineMutation = useCreateRoutineTemplateMutation();
  const updateRoutineMutation = useUpdateRoutineTemplateMutation();
  const deleteRoutineMutation = useDeleteRoutineTemplateMutation();
  const createChoreMutation = useCreateChoreTemplateMutation();
  const updateChoreMutation = useUpdateChoreTemplateMutation();
  const deleteChoreMutation = useDeleteChoreTemplateMutation();
  const routines = routinesQuery.data ?? [];
  const chores = choresQuery.data ?? [];
  const analytics = analyticsQuery.data ?? null;
  const loading = routinesQuery.isPending || choresQuery.isPending;
  const queryError = routinesQuery.error ?? choresQuery.error;
  const error = queryError instanceof Error ? queryError.message : queryError ? "Unable to load template data." : null;
  const canRetry = queryError ? isRetryableApiError(queryError) : false;

  const routineStreakMap = useMemo(
    () => new Map(analytics?.routines.streaks.map((s) => [s.routine_id, s]) ?? []),
    [analytics],
  );
  const choreStreakMap = useMemo(
    () => new Map(analytics?.chores.streaks.map((s) => [s.chore_id, s]) ?? []),
    [analytics],
  );

  const [routineName, setRoutineName] = useState("");
  const [routineDescription, setRoutineDescription] = useState("");
  const [routineStartDate, setRoutineStartDate] = useState(() => toIsoDate(new Date()));
  const [routineEveryNDays, setRoutineEveryNDays] = useState("1");
  const [routineDueTime, setRoutineDueTime] = useState("08:00");
  const [routineActive, setRoutineActive] = useState(true);
  const [editingRoutineId, setEditingRoutineId] = useState<number | null>(null);
  const [confirmDeleteRoutineId, setConfirmDeleteRoutineId] = useState<number | null>(null);
  const [confirmDeleteChoreId, setConfirmDeleteChoreId] = useState<number | null>(null);

  const [choreName, setChoreName] = useState("");
  const [choreDescription, setChoreDescription] = useState("");
  const [choreStartDate, setChoreStartDate] = useState(() => toIsoDate(new Date()));
  const [choreEveryNDays, setChoreEveryNDays] = useState("7");
  const [choreActive, setChoreActive] = useState(true);
  const [editingChoreId, setEditingChoreId] = useState<number | null>(null);

  const loadTemplates = async () => {
    await Promise.all([routinesQuery.refetch(), choresQuery.refetch()]);
  };

  const resetRoutineForm = () => {
    setEditingRoutineId(null);
    setRoutineName("");
    setRoutineDescription("");
    setRoutineStartDate(toIsoDate(new Date()));
    setRoutineEveryNDays("1");
    setRoutineDueTime("08:00");
    setRoutineActive(true);
  };

  const resetChoreForm = () => {
    setEditingChoreId(null);
    setChoreName("");
    setChoreDescription("");
    setChoreStartDate(toIsoDate(new Date()));
    setChoreEveryNDays("7");
    setChoreActive(true);
  };

  const submitRoutine = async () => {
    if (!routineName.trim()) {
      setSubmitError(m.templates_routine_name_required());
      return;
    }
    const everyNDaysRoutine = parseInt(routineEveryNDays, 10);
    if (!Number.isInteger(everyNDaysRoutine) || everyNDaysRoutine < 1) {
      setSubmitError(m.templates_every_n_error());
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);
    try {
      const payload = {
        name: routineName.trim(),
        description: routineDescription.trim() || null,
        start_date: routineStartDate,
        every_n_days: everyNDaysRoutine,
        due_time: routineDueTime ? `${routineDueTime}:00` : null,
        is_active: routineActive,
      };
      if (editingRoutineId !== null) {
        await updateRoutineMutation.mutateAsync({ routineTemplateId: editingRoutineId, input: payload });
      } else {
        await createRoutineMutation.mutateAsync(payload);
      }
      resetRoutineForm();
      setSuccessMessage(
        editingRoutineId !== null ? m.templates_routine_updated() : m.templates_routine_created(),
      );
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : m.templates_routine_save_failed());
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitChore = async () => {
    if (!choreName.trim()) {
      setSubmitError(m.templates_chore_name_required());
      return;
    }
    const everyNDaysChore = parseInt(choreEveryNDays, 10);
    if (!Number.isInteger(everyNDaysChore) || everyNDaysChore < 1) {
      setSubmitError(m.templates_every_n_error());
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);
    try {
      const payload = {
        name: choreName.trim(),
        description: choreDescription.trim() || null,
        start_date: choreStartDate,
        every_n_days: everyNDaysChore,
        is_active: choreActive,
      };
      if (editingChoreId !== null) {
        await updateChoreMutation.mutateAsync({ choreTemplateId: editingChoreId, input: payload });
      } else {
        await createChoreMutation.mutateAsync(payload);
      }
      resetChoreForm();
      setSuccessMessage(
        editingChoreId !== null ? m.templates_chore_updated() : m.templates_chore_created(),
      );
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : m.templates_chore_save_failed());
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRoutine = async (routineId: number) => {
    setConfirmDeleteRoutineId(null);
    setIsSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);
    try {
      await deleteRoutineMutation.mutateAsync(routineId);
      if (editingRoutineId === routineId) resetRoutineForm();
      setSuccessMessage(m.templates_routine_deleted());
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : m.templates_routine_delete_failed());
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteChore = async (choreId: number) => {
    setConfirmDeleteChoreId(null);
    setIsSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);
    try {
      await deleteChoreMutation.mutateAsync(choreId);
      if (editingChoreId === choreId) resetChoreForm();
      setSuccessMessage(m.templates_chore_deleted());
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : m.templates_chore_delete_failed());
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section>
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2 mb-2">
        <h2 className="h4 mb-0">{m.templates_title()}</h2>
        <button
          type="button"
          className="btn btn-outline-primary btn-sm"
          disabled={loading}
          onClick={() => void loadTemplates()}
        >
          {m.action_refresh()}
        </button>
      </div>
      <p className="text-muted mb-3">
        {m.templates_subtitle()}
      </p>

      {loading ? <div className="alert alert-info py-2">{m.templates_loading()}</div> : null}
      {error ? (
        <div className="alert alert-danger py-2 d-flex justify-content-between align-items-center gap-2 flex-wrap">
          <span>{error}</span>
          {canRetry ? (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => void loadTemplates()}
            >
              {m.action_retry()}
            </button>
          ) : null}
        </div>
      ) : null}
      {submitError ? <div className="alert alert-danger py-2">{submitError}</div> : null}
      {successMessage ? <div className="alert alert-success py-2">{successMessage}</div> : null}

      <div className="row g-3">
        <div className="col-xl-6">
          <div className="card mb-3">
            <div className="card-header fw-semibold py-2">{m.templates_routine_form_header()}</div>
            <div className="card-body d-grid gap-2">
              <input
                className="form-control"
                value={routineName}
                onChange={(event) => setRoutineName(event.target.value)}
                placeholder={m.templates_routine_name_placeholder()}
              />
              <textarea
                className="form-control"
                rows={3}
                value={routineDescription}
                onChange={(event) => setRoutineDescription(event.target.value)}
                placeholder={m.templates_description_placeholder()}
              />
              <div className="row g-2">
                <div className="col-sm-6">
                  <label className="form-label small fw-semibold mb-1">{m.templates_start_date_label()}</label>
                  <input
                    className="form-control"
                    type="date"
                    value={routineStartDate}
                    onChange={(event) => setRoutineStartDate(event.target.value)}
                  />
                </div>
                <div className="col-sm-6">
                  <label className="form-label small fw-semibold mb-1">{m.templates_every_n_days_label()}</label>
                  <input
                    className="form-control"
                    type="number"
                    min={1}
                    value={routineEveryNDays}
                    onChange={(event) => setRoutineEveryNDays(event.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="form-label small fw-semibold mb-1">{m.templates_due_time_label()}</label>
                <input
                  className="form-control"
                  type="time"
                  value={routineDueTime}
                  onChange={(event) => setRoutineDueTime(event.target.value)}
                />
              </div>
              <label className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={routineActive}
                  onChange={(event) => setRoutineActive(event.target.checked)}
                />
                <span className="form-check-label">{m.templates_active_label()}</span>
              </label>
              <div className="d-flex gap-2 flex-column flex-sm-row">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                  onClick={() => void submitRoutine()}
                >
                  {isSubmitting
                    ? editingRoutineId !== null
                      ? m.action_saving()
                      : m.action_creating()
                    : editingRoutineId !== null
                      ? m.templates_save_routine()
                      : m.templates_create_routine()}
                </button>
                {editingRoutineId !== null ? (
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    disabled={isSubmitting}
                    onClick={resetRoutineForm}
                  >
                    {m.templates_cancel_edit()}
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header fw-semibold py-2">{m.templates_routine_list_header()}</div>
            <ul className="list-group list-group-flush">
              {routines.length === 0 ? (
                <li className="list-group-item py-2 text-muted">{m.templates_no_routines()}</li>
              ) : (
                routines.map((routine) => (
                  <li key={routine.id} className="list-group-item py-2">
                    <div className="d-flex justify-content-between align-items-start gap-3">
                      <div>
                        <div className="fw-semibold">{routine.name}</div>
                        {routine.description ? (
                          <small className="d-block">{routine.description}</small>
                        ) : null}
                        <small className="text-muted d-block">
                          {m.templates_starts({ date: formatDate(routine.start_date) })} •{" "}
                          {routine.every_n_days === 1
                            ? m.templates_every_day({ count: routine.every_n_days })
                            : m.templates_every_days({ count: routine.every_n_days })}
                          {routine.due_time ? ` • ${routine.due_time.slice(0, 5)}` : ""}
                        </small>
                        <small className="text-muted d-block">
                          {m.templates_created({ date: formatDate(routine.created_at) })}
                        </small>
                      </div>
                      <div className="d-grid gap-2">
                        <span
                          className={`badge ${routine.is_active ? "text-bg-success" : "text-bg-secondary"}`}
                        >
                          {routine.is_active ? m.status_active() : m.status_inactive()}
                        </span>
                        {(() => {
                          const streak = routineStreakMap.get(routine.id);
                          return streak && streak.current_streak > 0 ? (
                            <span className="badge text-bg-warning" title={`Best: ${streak.longest_streak}`}>
                              🔥 {streak.current_streak}
                            </span>
                          ) : null;
                        })()}
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm"
                          onClick={() => {
                            setEditingRoutineId(routine.id);
                            setRoutineName(routine.name);
                            setRoutineDescription(routine.description ?? "");
                            setRoutineStartDate(routine.start_date);
                            setRoutineEveryNDays(String(routine.every_n_days));
                            setRoutineDueTime(routine.due_time ? routine.due_time.slice(0, 5) : "");
                            setRoutineActive(routine.is_active);
                            setConfirmDeleteRoutineId(null);
                            setSubmitError(null);
                          }}
                        >
                          {m.action_edit()}
                        </button>
                        {confirmDeleteRoutineId === routine.id ? (
                          <div className="d-flex gap-1">
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              disabled={isSubmitting}
                              onClick={() => void handleDeleteRoutine(routine.id)}
                            >
                              {m.action_confirm()}
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline-secondary btn-sm"
                              disabled={isSubmitting}
                              onClick={() => setConfirmDeleteRoutineId(null)}
                            >
                              {m.action_cancel()}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-outline-danger btn-sm"
                            onClick={() => setConfirmDeleteRoutineId(routine.id)}
                          >
                            {m.action_delete()}
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>

        <div className="col-xl-6">
          <div className="card mb-3">
            <div className="card-header fw-semibold py-2">{m.templates_chore_form_header()}</div>
            <div className="card-body d-grid gap-2">
              <input
                className="form-control"
                value={choreName}
                onChange={(event) => setChoreName(event.target.value)}
                placeholder={m.templates_chore_name_placeholder()}
              />
              <textarea
                className="form-control"
                rows={3}
                value={choreDescription}
                onChange={(event) => setChoreDescription(event.target.value)}
                placeholder={m.templates_description_placeholder()}
              />
              <div className="row g-2">
                <div className="col-sm-6">
                  <label className="form-label small fw-semibold mb-1">{m.templates_start_date_label()}</label>
                  <input
                    className="form-control"
                    type="date"
                    value={choreStartDate}
                    onChange={(event) => setChoreStartDate(event.target.value)}
                  />
                </div>
                <div className="col-sm-6">
                  <label className="form-label small fw-semibold mb-1">{m.templates_every_n_days_label()}</label>
                  <input
                    className="form-control"
                    type="number"
                    min={1}
                    value={choreEveryNDays}
                    onChange={(event) => setChoreEveryNDays(event.target.value)}
                  />
                </div>
              </div>
              <label className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={choreActive}
                  onChange={(event) => setChoreActive(event.target.checked)}
                />
                <span className="form-check-label">{m.templates_active_label()}</span>
              </label>
              <div className="d-flex gap-2 flex-column flex-sm-row">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                  onClick={() => void submitChore()}
                >
                  {isSubmitting
                    ? editingChoreId !== null
                      ? m.action_saving()
                      : m.action_creating()
                    : editingChoreId !== null
                      ? m.templates_save_chore()
                      : m.templates_create_chore()}
                </button>
                {editingChoreId !== null ? (
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    disabled={isSubmitting}
                    onClick={resetChoreForm}
                  >
                    {m.templates_cancel_edit()}
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header fw-semibold py-2">{m.templates_chore_list_header()}</div>
            <ul className="list-group list-group-flush">
              {chores.length === 0 ? (
                <li className="list-group-item py-2 text-muted">{m.templates_no_chores()}</li>
              ) : (
                chores.map((chore) => (
                  <li key={chore.id} className="list-group-item py-2">
                    <div className="d-flex justify-content-between align-items-start gap-3">
                      <div>
                        <div className="fw-semibold">{chore.name}</div>
                        {chore.description ? (
                          <small className="d-block">{chore.description}</small>
                        ) : null}
                        <small className="text-muted d-block">
                          {m.templates_starts({ date: formatDate(chore.start_date) })} •{" "}
                          {chore.every_n_days === 1
                            ? m.templates_every_day({ count: chore.every_n_days })
                            : m.templates_every_days({ count: chore.every_n_days })}
                        </small>
                      </div>
                      <div className="d-grid gap-2">
                        <span
                          className={`badge ${chore.is_active ? "text-bg-success" : "text-bg-secondary"}`}
                        >
                          {chore.is_active ? m.status_active() : m.status_inactive()}
                        </span>
                        {(() => {
                          const streak = choreStreakMap.get(chore.id);
                          return streak && streak.current_streak > 0 ? (
                            <span className="badge text-bg-warning" title={`Best: ${streak.longest_streak}`}>
                              🔥 {streak.current_streak}
                            </span>
                          ) : null;
                        })()}
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm"
                          onClick={() => {
                            setEditingChoreId(chore.id);
                            setChoreName(chore.name);
                            setChoreDescription(chore.description ?? "");
                            setChoreStartDate(chore.start_date);
                            setChoreEveryNDays(String(chore.every_n_days));
                            setChoreActive(chore.is_active);
                            setConfirmDeleteChoreId(null);
                            setSubmitError(null);
                          }}
                        >
                          {m.action_edit()}
                        </button>
                        {confirmDeleteChoreId === chore.id ? (
                          <div className="d-flex gap-1">
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              disabled={isSubmitting}
                              onClick={() => void handleDeleteChore(chore.id)}
                            >
                              {m.action_confirm()}
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline-secondary btn-sm"
                              disabled={isSubmitting}
                              onClick={() => setConfirmDeleteChoreId(null)}
                            >
                              {m.action_cancel()}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-outline-danger btn-sm"
                            onClick={() => setConfirmDeleteChoreId(chore.id)}
                          >
                            {m.action_delete()}
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
