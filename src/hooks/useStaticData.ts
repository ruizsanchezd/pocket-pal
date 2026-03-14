import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Cuenta, Categoria } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';

/** Cached fetch of active accounts for the current user. */
export function useCuentas() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['cuentas', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cuentas')
        .select('*')
        .eq('user_id', user!.id)
        .eq('activa', true)
        .order('orden');

      if (error) throw error;
      return (data ?? []) as Cuenta[];
    },
    enabled: !!user,
  });
}

/** Cached fetch of all categories for the current user. */
export function useCategorias() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['categorias', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categorias')
        .select('*')
        .eq('user_id', user!.id)
        .order('orden');

      if (error) throw error;
      return (data ?? []) as Categoria[];
    },
    enabled: !!user,
  });
}
