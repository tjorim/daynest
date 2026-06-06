import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import * as m from "@/paraglide/messages";
import { dayjs, formatDate, toIsoDate } from "@/lib/dateUtils";
import { isRetryableApiError } from "@/lib/api/today";
import { MEAL_SLOT_TYPES, type MealSlot, type MealSlotType } from "@/lib/api/mealPlans";
import { GenerateShoppingListModal } from "@/features/meal-planning/GenerateShoppingListModal";
import { MealSlotCard } from "@/features/meal-planning/MealSlotCard";
import { MealSlotModal } from "@/features/meal-planning/MealSlotModal";
import {
  useMealPlanActions,
  useMealPlanWeekQuery,
  useMealPlansQuery,
} from "@/features/meal-planning/useMealPlan";

function startOfWeek(value: dayjs.ConfigType): string {
  const date = dayjs(value);
  const daysSinceMonday = (date.day() + 6) % 7;
  return toIsoDate(date.subtract(daysSinceMonday, "day"));
}

function mealLabel(slotType: MealSlotType): string {
  switch (slotType) {
    case "breakfast":
      return m.meal_plan_breakfast();
    case "lunch":
      return m.meal_plan_lunch();
    case "dinner":
      return m.meal_plan_dinner();
    case "snack":
      return m.meal_plan_snack();
  }
}

