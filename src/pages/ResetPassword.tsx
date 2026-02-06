import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import logo from "@/assets/bla-bla-blu-logo.png";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  const passwordsMatch = password === confirmPassword;
  const canSubmit = passwordsMatch && password.length >= 6;

  useEffect(() => {
    // Check if we have a valid recovery session
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        setIsValidSession(true);
      } else {
        toast.error("El enlace de recuperación ha expirado o es inválido");
        navigate("/auth");
      }
      setCheckingSession(false);
    };

    // Listen for auth state changes (recovery link will trigger this)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsValidSession(true);
        setCheckingSession(false);
      }
    });

    checkSession();

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!passwordsMatch) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    
    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });
      
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Contraseña actualizada correctamente");
        // Sign out and redirect to login
        await supabase.auth.signOut();
        navigate("/auth");
      }
    } catch (error: any) {
      toast.error("Error al actualizar la contraseña");
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Verificando enlace...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isValidSession) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <img src={logo} alt="Bla Bla Blu" className="h-16 w-auto" />
          </div>
          <CardTitle className="text-2xl text-center">
            Nueva Contraseña
          </CardTitle>
          <CardDescription className="text-center">
            Ingresa tu nueva contraseña
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Nueva Contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  disabled={loading}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <div className="relative">
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirmar Nueva Contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  disabled={loading}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {confirmPassword && !passwordsMatch && (
                <p className="text-sm text-destructive">Las contraseñas no coinciden</p>
              )}
            </div>
            
            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading || !canSubmit}
            >
              {loading ? "Actualizando..." : "Actualizar Contraseña"}
            </Button>
          </form>
          
          <div className="mt-4 text-center text-sm">
            <button
              type="button"
              onClick={() => navigate("/auth")}
              className="text-primary hover:underline"
              disabled={loading}
            >
              Volver a Iniciar Sesión
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
