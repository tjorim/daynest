import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { dayjs } from "@/lib/dateUtils";
import {
  createPlannedItem,
  deletePlannedItem,
  listPlannedItems,
  reschedulePlannedItem,
  updatePlannedItem,
  type PlannedItemBackupFile,
  type PlannedItemModuleKey,
  type PlannedTodayItem,
} from "@/lib/api/today";

function safeParseBackup(raw: string): PlannedItemBackupFile {
  const parsed = JSON.parse(raw) as Partial<PlannedItemBackupFile>;
  if (parsed.source !== "daynest" || parsed.schema_version !== 1 || !Array.isArray(parsed.items)) {
    throw new Error("Unsupported backup file.");
  }
  parsed.items.forEach((item, index) => {
    if (!item || typeof item.title !== "string" || typeof item.planned_for !== "string") {
      throw new Error(`Invalid backup item at index ${index}: title and planned_for are required.`);
    }
  });
  return parsed as PlannedItemBackupFile;
}

export function useCalendarPlannedItems({
  selectedDate,
  monthStart,
  monthKey,
  loadCalendar,
}: {
  selectedDate: string;
  monthStart: dayjs.Dayjs;
  monthKey: { year: number; month: number };
  loadCalendar: () => Promise<void>;
}) {
  const [plannedItems, setPlannedItems] = useState<PlannedTodayItem[]>([]);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [moduleKey, setModuleKey] = useState<PlannedItemModuleKey | "">("");
  const [recurrenceHint, setRecurrenceHint] = useState("");
  const [linkedSource, setLinkedSource] = useState("");
  const [linkedRef, setLinkedRef] = useState("");
  const [editingPlannedItemId, setEditingPlannedItemId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const resetPlannedForm = () => {
    setEditingPlannedItemId(null);
    setTitle("");
    setNotes("");
    setModuleKey("");
    setRecurrenceHint("");
    setLinkedSource("");
    setLinkedRef("");
    setAddError(null);
  };

  const startEditing = (item: PlannedTodayItem) => {
    setEditingPlannedItemId(item.id);
    setTitle(item.title);
    setNotes(item.notes ?? "");
    setModuleKey(item.module_key ?? "");
    setRecurrenceHint(item.recurrence_hint ?? "");
    setLinkedSource(item.linked_source ?? "");
    setLinkedRef(item.linked_ref ?? "");
    setAddError(null);
  };

  const setPlanned = (items: PlannedTodayItem[]) => {
    setPlannedItems(items);
  };

  const onAddPlanned = async () => {
    if (!title.trim()) return;
    setIsAdding(true);
    setAddError(null);
    setActionStatus(null);
    try {
      const payload = {
        title: title.trim(),
        planned_for: selectedDate,
        notes: notes.trim() || null,
        module_key: moduleKey || null,
        recurrence_hint: recurrenceHint.trim() || null,
        linked_source: linkedSource.trim() || null,
        linked_ref: linkedRef.trim() || null,
      };

      if (editingPlannedItemId !== null) {
        const currentItem = plannedItems.find((item) => item.id === editingPlannedItemId);
        await updatePlannedItem(editingPlannedItemId, {
          ...payload,
          is_done: currentItem?.is_done ?? false,
        });
      } else {
        await createPlannedItem(payload);
      }

      const isUpdate = editingPlannedItemId !== null;
      resetPlannedForm();
      setActionStatus(isUpdate ? "Planned item updated." : "Planned item created.");
      await loadCalendar();
    } catch (err) {
      setAddError(
        err instanceof Error
          ? err.message
          : `Failed to ${editingPlannedItemId !== null ? "update" : "add"} item.`,
      );
    } finally {
      setIsAdding(false);
    }
  };

  const togglePlannedDone = async (item: PlannedTodayItem) => {
    setAddError(null);
    setIsAdding(true);
    setActionStatus(null);
    try {
      await updatePlannedItem(item.id, {
        title: item.title,
        planned_for: item.planned_for,
        notes: item.notes,
        module_key: item.module_key,
        recurrence_hint: item.recurrence_hint,
        linked_source: item.linked_source,
        linked_ref: item.linked_ref,
        is_done: !item.is_done,
      });
      setActionStatus(item.is_done ? "Planned item reopened." : "Planned item marked done.");
      await loadCalendar();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to update item.");
    } finally {
      setIsAdding(false);
    }
  };

  const removePlannedItem = async (itemId: number) => {
    setConfirmDeleteId(null);
    setAddError(null);
    setIsAdding(true);
    setActionStatus(null);
    try {
      await deletePlannedItem(itemId);
      if (editingPlannedItemId === itemId) {
        resetPlannedForm();
      }
      setActionStatus("Planned item deleted.");
      await loadCalendar();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to delete item.");
    } finally {
      setIsAdding(false);
    }
  };

  const dragReschedulePlannedItem = async (itemId: number, newDate: string) => {
    const prevItems = [...plannedItems];
    // Optimistic update
    setPlannedItems(plannedItems.map((item) =>
      item.id === itemId ? { ...item, planned_for: newDate } : item,
    ));
    setActionStatus(null);
    setAddError(null);
    try {
      await reschedulePlannedItem(itemId, newDate);
      setActionStatus("Planned item moved.");
      await loadCalendar();
    } catch (err) {
      setPlannedItems(prevItems);
      setAddError(err instanceof Error ? err.message : "Failed to reschedule item.");
    }
  };

  const onExportBackup = async () => {
    setIsExporting(true);
    setBackupStatus(null);
    try {
      const startDate = monthStart.format("YYYY-MM-DD");
      const endDate = monthStart.endOf("month").format("YYYY-MM-DD");
      const items = await listPlannedItems(startDate, endDate, undefined);
      const payload: PlannedItemBackupFile = {
        source: "daynest",
        schema_version: 1,
        exported_at: dayjs().toISOString(),
        items: items.map((item) => ({
          title: item.title,
          planned_for: item.planned_for,
          notes: item.notes,
          module_key: item.module_key,
          recurrence_hint: item.recurrence_hint,
          linked_source: item.linked_source,
          linked_ref: item.linked_ref,
        })),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = `daynest-backup-${monthKey.year}-${String(monthKey.month).padStart(2, "0")}.json`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(downloadUrl);
      setBackupStatus(`Exported ${payload.items.length} planned items.`);
    } catch (err) {
      setBackupStatus(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setIsExporting(false);
    }
  };

  const onImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (!selected) {
      return;
    }

    setIsImporting(true);
    setBackupStatus(null);
    try {
      const raw = await selected.text();
      const backup = safeParseBackup(raw);

      let imported = 0;
      let failed = 0;
      for (let start = 0; start < backup.items.length; start += 5) {
        const batch = backup.items.slice(start, start + 5);
        const results = await Promise.allSettled(
          batch.map((item) =>
            createPlannedItem({
              title: item.title,
              planned_for: item.planned_for,
              notes: item.notes,
              module_key: item.module_key,
              recurrence_hint: item.recurrence_hint,
              linked_source: item.linked_source,
              linked_ref: item.linked_ref,
            }),
          ),
        );
        for (const result of results) {
          if (result.status === "fulfilled") imported += 1;
          else failed += 1;
        }
      }
      await loadCalendar();
      setBackupStatus(`Import complete. ${imported} imported${failed ? `, ${failed} failed` : ""}.`);
    } catch (err) {
      setBackupStatus(err instanceof Error ? err.message : "Import failed.");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setIsImporting(false);
    }
  };

  return {
    plannedItems,
    setPlannedItems: setPlanned,
    title,
    notes,
    moduleKey,
    recurrenceHint,
    linkedSource,
    linkedRef,
    editingPlannedItemId,
    confirmDeleteId,
    backupStatus,
    isAdding,
    addError,
    isExporting,
    isImporting,
    actionStatus,
    fileInputRef,
    setTitle,
    setNotes,
    setModuleKey,
    setRecurrenceHint,
    setLinkedSource,
    setLinkedRef,
    setAddError,
    clearAddError: () => setAddError(null),
    setConfirmDeleteId,
    onAddPlanned,
    resetPlannedForm,
    startEditing,
    togglePlannedDone,
    removePlannedItem,
    dragReschedulePlannedItem,
    onExportBackup,
    onImportFile,
  };
}
