import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { startOfWeek, startOfMonth, addDays, addWeeks, endOfMonth } from "date-fns";
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
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newGuestSlot, setNewGuestSlot] = useState<{
    day: string;
    slot: number;
  } | null>(null);
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
    if (guest.id) {
      const {
        error
      } = await supabase.from('guests').update(guestData).eq('id', guest.id);
      if (error) {
        toast.error("Error al actualizar invitado");
        console.error(error);
      } else {
        toast.success("Invitado actualizado");
      }
    } else {
      const {
        error
      } = await supabase.from('guests').insert([guestData]);
      if (error) {
        toast.error("Error al crear invitado");
        console.error(error);
      } else {
        toast.success("Invitado creado");
      }
    }
    setNewGuestSlot(null);
  };
  const handleDeleteGuest = async (guestId: string) => {
    const {
      error
    } = await supabase.from('guests').delete().eq('id', guestId);
    if (error) {
      toast.error("Error al eliminar invitado");
      console.error(error);
    } else {
      toast.success("Invitado eliminado");
    }
  };
  const handleAddGuest = (day: string, slot: number) => {
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
      week_date: selectedWeek.toISOString().split('T')[0]
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
          onSearchChange={setSearchQuery} 
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
        />

        {viewMode === "day" && (
          <DayView 
            guests={filteredGuests} 
            onGuestClick={handleGuestClick} 
            onAddGuest={handleAddGuest}
            selectedDay={selectedDay}
            onDayChange={setSelectedDay}
          />
        )}

        {viewMode === "week" && (
          <WeeklyCalendar 
            guests={filteredGuests} 
            onGuestClick={handleGuestClick} 
            onAddGuest={handleAddGuest} 
            selectedWeek={selectedWeek} 
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
          />
        )}

        <GuestDetailModal guest={selectedGuest} isOpen={isModalOpen} onClose={() => {
        setIsModalOpen(false);
        setSelectedGuest(null);
        setNewGuestSlot(null);
      }} onSave={handleSaveGuest} onDelete={handleDeleteGuest} />
      </main>
    </div>;
};
export default Index;