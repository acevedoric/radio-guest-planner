import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface GuestSuggestion {
  name: string;
  position: string | null;
  phone: string | null;
  email?: string | null;
  social_networks: any;
}

interface PressSuggestion {
  press_contact: string;
  press_phone: string | null;
  press_email: string | null;
}

export function useGuestAutocomplete() {
  const [guestSuggestions, setGuestSuggestions] = useState<GuestSuggestion[]>([]);
  const [pressSuggestions, setPressSuggestions] = useState<PressSuggestion[]>([]);
  const [showGuestSuggestions, setShowGuestSuggestions] = useState(false);
  const [showPressSuggestions, setShowPressSuggestions] = useState(false);
  const guestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchGuests = (term: string) => {
    if (guestTimer.current) clearTimeout(guestTimer.current);
    if (term.length < 3) {
      setGuestSuggestions([]);
      setShowGuestSuggestions(false);
      return;
    }
    guestTimer.current = setTimeout(async () => {
      const { data } = await supabase
        .from("guests")
        .select("name, position, phone, email, social_networks")
        .ilike("name", `%${term}%`)
        .order("updated_at", { ascending: false })
        .limit(20);

      if (data) {
        // Deduplicate by name (keep most recent)
        const seen = new Set<string>();
        const unique = data.filter((g) => {
          const key = g.name.toLowerCase().trim();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setGuestSuggestions(unique.slice(0, 5));
        setShowGuestSuggestions(unique.length > 0);
      }
    }, 300);
  };

  const searchPress = (term: string) => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    if (term.length < 3) {
      setPressSuggestions([]);
      setShowPressSuggestions(false);
      return;
    }
    pressTimer.current = setTimeout(async () => {
      const { data } = await supabase
        .from("guests")
        .select("press_contact, press_phone, press_email")
        .ilike("press_contact", `%${term}%`)
        .not("press_contact", "is", null)
        .order("updated_at", { ascending: false })
        .limit(20);

      if (data) {
        const seen = new Set<string>();
        const unique: PressSuggestion[] = [];
        for (const row of data) {
          if (!row.press_contact) continue;
          const key = row.press_contact.toLowerCase().trim();
          if (seen.has(key)) continue;
          seen.add(key);
          unique.push({
            press_contact: row.press_contact,
            press_phone: row.press_phone,
            press_email: row.press_email,
          });
        }
        setPressSuggestions(unique.slice(0, 5));
        setShowPressSuggestions(unique.length > 0);
      }
    }, 300);
  };

  const dismissGuestSuggestions = () => setShowGuestSuggestions(false);
  const dismissPressSuggestions = () => setShowPressSuggestions(false);

  useEffect(() => {
    return () => {
      if (guestTimer.current) clearTimeout(guestTimer.current);
      if (pressTimer.current) clearTimeout(pressTimer.current);
    };
  }, []);

  return {
    guestSuggestions,
    pressSuggestions,
    showGuestSuggestions,
    showPressSuggestions,
    searchGuests,
    searchPress,
    dismissGuestSuggestions,
    dismissPressSuggestions,
  };
}
