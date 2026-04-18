import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";

interface AccessDeniedProps {
  email: string;
}

export const AccessDenied = ({ email }: AccessDeniedProps) => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  const handleRequest = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("access_requests")
        .insert({ email, message: message.trim() || null });
      if (error) throw error;
      toast.success("Solicitud enviada. El equipo revisará tu acceso.");
      setOpen(false);
      setMessage("");
    } catch (err: any) {
      toast.error(err.message || "No se pudo enviar la solicitud");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center">
            <div className="rounded-full bg-destructive/10 p-3">
              <ShieldAlert className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <CardTitle className="text-2xl">Acceso denegado</CardTitle>
          <CardDescription>
            Tú (<span className="font-medium text-foreground">{email}</span>) no tienes acceso a este proyecto. Solicita acceso al equipo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full" onClick={() => setOpen(true)}>
            Solicitar acceso
          </Button>
          <Button variant="outline" className="w-full" onClick={handleSignOut}>
            Cerrar sesión
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar acceso</DialogTitle>
            <DialogDescription>
              Cuéntanos brevemente quién eres y por qué necesitas acceso (opcional).
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Hola, soy... y necesito acceso porque..."
            rows={4}
            disabled={loading}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={handleRequest} disabled={loading}>
              {loading ? "Enviando..." : "Enviar solicitud"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
