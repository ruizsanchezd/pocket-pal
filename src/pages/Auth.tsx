import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoginForm } from '@/components/auth/LoginForm';
import { SignUpForm } from '@/components/auth/SignUpForm';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const { user, loading, profile, isNewUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      // Only redirect to onboarding for NEW users who haven't completed it
      if (isNewUser && !profile?.onboarding_completed) {
        navigate('/onboarding');
      } else {
        // All other cases: existing users go to main app
        navigate('/movimientos');
      }
    }
  }, [user, loading, profile, isNewUser, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary items-center justify-center p-12">
        <div className="max-w-md text-primary-foreground">
          <div className="flex items-center gap-3 mb-8">
            <TrendingUp className="h-10 w-10" />
            <span className="text-3xl font-bold">PocketPal</span>
          </div>
          <h2 className="text-4xl font-bold mb-4">
            Controla tus finanzas de forma simple
          </h2>
          <p className="text-lg opacity-90">
            Registra tus gastos e ingresos en segundos, categorízalos y visualiza 
            tu patrimonio total con su evolución mes a mes.
          </p>
          <div className="mt-12 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-primary-foreground" />
              <span>Añade un gasto en 5 segundos</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-primary-foreground" />
              <span>Categorías personalizables</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-primary-foreground" />
              <span>Visualiza tu patrimonio</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Auth form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-8">
        <Card className="w-full max-w-md border-0 shadow-none lg:border lg:shadow-sm">
          <CardContent className="pt-6">
            {/* Mobile logo */}
            <div className="flex items-center justify-center gap-2 mb-8 lg:hidden">
              <TrendingUp className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold">PocketPal</span>
            </div>
            
            {isLogin ? (
              <LoginForm onSwitchToSignUp={() => setIsLogin(false)} />
            ) : (
              <SignUpForm onSwitchToLogin={() => setIsLogin(true)} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
