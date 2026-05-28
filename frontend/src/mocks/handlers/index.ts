import { configHandlers } from "./config";
import { authHandlers } from "./auth";
import { todayHandlers } from "./today";
import { plannedItemHandlers } from "./plannedItems";
import { choreHandlers } from "./chores";
import { taskHandlers } from "./tasks";
import { medicationHandlers } from "./medication";
import { templateHandlers } from "./templates";
import { settingsHandlers } from "./settings";
import { analyticsHandlers } from "./analytics";

export const handlers = [
  ...configHandlers,
  ...authHandlers,
  ...todayHandlers,
  ...plannedItemHandlers,
  ...choreHandlers,
  ...taskHandlers,
  ...medicationHandlers,
  ...templateHandlers,
  ...settingsHandlers,
  ...analyticsHandlers,
];
