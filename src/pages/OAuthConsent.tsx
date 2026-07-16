import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type OAuthClient = {
  supabase: {
    auth: {
      oauth: {
        getAuthorizationDetails: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
        approveAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
        denyAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
      };
    };
  };
};

const authOAuth = (supabase as unknown as OAuthClient["supabase"]).auth as unknown as {
  oauth: OAuthClient["supabase"]["auth"]["oauth"];
};

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Falta authorization_id");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error } = await authOAuth.oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) {
        setError(error.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error } = approve
      ? await authOAuth.oauth.approveAuthorization(authorizationId)
      : await authOAuth.oauth.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("El servidor de autorización no devolvió una URL de redirección.");
      return;
    }
    window.location.href = target;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>No se pudo cargar la autorización</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <p className="text-muted-foreground">Cargando…</p>
      </div>
    );
  }

  const clientName = details.client?.name ?? details.client?.client_name ?? "una aplicación";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Conectar {clientName} a Bla Bla Blu</CardTitle>
          <CardDescription>
            Esto permite que {clientName} use las herramientas de Bla Bla Blu como tú.
            Se respetarán tus permisos de la app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-muted-foreground">
            <p><strong>Redirección:</strong> {details.client?.redirect_uri ?? "—"}</p>
            {details.scope && <p><strong>Permisos solicitados:</strong> {details.scope}</p>}
          </div>
          <div className="flex gap-2">
            <Button disabled={busy} onClick={() => decide(true)} className="flex-1">
              Aprobar
            </Button>
            <Button disabled={busy} onClick={() => decide(false)} variant="outline" className="flex-1">
              Rechazar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
