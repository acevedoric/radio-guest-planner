import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Guest } from "@/types/guest";

interface UndoAction {
  type: "update" | "delete" | "insert";
  guestId: string;
  previousData: Partial<Guest> | null; // null for insert (undo = delete)
  newData: Partial<Guest> | null; // null for delete (redo = delete)
}

const MAX_HISTORY = 20;

export const useUndoRedo = (onRefresh: () => void) => {
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const [redoStack, setRedoStack] = useState<UndoAction[]>([]);

  const pushAction = useCallback((action: UndoAction) => {
    setUndoStack((prev) => [...prev.slice(-(MAX_HISTORY - 1)), action]);
    setRedoStack([]);
  }, []);

  const undo = useCallback(async () => {
    const action = undoStack[undoStack.length - 1];
    if (!action) return;

    try {
      if (action.type === "update" && action.previousData) {
        await supabase.from("guests").update(action.previousData).eq("id", action.guestId);
      } else if (action.type === "delete" && action.previousData) {
        await supabase.from("guests").insert([{ ...action.previousData, id: action.guestId } as any]);
      } else if (action.type === "insert") {
        await supabase.from("guests").delete().eq("id", action.guestId);
      }

      setUndoStack((prev) => prev.slice(0, -1));
      setRedoStack((prev) => [...prev, action]);
      onRefresh();
      toast.success("Acción deshecha");
    } catch (err) {
      console.error("Undo failed:", err);
      toast.error("Error al deshacer");
    }
  }, [undoStack, onRefresh]);

  const redo = useCallback(async () => {
    const action = redoStack[redoStack.length - 1];
    if (!action) return;

    try {
      if (action.type === "update" && action.newData) {
        await supabase.from("guests").update(action.newData).eq("id", action.guestId);
      } else if (action.type === "delete") {
        await supabase.from("guests").delete().eq("id", action.guestId);
      } else if (action.type === "insert" && action.newData) {
        await supabase.from("guests").insert([{ ...action.newData, id: action.guestId } as any]);
      }

      setRedoStack((prev) => prev.slice(0, -1));
      setUndoStack((prev) => [...prev, action]);
      onRefresh();
      toast.success("Acción rehecha");
    } catch (err) {
      console.error("Redo failed:", err);
      toast.error("Error al rehacer");
    }
  }, [redoStack, onRefresh]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
        if (e.key === "z") {
          e.preventDefault();
          undo();
        } else if (e.key === "y") {
          e.preventDefault();
          redo();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);

  return { undo, redo, pushAction, canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 };
};
