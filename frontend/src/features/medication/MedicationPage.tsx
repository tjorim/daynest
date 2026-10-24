import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import * as m from "@/paraglide/messages";
import { isRetryableApiError } from "@/lib/api/http";
import { type MedicationPlan, type MedicationPlanUpdateInput } from "@/lib/api/medications";
import { formatDate, formatDateTime } from "@/lib/dateUtils";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogCloseButton,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useCreateMedicationPlanMutation,
  useDeleteMedicationPlanMutation,
  useMedicationHistoryQuery,
  useMedicationPlansQuery,
  useUpdateMedicationPlanMutation,
} from "@/features/medication/useMedicationQueries";
import { apiErrorMessage } from "@/lib/api/errorMessages";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Card, CardFooter, CardHeader } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/field";
import { ListGroup, ListGroupItem } from "@/components/ui/list-group";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

const medicationPlanFormSchema = z.object({
  name: z.string().trim().min(1),
  instructions: z.string().trim().min(1),
  startDate: z.string().trim().min(1),
  scheduleTime: z.string().trim().min(1),
  everyNDays: z.coerce.number().int().min(1),
  isActive: z.boolean().optional(),
});

type MedicationPlanFormValues = {
  name: string;
  instructions: string;
  startDate: string;
  scheduleTime: string;
  everyNDays: string;
  isActive?: boolean;
};

