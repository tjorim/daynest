import { HomeAssistant } from "custom-card-helpers";

export interface DaynestCardConfig {
  type: string;
  name?: string;
  sensor_prefix?: string;
  todo_entity?: string;
  view?: "full" | "compact" | "week";
  show_quick_add?: boolean;
  snooze_days?: number;
}

export function sensorNum(hass: HomeAssistant, entityId: string): number {
  return parseFloat(hass.states[entityId]?.state ?? "0") || 0;
}

export function sensorStr(hass: HomeAssistant, entityId: string): string {
  return hass.states[entityId]?.state ?? "";
}
