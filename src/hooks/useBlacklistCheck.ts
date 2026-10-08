import { useCallback, useEffect, useRef, useState } from "react";
import { checkBlacklist, BlacklistMatch } from "@/lib/blacklist";

/**
 * Chequea el nombre contra la lista negra (debounced). Si la mejor coincidencia
 * es aproximada, queda "pendiente de confirmación" hasta que el usuario responda
 * si es la misma persona o no.
 */
export function useBlacklistCheck(name: string | undefined | null) {
  const [match, setMatch] = useState<BlacklistMatch | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const prevName = useRef<string>("");

  useEffect(() => {
    const trimmed = (name || "").trim();
    if (timer.current) clearTimeout(timer.current);

    if (trimmed !== prevName.current) {
      setConfirmed(false);
      setDismissed(false);
    }

    if (!trimmed || trimmed.length < 3) {
      setMatch(null);
      prevName.current = trimmed;
      return;
    }

    timer.current = setTimeout(async () => {
      try {
        const results = await checkBlacklist(trimmed);
        setMatch(results[0] || null);
      } catch (error) {
        console.error("Error checking blacklist:", error);
      }
      prevName.current = trimmed;
    }, 300);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [name]);

  const confirm = useCallback(() => setConfirmed(true), []);
  const dismiss = useCallback(() => setDismissed(true), []);
  const reset = useCallback(() => {
    setMatch(null);
    setConfirmed(false);
    setDismissed(false);
    prevName.current = "";
  }, []);

  const pendingConfirmation = !!match && match.match_type === "approximate" && !confirmed && !dismissed;
  const blocked = !!match && !dismissed && (match.match_type === "exact" || confirmed);

  return { match, pendingConfirmation, blocked, confirm, dismiss, reset };
}