function todayLocalDate(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function toMedicationPlanInput(values: MedicationPlanFormValues): {
  input: MedicationPlanUpdateInput | null;
  error: string | null;
} {
  const parsed = medicationPlanFormSchema.safeParse(values);
  if (!parsed.success) {
    const hasEveryNDaysIssue = parsed.error.issues.some((issue) =>
      issue.path.includes("everyNDays"),
    );
    return {
      input: null,
      error: hasEveryNDaysIssue ? m.medication_every_n_error() : m.medication_required_fields(),
    };
  }

  const { name, instructions, startDate, scheduleTime, everyNDays, isActive } = parsed.data;
  return {
    input: {
      name: name.trim(),
      instructions: instructions.trim(),
      start_date: startDate,
      schedule_time: scheduleTime.length === 5 ? `${scheduleTime}:00` : scheduleTime,
      every_n_days: everyNDays,
      is_active: isActive ?? true,
    },
    error: null,
  };
}

export function MedicationPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editingPlan, setEditingPlan] = useState<MedicationPlan | null>(null);
  const [deletingPlanId, setDeletingPlanId] = useState<number | null>(null);

  const plansQuery = useMedicationPlansQuery();
  const historyQuery = useMedicationHistoryQuery();
  const createPlanMutation = useCreateMedicationPlanMutation();
  const updatePlanMutation = useUpdateMedicationPlanMutation();
  const deletePlanMutation = useDeleteMedicationPlanMutation();

  const plans = plansQuery.data ?? [];
  const history = historyQuery.data ?? [];
  const loading = plansQuery.isPending || historyQuery.isPending;
  const queryError = plansQuery.error ?? historyQuery.error;
  const error = queryError ? apiErrorMessage(queryError, m.load_medication_failed()) : null;
  const canRetry = queryError ? isRetryableApiError(queryError) : false;

  const createForm = useForm({
    defaultValues: {
      name: "",
      instructions: "",
      startDate: todayLocalDate(),
      scheduleTime: "09:00",
      everyNDays: "1",
    },
    onSubmit: async ({ value, formApi }) => {
      const parsed = toMedicationPlanInput(value);
      if (parsed.error || !parsed.input) {
        setSubmitError(parsed.error ?? m.medication_create_failed());
        return;
      }

      setIsSubmitting(true);
      setSubmitError(null);
      setSuccessMessage(null);

      try {
        await createPlanMutation.mutateAsync(parsed.input);
        formApi.reset({
          name: "",
          instructions: "",
          startDate: todayLocalDate(),
          scheduleTime: "09:00",
          everyNDays: "1",
        });
        setSuccessMessage(m.medication_plan_created());
      } catch (err) {
        setSubmitError(apiErrorMessage(err, m.medication_create_failed()));
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  const loadMedication = async () => {
    await Promise.all([plansQuery.refetch(), historyQuery.refetch()]);
  };

  const onUpdatePlan = async (planId: number, input: MedicationPlanUpdateInput) => {
    setIsSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);

    try {
      await updatePlanMutation.mutateAsync({ planId, input });
      setEditingPlan(null);
      setSuccessMessage(m.medication_plan_updated());
    } catch (err) {
      setSubmitError(apiErrorMessage(err, m.medication_update_failed()));
    } finally {
      setIsSubmitting(false);
    }
  };

  const onDeletePlan = async (planId: number) => {
    setDeletingPlanId(planId);
    setSubmitError(null);
    setSuccessMessage(null);

    try {
      await deletePlanMutation.mutateAsync(planId);
      setSuccessMessage(m.medication_plan_deleted());
    } catch (err) {
      setSubmitError(apiErrorMessage(err, m.medication_delete_failed()));
    } finally {
      setDeletingPlanId(null);
    }
  };

  return (
    <section>
      <div className="tw:flex tw:flex-col tw:md:flex-row tw:justify-between tw:items-start tw:md:items-center tw:gap-2 tw:mb-2">
        <h2 className="tw:text-h4 tw:font-medium tw:mb-0">{m.medication_title()}</h2>
        <Button
          variant="outline-primary"
          size="sm"
          disabled={loading}
          onClick={() => void loadMedication()}
        >
          {m.action_refresh()}
        </Button>
      </div>
      <p className="tw:text-muted-foreground tw:mb-4">{m.medication_subtitle()}</p>

      {loading ? (
        <Alert variant="info" className="tw:py-2">
          {m.medication_loading()}
        </Alert>
      ) : null}
      {error ? (
        <Alert
          variant="danger"
          className="tw:py-2 tw:flex tw:justify-between tw:items-center tw:gap-2 tw:flex-wrap"
        >
          <span>{error}</span>
          {canRetry ? (
            <Button variant="danger" size="sm" onClick={() => void loadMedication()}>
              {m.action_retry()}
            </Button>
          ) : null}
        </Alert>
      ) : null}
      {successMessage ? (
        <Alert variant="success" className="tw:py-2">
          {successMessage}
        </Alert>
      ) : null}

      <div className="tw:grid tw:grid-cols-12 tw:gap-4">
        <div className="tw:col-span-12 tw:lg:col-span-5">
          <Card className="tw:mb-4">
            <CardHeader className="tw:font-semibold tw:py-2">
              {m.medication_create_plan_header()}
            </CardHeader>
            <form
              className="tw:grid tw:flex-auto tw:gap-2 tw:p-4"
              onSubmit={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void createForm.handleSubmit();
              }}
            >
              <createForm.Field
                name="name"
                children={(field) => (
                  <Input
                    value={field.value}
                    onChange={(event) => {
                      field.handleChange(event.target.value);
                      setSubmitError(null);
                      setSuccessMessage(null);
                    }}
                    placeholder={m.medication_name_placeholder()}
                    aria-label={m.medication_name_placeholder()}
                  />
                )}
              />
              <createForm.Field
                name="instructions"
                children={(field) => (
                  <Textarea
                    rows={3}
                    value={field.value}
                    onChange={(event) => {
                      field.handleChange(event.target.value);
                      setSubmitError(null);
                      setSuccessMessage(null);
                    }}
                    placeholder={m.medication_instructions_placeholder()}
                    aria-label={m.medication_instructions_placeholder()}
                  />
                )}
              />
              <div className="tw:grid tw:grid-cols-12 tw:gap-2">
                <div className="tw:col-span-12 tw:sm:col-span-6">
                  <Label className="tw:text-small tw:font-semibold tw:mb-1">
                    {m.medication_start_date_label()}
                  </Label>
                  <createForm.Field
                    name="startDate"
                    children={(field) => (
                      <Input
                        type="date"
                        value={field.value}
                        onChange={(event) => field.handleChange(event.target.value)}
                      />
                    )}
                  />
                </div>
                <div className="tw:col-span-12 tw:sm:col-span-6">
                  <Label className="tw:text-small tw:font-semibold tw:mb-1">
                    {m.medication_schedule_time_label()}
                  </Label>
                  <createForm.Field
                    name="scheduleTime"
                    children={(field) => (
                      <Input
                        type="time"
                        value={field.value}
                        onChange={(event) => field.handleChange(event.target.value)}
                      />
                    )}
                  />
                </div>
              </div>
              <div>
                <Label className="tw:text-small tw:font-semibold tw:mb-1">
                  {m.medication_every_n_days_label()}
                </Label>
                <createForm.Field
                  name="everyNDays"
                  children={(field) => (
                    <Input
                      type="number"
                      min={1}
                      value={field.value}
                      onChange={(event) => {
                        field.handleChange(event.target.value);
                        setSubmitError(null);
                        setSuccessMessage(null);
                      }}
                    />
                  )}
                />
              </div>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? m.action_creating() : m.medication_create_button()}
              </Button>
            </form>
            {submitError ? (
              <CardFooter className="tw:text-danger tw:py-2 tw:text-small">
                {submitError}
              </CardFooter>
            ) : null}
          </Card>

          <Card>
            <CardHeader className="tw:font-semibold tw:py-2">
              {m.medication_active_plans_header()}
            </CardHeader>
            <ListGroup flush render={<ul />}>
              {plans.length === 0 ? (
                <ListGroupItem render={<li />} className="tw:py-2 tw:text-muted-foreground">
                  {m.medication_no_plans()}
                </ListGroupItem>
              ) : (
                plans.map((plan) => (
                  <ListGroupItem render={<li />} className="tw:py-2" key={plan.id}>
                    <div className="tw:flex tw:justify-between tw:items-start tw:gap-4 tw:flex-col tw:sm:flex-row">
                      <div>
                        <div className="tw:font-semibold">{plan.name}</div>
                        <small className="tw:text-muted-foreground tw:block">
                          {m.medication_starts({ date: formatDate(plan.start_date) })} •{" "}
                          {plan.schedule_time.slice(0, 5)} •{" "}
                          {plan.every_n_days === 1
                            ? m.medication_every_day({ count: plan.every_n_days })
                            : m.medication_every_days({ count: plan.every_n_days })}
                        </small>
                        <small className="tw:block tw:mt-1">{plan.instructions}</small>
                      </div>
                      <div className="tw:flex tw:gap-2 tw:items-center tw:flex-wrap">
                        <Badge
                          variant={plan.is_active ? "success" : "secondary"}
                          className="tw:self-start"
                        >
                          {plan.is_active ? m.status_active() : m.status_inactive()}
                        </Badge>
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => setEditingPlan(plan)}
                        >
                          {m.action_edit()}
                        </Button>
                        <Button
                          variant="outline-danger"
                          size="sm"
                          disabled={deletingPlanId === plan.id}
                          onClick={() => void onDeletePlan(plan.id)}
                        >
                          {deletingPlanId === plan.id ? m.action_deleting() : m.action_delete()}
                        </Button>
                      </div>
                    </div>
                  </ListGroupItem>
                ))
              )}
            </ListGroup>
          </Card>
        </div>

        <div className="tw:col-span-12 tw:lg:col-span-7">
          <Card>
            <CardHeader className="tw:font-semibold tw:py-2">
              {m.medication_dose_history_header()}
            </CardHeader>
            <ListGroup flush render={<ul />}>
              {history.length === 0 ? (
                <ListGroupItem render={<li />} className="tw:py-2 tw:text-muted-foreground">
                  {m.medication_no_history()}
                </ListGroupItem>
              ) : (
                history.map((item) => (
                  <ListGroupItem
                    render={<li />}
                    className="tw:py-2"
                    key={item.medication_dose_instance_id}
                  >
                    <div className="tw:flex tw:justify-between tw:items-start tw:gap-4">
                      <div>
                        <div className="tw:font-semibold">{item.name}</div>
                        <small className="tw:text-muted-foreground tw:block">
                          {formatDateTime(item.scheduled_at)} • {item.status}
                        </small>
                        <small className="tw:block tw:mt-1">{item.instructions}</small>
                      </div>
                      <Badge
                        variant={
                          item.status === "taken"
                            ? "success"
                            : item.status === "scheduled"
                              ? "info"
                              : "secondary"
                        }
                      >
                        {item.status}
                      </Badge>
                    </div>
                  </ListGroupItem>
                ))
              )}
            </ListGroup>
          </Card>
        </div>
      </div>
      {editingPlan ? (
        <EditMedicationPlanDialog
          plan={editingPlan}
          isSubmitting={isSubmitting}
          onCancel={() => setEditingPlan(null)}
          onSubmit={(input) => void onUpdatePlan(editingPlan.id, input)}
        />
      ) : null}
    </section>
  );
}

