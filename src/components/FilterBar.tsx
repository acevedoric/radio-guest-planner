import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { addWeeks, subWeeks, addMonths, subMonths, format } from "date-fns";
import { es } from "date-fns/locale";

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
  viewMode: "day" | "week" | "month";
  onViewModeChange: (mode: "day" | "week" | "month") => void;
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
  viewMode,
  onViewModeChange,
}: FilterBarProps) => {
  const handlePrevious = () => {
    if (viewMode === "week") {
      onWeekChange(subWeeks(selectedWeek, 1));
    } else if (viewMode === "month") {
      onMonthChange(subMonths(selectedMonth, 1));
    }
  };

  const handleNext = () => {
    if (viewMode === "week") {
      onWeekChange(addWeeks(selectedWeek, 1));
    } else if (viewMode === "month") {
      onMonthChange(addMonths(selectedMonth, 1));
    }
  };

  const getDateLabel = () => {
    if (viewMode === "week") {
      return format(selectedWeek, "'Semana del' d 'de' MMMM 'de' yyyy", { locale: es });
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
          
          <div className="min-w-[280px] text-center">
            <span className="text-lg font-semibold capitalize">
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
        <div className="flex gap-2">
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
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-2 w-full">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o tema..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
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
