import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createChoreTemplate,
  createRoutineTemplate,
  deleteChoreTemplate,
  deleteRoutineTemplate,
  listChoreTemplates,
  listRoutineTemplates,
  updateChoreTemplate,
  updateRoutineTemplate,
  type ChoreTemplateInput,
  type RoutineTemplateInput,
} from "@/lib/api/templates";
import {
  fetchAnalyticsSummary,
} from "@/lib/api/analytics";
import { queryKeys } from "@/lib/query/queryKeys";

function useInvalidateTemplateQueries() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.templates.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.today.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.search.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all }),
    ]);
}

export function useRoutineTemplatesQuery() {
  return useQuery({
    queryKey: queryKeys.templates.routines(),
    queryFn: ({ signal }) => listRoutineTemplates(signal),
  });
}

export function useChoreTemplatesQuery() {
  return useQuery({
    queryKey: queryKeys.templates.chores(),
    queryFn: ({ signal }) => listChoreTemplates(signal),
  });
}

export function useTemplateAnalyticsQuery() {
  return useQuery({
    queryKey: queryKeys.analytics.summary("week"),
    queryFn: ({ signal }) => fetchAnalyticsSummary("week", signal),
  });
}

export function useCreateRoutineTemplateMutation() {
  const invalidate = useInvalidateTemplateQueries();
  return useMutation({
    mutationFn: (input: RoutineTemplateInput) => createRoutineTemplate(input),
    onSuccess: invalidate,
  });
}

export function useUpdateRoutineTemplateMutation() {
  const invalidate = useInvalidateTemplateQueries();
  return useMutation({
    mutationFn: ({ routineTemplateId, input }: { routineTemplateId: number; input: RoutineTemplateInput }) =>
      updateRoutineTemplate(routineTemplateId, input),
    onSuccess: invalidate,
  });
}

export function useDeleteRoutineTemplateMutation() {
  const invalidate = useInvalidateTemplateQueries();
  return useMutation({
    mutationFn: (routineTemplateId: number) => deleteRoutineTemplate(routineTemplateId),
    onSuccess: invalidate,
  });
}

export function useCreateChoreTemplateMutation() {
  const invalidate = useInvalidateTemplateQueries();
  return useMutation({
    mutationFn: (input: ChoreTemplateInput) => createChoreTemplate(input),
    onSuccess: invalidate,
  });
}

export function useUpdateChoreTemplateMutation() {
  const invalidate = useInvalidateTemplateQueries();
  return useMutation({
    mutationFn: ({ choreTemplateId, input }: { choreTemplateId: number; input: ChoreTemplateInput }) =>
      updateChoreTemplate(choreTemplateId, input),
    onSuccess: invalidate,
  });
}

export function useDeleteChoreTemplateMutation() {
  const invalidate = useInvalidateTemplateQueries();
  return useMutation({
    mutationFn: (choreTemplateId: number) => deleteChoreTemplate(choreTemplateId),
    onSuccess: invalidate,
  });
}
