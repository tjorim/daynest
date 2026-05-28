// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MedicationPage } from "@/features/medication/MedicationPage";

vi.mock("@/paraglide/messages", () => {
  const identity = (key: string) => () => key;
  return {
    medication_every_n_error: identity("medication_every_n_error"),
    medication_required_fields: identity("medication_required_fields"),
    medication_create_failed: identity("medication_create_failed"),
    medication_plan_created: identity("medication_plan_created"),
    medication_plan_updated: identity("medication_plan_updated"),
    medication_update_failed: identity("medication_update_failed"),
    medication_plan_deleted: identity("medication_plan_deleted"),
    medication_delete_failed: identity("medication_delete_failed"),
    medication_title: identity("medication_title"),
    action_refresh: identity("action_refresh"),
    medication_subtitle: identity("medication_subtitle"),
    medication_loading: identity("medication_loading"),
    action_retry: identity("action_retry"),
    medication_create_plan_header: identity("medication_create_plan_header"),
    medication_name_placeholder: identity("medication_name_placeholder"),
    medication_instructions_placeholder: identity("medication_instructions_placeholder"),
    medication_start_date_label: identity("medication_start_date_label"),
    medication_schedule_time_label: identity("medication_schedule_time_label"),
    medication_every_n_days_label: identity("medication_every_n_days_label"),
    action_creating: identity("action_creating"),
    medication_create_button: identity("medication_create_button"),
    medication_active_plans_header: identity("medication_active_plans_header"),
    medication_no_plans: identity("medication_no_plans"),
    medication_starts: ({ date }: { date: string }) => `starts ${date}`,
    medication_every_day: ({ count }: { count: number }) => `every ${count} day`,
    medication_every_days: ({ count }: { count: number }) => `every ${count} days`,
    status_active: identity("status_active"),
    status_inactive: identity("status_inactive"),
    action_edit: identity("action_edit"),
    action_deleting: identity("action_deleting"),
    action_delete: identity("action_delete"),
    medication_dose_history_header: identity("medication_dose_history_header"),
    medication_no_history: identity("medication_no_history"),
    medication_edit_title: identity("medication_edit_title"),
    medication_active_label: identity("medication_active_label"),
    action_cancel: identity("action_cancel"),
    action_saving: identity("action_saving"),
    action_save: identity("action_save"),
  };
});

const medicationHooksMock = vi.hoisted(() => ({
  useMedicationPlansQuery: vi.fn(),
  useMedicationHistoryQuery: vi.fn(),
  useCreateMedicationPlanMutation: vi.fn(),
  useUpdateMedicationPlanMutation: vi.fn(),
  useDeleteMedicationPlanMutation: vi.fn(),
}));

vi.mock("@/features/medication/useMedicationQueries", () => ({
  useMedicationPlansQuery: medicationHooksMock.useMedicationPlansQuery,
  useMedicationHistoryQuery: medicationHooksMock.useMedicationHistoryQuery,
  useCreateMedicationPlanMutation: medicationHooksMock.useCreateMedicationPlanMutation,
  useUpdateMedicationPlanMutation: medicationHooksMock.useUpdateMedicationPlanMutation,
  useDeleteMedicationPlanMutation: medicationHooksMock.useDeleteMedicationPlanMutation,
}));

describe("MedicationPage", () => {
  const createMutation = vi.fn();
  const updateMutation = vi.fn();
  const deleteMutation = vi.fn();

  beforeEach(() => {
    createMutation.mockReset();
    updateMutation.mockReset();
    deleteMutation.mockReset();

    medicationHooksMock.useMedicationPlansQuery.mockReturnValue({
      data: [
        {
          id: 1,
          name: "Vitamin D",
          instructions: "Take after breakfast",
          start_date: "2026-05-20",
          schedule_time: "09:00:00",
          every_n_days: 1,
          is_active: true,
        },
      ],
      isPending: false,
      error: null,
      refetch: vi.fn().mockResolvedValue(undefined),
    });
    medicationHooksMock.useMedicationHistoryQuery.mockReturnValue({
      data: [],
      isPending: false,
      error: null,
      refetch: vi.fn().mockResolvedValue(undefined),
    });
    medicationHooksMock.useCreateMedicationPlanMutation.mockReturnValue({
      mutateAsync: createMutation,
    });
    medicationHooksMock.useUpdateMedicationPlanMutation.mockReturnValue({
      mutateAsync: updateMutation,
    });
    medicationHooksMock.useDeleteMedicationPlanMutation.mockReturnValue({
      mutateAsync: deleteMutation,
    });
  });

  it("shows loading state while medication queries are pending", () => {
    medicationHooksMock.useMedicationPlansQuery.mockReturnValueOnce({
      data: [],
      isPending: true,
      error: null,
      refetch: vi.fn().mockResolvedValue(undefined),
    });

    render(<MedicationPage />);

    expect(screen.getByText("medication_loading")).toBeInTheDocument();
  });

  it("validates required fields before creating a medication plan", async () => {
    const user = userEvent.setup();
    render(<MedicationPage />);

    await user.click(screen.getByRole("button", { name: /create/i }));

    expect(createMutation).not.toHaveBeenCalled();
    expect(screen.getByText("medication_required_fields")).toBeInTheDocument();
  });

  it("submits valid values through tanstack form and shows success", async () => {
    const user = userEvent.setup();
    createMutation.mockResolvedValueOnce({ id: 2 });
    render(<MedicationPage />);

    await user.type(screen.getByLabelText(/name/i), "Morning magnesium");
    await user.type(screen.getByLabelText(/instructions/i), "With water");
    await user.click(screen.getByRole("button", { name: /create/i }));

    await waitFor(() => {
      expect(createMutation).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Morning magnesium",
          instructions: "With water",
          schedule_time: "09:00:00",
          every_n_days: 1,
        }),
      );
    });
  });

  it("shows mutation error when create fails", async () => {
    const user = userEvent.setup();
    createMutation.mockRejectedValueOnce(new Error("Failed to save medication"));
    render(<MedicationPage />);

    await user.type(screen.getByLabelText(/name/i), "Evening magnesium");
    await user.type(screen.getByLabelText(/instructions/i), "After dinner");
    await user.click(screen.getByRole("button", { name: /create/i }));

    expect(await screen.findByText("Failed to save medication")).toBeInTheDocument();
  });
});
