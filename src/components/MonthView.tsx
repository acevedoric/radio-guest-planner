import { Card } from "@/components/ui/card";
import { Guest } from "@/types/guest";
import { startOfMonth, endOfMonth, eachDayOfInterval, format, isSameDay, startOfWeek, endOfWeek } from "date-fns";
import { es } from "date-fns/locale";

interface MonthViewProps {
  guests: Guest[];
  onGuestClick: (guest: Guest) => void;
  selectedMonth: Date;
  onDayClick: (day: Date) => void;
}

export const MonthView = ({ guests, onGuestClick, selectedMonth, onDayClick }: MonthViewProps) => {
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getGuestsForDay = (day: Date) => {
    const dayStr = format(day, "yyyy-MM-dd");
    return guests.filter(g => g.week_date && g.week_date.toString().startsWith(dayStr.substring(0, 7)));
  };

  const isCurrentMonth = (day: Date) => {
    return day.getMonth() === selectedMonth.getMonth();
  };

  const isWorkDay = (day: Date) => {
    const dayOfWeek = day.getDay();
    return dayOfWeek >= 1 && dayOfWeek <= 4; // Monday to Thursday
  };

  return (
    <div className="space-y-4">
      {/* Month Calendar Grid */}
      <div className="grid grid-cols-7 gap-2">
        {/* Day headers */}
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
          <div key={day} className="text-center text-sm font-semibold text-muted-foreground py-2">
            {day}
          </div>
        ))}

        {/* Calendar days */}
        {calendarDays.map((day, index) => {
          const dayGuests = getGuestsForDay(day);
          const hasGuests = dayGuests.length > 0;
          const isInMonth = isCurrentMonth(day);
          const isWork = isWorkDay(day);

          return (
            <Card
              key={index}
              className={`min-h-[120px] p-2 transition-all ${
                !isInMonth ? "opacity-30 bg-muted/30" : ""
              } ${
                isWork && isInMonth ? "cursor-pointer hover:shadow-md hover:border-primary" : ""
              } ${
                hasGuests ? "border-primary/50 bg-primary/5" : ""
              }`}
              onClick={() => {
                if (isWork && isInMonth) {
                  onDayClick(day);
                }
              }}
            >
              <div className="space-y-2">
                {/* Day number */}
                <div className={`text-sm font-semibold ${
                  hasGuests ? "text-primary" : "text-foreground"
                }`}>
                  {format(day, "d")}
                </div>

                {/* Guests for this day */}
                {hasGuests && (
                  <div className="space-y-1">
                    {dayGuests.slice(0, 3).map((guest, gIndex) => (
                      <div
                        key={gIndex}
                        className="text-xs p-1 bg-card rounded cursor-pointer hover:bg-primary/10 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          onGuestClick(guest);
                        }}
                      >
                        <div className="font-semibold text-foreground truncate">
                          {guest.name}
                        </div>
                        <div className="text-muted-foreground truncate">
                          {guest.topic}
                        </div>
                      </div>
                    ))}
                    {dayGuests.length > 3 && (
                      <div className="text-xs text-muted-foreground text-center">
                        +{dayGuests.length - 3} más
                      </div>
                    )}
                  </div>
                )}

                {/* Empty state for work days */}
                {!hasGuests && isWork && isInMonth && (
                  <div className="text-xs text-muted-foreground text-center pt-4">
                    Sin invitados
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
