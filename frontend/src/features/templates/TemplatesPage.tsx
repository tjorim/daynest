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
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Alert } from "@/components/ui/alert";
import { Card, CardHeader } from "@/components/ui/card";
import { ListGroup, ListGroupItem } from "@/components/ui/list-group";
import { Badge } from "@/components/ui/badge";

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
      <div className="tw:flex tw:flex-col tw:md:flex-row tw:justify-between tw:items-start tw:md:items-center tw:gap-2 tw:mb-2">
        <h2 className="tw:text-h4 tw:font-medium tw:mb-0">{m.templates_title()}</h2>
        <Button
          variant="outline-primary"
          size="sm"
          disabled={loading || refreshing}
          onClick={() => void loadTemplates()}
        >
          {refreshing ? <Spinner className="tw:me-1" role="status" /> : null}
          {m.action_refresh()}
        </Button>
      </div>
      <p className="tw:text-muted-foreground tw:mb-4">{m.templates_subtitle()}</p>

      <FeedbackBanner message={loading ? m.templates_loading() : null} tone="info" />
      {error ? (
        <Alert
          variant="danger"
          className="tw:py-2 tw:flex tw:justify-between tw:items-center tw:gap-2 tw:flex-wrap"
        >
          <span>{error}</span>
          {canRetry ? (
            <Button variant="danger" size="sm" onClick={() => void loadTemplates()}>
              {m.action_retry()}
            </Button>
          ) : null}
        </Alert>
      ) : null}
      <FeedbackBanner
        message={successMessage}
        tone="success"
        onDismiss={() => setSuccessMessage(null)}
      />

      <div className="tw:grid tw:grid-cols-12 tw:gap-4">
        <div className="tw:col-span-12 tw:xl:col-span-6">
          <Card>
            <CardHeader className="tw:flex tw:justify-between tw:items-center tw:gap-2 tw:py-2">
              <span className="tw:font-semibold">{m.templates_routine_list_header()}</span>
              <Button
                size="sm"
                onClick={(event) => openEditor({ kind: "routine" }, event.currentTarget)}
              >
                {m.templates_new_routine()}
              </Button>
            </CardHeader>
            <FeedbackBanner
              message={routineSubmitError}
              tone="danger"
              onDismiss={() => setRoutineSubmitError(null)}
            />
            <ListGroup flush render={<ul />}>
              {routines.length === 0 ? (
                <ListGroupItem render={<li />} className="tw:py-2 tw:text-muted-foreground">
                  {m.templates_no_routines()}
                </ListGroupItem>
              ) : (
                routines.map((routine) => (
                  <ListGroupItem render={<li />} className="tw:py-2" key={routine.id}>
                    <div className="tw:flex tw:justify-between tw:items-start tw:gap-4">
                      <div>
                        <div className="tw:font-semibold">{routine.name}</div>
                        {routine.description ? (
                          <small className="tw:block">{routine.description}</small>
                        ) : null}
                        <small className="tw:text-muted-foreground tw:block">
                          {m.templates_starts({ date: formatDate(routine.start_date) })} •{" "}
                          {routine.every_n_days === 1
                            ? m.templates_every_day({ count: routine.every_n_days })
                            : m.templates_every_days({ count: routine.every_n_days })}
                          {routine.due_time ? ` • ${routine.due_time.slice(0, 5)}` : ""}
                        </small>
                        <small className="tw:text-muted-foreground tw:block">
                          {m.templates_created({ date: formatDate(routine.created_at) })}
                        </small>
                      </div>
                      <div className="tw:grid tw:gap-2">
                        <Badge variant={routine.is_active ? "success" : "secondary"}>
                          {routine.is_active ? m.status_active() : m.status_inactive()}
                        </Badge>
                        {(() => {
                          const streak = routineStreakMap.get(routine.id);
                          return streak && streak.current_streak > 0 ? (
                            <Badge
                              variant="warning"
                              title={m.templates_best_streak({ count: streak.longest_streak })}
                            >
                              🔥 {streak.current_streak}
                            </Badge>
                          ) : null;
                        })()}
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={(event) =>
                            openEditor({ kind: "routine", template: routine }, event.currentTarget)
                          }
                        >
                          {m.action_edit()}
                        </Button>
                        {confirmDeleteRoutineId === routine.id ? (
                          <div className="tw:flex tw:gap-1">
                            <Button
                              variant="danger"
                              size="sm"
                              disabled={isRoutineSubmitting}
                              onClick={() => void handleDeleteRoutine(routine.id)}
                            >
                              {m.action_confirm()}
                            </Button>
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              disabled={isRoutineSubmitting}
                              onClick={() => setConfirmDeleteRoutineId(null)}
                            >
                              {m.action_cancel()}
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() => setConfirmDeleteRoutineId(routine.id)}
                          >
                            {m.action_delete()}
                          </Button>
                        )}
                      </div>
                    </div>
                  </ListGroupItem>
                ))
              )}
            </ListGroup>
          </Card>
        </div>

        <div className="tw:col-span-12 tw:xl:col-span-6">
          <Card>
            <CardHeader className="tw:flex tw:justify-between tw:items-center tw:gap-2 tw:py-2">
              <span className="tw:font-semibold">{m.templates_chore_list_header()}</span>
              <Button
                size="sm"
                onClick={(event) => openEditor({ kind: "chore" }, event.currentTarget)}
              >
                {m.templates_new_chore()}
              </Button>
            </CardHeader>
            <FeedbackBanner
              message={choreSubmitError}
              tone="danger"
              onDismiss={() => setChoreSubmitError(null)}
            />
            <ListGroup flush render={<ul />}>
              {chores.length === 0 ? (
                <ListGroupItem render={<li />} className="tw:py-2 tw:text-muted-foreground">
                  {m.templates_no_chores()}
                </ListGroupItem>
              ) : (
                chores.map((chore) => (
                  <ListGroupItem render={<li />} className="tw:py-2" key={chore.id}>
                    <div className="tw:flex tw:justify-between tw:items-start tw:gap-4">
                      <div>
                        <div className="tw:font-semibold">{chore.name}</div>
                        {chore.description ? (
                          <small className="tw:block">{chore.description}</small>
                        ) : null}
                        <small className="tw:text-muted-foreground tw:block">
                          {m.templates_starts({ date: formatDate(chore.start_date) })} •{" "}
                          {chore.every_n_days === 1
                            ? m.templates_every_day({ count: chore.every_n_days })
                            : m.templates_every_days({ count: chore.every_n_days })}
                        </small>
                      </div>
                      <div className="tw:grid tw:gap-2">
                        <Badge variant={chore.is_active ? "success" : "secondary"}>
                          {chore.is_active ? m.status_active() : m.status_inactive()}
                        </Badge>
                        {(() => {
                          const streak = choreStreakMap.get(chore.id);
                          return streak && streak.current_streak > 0 ? (
                            <Badge
                              variant="warning"
                              title={m.templates_best_streak({ count: streak.longest_streak })}
                            >
                              🔥 {streak.current_streak}
                            </Badge>
                          ) : null;
                        })()}
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={(event) =>
                            openEditor({ kind: "chore", template: chore }, event.currentTarget)
                          }
                        >
                          {m.action_edit()}
                        </Button>
                        {confirmDeleteChoreId === chore.id ? (
                          <div className="tw:flex tw:gap-1">
                            <Button
                              variant="danger"
                              size="sm"
                              disabled={isChoreSubmitting}
                              onClick={() => void handleDeleteChore(chore.id)}
                            >
                              {m.action_confirm()}
                            </Button>
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              disabled={isChoreSubmitting}
                              onClick={() => setConfirmDeleteChoreId(null)}
                            >
                              {m.action_cancel()}
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() => setConfirmDeleteChoreId(chore.id)}
                          >
                            {m.action_delete()}
                          </Button>
                        )}
                      </div>
                    </div>
                  </ListGroupItem>
                ))
              )}
            </ListGroup>
          </Card>
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
