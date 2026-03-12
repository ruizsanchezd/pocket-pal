import { useState, useEffect, useMemo, useRef } from 'react';
import { useWebHaptics } from 'web-haptics/react';
import { format, parse, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MovimientoForm } from '@/components/movimientos/MovimientoForm';
import { SwipeableRow } from '@/components/movimientos/SwipeableRow';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSwipeDownToDismiss } from '@/hooks/use-drawer-swipe-dismiss';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Receipt,
  Loader2,
  AlertCircle,
  Check,
  ChevronDown,
} from 'lucide-react';
import { MovimientoConRelaciones, Cuenta, Categoria } from '@/types/database';
import { cn } from '@/lib/utils';

export default function Movimientos() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const haptic = useWebHaptics();
  const isMobile = useIsMobile();

  const [currentMonth, setCurrentMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [movimientos, setMovimientos] = useState<MovimientoConRelaciones[]>([]);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMovimiento, setEditingMovimiento] = useState<MovimientoConRelaciones | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showRecurrenteBanner, setShowRecurrenteBanner] = useState(false);
  const [filtroCategoria, setFiltroCategoria] = useState<string>('__all__');
  const [filtroSubcategoria, setFiltroSubcategoria] = useState<string>('__all__');
  const [drawerCategoriaOpen, setDrawerCategoriaOpen] = useState(false);
  const [drawerCategoriaExpanded, setDrawerCategoriaExpanded] = useState(false);
  const collapseTimerCategoria = useRef<ReturnType<typeof setTimeout>>();
  const [drawerSubcategoriaOpen, setDrawerSubcategoriaOpen] = useState(false);
  const [drawerSubcategoriaExpanded, setDrawerSubcategoriaExpanded] = useState(false);
  const collapseTimerSubcategoria = useRef<ReturnType<typeof setTimeout>>();

  const handleScrollCategoria = (e: React.UIEvent<HTMLDivElement>) => {
    if (e.currentTarget.scrollTop > 0) {
      clearTimeout(collapseTimerCategoria.current);
      setDrawerCategoriaExpanded(true);
    } else {
      collapseTimerCategoria.current = setTimeout(() => setDrawerCategoriaExpanded(false), 80);
    }
  };

  const handleScrollSubcategoria = (e: React.UIEvent<HTMLDivElement>) => {
    if (e.currentTarget.scrollTop > 0) {
      clearTimeout(collapseTimerSubcategoria.current);
      setDrawerSubcategoriaExpanded(true);
    } else {
      collapseTimerSubcategoria.current = setTimeout(() => setDrawerSubcategoriaExpanded(false), 80);
    }
  };

  const swipeDismissCategoria = useSwipeDownToDismiss(() => setDrawerCategoriaOpen(false));
  const swipeDismissSubcategoria = useSwipeDownToDismiss(() => setDrawerSubcategoriaOpen(false));
  const swipeDismissMovimiento = useSwipeDownToDismiss(() => setModalOpen(false));

  // Format month for display
  const formattedMonth = useMemo(() => {
    const date = parse(currentMonth, 'yyyy-MM', new Date());
    return format(date, 'MMMM yyyy', { locale: es });
  }, [currentMonth]);

  // Get parent categories and all subcategories
  const categoriasParent = useMemo(() => {
    return categorias.filter(c => !c.parent_id);
  }, [categorias]);

  const todasSubcategorias = useMemo(() => {
    return categorias.filter(c => c.parent_id);
  }, [categorias]);

  const subcategoriasFiltradas = useMemo(() => {
    if (filtroCategoria !== '__all__') {
      return todasSubcategorias.filter(s => s.parent_id === filtroCategoria);
    }
    return todasSubcategorias;
  }, [todasSubcategorias, filtroCategoria]);

  // Filter movements
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

  // Calculate totals from filtered movements
  const totals = useMemo(() => {
    const ingresos = filteredMovimientos
      .filter(m => m.cantidad > 0)
      .reduce((sum, m) => sum + Number(m.cantidad), 0);
    const gastos = filteredMovimientos
      .filter(m => m.cantidad < 0)
      .reduce((sum, m) => sum + Math.abs(Number(m.cantidad)), 0);
    return {
      ingresos,
      gastos,
      balance: ingresos - gastos
    };
  }, [filteredMovimientos]);

  // Fetch data
  useEffect(() => {
    if (!user) return;
    
    const fetchData = async () => {
      setLoading(true);
      
      // Fetch accounts
      const { data: cuentasData } = await supabase
        .from('cuentas')
        .select('*')
        .eq('user_id', user.id)
        .eq('activa', true)
        .order('orden');
      
      if (cuentasData) setCuentas(cuentasData as Cuenta[]);

      // Fetch categories
      const { data: categoriasData } = await supabase
        .from('categorias')
        .select('*')
        .eq('user_id', user.id)
        .order('orden');
      
      if (categoriasData) setCategorias(categoriasData as Categoria[]);

      // Fetch movements for current month
      const { data: movimientosData } = await supabase
        .from('movimientos')
        .select('*')
        .eq('user_id', user.id)
        .eq('mes_referencia', currentMonth)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false });

      // Map movements if they exist
      const movimientosConRelaciones = movimientosData
        ? movimientosData.map(m => ({
            ...m,
            cuenta: cuentasData?.find(c => c.id === m.cuenta_id),
            categoria: categoriasData?.find(c => c.id === m.categoria_id),
            subcategoria: m.subcategoria_id
              ? categoriasData?.find(c => c.id === m.subcategoria_id)
              : null
          })) as MovimientoConRelaciones[]
        : [];

      setMovimientos(movimientosConRelaciones);

      // Check if we should show recurrente banner
      // Show banner if: in current month AND no recurring movements AND has active templates
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
      
      setLoading(false);
    };

    fetchData();
  }, [user, currentMonth]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    haptic.trigger('selection');
    const date = parse(currentMonth, 'yyyy-MM', new Date());
    const newDate = direction === 'prev' ? subMonths(date, 1) : addMonths(date, 1);
    setCurrentMonth(format(newDate, 'yyyy-MM'));
  };

  const handleCreateMovimiento = () => {
    setEditingMovimiento(null);
    setModalOpen(true);
  };

  const handleEditMovimiento = (movimiento: MovimientoConRelaciones) => {
    setEditingMovimiento(movimiento);
    setModalOpen(true);
  };

  const handleDeleteMovimiento = async (id: string) => {
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
      const updatedMovimientos = movimientos.filter(m => m.id !== id);
      setMovimientos(updatedMovimientos);
      toast({ title: 'Movimiento eliminado' });

      // Re-evaluate banner: if we deleted the last es_recurrente in the current month,
      // check if active templates exist and show the banner again
      const isCurrentMonth = currentMonth === format(new Date(), 'yyyy-MM');
      const deletedWasRecurrente = movimientos.find(m => m.id === id)?.es_recurrente;
      if (isCurrentMonth && deletedWasRecurrente) {
        const stillHasRecurrentes = updatedMovimientos.some(m => m.es_recurrente);
        if (!stillHasRecurrentes) {
          const { data: templates } = await supabase
            .from('gastos_recurrentes')
            .select('id')
            .eq('user_id', user!.id)
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

    // Refetch using the same pattern as the main fetch
    const { data: refreshed } = await supabase
      .from('movimientos')
      .select('*')
      .eq('user_id', user!.id)
      .eq('mes_referencia', currentMonth)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false });

    if (refreshed) {
      setMovimientos(refreshed.map(m => ({
        ...m,
        cuenta: cuentas.find(c => c.id === m.cuenta_id),
        categoria: categorias.find(c => c.id === m.categoria_id),
        subcategoria: m.subcategoria_id ? categorias.find(c => c.id === m.subcategoria_id) : null,
      })) as MovimientoConRelaciones[]);
    }
    toast({ title: 'Movimiento restaurado' });
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

    setMovimientos(prev => prev.filter(m => m.id !== movimiento.id));
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

  const handleSaveMovimiento = async (data: any) => {
    const movimientoData = {
      ...data,
      user_id: user!.id,
      fecha: format(data.fecha, 'yyyy-MM-dd'),
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

      // Update local state
      const movimientoConRelaciones = {
        ...updated,
        cuenta: cuentas.find(c => c.id === updated.cuenta_id),
        categoria: categorias.find(c => c.id === updated.categoria_id),
        subcategoria: updated.subcategoria_id 
          ? categorias.find(c => c.id === updated.subcategoria_id)
          : null
      } as MovimientoConRelaciones;

      setMovimientos(movimientos.map(m => 
        m.id === editingMovimiento.id ? movimientoConRelaciones : m
      ));
      
      toast({ title: 'Movimiento actualizado' });
    } else {
      // Create
      const { data: created, error } = await supabase
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

      // Add to local state
      const movimientoConRelaciones = {
        ...created,
        cuenta: cuentas.find(c => c.id === created.cuenta_id),
        categoria: categorias.find(c => c.id === created.categoria_id),
        subcategoria: created.subcategoria_id 
          ? categorias.find(c => c.id === created.subcategoria_id)
          : null
      } as MovimientoConRelaciones;

      setMovimientos([...movimientos, movimientoConRelaciones].sort(
        (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
      ));
      
      toast({ title: 'Movimiento creado' });
    }

    setModalOpen(false);
    setEditingMovimiento(null);
  };

  const handleGenerateRecurrentes = async () => {
    if (!user) return;

    // Fetch recurring templates
    const { data: templates } = await supabase
      .from('gastos_recurrentes')
      .select('*')
      .eq('user_id', user.id)
      .eq('activo', true);

    if (!templates || templates.length === 0) {
      setShowRecurrenteBanner(false);
      return;
    }

    // Create movements from templates
    const date = parse(currentMonth, 'yyyy-MM', new Date());
    const movimientosToCreate: any[] = [];

    templates.forEach(t => {
      const fechaStr = format(
        new Date(date.getFullYear(), date.getMonth(), 1),
        'yyyy-MM-dd'
      );

      // Origin movement (always created)
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

      // If transfer, create the destination movement
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

    const { data: created, error } = await supabase
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

    // Add to local state
    if (created) {
      const newMovimientos = created.map(m => ({
        ...m,
        cuenta: cuentas.find(c => c.id === m.cuenta_id),
        categoria: categorias.find(c => c.id === m.categoria_id),
        subcategoria: m.subcategoria_id 
          ? categorias.find(c => c.id === m.subcategoria_id)
          : null
      })) as MovimientoConRelaciones[];

      setMovimientos([...movimientos, ...newMovimientos].sort(
        (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
      ));
    }

    setShowRecurrenteBanner(false);
    toast({
      title: 'Gastos recurrentes generados',
      description: `Se crearon ${movimientosToCreate.length} movimientos`
    });
  };

  const formatCurrency = (amount: number) => {
    const symbol = profile?.divisa_principal === 'USD' ? '$' : 
                   profile?.divisa_principal === 'GBP' ? '£' : '€';
    return `${amount >= 0 ? '+' : ''}${amount.toLocaleString('es-ES', { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    })}${symbol}`;
  };

  return (
    <ProtectedRoute>
      <MainLayout>
        <div className="space-y-3 sm:space-y-6 pb-24 sm:pb-0">
          {/* Header */}
          <div className="flex sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigateMonth('prev')}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-base font-semibold md:text-lg capitalize text-center">
                {formattedMonth}
              </h1>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigateMonth('next')}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
            <div className="hidden sm:flex gap-2 shrink-0">
              <Button onClick={handleCreateMovimiento}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Movimiento
              </Button>
            </div>
          </div>

          {/* Recurrent expenses banner */}
          {showRecurrenteBanner && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>¿Generar gastos recurrentes para este mes?</span>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowRecurrenteBanner(false)}
                  >
                    No
                  </Button>
                  <Button 
                    size="sm"
                    onClick={handleGenerateRecurrentes}
                  >
                    Sí, generar
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Movements table */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-5">
                <CardTitle className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-muted"><Receipt className="h-4 w-4 text-muted-foreground" /></div>
                  Movimientos
                </CardTitle>

                {/* Filtros */}
                {movimientos.length > 0 && (
                  <div className="flex flex-row gap-2 w-full sm:w-auto items-center">
                    {isMobile ? (
                      <>
                        {/* Mobile: Drawer para categoría */}
                        <button
                          type="button"
                          className="flex-1 flex items-center justify-between rounded-md border border-input bg-background px-3 h-10 text-sm"
                          onClick={() => setDrawerCategoriaOpen(true)}
                        >
                          {filtroCategoria === '__all__' ? (
                            <span className="text-muted-foreground">Categoría</span>
                          ) : (() => {
                            const cat = categoriasParent.find(c => c.id === filtroCategoria);
                            return cat ? (
                              <span
                                className="px-2 py-0.5 rounded text-xs font-medium"
                                style={{ backgroundColor: `${cat.color}25`, color: cat.color, filter: 'brightness(0.85)' }}
                              >
                                {cat.nombre}
                              </span>
                            ) : <span className="text-muted-foreground">Categoría</span>;
                          })()}
                          <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
                        </button>
                        <Drawer open={drawerCategoriaOpen} onOpenChange={(v) => { setDrawerCategoriaOpen(v); if (!v) setDrawerCategoriaExpanded(false); }} shouldScaleBackground={false}>
                          <DrawerContent
                            className={cn(drawerCategoriaExpanded && "rounded-t-none")}
                            style={{
                              height: drawerCategoriaExpanded ? '100dvh' : '85dvh',
                              maxHeight: drawerCategoriaExpanded ? '100dvh' : '85dvh',
                              transition: 'height 180ms ease-in-out, max-height 180ms ease-in-out, border-top-left-radius 180ms ease-in-out, border-top-right-radius 180ms ease-in-out',
                            }}
                          >
                            <DrawerHeader>
                              <DrawerTitle>Categoría</DrawerTitle>
                            </DrawerHeader>
                            <div ref={swipeDismissCategoria} className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-4 pb-8" data-vaul-no-drag onScroll={handleScrollCategoria}>
                              <button
                                className="w-full text-left py-3 px-2 rounded-lg flex items-center gap-3 active:bg-accent"
                                onClick={() => { setFiltroCategoria('__all__'); setFiltroSubcategoria('__all__'); setDrawerCategoriaOpen(false); }}
                              >
                                <Check className={cn("h-4 w-4 shrink-0", filtroCategoria === '__all__' ? "opacity-100" : "opacity-0")} />
                                <span className="text-base text-muted-foreground italic">Todas</span>
                              </button>
                              {categoriasParent.map(cat => (
                                <button
                                  key={cat.id}
                                  className="w-full text-left py-3 px-2 rounded-lg flex items-center gap-3 active:bg-accent"
                                  onClick={() => { setFiltroCategoria(cat.id); setFiltroSubcategoria('__all__'); setDrawerCategoriaOpen(false); }}
                                >
                                  <Check className={cn("h-4 w-4 shrink-0", filtroCategoria === cat.id ? "opacity-100" : "opacity-0")} />
                                  <span
                                    className="px-2 py-0.5 rounded text-sm font-medium"
                                    style={{ backgroundColor: `${cat.color}25`, color: cat.color, filter: 'brightness(0.85)' }}
                                  >
                                    {cat.nombre}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </DrawerContent>
                        </Drawer>

                        {/* Mobile: Drawer para subcategoría */}
                        <button
                          type="button"
                          className="flex-1 flex items-center justify-between rounded-md border border-input bg-background px-3 h-10 text-sm"
                          onClick={() => setDrawerSubcategoriaOpen(true)}
                        >
                          {filtroSubcategoria === '__all__' ? (
                            <span className="text-muted-foreground">Subcategoría</span>
                          ) : (() => {
                            const sub = todasSubcategorias.find(s => s.id === filtroSubcategoria);
                            return sub ? (
                              <span
                                className="px-2 py-0.5 rounded text-xs font-medium"
                                style={{ backgroundColor: `${sub.color}25`, color: sub.color, filter: 'brightness(0.85)' }}
                              >
                                {sub.nombre}
                              </span>
                            ) : <span className="text-muted-foreground">Subcategoría</span>;
                          })()}
                          <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
                        </button>
                        <Drawer open={drawerSubcategoriaOpen} onOpenChange={(v) => { setDrawerSubcategoriaOpen(v); if (!v) setDrawerSubcategoriaExpanded(false); }} shouldScaleBackground={false}>
                          <DrawerContent
                            className={cn(drawerSubcategoriaExpanded && "rounded-t-none")}
                            style={{
                              height: drawerSubcategoriaExpanded ? '100dvh' : '85dvh',
                              maxHeight: drawerSubcategoriaExpanded ? '100dvh' : '85dvh',
                              transition: 'height 180ms ease-in-out, max-height 180ms ease-in-out, border-top-left-radius 180ms ease-in-out, border-top-right-radius 180ms ease-in-out',
                            }}
                          >
                            <DrawerHeader>
                              <DrawerTitle>Subcategoría</DrawerTitle>
                            </DrawerHeader>
                            <div ref={swipeDismissSubcategoria} className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-4 pb-8" data-vaul-no-drag onScroll={handleScrollSubcategoria}>
                              <button
                                className="w-full text-left py-3 px-2 rounded-lg flex items-center gap-3 active:bg-accent"
                                onClick={() => { setFiltroSubcategoria('__all__'); setDrawerSubcategoriaOpen(false); }}
                              >
                                <Check className={cn("h-4 w-4 shrink-0", filtroSubcategoria === '__all__' ? "opacity-100" : "opacity-0")} />
                                <span className="text-base text-muted-foreground italic">Todas</span>
                              </button>
                              {filtroCategoria !== '__all__' ? (
                                subcategoriasFiltradas.map(sub => (
                                  <button
                                    key={sub.id}
                                    className="w-full text-left py-3 px-2 rounded-lg flex items-center gap-3 active:bg-accent"
                                    onClick={() => { setFiltroSubcategoria(sub.id); setDrawerSubcategoriaOpen(false); }}
                                  >
                                    <Check className={cn("h-4 w-4 shrink-0", filtroSubcategoria === sub.id ? "opacity-100" : "opacity-0")} />
                                    <span
                                      className="px-2 py-0.5 rounded text-sm font-medium"
                                      style={{ backgroundColor: `${sub.color}25`, color: sub.color, filter: 'brightness(0.85)' }}
                                    >
                                      {sub.nombre}
                                    </span>
                                  </button>
                                ))
                              ) : (
                                categoriasParent.map(parent => {
                                  const hijas = todasSubcategorias.filter(s => s.parent_id === parent.id);
                                  if (hijas.length === 0) return null;
                                  return (
                                    <div key={parent.id} className="mt-2 first:mt-0">
                                      <p className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">{parent.nombre}</p>
                                      {hijas.map(sub => (
                                        <button
                                          key={sub.id}
                                          className="w-full text-left py-3 px-2 rounded-lg flex items-center gap-3 active:bg-accent"
                                          onClick={() => {
                                            setFiltroSubcategoria(sub.id);
                                            setFiltroCategoria(sub.parent_id!);
                                            setDrawerSubcategoriaOpen(false);
                                          }}
                                        >
                                          <Check className={cn("h-4 w-4 shrink-0", filtroSubcategoria === sub.id ? "opacity-100" : "opacity-0")} />
                                          <span
                                            className="px-2 py-0.5 rounded text-sm font-medium"
                                            style={{ backgroundColor: `${sub.color}25`, color: sub.color, filter: 'brightness(0.85)' }}
                                          >
                                            {sub.nombre}
                                          </span>
                                        </button>
                                      ))}
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </DrawerContent>
                        </Drawer>
                      </>
                    ) : (
                      <>
                        {/* Desktop: Select estándar para categoría */}
                        <Select value={filtroCategoria} onValueChange={(v) => { setFiltroCategoria(v); setFiltroSubcategoria('__all__'); }}>
                          <SelectTrigger className="flex-1 sm:w-[150px]">
                            <SelectValue>
                              {filtroCategoria === '__all__' ? (
                                'Categoría'
                              ) : (() => {
                                const cat = categoriasParent.find(c => c.id === filtroCategoria);
                                return cat ? (
                                  <span
                                    className="px-2 py-0.5 rounded text-xs font-medium"
                                    style={{ backgroundColor: `${cat.color}25`, color: cat.color, filter: 'brightness(0.85)' }}
                                  >
                                    {cat.nombre}
                                  </span>
                                ) : null;
                              })()}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__all__">Todas</SelectItem>
                            {categoriasParent.map(cat => (
                              <SelectItem key={cat.id} value={cat.id}>
                                <span
                                  className="px-2 py-0.5 rounded text-xs font-medium"
                                  style={{ backgroundColor: `${cat.color}25`, color: cat.color, filter: 'brightness(0.85)' }}
                                >
                                  {cat.nombre}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {/* Desktop: Select estándar para subcategoría */}
                        <Select value={filtroSubcategoria} onValueChange={(v) => {
                          setFiltroSubcategoria(v);
                          if (v !== '__all__' && filtroCategoria === '__all__') {
                            const sub = todasSubcategorias.find(s => s.id === v);
                            if (sub?.parent_id) setFiltroCategoria(sub.parent_id);
                          }
                        }}>
                          <SelectTrigger className="flex-1 sm:w-[150px]">
                            <SelectValue>
                              {filtroSubcategoria === '__all__' ? (
                                'Subcategoría'
                              ) : (() => {
                                const sub = todasSubcategorias.find(s => s.id === filtroSubcategoria);
                                return sub ? (
                                  <span
                                    className="px-2 py-0.5 rounded text-xs font-medium"
                                    style={{ backgroundColor: `${sub.color}25`, color: sub.color, filter: 'brightness(0.85)' }}
                                  >
                                    {sub.nombre}
                                  </span>
                                ) : null;
                              })()}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__all__">Todas</SelectItem>
                            {filtroCategoria !== '__all__' ? (
                              subcategoriasFiltradas.map(sub => (
                                <SelectItem key={sub.id} value={sub.id}>
                                  <span
                                    className="px-2 py-0.5 rounded text-xs font-medium"
                                    style={{ backgroundColor: `${sub.color}25`, color: sub.color, filter: 'brightness(0.85)' }}
                                  >
                                    {sub.nombre}
                                  </span>
                                </SelectItem>
                              ))
                            ) : (
                              categoriasParent.map(parent => {
                                const hijas = todasSubcategorias.filter(s => s.parent_id === parent.id);
                                if (hijas.length === 0) return null;
                                return (
                                  <SelectGroup key={parent.id} className="mt-2 first:mt-0">
                                    <SelectLabel className="text-xs text-muted-foreground">{parent.nombre}</SelectLabel>
                                    {hijas.map(sub => (
                                      <SelectItem key={sub.id} value={sub.id}>
                                        <span
                                          className="px-2 py-0.5 rounded text-xs font-medium"
                                          style={{ backgroundColor: `${sub.color}25`, color: sub.color, filter: 'brightness(0.85)' }}
                                        >
                                          {sub.nombre}
                                        </span>
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                );
                              })
                            )}
                          </SelectContent>
                        </Select>
                      </>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : movimientos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                  <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">No hay movimientos este mes</p>
                  <p className="text-muted-foreground mb-4">Empieza añadiendo tu primer movimiento</p>
                  <Button onClick={handleCreateMovimiento}>
                    <Plus className="mr-2 h-4 w-4" />
                    Añadir primer movimiento
                  </Button>
                </div>
              ) : (
                <>
                  {/* Mobile: card list */}
                  <div className="md:hidden divide-y -mx-6">
                    {filteredMovimientos.map((movimiento) => (
                      <SwipeableRow
                        key={movimiento.id}
                        onDelete={() => handleSwipeDelete(movimiento)}
                        onThresholdReached={() => haptic.trigger('warning')}
                      >
                        <div
                          className="flex items-center justify-between px-6 py-3 cursor-pointer active:bg-muted/40 transition-colors"
                          onClick={() => handleEditMovimiento(movimiento)}
                        >
                          <div className="flex-1 min-w-0 pr-3">
                            <p className="font-medium text-sm truncate">{movimiento.concepto}</p>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              {movimiento.categoria && (
                                <span
                                  className="px-1.5 py-0.5 rounded text-xs font-medium"
                                  style={{ backgroundColor: `${movimiento.categoria.color}25`, color: movimiento.categoria.color, filter: 'brightness(0.85)' }}
                                >
                                  {movimiento.categoria.nombre}
                                </span>
                              )}
                              {movimiento.subcategoria && (
                                <span
                                  className="px-1.5 py-0.5 rounded text-xs font-medium"
                                  style={{ backgroundColor: `${movimiento.subcategoria.color}25`, color: movimiento.subcategoria.color, filter: 'brightness(0.85)' }}
                                >
                                  {movimiento.subcategoria.nombre}
                                </span>
                              )}
                              {movimiento.es_recurrente && (
                                <span className="text-xs text-muted-foreground">· Recurrente</span>
                              )}
                            </div>
                          </div>
                          <span className={cn(
                            "font-semibold text-sm shrink-0",
                            movimiento.cantidad > 0 ? "text-green-600" : "text-destructive"
                          )}>
                            {formatCurrency(Number(movimiento.cantidad))}
                          </span>
                        </div>
                      </SwipeableRow>
                    ))}
                  </div>
                  {/* Desktop: table */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[100px]">Fecha</TableHead>
                          <TableHead className="text-right pr-8">Cantidad</TableHead>
                          <TableHead>Concepto</TableHead>
                          <TableHead className="hidden md:table-cell">Cuenta</TableHead>
                          <TableHead className="hidden md:table-cell">Categoría</TableHead>
                          <TableHead className="hidden md:table-cell">Subcategoría</TableHead>
                          <TableHead className="w-[80px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredMovimientos.map((movimiento) => (
                        <TableRow key={movimiento.id} className="group cursor-pointer" onClick={() => handleEditMovimiento(movimiento)}>
                          <TableCell className="font-medium">
                            {format(new Date(movimiento.fecha), 'dd/MM')}
                          </TableCell>
                          <TableCell className={cn(
                            "text-right font-medium pr-8",
                            movimiento.cantidad > 0 ? "text-green-600" : "text-destructive"
                          )}>
                            {formatCurrency(Number(movimiento.cantidad))}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span>{movimiento.concepto}</span>
                              {movimiento.es_recurrente && (
                                <span className="text-xs text-muted-foreground">
                                  Recurrente
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <div className="flex items-center gap-1.5">
                              <div
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: movimiento.cuenta?.color }}
                              />
                              <span className="text-sm">{movimiento.cuenta?.nombre}</span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {movimiento.categoria && (
                              <span
                                className="px-2 py-1 rounded text-xs font-medium"
                                style={{ backgroundColor: `${movimiento.categoria.color}25`, color: movimiento.categoria.color, filter: 'brightness(0.85)' }}
                              >
                                {movimiento.categoria.nombre}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {movimiento.subcategoria && (
                              <span
                                className="px-2 py-1 rounded text-xs font-medium"
                                style={{ backgroundColor: `${movimiento.subcategoria.color}25`, color: movimiento.subcategoria.color, filter: 'brightness(0.85)' }}
                              >
                                {movimiento.subcategoria.nombre}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={(e) => { e.stopPropagation(); setDeleteConfirm(movimiento.id); }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Totals */}
          {filteredMovimientos.length > 0 && (
            <div className="rounded-lg bg-muted/50 px-4 py-3">
              <div className="flex flex-wrap justify-center gap-6 text-center">
                <div>
                  <p className="text-xs md:text-sm text-muted-foreground">Ingresos</p>
                  <p className="text-sm md:text-base font-semibold text-green-600">
                    +{totals.ingresos.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€
                  </p>
                </div>
                <div className="border-l pl-6">
                  <p className="text-xs md:text-sm text-muted-foreground">Gastos</p>
                  <p className="text-sm md:text-base font-semibold text-destructive">
                    -{totals.gastos.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€
                  </p>
                </div>
                <div className="border-l pl-6">
                  <p className="text-xs md:text-sm text-muted-foreground">Balance</p>
                  <p className={cn(
                    "text-sm md:text-base font-semibold",
                    totals.balance >= 0 ? "text-green-600" : "text-destructive"
                  )}>
                    {totals.balance >= 0 ? '+' : ''}{totals.balance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Create/Edit Modal */}
          {isMobile ? (
            <Drawer open={modalOpen} onOpenChange={setModalOpen} shouldScaleBackground={false} repositionInputs={false}>
              <DrawerContent className="flex flex-col" style={{ height: '95dvh', maxHeight: '95dvh' }}>
                <DrawerHeader className="text-left px-6 pt-4 pb-2 shrink-0">
                  <DrawerTitle>{editingMovimiento ? 'Editar movimiento' : 'Nuevo movimiento'}</DrawerTitle>
                </DrawerHeader>
                <div ref={swipeDismissMovimiento} className="flex-1 overflow-y-auto px-6 pb-6" data-vaul-no-drag>
                  <MovimientoForm
                    cuentas={cuentas}
                    categorias={categorias}
                    defaultCuentaId={profile?.cuenta_default_id || undefined}
                    initialData={editingMovimiento || undefined}
                    onSubmit={handleSaveMovimiento}
                    onCancel={() => setModalOpen(false)}
                    onCategoriaCreated={(cat) => setCategorias([...categorias, cat])}
                    disableAutoFocus
                  />
                </div>
              </DrawerContent>
            </Drawer>
          ) : (
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
              <DialogContent className="sm:max-w-md w-full">
                <DialogHeader>
                  <DialogTitle>
                    {editingMovimiento ? 'Editar Movimiento' : 'Nuevo Movimiento'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingMovimiento
                      ? 'Modifica los datos del movimiento'
                      : 'Añade un nuevo ingreso o gasto'}
                  </DialogDescription>
                </DialogHeader>
                <MovimientoForm
                  cuentas={cuentas}
                  categorias={categorias}
                  defaultCuentaId={profile?.cuenta_default_id || undefined}
                  initialData={editingMovimiento || undefined}
                  onSubmit={handleSaveMovimiento}
                  onCancel={() => setModalOpen(false)}
                  onCategoriaCreated={(cat) => setCategorias([...categorias, cat])}
                />
              </DialogContent>
            </Dialog>
          )}

          {/* Delete confirmation */}
          <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>¿Eliminar movimiento?</DialogTitle>
                <DialogDescription>
                  Esta acción no se puede deshacer.
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                  Cancelar
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={() => deleteConfirm && handleDeleteMovimiento(deleteConfirm)}
                >
                  Eliminar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Mobile sticky bottom bar */}
        <div className="sm:hidden fixed bottom-0 left-0 right-0 z-20 bg-background border-t px-4 py-3">
          <Button className="w-full h-12 text-base" onClick={handleCreateMovimiento}>
            <Plus className="mr-2 h-5 w-5" />
            Nuevo Movimiento
          </Button>
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
}
