import { useRef, useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Search, ChevronLeft, ChevronRight, Lock, Unlock, Loader2, CalendarDays, User, Phone, Sparkles, X } from "lucide-react";
import { addWeeks, subWeeks, addMonths, subMonths, addDays, subDays, format, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { Guest } from "@/types/guest";
import { supabase } from "@/integrations/supabase/client";

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
  viewMode: "day" | "week" | "month" | "proposed";
  onViewModeChange: (mode: "day" | "week" | "month" | "proposed") => void;
  editMode: boolean;
  onEditModeChange: (mode: boolean) => void;
  canEdit?: boolean;
  globalSearchResults: { guests: Guest[]; press: Guest[] };
  isSearching: boolean;
  onGlobalResultClick: (guest: Guest) => void;
}

const isQuestion = (text: string): boolean => {
  const t = text.trim().toLowerCase();
  return /^[¿?]/.test(t) ||
    /\?$/.test(t) ||
    /^(cuándo|cuando|hace cuánto|hace cuanto|quién|quien|cuántos|cuantos|último|ultima|alguna vez|primera vez|por qué|porque|dime|cuál|cual|cómo|como|qué|que tan)/i.test(t);
};

const AiAnswerWithLinks = ({ text, onNavigate }: { text: string; onNavigate: (weekDate: string, dayOfWeek: string) => void }) => {
  const dayLabelsMap: Record<string, string> = {
    monday: "lunes", tuesday: "martes", wednesday: "miércoles", thursday: "jueves",
  };
  const parts = text.split(/(\[\[.*?\]\])/g);
  return (
    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
      {parts.map((part, i) => {
        const match = part.match(/^\[\[(.+?)\|(.+?)\|(.+?)\]\]$/);
        if (match) {
          const [, name, dayOfWeek, weekDate] = match;
          const date = new Date(weekDate + 'T12:00:00');
          const dayIndex = { monday: 0, tuesday: 1, wednesday: 2, thursday: 3 }[dayOfWeek] || 0;
          const actualDate = addDays(startOfWeek(date, { weekStartsOn: 1 }), dayIndex);
          const label = `${name} (${dayLabelsMap[dayOfWeek] || dayOfWeek} ${format(actualDate, "d 'de' MMMM yyyy", { locale: es })})`;
          return (
            <button
              key={i}
              type="button"
              className="text-primary underline hover:text-primary/80 font-medium cursor-pointer"
              onClick={() => onNavigate(weekDate, dayOfWeek)}
            >
              {label}
            </button>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
};

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
  canEdit = true,
  globalSearchResults,
  isSearching,
  onGlobalResultClick,
}: FilterBarProps) => {
  const searchRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isQuestionMode = searchQuery.length >= 3 && isQuestion(searchQuery);

  useEffect(() => {
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    if (!isQuestionMode) {
      setAiAnswer(null);
      setAiLoading(false);
      return;
    }
    setAiLoading(true);
    setAiAnswer(null);
    aiTimerRef.current = setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke("chat-guests", {
          body: { question: searchQuery },
        });
        if (error) throw error;
        setAiAnswer(data?.answer || "Sin respuesta");
      } catch (e: any) {
        console.error("AI chat error:", e);
        setAiAnswer("Error al consultar la IA. Intenta de nuevo.");
      } finally {
        setAiLoading(false);
      }
    }, 800);
    return () => {
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    };
  }, [searchQuery, isQuestionMode]);

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
      if (prevDate.getDay() === 0) prevDate = subDays(prevDate, 2);
      if (prevDate.getDay() === 5) prevDate = subDays(prevDate, 1);
      if (prevDate.getDay() === 6) prevDate = subDays(prevDate, 2);
      const newWeekStart = addDays(prevDate, -(prevDate.getDay() - 1));
      onWeekChange(newWeekStart);
      const dayMap: Record<number, string> = { 1: "monday", 2: "tuesday", 3: "wednesday", 4: "thursday" };
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
      if (nextDate.getDay() === 5) nextDate = addDays(nextDate, 3);
      if (nextDate.getDay() === 6) nextDate = addDays(nextDate, 2);
      if (nextDate.getDay() === 0) nextDate = addDays(nextDate, 1);
      const newWeekStart = addDays(nextDate, -(nextDate.getDay() - 1));
      onWeekChange(newWeekStart);
      const dayMap: Record<number, string> = { 1: "monday", 2: "tuesday", 3: "wednesday", 4: "thursday" };
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

  const dayLabels: Record<string, string> = {
    monday: "Lun",
    tuesday: "Mar",
    wednesday: "Mié",
    thursday: "Jue",
  };

  const hasResults = (globalSearchResults?.guests?.length || 0) > 0 || (globalSearchResults?.press?.length || 0) > 0;

  return (
    <div className="space-y-4">
      {/* Navigation and View Selector */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          {viewMode !== "proposed" && (
            <Button variant="outline" size="icon" onClick={handlePrevious}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}

          <div className="min-w-[320px] text-center px-4 py-2 bg-primary/5 rounded-lg border border-primary/20">
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              {viewMode === "day" && "Día"}
              {viewMode === "week" && "Semana"}
              {viewMode === "month" && "Mes"}
              {viewMode === "proposed" && "Bandeja"}
            </div>
            <span className="text-2xl font-bold capitalize text-primary">
              {viewMode === "proposed" ? "Propuestos" : getDateLabel()}
            </span>
          </div>

          {viewMode !== "proposed" && (
            <Button variant="outline" size="icon" onClick={handleNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* View Mode Selector */}
        <div className="flex gap-2 items-center">
          <Button variant={viewMode === "day" ? "default" : "outline"} onClick={() => onViewModeChange("day")}>Día</Button>
          <Button variant={viewMode === "week" ? "default" : "outline"} onClick={() => onViewModeChange("week")}>Sem</Button>
          <Button variant={viewMode === "month" ? "default" : "outline"} onClick={() => onViewModeChange("month")}>Mes</Button>
          <Button variant={viewMode === "proposed" ? "default" : "outline"} onClick={() => onViewModeChange("proposed")} title="Propuestos sin fecha">P</Button>
          
          {canEdit && (
            <>
              <div className="h-6 w-px bg-border mx-2" />
              <div className="flex items-center gap-2">
                {editMode ? <Unlock className="h-4 w-4 text-primary" /> : <Lock className="h-4 w-4 text-muted-foreground" />}
                <Switch checked={editMode} onCheckedChange={onEditModeChange} />
                <span className="text-sm font-medium whitespace-nowrap">
                  {editMode ? "Editar" : "Presentar"}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-2 w-full">
        <div className="relative flex-1" ref={searchRef}>
          {isSearching || aiLoading ? (
            <Loader2 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
          ) : isQuestionMode ? (
            <Sparkles className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-primary" />
          ) : (
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          )}
          <Input
            placeholder="Buscar invitados o preguntar a la IA..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 pr-9"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Dropdown resultados */}
          {searchQuery.length >= 3 && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-popover border border-border rounded-md shadow-lg overflow-hidden max-h-[520px] overflow-y-auto">

              {/* Respuesta IA */}
              {isQuestionMode && (
                <div className="border-b border-border">
                  <div className="px-4 py-2 bg-primary/10 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-primary">Respuesta IA</span>
                  </div>
                  <div className="px-4 py-3">
                    {aiLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Pensando...
                      </div>
                    ) : aiAnswer ? (
                      <AiAnswerWithLinks
                        text={aiAnswer}
                        onNavigate={(weekDate, dayOfWeek) => {
                          const date = new Date(weekDate + 'T12:00:00');
                          const monday = startOfWeek(date, { weekStartsOn: 1 });
                          onWeekChange(monday);
                          onDayChange(dayOfWeek);
                          onViewModeChange("day");
                          onSearchChange("");
                        }}
                      />
                    ) : null}
                  </div>
                </div>
              )}

              {!isQuestionMode && !hasResults && !isSearching && (
                <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                  No se encontraron resultados
                </div>
              )}

              {/* Sección INVITADOS */}
              {globalSearchResults.guests.length > 0 && (
                <>
                  <div className="px-4 py-2 bg-muted/50 border-b border-border flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-primary">Invitados</span>
                    <span className="text-xs text-muted-foreground">({globalSearchResults.guests.length})</span>
                  </div>
                  {globalSearchResults.guests.slice(0, 4).map((guest) => {
                    const weekDate = guest.week_date ? new Date(guest.week_date + 'T12:00:00') : null;
                    const dateLabel = weekDate ? format(weekDate, "d 'de' MMMM yyyy", { locale: es }) : "Sin fecha";
                    return (
                      <button
                        key={guest.id}
                        type="button"
                        className="w-full text-left px-4 py-3 hover:bg-accent transition-colors border-b border-border last:border-0 flex items-start gap-3"
                        onClick={() => onGlobalResultClick(guest)}
                      >
                        <CalendarDays className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">
                            {guest.name}
                            {guest.position && <span className="text-muted-foreground font-normal"> · {guest.position}</span>}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">{guest.topic}</div>
                          <div className="text-xs text-primary mt-0.5">
                            {dayLabels[guest.day_of_week] || guest.day_of_week} · {dateLabel} · Bloque {guest.time_slot}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </>
              )}

              {/* Sección PRENSA */}
              {globalSearchResults.press.length > 0 && (
                <>
                  <div className="px-4 py-2 bg-muted/50 border-b border-border flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-primary">Prensa</span>
                    <span className="text-xs text-muted-foreground">({globalSearchResults.press.length})</span>
                  </div>
                  {globalSearchResults.press.slice(0, 4).map((guest) => {
                    const weekDate = guest.week_date ? new Date(guest.week_date + 'T12:00:00') : null;
                    const dateLabel = weekDate ? format(weekDate, "d 'de' MMMM yyyy", { locale: es }) : "Sin fecha";
                    return (
                      <button
                        key={`press-${guest.id}`}
                        type="button"
                        className="w-full text-left px-4 py-3 hover:bg-accent transition-colors border-b border-border last:border-0 flex items-start gap-3"
                        onClick={() => onGlobalResultClick(guest)}
                      >
                        <Phone className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">
                            {guest.press_contact || "Sin contacto"}
                            {guest.press_phone && <span className="text-muted-foreground font-normal"> · {guest.press_phone}</span>}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            Invitado: {guest.name}
                          </div>
                          <div className="text-xs text-primary mt-0.5">
                            {dayLabels[guest.day_of_week] || guest.day_of_week} · {dateLabel}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </>
              )}

              {hasResults && (
                <button
                  type="button"
                  className="w-full text-center px-4 py-2.5 text-sm font-medium text-primary hover:bg-accent transition-colors border-t border-border"
                  onClick={() => {
                    navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
                  }}
                >
                  Ver todos los resultados →
                </button>
              )}
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
