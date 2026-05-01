import { useState, useEffect, useMemo } from 'react';
import { format, parse, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { useWebHaptics } from 'web-haptics/react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { useCuentas, useCategorias } from '@/hooks/useStaticData';
import { MovimientoConRelaciones, Movimiento, Categoria } from '@/types/database';
import { MovimientoFormData } from '@/lib/validations';

interface MovimientoInsert {
  user_id: string;
  fecha: string;
  concepto: string;
  cantidad: number;
  cuenta_id: string;
  categoria_id: string;
  subcategoria_id?: string | null;
  notas?: string | null;
  es_recurrente: boolean;
  recurrente_template_id: string;
  mes_referencia: string;
}

export function useMovimientos() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const haptic = useWebHaptics();
  const queryClient = useQueryClient();

  // Cached static data
  const { data: cuentas = [], isLoading: cuentasLoading } = useCuentas();
  const { data: categorias = [], isLoading: categoriasLoading } = useCategorias();

  // Core data state — only movimientos are fetched per-page
  const [currentMonth, setCurrentMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [rawMovimientos, setRawMovimientos] = useState<Movimiento[]>([]);
  const [movimientosLoading, setMovimientosLoading] = useState(true);

  // Map raw movimientos with relaciones reactively
  const movimientos = useMemo<MovimientoConRelaciones[]>(
    () =>
      rawMovimientos.map(m => ({
        ...m,
        cuenta: cuentas.find(c => c.id === m.cuenta_id),
        categoria: categorias.find(c => c.id === m.categoria_id),
        subcategoria: m.subcategoria_id
          ? categorias.find(c => c.id === m.subcategoria_id)
          : null,
      })) as MovimientoConRelaciones[],
    [rawMovimientos, cuentas, categorias]
  );

  const loading = cuentasLoading || categoriasLoading || movimientosLoading;

  // UI state managed here because it's coupled to data operations
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMovimiento, setEditingMovimiento] = useState<MovimientoConRelaciones | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showRecurrenteBanner, setShowRecurrenteBanner] = useState(false);

  // Filters
  const [filtroCategoria, setFiltroCategoria] = useState<string>('__all__');
  const [filtroSubcategoria, setFiltroSubcategoria] = useState<string>('__all__');

  // Derived data
  const formattedMonth = useMemo(() => {
    const date = parse(currentMonth, 'yyyy-MM', new Date());
    return format(date, 'MMMM yyyy', { locale: es });
  }, [currentMonth]);

  const categoriasParent = useMemo(() => categorias.filter(c => !c.parent_id), [categorias]);
  const todasSubcategorias = useMemo(() => categorias.filter(c => c.parent_id), [categorias]);

  const subcategoriasFiltradas = useMemo(() => {
    if (filtroCategoria !== '__all__') {
      return todasSubcategorias.filter(s => s.parent_id === filtroCategoria);
    }
    return todasSubcategorias;
  }, [todasSubcategorias, filtroCategoria]);

  const filteredMovimientos = useMemo(() => {
    let filtered = movimientos;
    if (filtroCategoria !== '__all__') {
      filtered = filtered.filter(m => m.categoria_id === filtroCategoria);
    }
    if (filtroSubcategoria !== '__all__') {
      filtered = filtered.filter(m => m.subcategoria_id === filtroSubcategoria);
    }
    return filtered;
  }, [movimientos, filtroCategoria, filtroSubcategoria]);

  const totals = useMemo(() => {
    const ingresos = filteredMovimientos
      .filter(m => m.cantidad > 0)
      .reduce((sum, m) => sum + Number(m.cantidad), 0);
    const gastos = filteredMovimientos
      .filter(m => m.cantidad < 0)
      .reduce((sum, m) => sum + Math.abs(Number(m.cantidad)), 0);
    return { ingresos, gastos, balance: ingresos - gastos };
  }, [filteredMovimientos]);

  const currency = profile?.divisa_principal || 'EUR';

  // Fetch only movimientos (cuentas/categorias come from React Query cache)
  useEffect(() => {
    if (!user) return;

    const fetchMovimientos = async () => {
      setMovimientosLoading(true);

      const { data: movimientosData } = await supabase
        .from('movimientos')
        .select('*')
        .eq('user_id', user.id)
        .eq('mes_referencia', currentMonth)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false });

      setRawMovimientos((movimientosData ?? []) as Movimiento[]);

      // Check if we should show recurrente banner
      const hasRecurrentes = movimientosData?.some(m => m.es_recurrente) || false;
      if (!hasRecurrentes && currentMonth === format(new Date(), 'yyyy-MM')) {
        const { data: templates } = await supabase
          .from('gastos_recurrentes')
          .select('id')
          .eq('user_id', user.id)
          .eq('activo', true)
          .limit(1);

        setShowRecurrenteBanner(!!templates && templates.length > 0);
      } else {
        setShowRecurrenteBanner(false);
      }

      setMovimientosLoading(false);
    };

    fetchMovimientos();
  }, [user, currentMonth]);

  // Shared refetch helper — just updates raw data, useMemo handles mapping
  const refetchMovimientos = async () => {
    const { data } = await supabase
      .from('movimientos')
      .select('*')
      .eq('user_id', user!.id)
      .eq('mes_referencia', currentMonth)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false });

    if (data) setRawMovimientos(data as Movimiento[]);
  };

  // Navigation
  const navigateMonth = (direction: 'prev' | 'next') => {
    haptic.trigger('selection');
    const date = parse(currentMonth, 'yyyy-MM', new Date());
    const newDate = direction === 'prev' ? subMonths(date, 1) : addMonths(date, 1);
    setCurrentMonth(format(newDate, 'yyyy-MM'));
  };

  // CRUD handlers
  const handleCreateMovimiento = () => {
    setEditingMovimiento(null);
    setModalOpen(true);
  };

  const handleEditMovimiento = (movimiento: MovimientoConRelaciones) => {
    setEditingMovimiento(movimiento);
    setModalOpen(true);
  };

  const handleDeleteMovimiento = async (id: string) => {
    if (!user) return;
    const { error } = await supabase
      .from('movimientos')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo eliminar el movimiento'
      });
    } else {
      haptic.trigger('success');

      const deletedWasRecurrente = rawMovimientos.find(m => m.id === id)?.es_recurrente;
      const updatedRaw = rawMovimientos.filter(m => m.id !== id);
      setRawMovimientos(updatedRaw);
      toast({ title: 'Movimiento eliminado' });

      // Re-evaluate banner
      const isCurrentMonth = currentMonth === format(new Date(), 'yyyy-MM');
      if (isCurrentMonth && deletedWasRecurrente) {
        const stillHasRecurrentes = updatedRaw.some(m => m.es_recurrente);
        if (!stillHasRecurrentes) {
          const { data: templates } = await supabase
            .from('gastos_recurrentes')
            .select('id')
            .eq('user_id', user.id)
            .eq('activo', true)
            .limit(1);
          setShowRecurrenteBanner(!!templates && templates.length > 0);
        }
      }
    }
    setDeleteConfirm(null);
  };

  const handleUndoDelete = async (movimiento: MovimientoConRelaciones) => {
    const { error } = await supabase.from('movimientos').insert({
      user_id: movimiento.user_id,
      fecha: movimiento.fecha,
      concepto: movimiento.concepto,
      cantidad: movimiento.cantidad,
      tipo: movimiento.tipo,
      cuenta_id: movimiento.cuenta_id,
      categoria_id: movimiento.categoria_id,
      subcategoria_id: movimiento.subcategoria_id,
      mes_referencia: movimiento.mes_referencia,
      notas: movimiento.notas,
      es_recurrente: movimiento.es_recurrente,
    });

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo restaurar el movimiento' });
      return;
    }

    await refetchMovimientos();
    toast({ title: 'Movimiento restaurado' });
  };

  const handleDuplicateMovimiento = async (movimiento: MovimientoConRelaciones) => {
    if (!user) return;

    const { error } = await supabase
      .from('movimientos')
      .insert({
        user_id: movimiento.user_id,
        fecha: movimiento.fecha,
        concepto: movimiento.concepto,
        cantidad: movimiento.cantidad,
        cuenta_id: movimiento.cuenta_id,
        categoria_id: movimiento.categoria_id,
        subcategoria_id: movimiento.subcategoria_id,
        notas: movimiento.notas,
        mes_referencia: movimiento.mes_referencia,
        es_recurrente: false,
      });

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo duplicar el movimiento' });
      return;
    }

    haptic.trigger('success');
    await refetchMovimientos();
    toast({ title: 'Movimiento duplicado' });
  };

  const handleSwipeDelete = async (movimiento: MovimientoConRelaciones) => {
    const { error } = await supabase
      .from('movimientos')
      .delete()
      .eq('id', movimiento.id);

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar' });
      return;
    }

    setRawMovimientos(prev => prev.filter(m => m.id !== movimiento.id));
    haptic.trigger('success');

    toast({
      title: 'Movimiento eliminado',
      action: (
        <ToastAction altText="Deshacer" onClick={() => handleUndoDelete(movimiento)}>
          Deshacer
        </ToastAction>
      ),
    });
  };

  const handleSaveMovimiento = async (data: MovimientoFormData) => {
    if (!user) return;
    const movimientoData = {
      user_id: user.id,
      fecha: format(data.fecha, 'yyyy-MM-dd'),
      concepto: data.concepto,
      cantidad: data.cantidad,
      cuenta_id: data.cuenta_id,
      categoria_id: data.categoria_id,
      subcategoria_id: data.subcategoria_id || null,
      mes_referencia: format(data.fecha, 'yyyy-MM')
    };

    if (editingMovimiento) {
      // Update
      const { data: updated, error } = await supabase
        .from('movimientos')
        .update(movimientoData)
        .eq('id', editingMovimiento.id)
        .select()
        .single();

      if (error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'No se pudo actualizar el movimiento'
        });
        return;
      }

      setRawMovimientos(prev =>
        prev.map(m => m.id === editingMovimiento.id ? (updated as Movimiento) : m)
      );

      toast({ title: 'Movimiento actualizado' });
    } else {
      // Create
      const { error } = await supabase
        .from('movimientos')
        .insert(movimientoData)
        .select()
        .single();

      if (error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'No se pudo crear el movimiento'
        });
        return;
      }

      await refetchMovimientos();
      toast({ title: 'Movimiento creado' });
    }

    setModalOpen(false);
    setEditingMovimiento(null);
  };

  const handleGenerateRecurrentes = async () => {
    if (!user) return;

    const { data: templates } = await supabase
      .from('gastos_recurrentes')
      .select('*')
      .eq('user_id', user.id)
      .eq('activo', true);

    if (!templates || templates.length === 0) {
      setShowRecurrenteBanner(false);
      return;
    }

    const date = parse(currentMonth, 'yyyy-MM', new Date());
    const movimientosToCreate: MovimientoInsert[] = [];

    templates.forEach(t => {
      const fechaStr = format(
        new Date(date.getFullYear(), date.getMonth(), 1),
        'yyyy-MM-dd'
      );

      movimientosToCreate.push({
        user_id: user.id,
        fecha: fechaStr,
        concepto: t.concepto,
        cantidad: t.is_transfer ? -Math.abs(t.cantidad) : t.cantidad,
        cuenta_id: t.cuenta_id,
        categoria_id: t.categoria_id,
        subcategoria_id: t.subcategoria_id,
        notas: t.notas,
        es_recurrente: true,
        recurrente_template_id: t.id,
        mes_referencia: currentMonth
      });

      if (t.is_transfer && t.destination_account_id) {
        movimientosToCreate.push({
          user_id: user.id,
          fecha: fechaStr,
          concepto: t.concepto,
          cantidad: Math.abs(t.cantidad),
          cuenta_id: t.destination_account_id,
          categoria_id: t.categoria_id,
          subcategoria_id: t.subcategoria_id,
          notas: t.notas ? `${t.notas} (transferencia)` : 'Transferencia entre cuentas',
          es_recurrente: true,
          recurrente_template_id: t.id,
          mes_referencia: currentMonth
        });
      }
    });

    const { error } = await supabase
      .from('movimientos')
      .insert(movimientosToCreate)
      .select();

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron generar los gastos recurrentes'
      });
      return;
    }

    await refetchMovimientos();

    setShowRecurrenteBanner(false);
    toast({
      title: 'Gastos recurrentes generados',
      description: `Se crearon ${movimientosToCreate.length} movimientos`
    });
  };

  const addCategoria = (cat: Categoria) => {
    queryClient.setQueryData<Categoria[]>(
      ['categorias', user?.id],
      (old) => old ? [...old, cat] : [cat]
    );
  };

  return {
    movimientos,
    cuentas,
    categorias,
    loading,
    currentMonth,
    showRecurrenteBanner,
    formattedMonth,
    categoriasParent,
    todasSubcategorias,
    subcategoriasFiltradas,
    filteredMovimientos,
    totals,
    currency,
    filtroCategoria,
    filtroSubcategoria,
    setFiltroCategoria,
    setFiltroSubcategoria,
    modalOpen,
    setModalOpen,
    editingMovimiento,
    deleteConfirm,
    setDeleteConfirm,
    setShowRecurrenteBanner,
    navigateMonth,
    handleCreateMovimiento,
    handleEditMovimiento,
    handleDeleteMovimiento,
    handleDuplicateMovimiento,
    handleSwipeDelete,
    handleSaveMovimiento,
    handleGenerateRecurrentes,
    addCategoria,
    haptic,
    profile,
  };
}
