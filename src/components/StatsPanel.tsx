import { Card } from "@/components/ui/card";
import { Users, Radio, Mic, XCircle } from "lucide-react";

interface Guest {
  recording_status: string;
  day_of_week: string;
}

interface StatsPanelProps {
  guests: Guest[];
}

export const StatsPanel = ({ guests }: StatsPanelProps) => {
  const totalGuests = guests.length;
  const liveCount = guests.filter(g => g.recording_status === "live").length;
  const recordedCount = guests.filter(g => g.recording_status === "recorded").length;
  const cancelledCount = guests.filter(g => g.recording_status === "cancelled").length;

  const guestsByDay = {
    monday: guests.filter(g => g.day_of_week === "monday").length,
    tuesday: guests.filter(g => g.day_of_week === "tuesday").length,
    wednesday: guests.filter(g => g.day_of_week === "wednesday").length,
    thursday: guests.filter(g => g.day_of_week === "thursday").length,
  };

  const stats = [
    {
      label: "Total Invitados",
      value: totalGuests,
      icon: Users,
      color: "text-primary",
    },
    {
      label: "En Vivo",
      value: liveCount,
      icon: Radio,
      color: "text-status-live",
    },
    {
      label: "Grabados",
      value: recordedCount,
      icon: Mic,
      color: "text-status-recorded",
    },
    {
      label: "Cancelados",
      value: cancelledCount,
      icon: XCircle,
      color: "text-status-cancelled",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold mt-1">{stat.value}</p>
              </div>
              <stat.icon className={`w-8 h-8 ${stat.color}`} />
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <h3 className="font-semibold mb-3">Invitados por Día</h3>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Lunes</p>
            <p className="text-xl font-semibold">{guestsByDay.monday}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Martes</p>
            <p className="text-xl font-semibold">{guestsByDay.tuesday}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Miércoles</p>
            <p className="text-xl font-semibold">{guestsByDay.wednesday}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Jueves</p>
            <p className="text-xl font-semibold">{guestsByDay.thursday}</p>
          </div>
        </div>
      </Card>
    </div>
  );
};