export function MealPlannerPage() {
  const navigate = useNavigate();
  const plansQuery = useMealPlansQuery();
  const actions = useMealPlanActions();
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(dayjs()));
  const [isInitialized, setIsInitialized] = useState(false);
  const [newPlanName, setNewPlanName] = useState<string>(() => m.meal_plan_default_name());
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [editingSlot, setEditingSlot] = useState<{
    slot: MealSlot;
    dayLabel: string;
    mealLabel: string;
  } | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  const plans = plansQuery.data ?? [];

  useEffect(() => {
    if (isInitialized || plans.length === 0) return;
    const currentWeekPlan = plans.find((plan) => plan.week_start === weekStart) ?? plans[0];
    if (currentWeekPlan) {
      setSelectedPlanId(currentWeekPlan.id);
      setWeekStart(currentWeekPlan.week_start);
    }
    setIsInitialized(true);
  }, [plans, isInitialized, weekStart]);

  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? null;
  const weekQuery = useMealPlanWeekQuery(selectedPlanId, weekStart);
  const week = weekQuery.data;

  const weekEnd = useMemo(() => toIsoDate(dayjs(weekStart).add(6, "day")), [weekStart]);
  const queryError = plansQuery.error ?? weekQuery.error ?? actions.error;
  const error =
    queryError instanceof Error ? queryError.message : queryError ? m.meal_plan_load_error() : null;

  const createPlan = async () => {
    setStatusMessage(null);
    const plan = await actions.createPlan({
      name: newPlanName.trim() || m.meal_plan_default_name(),
      week_start: weekStart,
      notes: null,
    });
    setSelectedPlanId(plan.id);
    setWeekStart(plan.week_start);
    setStatusMessage(m.meal_plan_created());
  };

  const changeWeek = (nextWeekStart: string) => {
    setStatusMessage(null);
    setWeekStart(nextWeekStart);
    const matchingPlan = plans.find((plan) => plan.week_start === nextWeekStart);
    setSelectedPlanId(matchingPlan?.id ?? null);
  };

  const generateShoppingList = async () => {
    if (!selectedPlanId) return;
    const response = await actions.generateShoppingList(selectedPlanId);
    setShowGenerateModal(false);
    setStatusMessage(m.meal_plan_shopping_list_created({ name: response.shopping_list.name }));
    await navigate({
      to: "/shopping/$listId",
      params: { listId: String(response.shopping_list.id) },
    });
  };

  const reload = async () => {
    await Promise.all([plansQuery.refetch(), weekQuery.refetch()]);
  };

  return (
    <section>
      <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-start gap-3 mb-3">
        <div>
          <h2 className="h4 mb-1">{m.meal_plan_title()}</h2>
          <p className="text-muted mb-0">{m.meal_plan_subtitle()}</p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={() => void reload()}
          >
            {m.action_refresh()}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!week || actions.isSubmitting}
            onClick={() => setShowGenerateModal(true)}
          >
            {m.meal_plan_generate_shopping_list()}
          </button>
        </div>
      </div>

      {plansQuery.isPending ? (
        <div className="alert alert-info py-2">{m.meal_plan_loading()}</div>
      ) : null}
      {error ? (
        <div className="alert alert-danger py-2 d-flex justify-content-between align-items-center gap-2 flex-wrap">
          <span>{error}</span>
          {isRetryableApiError(queryError) ? (
            <button type="button" className="btn btn-danger btn-sm" onClick={() => void reload()}>
              {m.action_retry()}
            </button>
          ) : null}
        </div>
      ) : null}
      {statusMessage ? <div className="alert alert-success py-2">{statusMessage}</div> : null}

      <div className="card mb-3">
        <div className="card-body">
          <div className="row g-2 align-items-end">
            <div className="col-12 col-md-4">
              <label className="form-label" htmlFor="meal-plan-select">
                {m.meal_plan_select()}
              </label>
              <select
                id="meal-plan-select"
                className="form-select"
                value={selectedPlanId ?? ""}
                onChange={(event) => {
                  const plan = plans.find((item) => item.id === Number(event.target.value));
                  setSelectedPlanId(plan?.id ?? null);
                  if (plan) setWeekStart(plan.week_start);
                }}
                disabled={plans.length === 0}
              >
                {plans.length === 0 ? <option value="">{m.meal_plan_no_plans()}</option> : null}
                {plans.map((plan) => (
                  <option value={plan.id} key={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-4">
              <label className="form-label" htmlFor="meal-plan-name">
                {m.meal_plan_new_name()}
              </label>
              <input
                id="meal-plan-name"
                className="form-control"
                value={newPlanName}
                onChange={(event) => setNewPlanName(event.target.value)}
              />
            </div>
            <div className="col-12 col-md-4">
              <button
                type="button"
                className="btn btn-outline-primary w-100"
                disabled={actions.isSubmitting}
                onClick={() => void createPlan()}
              >
                {actions.isSubmitting ? m.action_creating() : m.meal_plan_create()}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-body d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
          <div>
            <div className="text-muted small">{m.meal_plan_week()}</div>
            <div className="fw-semibold">
              {formatDate(weekStart)} – {formatDate(weekEnd)}
            </div>
          </div>
          <div className="d-flex flex-wrap gap-2 align-items-center">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              disabled={actions.isSubmitting || !selectedPlan}
              onClick={() => void changeWeek(toIsoDate(dayjs(weekStart).subtract(7, "day")))}
            >
              {m.meal_plan_previous_week()}
            </button>
            <input
              type="date"
              className="form-control form-control-sm meal-plan-week-input"
              value={weekStart}
              disabled={actions.isSubmitting || !selectedPlan}
              onChange={(event) => void changeWeek(startOfWeek(event.target.value))}
              aria-label={m.meal_plan_week_start()}
            />
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              disabled={actions.isSubmitting || !selectedPlan}
              onClick={() => void changeWeek(toIsoDate(dayjs(weekStart).add(7, "day")))}
            >
              {m.meal_plan_next_week()}
            </button>
          </div>
        </div>
      </div>

      {weekQuery.isPending && selectedPlan ? (
        <div className="alert alert-info py-2">{m.meal_plan_loading_week()}</div>
      ) : null}
      {week ? (
        <div className="meal-plan-grid card p-2 p-md-3">
          <div className="meal-plan-grid-corner" />
          {week.days.map((day) => (
            <div className="meal-plan-day-header" key={day.date}>
              <div className="fw-semibold">{dayjs(day.date).format("ddd")}</div>
              <div className="small text-muted">{formatDate(day.date)}</div>
            </div>
          ))}
          {MEAL_SLOT_TYPES.map((slotType) => (
            <div className="meal-plan-row-contents" key={slotType}>
              <div className="meal-plan-meal-header">{mealLabel(slotType)}</div>
              {week.days.map((day) => {
                const slot = day.slots[slotType];
                const dayLabel = `${dayjs(day.date).format("dddd")}, ${formatDate(day.date)}`;
                return (
                  <MealSlotCard
                    key={`${day.date}-${slotType}`}
                    slot={slot}
                    mealLabel={mealLabel(slotType)}
                    onEdit={() =>
                      slot
                        ? setEditingSlot({ slot, dayLabel, mealLabel: mealLabel(slotType) })
                        : undefined
                    }
                  />
                );
              })}
            </div>
          ))}
        </div>
      ) : !plansQuery.isPending ? (
        <div className="alert alert-secondary py-2">{m.meal_plan_create_first()}</div>
      ) : null}

      <MealSlotModal
        slot={editingSlot?.slot ?? null}
        dayLabel={editingSlot?.dayLabel ?? ""}
        mealLabel={editingSlot?.mealLabel ?? ""}
        isSaving={actions.isSubmitting}
        onSave={async (slotId, input) => {
          if (!selectedPlanId) return;
          await actions.updateSlot(selectedPlanId, slotId, input);
          await weekQuery.refetch();
        }}
        onClose={() => setEditingSlot(null)}
      />
      {showGenerateModal && week ? (
        <GenerateShoppingListModal
          week={week}
          isSaving={actions.isSubmitting}
          onGenerate={generateShoppingList}
          onClose={() => setShowGenerateModal(false)}
        />
      ) : null}
    </section>
  );
}
