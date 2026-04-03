import { useState, useEffect, useMemo } from 'react';
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
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel
} from '@/components/ui/alert-dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSwipeDownToDismiss } from '@/hooks/use-drawer-swipe-dismiss';
import { CuentaForm } from '@/components/configuracion/CuentaForm';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useWebHaptics } from 'web-haptics/react';
import {
  Plus,
  Star,
  Wallet,
  Loader2,
  Trash2,
  Eye,
  EyeOff,
  MoreHorizontal
} from 'lucide-react';
import { Cuenta, CuentaMonederoConfig } from '@/types/database';
import { CuentaFormData } from '@/lib/validations';
import { formatCurrency } from '@/lib/format';
import { useAccountBalances } from '@/hooks/useAccountBalances';
import { cn } from '@/lib/utils';
import { MobileSubpageHeader } from '@/components/configuracion/MobileSubpageHeader';
import { format, subMonths, differenceInMonths, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

interface CuentaConConfig extends Cuenta {
  monedero_config?: CuentaMonederoConfig | null;
  saldo_actual?: number;
}

export default function ConfigCuentas() {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const haptic = useWebHaptics();
  const isMobile = useIsMobile();
  const swipeDismissCuenta = useSwipeDownToDismiss(() => setModalOpen(false));

  // Raw data from DB — balances computed separately by the hook
  const [rawCuentas, setRawCuentas] = useState<Cuenta[]>([]);
  const [monederoConfigs, setMonederoConfigs] = useState<CuentaMonederoConfig[]>([]);
  const [rawLoading, setRawLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCuenta, setEditingCuenta] = useState<CuentaConConfig | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<CuentaConConfig | null>(null);
  const [pendingPrevMonthUpdate, setPendingPrevMonthUpdate] = useState<{
    cuentaId: string;
    cuentaNombre: string;
    mesAnterior: string;
    mesAnteriorLabel: string;
    saldoNuevo: number;
  } | null>(null);

  const { balances, loading: balancesLoading } = useAccountBalances(rawCuentas);
  const loading = rawLoading || balancesLoading;

  // Combine raw cuentas with hook-computed balances and monedero config
  const cuentas = useMemo<CuentaConConfig[]>(
    () =>
      rawCuentas.map((cuenta) => {
        const monedero_config = monederoConfigs.find((c) => c.cuenta_id === cuenta.id) ?? null;

        let recargaAcumulada = 0;
        if (cuenta.tipo === 'monedero' && monedero_config && cuenta.created_at) {
          const meses = differenceInMonths(
            startOfMonth(new Date()),
            startOfMonth(new Date(cuenta.created_at))
          );
          recargaAcumulada = monedero_config.recarga_mensual * meses;
        }

        return {
          ...cuenta,
          saldo_actual: (balances[cuenta.id] ?? 0) + recargaAcumulada,
          monedero_config,
        };
      }),
    [rawCuentas, balances, monederoConfigs]
  );

  // Fetch accounts
  useEffect(() => {
    if (!user) return;

    const fetchCuentas = async () => {
      setRawLoading(true);

      const { data: cuentasData } = await supabase
        .from('cuentas')
        .select('id, nombre, tipo, saldo_inicial, color, activa, orden, capital_inicial_invertido, divisa, created_at')
        .eq('user_id', user.id)
        .order('orden');

      if (cuentasData) {
        const { data: configsData } = await supabase
          .from('cuentas_monedero_config')
          .select('*')
          .eq('user_id', user.id);

        setRawCuentas(cuentasData as Cuenta[]);
        setMonederoConfigs((configsData as CuentaMonederoConfig[]) ?? []);
      }

      setRawLoading(false);
    };

    fetchCuentas();
  }, [user]);

  const handleCreate = () => {
    setEditingCuenta(null);
    setModalOpen(true);
  };

  const handleEdit = (cuenta: CuentaConConfig) => {
    setEditingCuenta(cuenta);
    setModalOpen(true);
  };

  const handleSave = async (data: CuentaFormData) => {
    if (!user) return;

    try {
      if (editingCuenta) {
        // Check if balance was overridden
        if (data.saldo_actual !== undefined && data.saldo_actual !== editingCuenta.saldo_actual) {
          // Balance override: recalculate saldo_inicial
          const { data: movimientos } = await supabase
            .from('movimientos')
            .select('cantidad')
            .eq('cuenta_id', editingCuenta.id);

          const sumaMovimientos = movimientos?.reduce(
            (sum, m) => sum + Number(m.cantidad),
            0
          ) || 0;

          // For monedero accounts, recargaAcumulada is added on top by the Dashboard,
          // so we need to subtract it here so the formula resolves to the user's intended balance.
          let recargaAcumulada = 0;
          if (editingCuenta.tipo === 'monedero' && editingCuenta.monedero_config && editingCuenta.created_at) {
            const meses = differenceInMonths(
              startOfMonth(new Date()),
              startOfMonth(new Date(editingCuenta.created_at))
            );
            recargaAcumulada = editingCuenta.monedero_config.recarga_mensual * meses;
          }

          // New saldo_inicial = desired balance - sum of movements - recargaAcumulada
          const nuevoSaldoInicial = data.saldo_actual - sumaMovimientos - recargaAcumulada;

          // Update account with new saldo_inicial
          const { error: updateError } = await supabase
            .from('cuentas')
            .update({
              nombre: data.nombre,
              tipo: data.tipo,
              divisa: data.divisa,
              saldo_inicial: nuevoSaldoInicial,
              capital_inicial_invertido: data.capital_inicial_invertido || 0,
              color: data.color
            })
            .eq('id', editingCuenta.id);

          if (updateError) throw updateError;

          // Upsert snapshot for current month
          const currentMonth = format(new Date(), 'yyyy-MM');
          const { data: snapshot } = await supabase
            .from('snapshots_patrimonio')
            .upsert(
              {
                user_id: user.id,
                mes: currentMonth,
                cuenta_id: editingCuenta.id,
                saldo_registrado: data.saldo_actual,
                saldo_calculado: data.saldo_actual,
                tipo: 'manual'
              },
              { onConflict: 'user_id,mes,cuenta_id' }
            )
            .select()
            .single();

          // Log in balance history
          await supabase
            .from('account_balance_history')
            .insert({
              user_id: user.id,
              cuenta_id: editingCuenta.id,
              snapshot_id: snapshot?.id || null,
              previous_balance: editingCuenta.saldo_actual || 0,
              new_balance: data.saldo_actual
            });

          // Check if previous month snapshot is missing saldo_registrado
          const prevMonth = format(subMonths(new Date(), 1), 'yyyy-MM');
          if (prevMonth !== currentMonth) {
            const { data: prevSnap } = await supabase
              .from('snapshots_patrimonio')
              .select('id, saldo_registrado')
              .eq('user_id', user.id)
              .eq('mes', prevMonth)
              .eq('cuenta_id', editingCuenta.id)
              .single();

            if (!prevSnap || prevSnap.saldo_registrado === null) {
              const prevMonthDate = subMonths(new Date(), 1);
              setPendingPrevMonthUpdate({
                cuentaId: editingCuenta.id,
                cuentaNombre: editingCuenta.nombre,
                mesAnterior: prevMonth,
                mesAnteriorLabel: format(prevMonthDate, 'MMMM yyyy', { locale: es }),
                saldoNuevo: data.saldo_actual
              });
            }
          }
        } else {
          // Normal update (no balance change)
          const { error: updateError } = await supabase
            .from('cuentas')
            .update({
              nombre: data.nombre,
              tipo: data.tipo,
              divisa: data.divisa,
              saldo_inicial: data.saldo_inicial,
              capital_inicial_invertido: data.capital_inicial_invertido || 0,
              color: data.color
            })
            .eq('id', editingCuenta.id);

          if (updateError) throw updateError;
        }

        // Handle monedero config
        if (data.tipo === 'monedero' && data.recarga_mensual) {
          if (editingCuenta.monedero_config) {
            await supabase
              .from('cuentas_monedero_config')
              .update({ recarga_mensual: data.recarga_mensual })
              .eq('id', editingCuenta.monedero_config.id);
          } else {
            await supabase
              .from('cuentas_monedero_config')
              .insert({
                user_id: user.id,
                cuenta_id: editingCuenta.id,
                recarga_mensual: data.recarga_mensual
              });
          }
        } else if (data.tipo !== 'monedero' && editingCuenta.monedero_config) {
          await supabase
            .from('cuentas_monedero_config')
            .delete()
            .eq('id', editingCuenta.monedero_config.id);
        }

        haptic.trigger('success');
        toast({ title: 'Cuenta actualizada' });
      } else {
        // Create account
        const { data: newCuenta, error: createError } = await supabase
          .from('cuentas')
          .insert({
            user_id: user.id,
            nombre: data.nombre,
            tipo: data.tipo,
            divisa: data.divisa,
            saldo_inicial: data.saldo_inicial,
            capital_inicial_invertido: data.capital_inicial_invertido || 0,
            color: data.color,
            orden: cuentas.length
          })
          .select()
          .single();

        if (createError) throw createError;

        // Create monedero config if needed
        if (data.tipo === 'monedero' && data.recarga_mensual) {
          await supabase
            .from('cuentas_monedero_config')
            .insert({
              user_id: user.id,
              cuenta_id: newCuenta.id,
              recarga_mensual: data.recarga_mensual
            });
        }

        haptic.trigger('success');
        toast({ title: 'Cuenta creada' });
      }

      // Refresh list — setting rawCuentas triggers useAccountBalances to recompute balances
      const { data: cuentasData } = await supabase
        .from('cuentas')
        .select('id, nombre, tipo, saldo_inicial, color, activa, orden, capital_inicial_invertido, divisa, created_at')
        .eq('user_id', user.id)
        .order('orden');

      if (cuentasData) {
        const { data: configsData } = await supabase
          .from('cuentas_monedero_config')
          .select('*')
          .eq('user_id', user.id);

        setRawCuentas(cuentasData as Cuenta[]);
        setMonederoConfigs((configsData as CuentaMonederoConfig[]) ?? []);
      }

      setModalOpen(false);
      setEditingCuenta(null);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error saving cuenta:', error);
      }
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo guardar la cuenta'
      });
    }
  };

  const handleToggleActive = async (cuenta: CuentaConConfig) => {
    const { error } = await supabase
      .from('cuentas')
      .update({ activa: !cuenta.activa })
      .eq('id', cuenta.id);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo actualizar el estado'
      });
      return;
    }

    haptic.trigger('light');
    setRawCuentas(rawCuentas.map(c =>
      c.id === cuenta.id ? { ...c, activa: !c.activa } : c
    ));
  };

  const handleSetDefault = async (cuenta: CuentaConConfig) => {
    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .update({ cuenta_default_id: cuenta.id })
      .eq('id', user.id);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo establecer como predeterminada'
      });
      return;
    }

    await refreshProfile();
    haptic.trigger('light');
    toast({ title: 'Cuenta predeterminada actualizada' });
  };

  const handleDelete = async (cuenta: CuentaConConfig) => {
    if (!user) return;

    const { error } = await supabase
      .from('cuentas')
      .delete()
      .eq('id', cuenta.id);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo eliminar la cuenta'
      });
      return;
    }

    // Remove from default account if it was the default
    if (profile?.cuenta_default_id === cuenta.id) {
      await supabase
        .from('profiles')
        .update({ cuenta_default_id: null })
        .eq('id', user.id);
      await refreshProfile();
    }

    haptic.trigger('success');
    setRawCuentas(rawCuentas.filter(c => c.id !== cuenta.id));
    setDeleteConfirm(null);
    toast({ title: 'Cuenta eliminada' });
  };

  const handleConfirmPrevMonth = async () => {
    if (!user || !pendingPrevMonthUpdate) return;
    const { cuentaId, mesAnterior, saldoNuevo } = pendingPrevMonthUpdate;

    try {
      await supabase
        .from('snapshots_patrimonio')
        .upsert(
          {
            user_id: user.id,
            mes: mesAnterior,
            cuenta_id: cuentaId,
            saldo_registrado: saldoNuevo,
            tipo: 'manual'
          },
          { onConflict: 'user_id,mes,cuenta_id' }
        );

      toast({ title: `Snapshot de ${pendingPrevMonthUpdate.mesAnteriorLabel} actualizado` });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo actualizar el mes anterior'
      });
    }
    setPendingPrevMonthUpdate(null);
  };

  // Group accounts by type
  const groupedCuentas = {
    corriente: cuentas.filter(c => c.tipo === 'corriente'),
    inversion: cuentas.filter(c => c.tipo === 'inversion'),
    monedero: cuentas.filter(c => c.tipo === 'monedero')
  };

  const renderAccountGroup = (title: string, accounts: CuentaConConfig[]) => {
    if (accounts.length === 0) return null;

    return (
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        {accounts.map((cuenta) => (
          <div
            key={cuenta.id}
            className={cn(
              "flex items-center justify-between p-4 rounded-lg border cursor-pointer hover:bg-muted/30",
              !cuenta.activa && "opacity-50"
            )}
            onClick={() => handleEdit(cuenta)}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: cuenta.color }}
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{cuenta.nombre}</span>
                  {profile?.cuenta_default_id === cuenta.id && (
                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {cuenta.saldo_actual !== undefined && (
                    <span className={cn(
                      "font-medium",
                      cuenta.saldo_actual >= 0 ? "text-green-600" : "text-red-600"
                    )}>
                      {formatCurrency(cuenta.saldo_actual, cuenta.divisa)}
                    </span>
                  )}
                  {cuenta.tipo === 'inversion' && cuenta.capital_inicial_invertido > 0 && (
                    <span className="text-xs text-muted-foreground">
                      Inv: {formatCurrency(cuenta.capital_inicial_invertido, cuenta.divisa)}
                    </span>
                  )}
                  {cuenta.tipo === 'monedero' && cuenta.monedero_config && (
                    <span className="text-xs text-muted-foreground">
                      Recarga: {cuenta.monedero_config.recarga_mensual}€/mes
                    </span>
                  )}
                </div>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger className="p-1 rounded hover:bg-muted outline-none shrink-0" onClick={(e) => e.stopPropagation()}>
                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleToggleActive(cuenta)} className="py-2.5 px-4">
                  {cuenta.activa ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                  {cuenta.activa ? "Ocultar" : "Mostrar"}
                </DropdownMenuItem>
                {profile?.cuenta_default_id !== cuenta.id && cuenta.activa && (
                  <DropdownMenuItem onClick={() => handleSetDefault(cuenta)} className="py-2.5 px-4">
                    <Star className="h-4 w-4 mr-2" />
                    Hacer favorita
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => setDeleteConfirm(cuenta)}
                  className="py-2.5 px-4 text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>
    );
  };

  return (
    <ProtectedRoute>
      <MainLayout>
        <div className="space-y-4 md:space-y-6">
          <MobileSubpageHeader title="Gestión de Cuentas" backHref="/configuracion" />

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-muted"><Wallet className="h-4 w-4 text-muted-foreground" /></div>
                Mis Cuentas
              </CardTitle>
              <Button onClick={handleCreate} className="shrink-0 h-7 w-7 p-0 sm:h-9 sm:w-auto sm:px-4">
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Nueva Cuenta</span>
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : cuentas.length === 0 ? (
                <div className="text-center py-8">
                  <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium">No hay cuentas configuradas</p>
                  <p className="text-muted-foreground mb-4">
                    Añade tu primera cuenta para empezar
                  </p>
                  <Button onClick={handleCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    Añadir cuenta
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {renderAccountGroup('Cuentas Corrientes', groupedCuentas.corriente)}
                  {renderAccountGroup('Inversiones', groupedCuentas.inversion)}
                  {renderAccountGroup('Monederos', groupedCuentas.monedero)}
                </div>
              )}
            </CardContent>
          </Card>

          {isMobile ? (
            <Drawer open={modalOpen} onOpenChange={setModalOpen} shouldScaleBackground={false}>
              <DrawerContent className="flex flex-col" style={{ height: '85dvh', maxHeight: '85dvh' }}>
                <DrawerHeader className="text-left px-6 pt-4 pb-2 shrink-0">
                  <DrawerTitle>{editingCuenta ? 'Editar Cuenta' : 'Nueva Cuenta'}</DrawerTitle>
                </DrawerHeader>
                <div ref={swipeDismissCuenta} className="flex-1 overflow-y-auto px-6 pb-6" data-vaul-no-drag>
                  <CuentaForm
                    initialData={editingCuenta || undefined}
                    saldoActual={editingCuenta?.saldo_actual}
                    onSubmit={handleSave}
                    onCancel={() => setModalOpen(false)}
                  />
                </div>
              </DrawerContent>
            </Drawer>
          ) : (
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
              <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
                <DialogHeader>
                  <DialogTitle>
                    {editingCuenta ? 'Editar Cuenta' : 'Nueva Cuenta'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingCuenta
                      ? 'Modifica los datos de la cuenta'
                      : 'Añade una nueva cuenta'}
                  </DialogDescription>
                </DialogHeader>
                <CuentaForm
                  initialData={editingCuenta || undefined}
                  saldoActual={editingCuenta?.saldo_actual}
                  onSubmit={handleSave}
                  onCancel={() => setModalOpen(false)}
                />
              </DialogContent>
            </Dialog>
          )}

          {/* Previous month snapshot prompt */}
          <AlertDialog
            open={!!pendingPrevMonthUpdate}
            onOpenChange={(open) => { if (!open) setPendingPrevMonthUpdate(null); }}
          >
            <AlertDialogContent className="max-w-sm">
              <AlertDialogHeader>
                <AlertDialogTitle>Actualizar mes anterior</AlertDialogTitle>
                <AlertDialogDescription>
                  {pendingPrevMonthUpdate && (
                    <>
                      El snapshot de <span className="font-medium">{pendingPrevMonthUpdate.mesAnteriorLabel}</span> para{' '}
                      <span className="font-medium">{pendingPrevMonthUpdate.cuentaNombre}</span> no tiene un saldo manual registrado.
                      {' '}¿Quieres aplicar también este saldo a ese mes?
                    </>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>No, solo este mes</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmPrevMonth}>
                  Sí, actualizar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Delete confirmation */}
          <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>¿Eliminar cuenta?</DialogTitle>
                <DialogDescription>
                  Esta acción no se puede deshacer. Se eliminarán también todos los movimientos asociados a esta cuenta.
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
