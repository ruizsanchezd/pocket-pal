import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Handle the OAuth callback
    const handleCallback = async () => {
      try {
        // Supabase automatically handles the OAuth callback
        // We just need to check the session and redirect
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          // Successful OAuth login - redirect to app
          navigate('/movimientos', { replace: true });
        } else {
          // No session - redirect to auth page
          navigate('/auth', { replace: true });
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Error handling OAuth callback:', error);
        }
        navigate('/auth', { replace: true });
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Iniciando sesión...</p>
      </div>
    </div>
  );
}