function EditMedicationPlanDialog({
  plan,
  isSubmitting,
  onCancel,
  onSubmit,
}: {
  plan: MedicationPlan;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (input: MedicationPlanUpdateInput) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const editForm = useForm({
    defaultValues: {
      name: plan.name,
      instructions: plan.instructions,
      startDate: plan.start_date,
      scheduleTime: plan.schedule_time.slice(0, 5),
      everyNDays: String(plan.every_n_days),
      isActive: plan.is_active,
    },
    onSubmit: ({ value }) => {
      const parsed = toMedicationPlanInput(value);
      if (parsed.error || !parsed.input) {
        setError(parsed.error ?? m.medication_update_failed());
        return;
      }
      setError(null);
      onSubmit(parsed.input);
    },
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void editForm.handleSubmit();
          }}
        >
          <DialogHeader>
            <DialogTitle className="tw:text-h5 tw:font-medium tw:mb-0">
              {m.medication_edit_title()}
            </DialogTitle>
            <DialogCloseButton />
          </DialogHeader>
          <DialogBody className="tw:grid tw:gap-2">
            {error ? (
              <Alert variant="danger" className="tw:py-2">
                {error}
              </Alert>
            ) : null}
            <editForm.Field
              name="name"
              children={(field) => (
                <Input
                  value={field.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  aria-label={m.medication_name_placeholder()}
                />
              )}
            />
            <editForm.Field
              name="instructions"
              children={(field) => (
                <Textarea
                  rows={3}
                  value={field.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  aria-label={m.medication_instructions_placeholder()}
                />
              )}
            />
            <div className="tw:grid tw:grid-cols-12 tw:gap-2">
              <div className="tw:col-span-12 tw:sm:col-span-6">
                <Label
                  className="tw:text-small tw:font-semibold tw:mb-1"
                  htmlFor="edit-medication-start-date"
                >
                  {m.medication_start_date_label()}
                </Label>
                <editForm.Field
                  name="startDate"
                  children={(field) => (
                    <Input
                      id="edit-medication-start-date"
                      type="date"
                      value={field.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                    />
                  )}
                />
              </div>
              <div className="tw:col-span-12 tw:sm:col-span-6">
                <Label
                  className="tw:text-small tw:font-semibold tw:mb-1"
                  htmlFor="edit-medication-schedule-time"
                >
                  {m.medication_schedule_time_label()}
                </Label>
                <editForm.Field
                  name="scheduleTime"
                  children={(field) => (
                    <Input
                      id="edit-medication-schedule-time"
                      type="time"
                      value={field.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                    />
                  )}
                />
              </div>
            </div>
            <div>
              <Label
                className="tw:text-small tw:font-semibold tw:mb-1"
                htmlFor="edit-medication-every-n-days"
              >
                {m.medication_every_n_days_label()}
              </Label>
              <editForm.Field
                name="everyNDays"
                children={(field) => (
                  <Input
                    id="edit-medication-every-n-days"
                    type="number"
                    min={1}
                    value={field.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                )}
              />
            </div>
            <label className="tw:flex tw:items-start tw:gap-2 tw:min-h-6 tw:mb-0.5">
              <editForm.Field
                name="isActive"
                children={(field) => (
                  <Checkbox
                    checked={field.value}
                    onChange={(event) => field.handleChange(event.target.checked)}
                  />
                )}
              />
              <span>{m.medication_active_label()}</span>
            </label>
          </DialogBody>
          <DialogFooter>
            <DialogClose render={<Button variant="outline-secondary" />}>
              {m.action_cancel()}
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? m.action_saving() : m.action_save()}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
