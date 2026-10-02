import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AccessDenied } from "./AccessDenied";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

interface AuthGuardProps {
  children: React.ReactNode;
}

export const AuthGuard = ({ children }: AuthGuardProps) => {
  const [status, setStatus] = useState<"loading" | "allowed" | "denied" | "verification_error">("loading");
  const [email, setEmail] = useState<string>("");
  const [retryKey, setRetryKey] = useState(0);
  const verifiedUserRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let checkId = 0;

    const check = async (session: { user?: { id?: string; email?: string | null } } | null) => {
      const currentCheck = ++checkId;
      const isCurrent = () => mounted && currentCheck === checkId;

      if (!session) {
        // Acceso público de solo lectura
        verifiedUserRef.current = null;
        if (isCurrent()) {
          setEmail("");
          setStatus("allowed");
        }
        return;
      }

      // Ya verificado para este mismo usuario: no reiniciar la pantalla
      if (verifiedUserRef.current && verifiedUserRef.current === session.user?.id) {
        return;
      }

      setStatus("loading");

      const markAllowed = () => {
        verifiedUserRef.current = session.user?.id ?? null;
        setStatus("allowed");
      };

      // Usar primero los datos de la sesión local; solo llamar a getUser()
      // cuando la sesión no trae email (evita 403 bad_jwt con tokens inválidos).
      const sessionEmail = (session.user?.email ?? "").trim().toLowerCase();
      let userEmail = sessionEmail;

      if (!userEmail) {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (!isCurrent()) return;
        if (userError || !userData.user) {
          // Token inválido o expirado: cerrar sesión y volver al acceso público
          // de solo lectura en lugar de mostrar un error sin salida.
          console.error("Could not verify the current user:", userError);
          await supabase.auth.signOut();
          verifiedUserRef.current = null;
          if (isCurrent()) {
            setEmail("");
            setStatus("allowed");
          }
          return;
        }
        userEmail = (userData.user.email ?? "").trim().toLowerCase();
      }
      setEmail(userEmail);

      // Corporate accounts are explicitly permitted by the project's access policy.
      if (userEmail.endsWith("@caracoltv.com.co")) {
        markAllowed();
        return;
      }

      const { data, error } = await supabase.rpc("is_email_allowed", { _email: userEmail });
      if (!isCurrent()) return;
      if (error) {
        console.error("is_email_allowed error:", error);
        setStatus("verification_error");
        return;
      }
      if (data) markAllowed();
      else {
        verifiedUserRef.current = null;
        setStatus("denied");
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => check(session));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED") return;
      check(session);
    });

    return () => {
      mounted = false;
      checkId += 1;
      subscription.unsubscribe();
    };
  }, [retryKey]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Verificando acceso...</div>
      </div>
    );
  }

  if (status === "denied") {
    return <AccessDenied email={email} />;
  }

  if (status === "verification_error") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-4 text-center">
            <div className="flex justify-center">
              <div className="rounded-full bg-destructive/10 p-3">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
            </div>
            <CardTitle className="text-2xl">No pudimos verificar tu acceso</CardTitle>
            <CardDescription>
              Hubo un problema de conexión. Tu cuenta no fue rechazada; inténtalo de nuevo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => setRetryKey((value) => value + 1)}>
              Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};
