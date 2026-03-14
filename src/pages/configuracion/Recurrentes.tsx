import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSwipeDownToDismiss } from '@/hooks/use-drawer-swipe-dismiss';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { GastoRecurrenteForm } from '@/components/configuracion/GastoRecurrenteForm';
import { useToast } from '@/hooks/use-toast';
import { useWebHaptics } from 'web-haptics/react';
import {
  Plus,
  Trash2,
  CreditCard,
  Loader2,
  Pause,
  Play,
  MoreHorizontal
} from 'lucide-react';
import { GastoRecurrente, Cuenta, Categoria } from '@/types/database';
import { GastoRecurrenteFormData } from '@/lib/validations';
import { useCuentas, useCategorias } from '@/hooks/useStaticData';
import { cn } from '@/lib/utils';
import { MobileSubpageHeader } from '@/components/configuracion/MobileSubpageHeader';

interface GastoRecurrenteConRelaciones extends GastoRecurrente {
  cuenta?: Cuenta;
  categoria?: Categoria;
  subcategoria?: Categoria | null;
}

export default function ConfigRecurrentes() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const haptic = useWebHaptics();
  const isMobile = useIsMobile();
  const swipeDismissRecurrente = useSwipeDownToDismiss(() => setModalOpen(false));

  // Cached static data from React Query
  const { data: cuentas = [] as Cuenta[], isLoading: cuentasLoading } = useCuentas();
  const { data: categorias = [] as Categoria[], isLoading: categoriasLoading } = useCategorias();

  const [gastos, setGastos] = useState<GastoRecurrenteConRelaciones[]>([]);
  const [gastosLoading, setGastosLoading] = useState(true);
  const loading = cuentasLoading || categoriasLoading || gastosLoading;
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGasto, setEditingGasto] = useState<GastoRecurrenteConRelaciones | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [drawerFullHeight, setDrawerFullHeight] = useState(false);
  const drawerContentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!modalOpen) {
      setDrawerFullHeight(false);
      return;
    }
    let observer: ResizeObserver | null = null;
    const setup = () => {
      if (!drawerContentRef.current) return;
      const el = drawerContentRef.current;
      observer = new ResizeObserver(() => {
        setDrawerFullHeight(el.offsetHeight >= window.innerHeight - 2);
      });
      observer.observe(el);
    };
    const rafId = requestAnimationFrame(setup);
    return () => {
      cancelAnimationFrame(rafId);
      observer?.disconnect();
    };
  }, [modalOpen]);

  // Fetch gastos recurrentes (cuentas/categorias come from React Query cache)
  useEffect(() => {
    if (!user || cuentasLoading || categoriasLoading) return;

    const fetchGastos = async () => {
      setGastosLoading(true);

      const { data: gastosData } = await supabase
        .from('gastos_recurrentes')
        .select('*')
        .eq('user_id', user.id)
        .order('concepto');

      if (gastosData) {
        const gastosConRelaciones = gastosData.map(g => ({
          ...g,
          cuenta: cuentas.find(c => c.id === g.cuenta_id),
          categoria: categorias.find(c => c.id === g.categoria_id),
          subcategoria: g.subcategoria_id
            ? categorias.find(c => c.id === g.subcategoria_id)
            : null
        })) as GastoRecurrenteConRelaciones[];

        setGastos(gastosConRelaciones);
      }

      setGastosLoading(false);
    };

    fetchGastos();
  }, [user, cuentas, categorias, cuentasLoading, categoriasLoading]);

  const handleCreate = () => {
    setEditingGasto(null);
    setModalOpen(true);
  };

  const handleEdit = (gasto: GastoRecurrenteConRelaciones) => {
    setEditingGasto(gasto);
    setModalOpen(true);
  };

  const handleSave = async (data: GastoRecurrenteFormData) => {
    if (!user) return;

    try {
      if (editingGasto) {
        // Update
        const { error } = await supabase
          .from('gastos_recurrentes')
          .update({
            concepto: data.concepto,
            cantidad: data.cantidad,
            dia_del_mes: 1,
            cuenta_id: data.cuenta_id,
            categoria_id: data.categoria_id,
            subcategoria_id: data.subcategoria_id || null,
            notas: data.notas || null,
            is_transfer: data.is_transfer || false,
            destination_account_id: data.destination_account_id || null
          })
          .eq('id', editingGasto.id);

        if (error) throw error;

        // Update local state
        setGastos(gastos.map(g => 
          g.id === editingGasto.id 
            ? {
                ...g,
                ...data,
                cuenta: cuentas.find(c => c.id === data.cuenta_id),
                categoria: categorias.find(c => c.id === data.categoria_id),
                subcategoria: data.subcategoria_id 
                  ? categorias.find(c => c.id === data.subcategoria_id)
                  : null
              }
            : g
        ));

        toast({ title: 'Movimiento recurrente actualizado' });
      } else {
        // Create
        const { data: newGasto, error } = await supabase
          .from('gastos_recurrentes')
          .insert({
            user_id: user.id,
            concepto: data.concepto,
            cantidad: data.cantidad,
            dia_del_mes: 1,
            cuenta_id: data.cuenta_id,
            categoria_id: data.categoria_id,
            subcategoria_id: data.subcategoria_id || null,
            notas: data.notas || null,
            is_transfer: data.is_transfer || false,
            destination_account_id: data.destination_account_id || null
          })
          .select()
          .single();

        if (error) throw error;

        const gastoConRelaciones: GastoRecurrenteConRelaciones = {
          ...newGasto,
          cuenta: cuentas.find(c => c.id === newGasto.cuenta_id),
          categoria: categorias.find(c => c.id === newGasto.categoria_id),
          subcategoria: newGasto.subcategoria_id 
            ? categorias.find(c => c.id === newGasto.subcategoria_id)
            : null
        };

        setGastos([...gastos, gastoConRelaciones]);
        toast({ title: 'Movimiento recurrente creado' });
      }

      setModalOpen(false);
      setEditingGasto(null);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error saving movimiento recurrente:', error);
      }
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo guardar el movimiento recurrente'
      });
    }
  };

  const handleToggleActive = async (gasto: GastoRecurrenteConRelaciones) => {
    const { error } = await supabase
      .from('gastos_recurrentes')
      .update({ activo: !gasto.activo })
      .eq('id', gasto.id);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo actualizar el estado'
      });
      return;
    }

    haptic.trigger('light');
    setGastos(gastos.map(g =>
      g.id === gasto.id ? { ...g, activo: !g.activo } : g
    ));
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('gastos_recurrentes')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo eliminar el movimiento recurrente'
      });
    } else {
      haptic.trigger('success');
      setGastos(gastos.filter(g => g.id !== id));
      toast({ title: 'Movimiento recurrente eliminado' });
    }

    setDeleteConfirm(null);
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
        <div className="space-y-4 md:space-y-6">
          <MobileSubpageHeader title="Gestión de Recurrentes" backHref="/configuracion" />

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-muted"><CreditCard className="h-4 w-4 text-muted-foreground" /></div>
                Movimientos Recurrentes
              </CardTitle>
              <Button onClick={handleCreate} className="shrink-0 h-7 w-7 p-0 sm:h-9 sm:w-auto sm:px-4">
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Nuevo Recurrente</span>
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : gastos.length === 0 ? (
                <div className="text-center py-8">
                  <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium">No hay movimientos recurrentes</p>
                  <p className="text-muted-foreground mb-4">
                    Configura tus movimientos que se repiten cada mes
                  </p>
                  <Button onClick={handleCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    Añadir recurrente
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {gastos.map((gasto) => (
                    <div
                      key={gasto.id}
                      className={cn(
                        "flex items-center justify-between gap-3 p-4 rounded-lg border cursor-pointer hover:bg-muted/30",
                        !gasto.activo && "opacity-50"
                      )}
                      onClick={() => handleEdit(gasto)}
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div>
                          <span className="font-medium">{gasto.concepto}</span>
                          <span className={cn(
                            "font-bold ml-2",
                            gasto.cantidad >= 0 ? "text-green-600" : "text-destructive"
                          )}>
                            {formatCurrency(Number(gasto.cantidad))}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                          <span
                            className="px-2 py-0.5 rounded text-xs"
                            style={{ backgroundColor: `${gasto.cuenta?.color}20` }}
                          >
                            {gasto.cuenta?.nombre}
                          </span>
                          <span>•</span>
                          <span>{gasto.categoria?.nombre}</span>
                          {gasto.subcategoria && (
                            <>
                              <span>{'>'}</span>
                              <span>{gasto.subcategoria.nombre}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Mobile: dropdown de 3 puntitos */}
                      <div className="sm:hidden shrink-0" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger className="p-1 rounded hover:bg-muted outline-none">
                            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleToggleActive(gasto)} className="py-2.5 px-4">
                              {gasto.activo ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                              {gasto.activo ? "Pausar" : "Reanudar"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeleteConfirm(gasto.id)}
                              className="py-2.5 px-4 text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Desktop: botones expandidos */}
                      <div className="hidden sm:flex gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant={gasto.activo ? "secondary" : "outline"}
                          onClick={() => handleToggleActive(gasto)}
                          className="h-9 px-3 text-sm"
                        >
                          {gasto.activo ? <Pause className="h-4 w-4 mr-0.5" /> : <Play className="h-4 w-4 mr-0.5" />}
                          {gasto.activo ? "Pausar" : "Reanudar"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setDeleteConfirm(gasto.id)}
                          className="h-9 w-9 p-0 shrink-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Create/Edit Modal */}
          {isMobile ? (
            <Drawer open={modalOpen} onOpenChange={setModalOpen} shouldScaleBackground={false}>
              <DrawerContent
                ref={drawerContentRef}
                className={cn("flex flex-col max-h-[100dvh]", drawerFullHeight && "rounded-t-none")}
              >
                <DrawerHeader className="text-left px-6 pt-4 pb-4 shrink-0">
                  <DrawerTitle>
                    {editingGasto ? 'Editar Movimiento Recurrente' : 'Nuevo Movimiento Recurrente'}
                  </DrawerTitle>
                </DrawerHeader>
                <div ref={swipeDismissRecurrente} className="flex-1 overflow-y-auto px-6 pb-6" data-vaul-no-drag>
                  <GastoRecurrenteForm
                    cuentas={cuentas}
                    categorias={categorias}
                    defaultCuentaId={profile?.cuenta_default_id || undefined}
                    initialData={editingGasto || undefined}
                    onSubmit={handleSave}
                    onCancel={() => setModalOpen(false)}
                    onCategoriaCreated={(cat) => setCategorias([...categorias, cat])}
                  />
                </div>
              </DrawerContent>
            </Drawer>
          ) : (
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
              <DialogContent className="max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
                <DialogHeader>
                  <DialogTitle>
                    {editingGasto ? 'Editar Movimiento Recurrente' : 'Nuevo Movimiento Recurrente'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingGasto
                      ? 'Modifica los datos del movimiento recurrente'
                      : 'Añade un nuevo gasto que se repite cada mes'}
                  </DialogDescription>
                </DialogHeader>
                <GastoRecurrenteForm
                  cuentas={cuentas}
                  categorias={categorias}
                  defaultCuentaId={profile?.cuenta_default_id || undefined}
                  initialData={editingGasto || undefined}
                  onSubmit={handleSave}
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
                <DialogTitle>¿Eliminar movimiento recurrente?</DialogTitle>
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
                  onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
                >
                  Eliminar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
}
