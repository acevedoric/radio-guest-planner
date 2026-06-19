import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AccessDenied } from "./AccessDenied";

interface AuthGuardProps {
  children: React.ReactNode;
}

export const AuthGuard = ({ children }: AuthGuardProps) => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "allowed" | "denied">("loading");
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    let mounted = true;

    const check = async (session: any) => {
      if (!session) {
        // Acceso público de solo lectura
        setEmail("");
        setStatus("allowed");
        return;
      }
      const userEmail = session.user.email ?? "";
      setEmail(userEmail);
      const { data, error } = await supabase.rpc("is_email_allowed", { _email: userEmail });
      if (!mounted) return;
      if (error) {
        console.error("is_email_allowed error:", error);
        setStatus("denied");
        return;
      }
      setStatus(data ? "allowed" : "denied");
    };

    supabase.auth.getSession().then(({ data: { session } }) => check(session));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      check(session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

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

  return <>{children}</>;
};
