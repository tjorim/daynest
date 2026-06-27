import { getJson } from "@/lib/api/http";
import { z } from "zod";

export interface RoutineSearchResult {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ChoreSearchResult {
  id: number;
  name: string;
  description: string | null;
  priority: string;
  tags: string[];
  is_active: boolean;
  created_at: string;
}

export interface MedicationSearchResult {
  id: number;
  name: string;
  instructions: string;
  is_active: boolean;
  created_at: string;
}

export interface PlannedItemSearchResult {
  id: number;
  title: string;
  notes: string | null;
  planned_for: string;
  priority: string;
  tags: string[];
  is_done: boolean;
  created_at: string;
}

export interface SearchResponse {
  query: string;
  routine_templates: RoutineSearchResult[];
  chore_templates: ChoreSearchResult[];
  medication_plans: MedicationSearchResult[];
  planned_items: PlannedItemSearchResult[];
}

const searchResponseSchema = z.object({
  query: z.string(),
  routine_templates: z.array(z.object({
    id: z.number(),
    name: z.string(),
    description: z.string().nullable(),
    is_active: z.boolean(),
    created_at: z.string(),
  })),
  chore_templates: z.array(z.object({
    id: z.number(),
    name: z.string(),
    description: z.string().nullable(),
    priority: z.string(),
    tags: z.array(z.string()),
    is_active: z.boolean(),
    created_at: z.string(),
  })),
  medication_plans: z.array(z.object({
    id: z.number(),
    name: z.string(),
    instructions: z.string(),
    is_active: z.boolean(),
    created_at: z.string(),
  })),
  planned_items: z.array(z.object({
    id: z.number(),
    title: z.string(),
    notes: z.string().nullable(),
    planned_for: z.string(),
    priority: z.string(),
    tags: z.array(z.string()),
    is_done: z.boolean(),
    created_at: z.string(),
  })),
});

export async function searchItems(query: string, signal?: AbortSignal): Promise<SearchResponse> {
  return getJson(
    `/api/search?q=${encodeURIComponent(query)}`,
    searchResponseSchema,
    signal,
    2,
    "Search failed",
  );
}
