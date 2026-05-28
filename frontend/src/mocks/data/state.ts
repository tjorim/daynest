import type {
  PlannedTodayItem,
  MedicationPlan,
  RoutineTemplate,
  ChoreTemplate,
  UserSettings,
} from "@/lib/api/today";
import { MOCK_TODAY } from "./constants";
import { busyTodayPayload, emptyTodayPayload, overdueTodayPayload } from "./today";
import { seedMedications } from "./medication";
import { seedRoutineTemplates, seedChoreTemplates } from "./templates";
import { seedPlannedItems } from "./plannedItems";
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
    plannedItems: scenario === "empty" ? [] : seedPlannedItems(MOCK_TODAY),
    medications: seedMedications(),
    routineTemplates: seedRoutineTemplates(),
    choreTemplates: seedChoreTemplates(),
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
  _state = buildInitialState("default");
}

export function getTodayPayload() {
  const { scenario } = _state;
  if (scenario === "empty") return emptyTodayPayload(MOCK_TODAY);
  if (scenario === "busy-today") return busyTodayPayload(MOCK_TODAY);
  if (scenario === "overdue") return overdueTodayPayload(MOCK_TODAY);
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
      "api-error",
    ];
    if (valid.includes(raw as MockScenario)) {
      setScenario(raw as MockScenario);
    }
  }
}
