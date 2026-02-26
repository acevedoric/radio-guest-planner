import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Navigate } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { Guest } from "@/types/guest";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CalendarDays, Loader2, Search } from "lucide-react";
import logo from "@/assets/bla-bla-blu-logo.png";

const statusLabels: Record<string, string> = {
  live: "En Vivo",
  recorded: "Grabado",
  to_record: "Por Grabar",
  postponed: "Pospuesto",
  proposed: "Propuesto",
  no_recording: "Sin Grabación",
  cancelled: "Cancelado",
};

const statusColors: Record<string, string> = {
  live: "bg-red-500/10 text-red-600 border-red-200",
  recorded: "bg-green-500/10 text-green-600 border-green-200",
  to_record: "bg-yellow-500/10 text-yellow-600 border-yellow-200",
  postponed: "bg-orange-500/10 text-orange-600 border-orange-200",
  proposed: "bg-blue-500/10 text-blue-600 border-blue-200",
  no_recording: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-muted text-muted-foreground border-border",
};

const dayLabels: Record<string, string> = {
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miércoles",
  thursday: "Jueves",
};

const SearchResults = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get("q") || "";
  const [results, setResults] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!session || !query || query.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    const fetchResults = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("guests")
        .select("*")
        .or(
          `name.ilike.%${query}%,topic.ilike.%${query}%,position.ilike.%${query}%,notes.ilike.%${query}%,program_type.ilike.%${query}%`
        )
        .order("week_date", { ascending: false })
        .limit(100);

      if (!error && data) {
        setResults(data as Guest[]);
      }
      setLoading(false);
    };

    fetchResults();
  }, [query, session]);

  const handleGuestClick = (guest: Guest) => {
    // Navigate to Index with params to open this guest
    const params = new URLSearchParams({
      guestWeek: guest.week_date,
      guestDay: guest.day_of_week,
      guestId: guest.id || "",
    });
    navigate(`/?${params.toString()}`);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Bla Bla Blu" className="h-10 w-auto" />
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver al calendario
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <Search className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">
            Resultados para "{query}"
          </h1>
          {!loading && (
            <Badge variant="secondary" className="text-sm">
              {results.length} resultado{results.length !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Buscando...</span>
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Search className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg">No se encontraron invitados para "{query}"</p>
            <p className="text-sm mt-2">Intenta con otro término de búsqueda</p>
          </div>
        ) : (
          <div className="space-y-3">
            {results.map((guest) => {
              const weekDate = new Date(guest.week_date + "T12:00:00");
              const dateLabel = format(weekDate, "d 'de' MMMM yyyy", { locale: es });

              return (
                <button
                  key={guest.id}
                  onClick={() => handleGuestClick(guest)}
                  className="w-full text-left p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors flex items-start gap-4"
                >
                  <CalendarDays className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-base">{guest.name}</span>
                      {guest.position && (
                        <span className="text-sm text-muted-foreground">· {guest.position}</span>
                      )}
                      <Badge
                        variant="outline"
                        className={`text-xs ${statusColors[guest.recording_status] || ""}`}
                      >
                        {statusLabels[guest.recording_status] || guest.recording_status}
                      </Badge>
                    </div>
                    {guest.topic && (
                      <p className="text-sm text-muted-foreground mt-1 truncate">
                        Tema: {guest.topic}
                      </p>
                    )}
                    <div className="text-xs text-primary mt-1">
                      {dayLabels[guest.day_of_week] || guest.day_of_week} · Semana del {dateLabel} · Bloque {guest.time_slot}
                    </div>
                    {guest.notes && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        📝 {guest.notes}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default SearchResults;
