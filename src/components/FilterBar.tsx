import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Search, ChevronLeft, ChevronRight, Lock, Unlock, Loader2, CalendarDays } from "lucide-react";
import { addWeeks, subWeeks, addMonths, subMonths, addDays, subDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { Guest } from "@/types/guest";

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  selectedWeek: Date;
  onWeekChange: (date: Date) => void;
  selectedMonth: Date;
  onMonthChange: (date: Date) => void;
  selectedDay: string;
  onDayChange: (day: string) => void;
  viewMode: "day" | "week" | "month";
  onViewModeChange: (mode: "day" | "week" | "month") => void;
  editMode: boolean;
  onEditModeChange: (mode: boolean) => void;
  globalSearchResults: Guest[];
  isSearching: boolean;
  onGlobalResultClick: (guest: Guest) => void;
}


export const FilterBar = ({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  selectedWeek,
  onWeekChange,
  selectedMonth,
  onMonthChange,
  selectedDay,
  onDayChange,
  viewMode,
  onViewModeChange,
  editMode,
  onEditModeChange,
  globalSearchResults,
  isSearching,
  onGlobalResultClick,
}: FilterBarProps) => {
  const searchRef = useRef<HTMLDivElement>(null);
  const calculateDayDate = () => {
    const dayIndex = {
      monday: 0,
      tuesday: 1,
      wednesday: 2,
      thursday: 3
    }[selectedDay] || 0;
    return addDays(selectedWeek, dayIndex);
  };

  const handlePrevious = () => {
    if (viewMode === "day") {
      const currentDate = calculateDayDate();
      let prevDate = subDays(currentDate, 1);
      
      // Skip weekend days
      if (prevDate.getDay() === 0) { // Sunday
        prevDate = subDays(prevDate, 2); // Go to Friday, then will go to Thursday
      }
      if (prevDate.getDay() === 5) { // Friday
        prevDate = subDays(prevDate, 1); // Go to Thursday
      }
      if (prevDate.getDay() === 6) { // Saturday
        prevDate = subDays(prevDate, 2); // Go to Thursday
      }
      
      // Update week if needed
      const newWeekStart = addDays(prevDate, -(prevDate.getDay() - 1));
      onWeekChange(newWeekStart);
      
      // Set the day
      const dayMap: Record<number, string> = {
        1: "monday",
        2: "tuesday",
        3: "wednesday",
        4: "thursday"
      };
      onDayChange(dayMap[prevDate.getDay()]);
      onViewModeChange("day");
    } else if (viewMode === "week") {
      onWeekChange(subWeeks(selectedWeek, 1));
    } else if (viewMode === "month") {
      onMonthChange(subMonths(selectedMonth, 1));
    }
  };

  const handleNext = () => {
    if (viewMode === "day") {
      const currentDate = calculateDayDate();
      let nextDate = addDays(currentDate, 1);
      
      // Skip weekend days
      if (nextDate.getDay() === 5) { // Friday
        nextDate = addDays(nextDate, 3); // Go to Monday
      }
      if (nextDate.getDay() === 6) { // Saturday
        nextDate = addDays(nextDate, 2); // Go to Monday
      }
      if (nextDate.getDay() === 0) { // Sunday
        nextDate = addDays(nextDate, 1); // Go to Monday
      }
      
      // Update week if needed
      const newWeekStart = addDays(nextDate, -(nextDate.getDay() - 1));
      onWeekChange(newWeekStart);
      
      // Set the day
      const dayMap: Record<number, string> = {
        1: "monday",
        2: "tuesday",
        3: "wednesday",
        4: "thursday"
      };
      onDayChange(dayMap[nextDate.getDay()]);
      onViewModeChange("day");
    } else if (viewMode === "week") {
      onWeekChange(addWeeks(selectedWeek, 1));
    } else if (viewMode === "month") {
      onMonthChange(addMonths(selectedMonth, 1));
    }
  };

  const getDateLabel = () => {
    if (viewMode === "day") {
      return format(calculateDayDate(), "d 'de' MMMM yyyy", { locale: es });
    } else if (viewMode === "week") {
      const weekStart = selectedWeek;
      const weekEnd = addDays(selectedWeek, 3);
      return `del ${format(weekStart, "d", { locale: es })} al ${format(weekEnd, "d 'de' MMMM yyyy", { locale: es })}`;
    } else if (viewMode === "month") {
      return format(selectedMonth, "MMMM 'de' yyyy", { locale: es });
    }
    return "";
  };

  return (
    <div className="space-y-4">
      {/* Navigation and View Selector */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handlePrevious}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="min-w-[320px] text-center px-4 py-2 bg-primary/5 rounded-lg border border-primary/20">
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              {viewMode === "day" && "Día"}
              {viewMode === "week" && "Semana"}
              {viewMode === "month" && "Mes"}
            </div>
            <span className="text-2xl font-bold capitalize text-primary">
              {getDateLabel()}
            </span>
          </div>
          
          <Button
            variant="outline"
            size="icon"
            onClick={handleNext}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* View Mode Selector */}
        <div className="flex gap-2 items-center">
          <Button
            variant={viewMode === "day" ? "default" : "outline"}
            onClick={() => onViewModeChange("day")}
          >
            Día
          </Button>
          <Button
            variant={viewMode === "week" ? "default" : "outline"}
            onClick={() => onViewModeChange("week")}
          >
            Semana
          </Button>
          <Button
            variant={viewMode === "month" ? "default" : "outline"}
            onClick={() => onViewModeChange("month")}
          >
            Mes
          </Button>
          
          <div className="h-6 w-px bg-border mx-2" />
          
          <div className="flex items-center gap-2">
            {editMode ? <Unlock className="h-4 w-4 text-primary" /> : <Lock className="h-4 w-4 text-muted-foreground" />}
            <Switch 
              checked={editMode} 
              onCheckedChange={onEditModeChange}
            />
            <span className="text-sm font-medium whitespace-nowrap">
              {editMode ? "Editar" : "Presentar"}
            </span>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-2 w-full">
        <div className="relative flex-1" ref={searchRef}>
          {isSearching ? (
            <Loader2 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
          ) : (
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          )}
          <Input
            placeholder="Buscar por nombre o tema..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />

          {/* Dropdown resultados globales */}
          {searchQuery.length >= 3 && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-popover border border-border rounded-md shadow-lg overflow-hidden">
              {globalSearchResults.length === 0 && !isSearching && (
                <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                  No se encontraron invitados
                </div>
              )}
              {globalSearchResults.map((guest) => {
                const weekDate = new Date(guest.week_date + 'T12:00:00');
                const dateLabel = format(weekDate, "d 'de' MMMM yyyy", { locale: es });
                const dayLabels: Record<string, string> = {
                  monday: "Lun",
                  tuesday: "Mar",
                  wednesday: "Mié",
                  thursday: "Jue",
                };
                return (
                  <button
                    key={guest.id}
                    type="button"
                    className="w-full text-left px-4 py-3 hover:bg-accent transition-colors border-b border-border last:border-0 flex items-start gap-3"
                    onClick={() => onGlobalResultClick(guest)}
                  >
                    <CalendarDays className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{guest.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{guest.topic}</div>
                      <div className="text-xs text-primary mt-0.5">
                        {dayLabels[guest.day_of_week] || guest.day_of_week} · {dateLabel} · Bloque {guest.time_slot}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="live">En Vivo</SelectItem>
            <SelectItem value="recorded">Grabado</SelectItem>
            <SelectItem value="no_recording">Sin Grabación</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
