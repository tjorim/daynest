import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";
import { initScenarioFromUrl } from "./data/state";

export const worker = setupWorker(...handlers);

initScenarioFromUrl();
