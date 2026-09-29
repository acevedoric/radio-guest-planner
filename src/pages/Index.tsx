import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { startOfWeek, startOfMonth, addDays, addWeeks, endOfMonth, format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { WeeklyCalendar } from "@/components/WeeklyCalendar";
import { DayView } from "@/components/DayView";
import { MonthView } from "@/components/MonthView";
import { GuestDetailModal } from "@/components/GuestDetailModal";
import { FilterBar } from "@/components/FilterBar";
import { ProposedView } from "@/components/ProposedView";
import { Guest } from "@/types/guest";
import logo from "@/assets/bla-bla-blu-logo.png";
import { LogOut, LogIn, Undo2, Redo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUndoRedo } from "@/hooks/useUndoRedo";
import { guestsReadFrom } from "@/lib/guestsSource";
import { ImportExcelModal } from "@/components/ImportExcelModal";
import { HistoricalSearchDialog } from "@/components/HistoricalSearchDialog";

const Index = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [guests, setGuests] = useState<Guest[]>([]);
  const initialParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const parseParamDate = (value: string | null): Date | null => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const d = new Date(value + "T00:00:00");
    return isNaN(d.getTime()) ? null : d;
  };
  const pendingGuestIdRef = useRef<string | null>(initialParams.get("guest"));
  const [viewMode, setViewMode] = useState<"day" | "week" | "month" | "proposed">(() => {
    const v = initialParams.get("view");
    return v === "day" || v === "week" || v === "month" || v === "proposed" ? v : "week";
  });
  const [proposedGuests, setProposedGuests] = useState<Guest[]>([]);
  const [selectedWeek, setSelectedWeek] = useState(() => {
    const d = parseParamDate(initialParams.get("week"));
    return startOfWeek(d ?? new Date(), { weekStartsOn: 1 });
  });
  const [selectedDay, setSelectedDay] = useState(() => {
    const d = initialParams.get("day");
    return d && ["monday", "tuesday", "wednesday", "thursday"].includes(d) ? d : "monday";
  });
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = parseParamDate(initialParams.get("month"));
    return startOfMonth(d ?? new Date());
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [globalSearchResults, setGlobalSearchResults] = useState<{ guests: Guest[]; press: Guest[] }>({ guests: [], press: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newGuestSlot, setNewGuestSlot] = useState<{
    day: string;
    slot: number;
    slotOrder?: number;
  } | null>(null);
  const [editMode, setEditMode] = useState(() => {
    const m = initialParams.get("mode");
    if (m === "edit") return true;
    if (m === "present") return false;
    try {
      return localStorage.getItem("blu-edit-mode") === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("blu-edit-mode", editMode ? "1" : "0");
    } catch {
      // ignore
    }
  }, [editMode]);
  const [allRecordingGuests, setAllRecordingGuests] = useState<Guest[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  
  
  const refreshRef = useRef<() => void>(() => {});
  const refreshData = useCallback(() => {
    refreshRef.current();
  }, []);

  const { undo, redo, pushAction, canUndo, canRedo } = useUndoRedo(refreshData);

  // Sync view state (and open guest) to URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("view", viewMode);
    params.set("week", format(selectedWeek, "yyyy-MM-dd"));
    params.set("day", selectedDay);
    params.set("month", format(selectedMonth, "yyyy-MM-dd"));
    if (isModalOpen && selectedGuest?.id) params.set("guest", selectedGuest.id);
    else if (!pendingGuestIdRef.current) params.delete("guest");
    const next = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
    if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.replaceState(window.history.state, "", next);
    }
  }, [viewMode, selectedWeek, selectedDay, selectedMonth, isModalOpen, selectedGuest]);

  // Reopen guest from URL
  useEffect(() => {
    const guestId = pendingGuestIdRef.current;
    if (loading || !guestId) return;
    pendingGuestIdRef.current = null;
    (supabase as any).from(guestsReadFrom(session)).select('*').eq('id', guestId).maybeSingle()
      .then(({ data }: any) => {
        if (data) {
          setSelectedGuest(data as Guest);
          setIsModalOpen(true);
        }
      });
  }, [loading, session]);

  // Check authentication status
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "TOKEN_REFRESHED") return;
        setSession(session);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Check admin role
  useEffect(() => {
    if (!session) { setIsAdmin(false); return; }
    (supabase.rpc as any)("has_role", { _user_id: session.user.id, _role: "admin" })
      .then(({ data }: any) => setIsAdmin(!!data));
  }, [session]);


  useEffect(() => {
    if (loading) return;
    fetchGuests();
    fetchAllRecordingGuests();
    fetchProposedGuests();

    // Setup realtime subscription (solo para usuarios autenticados)
    if (!session) return;
    const channel = supabase.channel('schema-db-changes').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'guests'
    }, () => {
      fetchGuests();
      fetchAllRecordingGuests();
      fetchProposedGuests();
    }).subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedWeek, selectedMonth, viewMode, session, loading]);

  const fetchAllRecordingGuests = async () => {
    const { data } = await (supabase as any)
      .from(guestsReadFrom(session))
      .select('*')
      .in('recording_status', ['to_record', 'postponed', 'proposed'])
      .not('scheduled_date', 'is', null);
    setAllRecordingGuests((data || []) as Guest[]);
  };

  const fetchProposedGuests = async () => {
    const { data, error } = await (supabase as any)
      .from(guestsReadFrom(session))
      .select('*')
      .eq('recording_status', 'proposed')
      .order('created_at', { ascending: false });
    if (!error) {
      setProposedGuests((data || []) as Guest[]);
    }
  };

  const fetchGuests = async () => {
    let query = (supabase as any).from(guestsReadFrom(session)).select('*');
    
    if (viewMode === "day" || viewMode === "week") {
      const weekStart = format(selectedWeek, "yyyy-MM-dd");
      query = query.eq('week_date', weekStart);
    } else if (viewMode === "month") {
      const monthStart = startOfMonth(selectedMonth);
      const monthEnd = endOfMonth(selectedMonth);
      
      const mondaysInMonth: string[] = [];
      let current = startOfWeek(monthStart, { weekStartsOn: 1 });
      const end = startOfWeek(monthEnd, { weekStartsOn: 1 });
      
      while (current <= end) {
        mondaysInMonth.push(format(current, "yyyy-MM-dd"));
        current = addWeeks(current, 1);
      }
      
      query = query.in('week_date', mondaysInMonth);
    }
    
    const { data, error } = await query
      .order('day_of_week')
      .order('time_slot');
      
    if (error) {
      toast.error("Error al cargar invitados");
      console.error(error);
    } else {
      setGuests((data || []) as Guest[]);
    }
  };
  const handleSaveGuest = async (guest: Guest): Promise<boolean> => {
    const isProposedNoDate = guest.recording_status === "proposed" && !guest.week_date && !newGuestSlot;
    const guestData: any = isProposedNoDate
      ? {
          ...guest,
          week_date: null,
          day_of_week: null,
          time_slot: null,
          slot_order: guest.slot_order ?? 1,
        }
      : {
          ...guest,
          week_date: guest.week_date || format(selectedWeek, "yyyy-MM-dd"),
          day_of_week: newGuestSlot?.day || guest.day_of_week,
          time_slot: newGuestSlot?.slot ?? guest.time_slot,
          slot_order: newGuestSlot?.slotOrder ?? guest.slot_order ?? 1,
        };

    // Si el estado es de grabación y hay scheduled_date, mover al nuevo día
    const statusesWithRelocation = ["postponed", "proposed", "to_record"];
    if (statusesWithRelocation.includes(guestData.recording_status) && guestData.scheduled_date) {
      const scheduledDate = new Date(guestData.scheduled_date + 'T12:00:00');
      const dayOfWeekNum = scheduledDate.getDay();

      const dayMap: Record<number, string> = {
        1: "monday",
        2: "tuesday",
        3: "wednesday",
        4: "thursday"
      };

      if (!dayMap[dayOfWeekNum]) {
        toast.error("La fecha seleccionada no cae en un día laboral (Lunes a Jueves)");
        return false;
      }

      const newDayOfWeek = dayMap[dayOfWeekNum];
      const newWeekDate = startOfWeek(scheduledDate, { weekStartsOn: 1 });
      const newWeekDateStr = format(newWeekDate, "yyyy-MM-dd");

      // Para grabaciones: verificar conflictos por scheduled_time, NO por time_slot
      if (guestData.scheduled_time) {
        let timeQuery = supabase
          .from('guests')
          .select('id, name, scheduled_time')
          .eq('scheduled_date', guestData.scheduled_date)
          .not('scheduled_time', 'is', null);

        if (guest.id) {
          timeQuery = timeQuery.neq('id', guest.id);
        }

        const { data: occupiedTimes, error: conflictError } = await timeQuery;

        if (conflictError) {
          toast.error("Error al verificar disponibilidad");
          console.error(conflictError);
          return false;
        }

        const takenTimes = (occupiedTimes || []).map(t => t.scheduled_time);
        const requestedTime = guestData.scheduled_time;

        if (takenTimes.includes(requestedTime)) {
          const allRecordingHours = ["16:00:00", "17:00:00", "18:00:00", "19:00:00"];
          const available = allRecordingHours
            .filter(h => !takenTimes.includes(h))
            .map(h => h.substring(0, 5));
          const takenNames = (occupiedTimes || [])
            .map(t => `${t.name} (${(t.scheduled_time || '').substring(0, 5)})`)
            .join(', ');
          
          const dayNames: Record<string, string> = {
            monday: "Lunes", tuesday: "Martes", wednesday: "Miércoles", thursday: "Jueves"
          };
          const dayLabel = dayNames[newDayOfWeek];
          const dateLabel = format(scheduledDate, "d/MM");

          if (available.length > 0) {
            toast.error(`${requestedTime.substring(0, 5)} ya está ocupada el ${dayLabel} ${dateLabel} (${takenNames}). Horas libres: ${available.join(', ')}`);
          } else {
            // Buscar días cercanos con horas libres
            const nearbyDays = [-1, 1, -2, 2, -3, 3];
            const suggestions: string[] = [];
            for (const offset of nearbyDays) {
              const nearbyDate = addDays(scheduledDate, offset);
              const nearbyDayNum = nearbyDate.getDay();
              if (nearbyDayNum < 1 || nearbyDayNum > 4) continue;

              const { data: nearbyOccupied } = await supabase
                .from('guests')
                .select('scheduled_time')
                .eq('scheduled_date', format(nearbyDate, "yyyy-MM-dd"))
                .not('scheduled_time', 'is', null);

              const nearbyTaken = (nearbyOccupied || []).map(t => t.scheduled_time);
              const nearbyAvailable = allRecordingHours.filter(h => !nearbyTaken.includes(h));
              if (nearbyAvailable.length > 0) {
                const nearbyDayName = dayNames[dayMap[nearbyDayNum]];
                suggestions.push(`${nearbyDayName} ${format(nearbyDate, "d/MM")}: ${nearbyAvailable.map(h => h.substring(0, 5)).join(', ')}`);
              }
              if (suggestions.length >= 3) break;
            }

            if (suggestions.length > 0) {
              toast.error(`${dayLabel} ${dateLabel} está completamente lleno. Días cercanos disponibles: ${suggestions.join(' | ')}`);
            } else {
              toast.error(`No hay horas de grabación disponibles en días cercanos.`);
            }
          }
          return false;
        }
      }

      // No reubicar: el invitado mantiene su posición en el calendario.
      // La grabación queda registrada en scheduled_date + scheduled_time.
    }
    
    // Validar que el slot de emisión no esté ocupado por otro invitado
    if (guestData.week_date && guestData.day_of_week && guestData.time_slot) {
      let slotQuery = supabase
        .from('guests')
        .select('id, name, time_slot, slot_order')
        .eq('week_date', guestData.week_date)
        .eq('day_of_week', guestData.day_of_week);
      if (guest.id) slotQuery = slotQuery.neq('id', guest.id);

      const { data: dayGuests, error: slotError } = await slotQuery;
      if (slotError) {
        toast.error("Error al verificar el slot de emisión");
        console.error(slotError);
        return false;
      }

      const slotOrder = guestData.slot_order ?? 1;
      const occupant = (dayGuests || []).find(
        (g) => g.time_slot === guestData.time_slot && (g.slot_order ?? 1) === slotOrder
      );
      if (occupant) {
        const taken = new Set((dayGuests || []).filter((g) => (g.slot_order ?? 1) === 1).map((g) => g.time_slot));
        const hourLabels: Record<number, string> = { 1: "1ra", 2: "2da", 3: "3ra" };
        const free = [1, 2, 3].filter((h) => !taken.has(h));
        const freeMsg = free.length
          ? ` Horas libres: ${free.map((h) => hourLabels[h]).join(", ")}.`
          : " No hay horas libres ese día (puedes agregar co-invitado en 3ra hora).";
        toast.error(`${hourLabels[guestData.time_slot] ?? guestData.time_slot}ª hora ya está ocupada por ${occupant.name}.${freeMsg}`);
        return false;
      }
    }

    if (guest.id) {

      // Save previous state for undo
      const previousGuest = guests.find(g => g.id === guest.id);
      const { error } = await supabase.from('guests').update(guestData).eq('id', guest.id);
      if (error) {
        toast.error("Error al actualizar invitado");
        console.error(error);
        return false;
      } else {
        if (previousGuest) {
          pushAction({ type: "update", guestId: guest.id, previousData: { ...previousGuest }, newData: { ...guestData } });
        }
        toast.success("Invitado actualizado");
      }
    } else {
      const { data, error } = await supabase.from('guests').insert([guestData]).select().single();
      if (error) {
        toast.error("Error al crear invitado");
        console.error(error);
        return false;
      } else {
        pushAction({ type: "insert", guestId: data.id, previousData: null, newData: { ...guestData } });
        toast.success("Invitado creado");
      }
    }
    setNewGuestSlot(null);
    return true;
  };

  const triggerN8nScraping = async (guestId: string, name: string, position: string) => {
    try {
      console.log(`Triggering n8n scraping for: ${name} - ${position}`);
      
      const { data, error } = await supabase.functions.invoke('trigger-n8n-scraping', {
        body: { guest_id: guestId, name, position }
      });
      
      if (error) {
        console.error('Error triggering n8n scraping:', error);
        toast.error("Error al solicitar información del invitado");
      } else {
        console.log('n8n scraping triggered successfully:', data);
        toast.info("🔍 Solicitando información del invitado...");
      }
    } catch (err) {
      console.error('Exception triggering n8n scraping:', err);
    }
  };
  const handleDeleteGuest = async (guestId: string) => {
    const guestToDelete = guests.find((g) => g.id === guestId);

    const { error, count } = await supabase.from('guests').delete({ count: 'exact' }).eq('id', guestId);
    if (error || count === 0) {
      toast.error("No se pudo eliminar el invitado (verifica permisos)");
      console.error('Delete failed:', error, 'count:', count);
    } else {
      if (guestToDelete) {
        pushAction({ type: "delete", guestId, previousData: { ...guestToDelete }, newData: null });
      }
      setGuests((prev) => prev.filter((g) => g.id !== guestId));
      setIsModalOpen(false);
      setSelectedGuest(null);
      setNewGuestSlot(null);

      if (guestToDelete) {
        const hasAnotherGuestInSameSlot = guests.some(
          (g) =>
            g.id !== guestId &&
            g.week_date === guestToDelete.week_date &&
            g.day_of_week === guestToDelete.day_of_week &&
            g.time_slot === guestToDelete.time_slot
        );

        if (hasAnotherGuestInSameSlot) {
          toast.warning("Se eliminó el registro, pero existe otro invitado en ese mismo bloque.");
        } else {
          toast.success("Invitado eliminado");
        }
      } else {
        toast.success("Invitado eliminado");
      }

      await fetchGuests();
    }
  };

  const handleMoveGuest = async (guestId: string, newDay: string, newSlot: number, newWeekDate: string, targetGuestId?: string) => {
    // Validar que newDay sea un día de la semana válido
    const validDays = ["monday", "tuesday", "wednesday", "thursday"];
    if (!validDays.includes(newDay)) {
      toast.error("Día inválido");
      console.error(`Invalid day: ${newDay}`);
      return;
    }
    
    // Validar que newSlot sea un slot válido (1, 2, 3)
    if (![1, 2, 3].includes(newSlot)) {
      toast.error("Slot inválido");
      console.error(`Invalid slot: ${newSlot}`);
      return;
    }

    const movedGuest = guests.find(g => g.id === guestId);
    if (!movedGuest) return;

    if (targetGuestId) {
      const targetGuest = guests.find(g => g.id === targetGuestId);
      if (!targetGuest) return;

      const { error: error1 } = await supabase
        .from('guests')
        .update({ 
          day_of_week: targetGuest.day_of_week, 
          time_slot: targetGuest.time_slot,
          week_date: targetGuest.week_date
        })
        .eq('id', guestId);

      const { error: error2 } = await supabase
        .from('guests')
        .update({ 
          day_of_week: newDay, 
          time_slot: newSlot,
          week_date: newWeekDate
        })
        .eq('id', targetGuestId);

      if (error1 || error2) {
        toast.error("Error al intercambiar invitados");
        console.error(error1 || error2);
      } else {
        toast.success("Invitados intercambiados");
      }
    } else {
      const { error } = await supabase
        .from('guests')
        .update({ 
          day_of_week: newDay, 
          time_slot: newSlot,
          week_date: newWeekDate
        })
        .eq('id', guestId);

      if (error) {
        toast.error("Error al mover invitado");
        console.error(error);
      } else {
        toast.success("Invitado movido");
      }
    }
  };
  const handleAddGuest = (day: string, slot: number, weekDate?: string, slotOrder?: number) => {
    const order = slotOrder ?? 1;
    setNewGuestSlot({
      day,
      slot,
      slotOrder: order,
    });
    setSelectedGuest({
      name: "",
      topic: "",
      recording_status: order === 2 ? "recorded" : "proposed",
      day_of_week: day,
      time_slot: slot,
      slot_order: order,
      week_date: weekDate || format(selectedWeek, "yyyy-MM-dd")
    });
    setIsModalOpen(true);
  };
  const handleGuestClick = (guest: Guest) => {
    setSelectedGuest(guest);
    setNewGuestSlot(null);
    setIsModalOpen(true);
  };

  const handleCreateProposed = () => {
    setNewGuestSlot(null);
    setSelectedGuest({
      name: "",
      topic: "",
      recording_status: "proposed",
      day_of_week: null,
      time_slot: null,
      week_date: null,
    });
    setIsModalOpen(true);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Sesión cerrada");
  };

  const searchAllGuests = useCallback(async (query: string) => {
    if (query.length < 3) {
      setGlobalSearchResults({ guests: [], press: [] });
      return;
    }
    setIsSearching(true);

    const readFrom = guestsReadFrom(session);
    const guestOr = session
      ? `name.ilike.%${query}%,topic.ilike.%${query}%,position.ilike.%${query}%,notes.ilike.%${query}%,program_type.ilike.%${query}%,tema_principal.ilike.%${query}%`
      : `name.ilike.%${query}%,topic.ilike.%${query}%,position.ilike.%${query}%,program_type.ilike.%${query}%,tema_principal.ilike.%${query}%`;
    const [guestsRes, pressRes] = await Promise.all([
      (supabase as any)
        .from(readFrom)
        .select('*')
        .or(guestOr)
        .limit(20),
      session
        ? supabase
            .from('guests')
            .select('*')
            .or(`press_contact.ilike.%${query}%,press_phone.ilike.%${query}%,press_email.ilike.%${query}%`)
            .limit(20)
        : Promise.resolve({ data: [] as Guest[] }),
    ]);

    setIsSearching(false);
    setGlobalSearchResults({
      guests: (guestsRes.data || []) as Guest[],
      press: (pressRes.data || []) as Guest[],
    });
  }, [session]);

  // Always point refresh at the latest fetchers (current session/week/view)
  refreshRef.current = () => {
    fetchGuests();
    fetchAllRecordingGuests();
    fetchProposedGuests();
  };

  const handleGlobalResultClick = (guest: Guest) => {
    // Si no tiene fecha asignada, abrir directamente el modal sin navegar
    if (!guest.week_date || !guest.day_of_week) {
      setSelectedGuest(guest);
      setNewGuestSlot(null);
      setIsModalOpen(true);
      setSearchQuery("");
      setGlobalSearchResults({ guests: [], press: [] });
      return;
    }

    // Navegar a la semana/día del invitado
    const weekDate = new Date(guest.week_date + 'T12:00:00');
    const weekStart = startOfWeek(weekDate, { weekStartsOn: 1 });
    setSelectedWeek(weekStart);

    const dayMap: Record<string, string> = {
      monday: "monday",
      tuesday: "tuesday",
      wednesday: "wednesday",
      thursday: "thursday",
    };
    if (dayMap[guest.day_of_week]) {
      setSelectedDay(guest.day_of_week);
    }
    setViewMode("day");

    // Abrir el modal con ese invitado
    setSelectedGuest(guest);
    setNewGuestSlot(null);
    setIsModalOpen(true);

    // Limpiar la búsqueda
    setSearchQuery("");
    setGlobalSearchResults({ guests: [], press: [] });
  };

  const getNextWorkDay = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    
    if (dayOfWeek === 0) {
      return addDays(today, 1);
    } else if (dayOfWeek === 5) {
      return addDays(today, 3);
    } else if (dayOfWeek === 6) {
      return addDays(today, 2);
    }
    
    return today;
  };

  const handleLogoClick = () => {
    const workDay = getNextWorkDay();
    const weekStart = startOfWeek(workDay, { weekStartsOn: 1 });

    const dayMap: Record<number, string> = {
      1: "monday",
      2: "tuesday",
      3: "wednesday",
      4: "thursday"
    };

    setSelectedWeek(weekStart);
    setSelectedMonth(startOfMonth(workDay));
    setSelectedDay(dayMap[workDay.getDay()] || "monday");
    setSearchQuery("");
    setViewMode("day");
  };

  const handleScheduledDateClick = (date: Date) => {
    // Cambiar a vista DÍA
    setViewMode("day");
    
    // Establecer la semana correcta (lunes de esa semana)
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    setSelectedWeek(weekStart);
    
    // Establecer el día correcto basado en la fecha
    const dayMap: Record<number, string> = {
      1: "monday",
      2: "tuesday",
      3: "wednesday",
      4: "thursday"
    };
    const dayOfWeek = date.getDay();
    
    // Si es un día laboral (Lun-Jue), establecerlo
    if (dayMap[dayOfWeek]) {
      setSelectedDay(dayMap[dayOfWeek]);
    }
    
    toast.success(`Navegando a ${format(date, "EEEE d 'de' MMMM", { locale: es })}`);
  };

  const filteredGuests = guests.filter(guest => {
    const matchesSearch = guest.name.toLowerCase().includes(searchQuery.toLowerCase()) || guest.topic.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || guest.recording_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  const isPublic = !session;
  if (isPublic && editMode) {
    setEditMode(false);
  }


  return <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <img 
              src={logo} 
              alt="Bla Bla Blu" 
              className="h-12 w-auto cursor-pointer hover:opacity-80 transition-opacity" 
              onClick={handleLogoClick}
            />
            <div className="flex items-center gap-1">
              <HistoricalSearchDialog />
              {!isPublic && (
                <>
                  <Button variant="ghost" size="sm" onClick={undo} disabled={!canUndo} title="Deshacer (Ctrl+Z)">
                    <Undo2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={redo} disabled={!canRedo} title="Rehacer (Ctrl+Y)">
                    <Redo2 className="h-4 w-4" />
                  </Button>
                  {isAdmin && <ImportExcelModal onImported={refreshData} />}
                  <Button variant="ghost" size="sm" onClick={handleLogout}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Salir
                  </Button>
                </>
              )}
              {isPublic && (
                <Button variant="default" size="sm" onClick={() => navigate("/auth")}>
                  <LogIn className="h-4 w-4 mr-2" />
                  Login
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        <FilterBar 
          searchQuery={searchQuery} 
          onSearchChange={(value) => {
            setSearchQuery(value);
            searchAllGuests(value);
          }} 
          statusFilter={statusFilter} 
          onStatusFilterChange={setStatusFilter} 
          selectedWeek={selectedWeek} 
          onWeekChange={setSelectedWeek}
          selectedMonth={selectedMonth}
          onMonthChange={setSelectedMonth}
          selectedDay={selectedDay}
          onDayChange={setSelectedDay}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          editMode={editMode}
          onEditModeChange={setEditMode}
          canEdit={!isPublic}
          globalSearchResults={globalSearchResults}
          isSearching={isSearching}
          onGlobalResultClick={handleGlobalResultClick}
        />

        {viewMode === "day" && (
          <DayView 
            guests={filteredGuests}
            allGuests={allRecordingGuests}
            onGuestClick={handleGuestClick} 
            onAddGuest={handleAddGuest}
            selectedDay={selectedDay}
            onDayChange={setSelectedDay}
            editMode={editMode}
            selectedDayDate={(() => {
              const dayOffsets: Record<string, number> = { monday: 0, tuesday: 1, wednesday: 2, thursday: 3 };
              const offset = dayOffsets[selectedDay] ?? 0;
              return format(addDays(selectedWeek, offset), "yyyy-MM-dd");
            })()}
            onRecordingGuestClick={handleGlobalResultClick}
            onGuestUpdate={(updatedGuest) => {
              if (updatedGuest.id) {
                setGuests(prev => prev.map(g => 
                  g.id === updatedGuest.id ? { ...g, ...updatedGuest } : g
                ));
              }
            }}
          />
        )}

        {viewMode === "week" && (
          <WeeklyCalendar 
            guests={filteredGuests}
            allGuests={allRecordingGuests}
            onGuestClick={handleGuestClick} 
            onAddGuest={handleAddGuest} 
            selectedWeek={selectedWeek}
            onMoveGuest={handleMoveGuest}
            editMode={editMode}
            onRecordingGuestClick={handleGlobalResultClick}
          />
        )}

        {viewMode === "month" && (
          <MonthView 
            guests={filteredGuests}
            allGuests={allRecordingGuests}
            onGuestClick={handleGuestClick}
            selectedMonth={selectedMonth}
            onDayClick={(day) => {
              setSelectedWeek(startOfWeek(day, { weekStartsOn: 1 }));
              setSelectedDay(["monday", "tuesday", "wednesday", "thursday"][day.getDay() - 1]);
              setViewMode("day");
            }}
            onScheduledDateClick={handleScheduledDateClick}
            onAddGuest={handleAddGuest}
            onMoveGuest={handleMoveGuest}
            editMode={editMode}
            onRecordingGuestClick={handleGlobalResultClick}
          />
        )}

        {viewMode === "proposed" && (
          <ProposedView
            guests={proposedGuests.filter(g => {
              const q = searchQuery.toLowerCase();
              return !q || g.name?.toLowerCase().includes(q) || g.topic?.toLowerCase().includes(q);
            })}
            onGuestClick={handleGuestClick}
            onCreateNew={handleCreateProposed}
            editMode={editMode}
          />
        )}


        <GuestDetailModal 
          guest={selectedGuest} 
          isOpen={isModalOpen} 
          onClose={() => {
            setIsModalOpen(false);
            setSelectedGuest(null);
            setNewGuestSlot(null);
          }} 
          onSave={handleSaveGuest} 
          onDelete={handleDeleteGuest}
          readOnly={!editMode}
        />
      </main>
    </div>;
};
export default Index;