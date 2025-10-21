import { useState, useEffect } from "react";
import { startOfWeek } from "date-fns";
import { Radio } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { WeeklyCalendar } from "@/components/WeeklyCalendar";
import { GuestDetailModal } from "@/components/GuestDetailModal";
import { FilterBar } from "@/components/FilterBar";
import { StatsPanel } from "@/components/StatsPanel";
import { Guest } from "@/types/guest";
const Index = () => {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [selectedWeek, setSelectedWeek] = useState(startOfWeek(new Date(), {
    weekStartsOn: 1
  }));
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newGuestSlot, setNewGuestSlot] = useState<{
    day: string;
    slot: number;
  } | null>(null);
  useEffect(() => {
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
  }, [selectedWeek]);
  const fetchGuests = async () => {
    const weekStart = selectedWeek.toISOString().split('T')[0];
    const {
      data,
      error
    } = await supabase.from('guests').select('*').eq('week_date', weekStart).order('day_of_week').order('time_slot');
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
      recording_status: "no_recording",
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
  const filteredGuests = guests.filter(guest => {
    const matchesSearch = guest.name.toLowerCase().includes(searchQuery.toLowerCase()) || guest.topic.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || guest.recording_status === statusFilter;
    return matchesSearch && matchesStatus;
  });
  return <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-lg">
              <Radio className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Bla Bla Blu - Planner</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        <StatsPanel guests={filteredGuests} />
        
        <FilterBar searchQuery={searchQuery} onSearchChange={setSearchQuery} statusFilter={statusFilter} onStatusFilterChange={setStatusFilter} selectedWeek={selectedWeek} onWeekChange={setSelectedWeek} />

        <WeeklyCalendar guests={filteredGuests} onGuestClick={handleGuestClick} onAddGuest={handleAddGuest} selectedWeek={selectedWeek} />

        <GuestDetailModal guest={selectedGuest} isOpen={isModalOpen} onClose={() => {
        setIsModalOpen(false);
        setSelectedGuest(null);
        setNewGuestSlot(null);
      }} onSave={handleSaveGuest} onDelete={handleDeleteGuest} />
      </main>
    </div>;
};
export default Index;