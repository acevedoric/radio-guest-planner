import { useState, useEffect, useCallback } from "react";
import { Navigate } from "react-router-dom";
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
import { Guest } from "@/types/guest";
import logo from "@/assets/bla-bla-blu-logo.png";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

const Index = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("week");
  const [selectedWeek, setSelectedWeek] = useState(startOfWeek(new Date(), {
    weekStartsOn: 1
  }));
  const [selectedDay, setSelectedDay] = useState("monday");
  const [selectedMonth, setSelectedMonth] = useState(startOfMonth(new Date()));
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [globalSearchResults, setGlobalSearchResults] = useState<{ guests: Guest[]; press: Guest[] }>({ guests: [], press: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newGuestSlot, setNewGuestSlot] = useState<{
    day: string;
    slot: number;
  } | null>(null);
  const [editMode, setEditMode] = useState(false);
  
  // Check authentication status
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      fetchGuests();

      // Setup realtime subscription
      const channel = supabase.channel('schema-db-changes').on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'guests'
      }, () => fetchGuests()).subscribe();
      
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedWeek, selectedMonth, viewMode, session]);

  const fetchGuests = async () => {
    let query = supabase.from('guests').select('*');
    
    if (viewMode === "day" || viewMode === "week") {
      const weekStart = selectedWeek.toISOString().split('T')[0];
      query = query.eq('week_date', weekStart);
    } else if (viewMode === "month") {
      const monthStart = startOfMonth(selectedMonth);
      const monthEnd = endOfMonth(selectedMonth);
      
      const mondaysInMonth: string[] = [];
      let current = startOfWeek(monthStart, { weekStartsOn: 1 });
      const end = startOfWeek(monthEnd, { weekStartsOn: 1 });
      
      while (current <= end) {
        mondaysInMonth.push(current.toISOString().split('T')[0]);
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
  const handleSaveGuest = async (guest: Guest) => {
    const guestData = {
      ...guest,
      week_date: selectedWeek.toISOString().split('T')[0],
      day_of_week: newGuestSlot?.day || guest.day_of_week,
      time_slot: newGuestSlot?.slot || guest.time_slot
    };

    // Si el estado es "postponed" y hay scheduled_date, mover al nuevo día
    if (guestData.recording_status === "postponed" && guestData.scheduled_date) {
      const scheduledDate = new Date(guestData.scheduled_date + 'T12:00:00');
      const dayOfWeekNum = scheduledDate.getDay(); // 0=Dom, 1=Lun, ... 4=Jue

      const dayMap: Record<number, string> = {
        1: "monday",
        2: "tuesday",
        3: "wednesday",
        4: "thursday"
      };

      if (!dayMap[dayOfWeekNum]) {
        toast.error("La fecha seleccionada no cae en un día laboral (Lunes a Jueves)");
        return;
      }

      const newDayOfWeek = dayMap[dayOfWeekNum];
      const newWeekDate = startOfWeek(scheduledDate, { weekStartsOn: 1 });
      const newWeekDateStr = newWeekDate.toISOString().split('T')[0];

      // Verificar disponibilidad del slot
      let conflictQuery = supabase
        .from('guests')
        .select('id, name')
        .eq('week_date', newWeekDateStr)
        .eq('day_of_week', newDayOfWeek)
        .eq('time_slot', guestData.time_slot);

      if (guest.id) {
        conflictQuery = conflictQuery.neq('id', guest.id);
      }

      const { data: conflicts, error: conflictError } = await conflictQuery;

      if (conflictError) {
        toast.error("Error al verificar disponibilidad");
        console.error(conflictError);
        return;
      }

      if (conflicts && conflicts.length > 0) {
        const dayNames: Record<string, string> = {
          monday: "Lunes", tuesday: "Martes", wednesday: "Miércoles", thursday: "Jueves"
        };
        toast.error(`El slot ${guestData.time_slot} del ${dayNames[newDayOfWeek]} ya está ocupado por "${conflicts[0].name}"`);
        return;
      }

      // Mover el invitado al nuevo día/semana
      guestData.day_of_week = newDayOfWeek;
      guestData.week_date = newWeekDateStr;
    }
    
    if (guest.id) {
      const { error } = await supabase.from('guests').update(guestData).eq('id', guest.id);
      if (error) {
        toast.error("Error al actualizar invitado");
        console.error(error);
      } else {
        toast.success("Invitado actualizado y movido");
      }
    } else {
      const { data, error } = await supabase.from('guests').insert([guestData]).select().single();
      if (error) {
        toast.error("Error al crear invitado");
        console.error(error);
      } else {
        toast.success("Invitado creado");
      }
    }
    setNewGuestSlot(null);
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
    const { error } = await supabase.from('guests').delete().eq('id', guestId);
    if (error) {
      toast.error("Error al eliminar invitado");
      console.error(error);
    } else {
      toast.success("Invitado eliminado");
      setGuests(prev => prev.filter(g => g.id !== guestId));
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
  const handleAddGuest = (day: string, slot: number, weekDate?: string) => {
    setNewGuestSlot({
      day,
      slot
    });
    setSelectedGuest({
      name: "",
      topic: "",
      recording_status: "proposed",
      day_of_week: day,
      time_slot: slot,
      week_date: weekDate || selectedWeek.toISOString().split('T')[0]
    });
    setIsModalOpen(true);
  };
  const handleGuestClick = (guest: Guest) => {
    setSelectedGuest(guest);
    setNewGuestSlot(null);
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

    const [guestsRes, pressRes] = await Promise.all([
      supabase
        .from('guests')
        .select('*')
        .or(`name.ilike.%${query}%,topic.ilike.%${query}%,position.ilike.%${query}%,notes.ilike.%${query}%,program_type.ilike.%${query}%,tema_principal.ilike.%${query}%`)
        .limit(20),
      supabase
        .from('guests')
        .select('*')
        .or(`press_contact.ilike.%${query}%,press_phone.ilike.%${query}%`)
        .limit(20),
    ]);

    setIsSearching(false);
    setGlobalSearchResults({
      guests: (guestsRes.data || []) as Guest[],
      press: (pressRes.data || []) as Guest[],
    });
  }, []);

  const handleGlobalResultClick = (guest: Guest) => {
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
    
    setViewMode("day");
    setSelectedWeek(weekStart);
    
    const dayMap: Record<number, string> = {
      1: "monday",
      2: "tuesday",
      3: "wednesday",
      4: "thursday"
    };
    setSelectedDay(dayMap[workDay.getDay()]);
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

  if (!session) {
    return <Navigate to="/auth" />;
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
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Salir
            </Button>
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
          globalSearchResults={globalSearchResults}
          isSearching={isSearching}
          onGlobalResultClick={handleGlobalResultClick}
        />

        {viewMode === "day" && (
          <DayView 
            guests={filteredGuests} 
            onGuestClick={handleGuestClick} 
            onAddGuest={handleAddGuest}
            selectedDay={selectedDay}
            onDayChange={setSelectedDay}
            editMode={editMode}
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
            onGuestClick={handleGuestClick} 
            onAddGuest={handleAddGuest} 
            selectedWeek={selectedWeek}
            onMoveGuest={handleMoveGuest}
            editMode={editMode}
          />
        )}

        {viewMode === "month" && (
          <MonthView 
            guests={filteredGuests} 
            onGuestClick={handleGuestClick}
            selectedMonth={selectedMonth}
            onDayClick={(day) => {
              setSelectedDay(["monday", "tuesday", "wednesday", "thursday"][day.getDay() - 1]);
              setViewMode("day");
            }}
            onScheduledDateClick={handleScheduledDateClick}
            onAddGuest={handleAddGuest}
            onMoveGuest={handleMoveGuest}
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