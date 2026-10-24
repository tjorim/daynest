import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import * as m from "@/paraglide/messages";
import { dayjs, formatDate, formatWeekday, toIsoDate } from "@/lib/dateUtils";
import { isRetryableApiError } from "@/lib/api/http";
import { MEAL_SLOT_TYPES, type MealSlot, type MealSlotType } from "@/lib/api/mealPlans";
import { GenerateShoppingListModal } from "@/features/meal-planning/GenerateShoppingListModal";
import { MealSlotCard } from "@/features/meal-planning/MealSlotCard";
import { MealSlotModal } from "@/features/meal-planning/MealSlotModal";
import {
  useMealPlanActions,
  useMealPlanWeekQuery,
  useMealPlansQuery,
} from "@/features/meal-planning/useMealPlan";
import { apiErrorMessage } from "@/lib/api/errorMessages";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

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
  const error = queryError ? apiErrorMessage(queryError, m.meal_plan_load_error()) : null;

  const createPlan = async () => {
    setStatusMessage(null);
    try {
      const plan = await actions.createPlan({
        name: newPlanName.trim() || m.meal_plan_default_name(),
        week_start: weekStart,
        notes: null,
      });
      setSelectedPlanId(plan.id);
      setWeekStart(plan.week_start);
      setStatusMessage(m.meal_plan_created());
    } catch {
      // error is tracked in actions.error
    }
  };

  const changeWeek = (nextWeekStart: string) => {
    setStatusMessage(null);
    setWeekStart(nextWeekStart);
    const matchingPlan = plans.find((plan) => plan.week_start === nextWeekStart);
    setSelectedPlanId(matchingPlan?.id ?? null);
  };

  const generateShoppingList = async () => {
    if (!selectedPlanId) return;
    try {
      const response = await actions.generateShoppingList(selectedPlanId);
      setShowGenerateModal(false);
      setStatusMessage(m.meal_plan_shopping_list_created({ name: response.shopping_list.name }));
      await navigate({
        to: "/shopping/$listId",
        params: { listId: response.shopping_list.id },
      });
    } catch {
      // error is tracked in actions.error
    }
  };

  const reload = async () => {
    const refetches: Promise<unknown>[] = [plansQuery.refetch()];
    if (selectedPlanId !== null) {
      refetches.push(weekQuery.refetch());
    }
    await Promise.all(refetches);
  };

  return (
    <section>
      <div className="flex flex-col lg:flex-row justify-between lg:items-start gap-4 mb-4">
        <div>
          <h2 className="text-h4 font-medium mb-1">{m.meal_plan_title()}</h2>
          <p className="text-muted-foreground mb-0">{m.meal_plan_subtitle()}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline-primary" size="sm" onClick={() => void reload()}>
            {m.action_refresh()}
          </Button>
          <Button
            size="sm"
            disabled={!week || actions.isSubmitting}
            onClick={() => setShowGenerateModal(true)}
          >
            {m.meal_plan_generate_shopping_list()}
          </Button>
        </div>
      </div>

      {plansQuery.isPending ? (
        <Alert variant="info" className="py-2">
          {m.meal_plan_loading()}
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="danger" className="py-2 flex justify-between items-center gap-2 flex-wrap">
          <span>{error}</span>
          {isRetryableApiError(queryError) ? (
            <Button variant="danger" size="sm" onClick={() => void reload()}>
              {m.action_retry()}
            </Button>
          ) : null}
        </Alert>
      ) : null}
      {statusMessage ? (
        <Alert variant="success" className="py-2">
          {statusMessage}
        </Alert>
      ) : null}

      <Card className="mb-4">
        <CardContent>
          <div className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-12 md:col-span-4">
              <Label htmlFor="meal-plan-select">{m.meal_plan_select()}</Label>
              <Select
                id="meal-plan-select"
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
              </Select>
            </div>
            <div className="col-span-12 md:col-span-4">
              <Label htmlFor="meal-plan-name">{m.meal_plan_new_name()}</Label>
              <Input
                id="meal-plan-name"
                value={newPlanName}
                onChange={(event) => setNewPlanName(event.target.value)}
              />
            </div>
            <div className="col-span-12 md:col-span-4">
              <Button
                variant="outline-primary"
                className="w-full"
                disabled={actions.isSubmitting}
                onClick={() => void createPlan()}
              >
                {actions.isSubmitting ? m.action_creating() : m.meal_plan_create()}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardContent className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="text-muted-foreground text-small">{m.meal_plan_week()}</div>
            <div className="font-semibold">
              {formatDate(weekStart)} – {formatDate(weekEnd)}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Button
              variant="outline-secondary"
              size="sm"
              disabled={actions.isSubmitting || !selectedPlan}
              onClick={() => void changeWeek(toIsoDate(dayjs(weekStart).subtract(7, "day")))}
            >
              {m.meal_plan_previous_week()}
            </Button>
            <Input
              size="sm"
              className="w-auto"
              type="date"
              value={weekStart}
              disabled={actions.isSubmitting || !selectedPlan}
              onChange={(event) => void changeWeek(startOfWeek(event.target.value))}
              aria-label={m.meal_plan_week_start()}
            />
            <Button
              variant="outline-secondary"
              size="sm"
              disabled={actions.isSubmitting || !selectedPlan}
              onClick={() => void changeWeek(toIsoDate(dayjs(weekStart).add(7, "day")))}
            >
              {m.meal_plan_next_week()}
            </Button>
          </div>
        </CardContent>
      </Card>

      {weekQuery.isPending && selectedPlan ? (
        <Alert variant="info" className="py-2">
          {m.meal_plan_loading_week()}
        </Alert>
      ) : null}
      {week ? (
        <Card className="grid meal-plan-grid p-2 md:p-4">
          <div className="meal-plan-grid-corner" />
          {week.days.map((day) => (
            <div className="meal-plan-day-header" key={day.date}>
              <div className="font-semibold">{formatWeekday(day.date)}</div>
              <div className="text-small text-muted-foreground">{formatDate(day.date)}</div>
            </div>
          ))}
          {MEAL_SLOT_TYPES.map((slotType) => (
            <div className="meal-plan-row-contents" key={slotType}>
              <div className="meal-plan-meal-header">{mealLabel(slotType)}</div>
              {week.days.map((day) => {
                const slot = day.slots[slotType];
                const dayLabel = `${formatWeekday(day.date, "long")}, ${formatDate(day.date)}`;
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
        </Card>
      ) : !plansQuery.isPending ? (
        <Alert variant="secondary" className="py-2">
          {m.meal_plan_create_first()}
        </Alert>
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
