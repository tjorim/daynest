import type { PlannedTodayItem } from "@/lib/api/today";
import type { MedicationPlan } from "@/lib/api/medications";
import type { UserSettings } from "@/lib/api/settings";
import type { ChoreTemplate, RoutineTemplate } from "@/lib/api/templates";
import { MOCK_TODAY } from "./constants";
import { busyTodayPayload, emptyTodayPayload, medicationRefillTodayPayload, overdueTodayPayload } from "./today";
import { seedMedications, resetMedicationId } from "./medication";
import {
  seedRoutineTemplates,
  seedRoutineTemplatesCrud,
  seedChoreTemplates,
  seedChoreTemplatesCrud,
  resetTemplateId,
} from "./templates";
import { seedPlannedItems, resetPlannedItemId } from "./plannedItems";
import { seedUserSettings } from "./settings";

export type MockScenario =
  | "default"
  | "empty"
  | "busy-today"
  | "overdue"
  | "medication-refill"
  | "template-crud"
  | "signed-out"
  | "expired-session"
  | "forbidden"
  | "api-error";

interface MockState {
  scenario: MockScenario;
  plannedItems: PlannedTodayItem[];
  medications: MedicationPlan[];
  routineTemplates: RoutineTemplate[];
  choreTemplates: ChoreTemplate[];
  settings: UserSettings;
}

function buildInitialState(scenario: MockScenario): MockState {
  return {
    scenario,
    plannedItems: scenario === "empty" || scenario === "template-crud" ? [] : seedPlannedItems(MOCK_TODAY),
    medications: seedMedications(),
    routineTemplates: scenario === "template-crud" ? seedRoutineTemplatesCrud() : seedRoutineTemplates(),
    choreTemplates: scenario === "template-crud" ? seedChoreTemplatesCrud() : seedChoreTemplates(),
    settings: seedUserSettings(),
  };
}

let _state: MockState = buildInitialState("default");

export function getMockState(): Readonly<MockState> {
  return _state;
}

export function setScenario(scenario: MockScenario): void {
  _state = buildInitialState(scenario);
}

export function resetMockState(): void {
  resetMedicationId();
  resetPlannedItemId();
  resetTemplateId();
  _state = buildInitialState("default");
}

export function getTodayPayload() {
  const { scenario } = _state;
  if (scenario === "empty") return emptyTodayPayload(MOCK_TODAY);
  if (scenario === "busy-today") return busyTodayPayload(MOCK_TODAY);
  if (scenario === "overdue") return overdueTodayPayload(MOCK_TODAY);
  if (scenario === "medication-refill") return medicationRefillTodayPayload(MOCK_TODAY);
  if (scenario === "template-crud") return emptyTodayPayload(MOCK_TODAY);
  return busyTodayPayload(MOCK_TODAY);
}

export function mutatePlannedItems(
  updater: (items: PlannedTodayItem[]) => PlannedTodayItem[],
): void {
  _state = { ..._state, plannedItems: updater(_state.plannedItems) };
}

export function mutateMedications(
  updater: (items: MedicationPlan[]) => MedicationPlan[],
): void {
  _state = { ..._state, medications: updater(_state.medications) };
}

export function mutateRoutineTemplates(
  updater: (items: RoutineTemplate[]) => RoutineTemplate[],
): void {
  _state = { ..._state, routineTemplates: updater(_state.routineTemplates) };
}

export function mutateChoreTemplates(
  updater: (items: ChoreTemplate[]) => ChoreTemplate[],
): void {
  _state = { ..._state, choreTemplates: updater(_state.choreTemplates) };
}

export function mutateSettings(
  updater: (s: UserSettings) => UserSettings,
): void {
  _state = { ..._state, settings: updater(_state.settings) };
}

/** Reads the `mock-scenario` URL search param and applies it if present. */
export function initScenarioFromUrl(): void {
  if (typeof window === "undefined") return;
  const raw = new URLSearchParams(window.location.search).get("mock-scenario");
  if (raw) {
    const valid: MockScenario[] = [
      "default",
      "empty",
      "busy-today",
      "overdue",
      "medication-refill",
      "template-crud",
      "signed-out",
      "expired-session",
      "forbidden",
      "api-error",
    ];
    if (valid.includes(raw as MockScenario)) {
      setScenario(raw as MockScenario);
    }
  }
}
