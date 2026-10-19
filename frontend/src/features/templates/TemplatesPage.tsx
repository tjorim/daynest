import { useMemo, useRef, useState } from "react";
import * as m from "@/paraglide/messages";
import { FeedbackBanner } from "@/components/common/FeedbackBanner";
import { isRetryableApiError } from "@/lib/api/http";
import { formatDate } from "@/lib/dateUtils";
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
import { apiErrorMessage } from "@/lib/api/errorMessages";

import { TemplateEditor, type TemplateEditorState } from "./TemplateEditor";

export function TemplatesPage() {
  const [routineSubmitError, setRoutineSubmitError] = useState<string | null>(null);
  const [choreSubmitError, setChoreSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isRoutineSubmitting, setIsRoutineSubmitting] = useState(false);
  const [isChoreSubmitting, setIsChoreSubmitting] = useState(false);
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
  const loading = routinesQuery.isPending || choresQuery.isPending || analyticsQuery.isPending;
  const refreshing =
    (routinesQuery.isFetching || choresQuery.isFetching || analyticsQuery.isFetching) && !loading;
  const queryError = routinesQuery.error ?? choresQuery.error ?? analyticsQuery.error;
  const error = queryError ? apiErrorMessage(queryError, m.load_templates_failed()) : null;
  const canRetry = queryError ? isRetryableApiError(queryError) : false;

  const routineStreakMap = useMemo(
    () => new Map(analytics?.routines.streaks.map((s) => [s.routine_id, s]) ?? []),
    [analytics],
  );
  const choreStreakMap = useMemo(
    () => new Map(analytics?.chores.streaks.map((s) => [s.chore_id, s]) ?? []),
    [analytics],
  );

  const [editor, setEditor] = useState<TemplateEditorState | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const openEditor = (next: TemplateEditorState, trigger: HTMLElement) => {
    returnFocus.current = trigger;
    setSuccessMessage(null);
    setEditor(next);
  };
  const [confirmDeleteRoutineId, setConfirmDeleteRoutineId] = useState<number | null>(null);
  const [confirmDeleteChoreId, setConfirmDeleteChoreId] = useState<number | null>(null);
  const loadTemplates = async () => {
    await Promise.all([routinesQuery.refetch(), choresQuery.refetch(), analyticsQuery.refetch()]);
  };

  const handleDeleteRoutine = async (routineId: number) => {
    setConfirmDeleteRoutineId(null);
    setIsRoutineSubmitting(true);
    setRoutineSubmitError(null);
    setSuccessMessage(null);
    try {
      await deleteRoutineMutation.mutateAsync(routineId);
      setSuccessMessage(m.templates_routine_deleted());
    } catch (err) {
      setRoutineSubmitError(apiErrorMessage(err, m.templates_routine_delete_failed()));
    } finally {
      setIsRoutineSubmitting(false);
    }
  };

  const handleDeleteChore = async (choreId: number) => {
    setConfirmDeleteChoreId(null);
    setIsChoreSubmitting(true);
    setChoreSubmitError(null);
    setSuccessMessage(null);
    try {
      await deleteChoreMutation.mutateAsync(choreId);
      setSuccessMessage(m.templates_chore_deleted());
    } catch (err) {
      setChoreSubmitError(apiErrorMessage(err, m.templates_chore_delete_failed()));
    } finally {
      setIsChoreSubmitting(false);
    }
  };

  return (
    <section>
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2 mb-2">
        <h2 className="h4 mb-0">{m.templates_title()}</h2>
        <button
          type="button"
          className="btn btn-outline-primary btn-sm"
          disabled={loading || refreshing}
          onClick={() => void loadTemplates()}
        >
          {refreshing ? (
            <span
              className="spinner-border spinner-border-sm me-1"
              role="status"
              aria-hidden="true"
            />
          ) : null}
          {m.action_refresh()}
        </button>
      </div>
      <p className="text-muted mb-3">{m.templates_subtitle()}</p>

      <FeedbackBanner message={loading ? m.templates_loading() : null} tone="info" />
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
      <FeedbackBanner
        message={successMessage}
        tone="success"
        onDismiss={() => setSuccessMessage(null)}
      />

      <div className="row g-3">
        <div className="col-xl-6">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center gap-2 py-2">
              <span className="fw-semibold">{m.templates_routine_list_header()}</span>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={(event) => openEditor({ kind: "routine" }, event.currentTarget)}
              >
                {m.templates_new_routine()}
              </button>
            </div>
            <FeedbackBanner
              message={routineSubmitError}
              tone="danger"
              onDismiss={() => setRoutineSubmitError(null)}
            />
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
                            <span
                              className="badge text-bg-warning"
                              title={m.templates_best_streak({ count: streak.longest_streak })}
                            >
                              🔥 {streak.current_streak}
                            </span>
                          ) : null;
                        })()}
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm"
                          onClick={(event) =>
                            openEditor({ kind: "routine", template: routine }, event.currentTarget)
                          }
                        >
                          {m.action_edit()}
                        </button>
                        {confirmDeleteRoutineId === routine.id ? (
                          <div className="d-flex gap-1">
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              disabled={isRoutineSubmitting}
                              onClick={() => void handleDeleteRoutine(routine.id)}
                            >
                              {m.action_confirm()}
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline-secondary btn-sm"
                              disabled={isRoutineSubmitting}
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
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center gap-2 py-2">
              <span className="fw-semibold">{m.templates_chore_list_header()}</span>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={(event) => openEditor({ kind: "chore" }, event.currentTarget)}
              >
                {m.templates_new_chore()}
              </button>
            </div>
            <FeedbackBanner
              message={choreSubmitError}
              tone="danger"
              onDismiss={() => setChoreSubmitError(null)}
            />
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
                            <span
                              className="badge text-bg-warning"
                              title={m.templates_best_streak({ count: streak.longest_streak })}
                            >
                              🔥 {streak.current_streak}
                            </span>
                          ) : null;
                        })()}
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm"
                          onClick={(event) =>
                            openEditor({ kind: "chore", template: chore }, event.currentTarget)
                          }
                        >
                          {m.action_edit()}
                        </button>
                        {confirmDeleteChoreId === chore.id ? (
                          <div className="d-flex gap-1">
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              disabled={isChoreSubmitting}
                              onClick={() => void handleDeleteChore(chore.id)}
                            >
                              {m.action_confirm()}
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline-secondary btn-sm"
                              disabled={isChoreSubmitting}
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
      {editor ? (
        <TemplateEditor
          editor={editor}
          returnFocus={returnFocus}
          onClose={() => setEditor(null)}
          onSave={async (input) => {
            if (editor.kind === "routine") {
              if (editor.template)
                await updateRoutineMutation.mutateAsync({
                  routineTemplateId: editor.template.id,
                  input,
                });
              else await createRoutineMutation.mutateAsync(input);
              setSuccessMessage(
                editor.template ? m.templates_routine_updated() : m.templates_routine_created(),
              );
            } else {
              if (editor.template)
                await updateChoreMutation.mutateAsync({
                  choreTemplateId: editor.template.id,
                  input,
                });
              else await createChoreMutation.mutateAsync(input);
              setSuccessMessage(
                editor.template ? m.templates_chore_updated() : m.templates_chore_created(),
              );
            }
          }}
        />
      ) : null}
    </section>
  );
}
