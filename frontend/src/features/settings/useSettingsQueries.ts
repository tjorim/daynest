import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createIntegrationClient,
  listIntegrationClients,
  revokeIntegrationClient,
  rotateIntegrationClient,
  type IntegrationClientInput,
} from "@/lib/api/integrationClients";
import {
  fetchCalendarFeed,
  fetchUserSettings,
  regenerateCalendarFeed,
  updateUserSettings,
  type UserSettingsPatch,
} from "@/lib/api/settings";
import { queryKeys } from "@/lib/query/queryKeys";

function useInvalidateSettingsQueries() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.search.all }),
    ]);
}

export function useIntegrationClientsQuery() {
  return useQuery({
    queryKey: queryKeys.settings.integrationClients(),
    queryFn: ({ signal }) => listIntegrationClients(signal),
  });
}

export function useCalendarFeedQuery() {
  return useQuery({
    queryKey: queryKeys.settings.calendarFeed(),
    queryFn: ({ signal }) => fetchCalendarFeed(signal),
  });
}

export function useUserSettingsQuery() {
  return useQuery({
    queryKey: queryKeys.settings.user(),
    queryFn: ({ signal }) => fetchUserSettings(signal),
  });
}

export function useCreateIntegrationClientMutation() {
  const invalidate = useInvalidateSettingsQueries();
  return useMutation({
    mutationFn: (input: IntegrationClientInput) => createIntegrationClient(input),
    onSuccess: invalidate,
  });
}

export function useRotateIntegrationClientMutation() {
  const invalidate = useInvalidateSettingsQueries();
  return useMutation({
    mutationFn: (clientId: number) => rotateIntegrationClient(clientId),
    onSuccess: invalidate,
  });
}

export function useRevokeIntegrationClientMutation() {
  const invalidate = useInvalidateSettingsQueries();
  return useMutation({
    mutationFn: (clientId: number) => revokeIntegrationClient(clientId),
    onSuccess: invalidate,
  });
}

export function useRegenerateCalendarFeedMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => regenerateCalendarFeed(),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.settings.calendarFeed(), updated);
    },
  });
}

export function useUpdateUserSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: UserSettingsPatch) => updateUserSettings(patch),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.settings.user(), (current: unknown) =>
        typeof current === "object" && current !== null
          ? { ...(current as Record<string, unknown>), ...updated }
          : updated,
      );
    },
  });
}
