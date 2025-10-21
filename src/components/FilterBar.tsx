import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { addWeeks, subWeeks, format } from "date-fns";
import { es } from "date-fns/locale";

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  selectedWeek: Date;
  onWeekChange: (date: Date) => void;
}

export const FilterBar = ({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  selectedWeek,
  onWeekChange,
}: FilterBarProps) => {
  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
      <div className="flex gap-2 items-center">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onWeekChange(subWeeks(selectedWeek, 1))}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="font-semibold text-lg min-w-[200px] text-center">
          {format(selectedWeek, "'Semana del' d 'de' MMMM", { locale: es })}
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onWeekChange(addWeeks(selectedWeek, 1))}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex gap-2 w-full sm:w-auto">
        <div className="relative flex-1 sm:w-64">
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
