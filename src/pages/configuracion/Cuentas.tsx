import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { CuentaForm } from '@/components/configuracion/CuentaForm';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  Pencil, 
  Star, 
  Wallet,
  Loader2,
  ArrowLeft,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { Cuenta, CuentaMonederoConfig } from '@/types/database';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

interface CuentaConConfig extends Cuenta {
  monedero_config?: CuentaMonederoConfig | null;
}

export default function ConfigCuentas() {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  
  const [cuentas, setCuentas] = useState<CuentaConConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCuenta, setEditingCuenta] = useState<CuentaConConfig | null>(null);

  // Fetch accounts
  useEffect(() => {
    if (!user) return;
    
    const fetchCuentas = async () => {
      setLoading(true);
      
      const { data: cuentasData } = await supabase
        .from('cuentas')
        .select('*')
        .eq('user_id', user.id)
        .order('orden');
      
      if (cuentasData) {
        // Fetch monedero configs
        const { data: configsData } = await supabase
          .from('cuentas_monedero_config')
          .select('*')
          .eq('user_id', user.id);
        
        const cuentasConConfig = cuentasData.map(cuenta => ({
          ...cuenta,
          monedero_config: configsData?.find(c => c.cuenta_id === cuenta.id) || null
        })) as CuentaConConfig[];
        
        setCuentas(cuentasConConfig);
      }
      
      setLoading(false);
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

  const handleSave = async (data: any) => {
    if (!user) return;

    try {
      if (editingCuenta) {
        // Update account
        const { error: updateError } = await supabase
          .from('cuentas')
          .update({
            nombre: data.nombre,
            tipo: data.tipo,
            divisa: data.divisa,
            saldo_inicial: data.saldo_inicial,
            color: data.color
          })
          .eq('id', editingCuenta.id);

        if (updateError) throw updateError;

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

        toast({ title: 'Cuenta creada' });
      }

      // Refresh list
      const { data: cuentasData } = await supabase
        .from('cuentas')
        .select('*')
        .eq('user_id', user.id)
        .order('orden');
      
      if (cuentasData) {
        const { data: configsData } = await supabase
          .from('cuentas_monedero_config')
          .select('*')
          .eq('user_id', user.id);
        
        const cuentasConConfig = cuentasData.map(cuenta => ({
          ...cuenta,
          monedero_config: configsData?.find(c => c.cuenta_id === cuenta.id) || null
        })) as CuentaConConfig[];
        
        setCuentas(cuentasConConfig);
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

    setCuentas(cuentas.map(c => 
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
    toast({ title: 'Cuenta predeterminada actualizada' });
  };

  const handleReorder = async (cuenta: CuentaConConfig, direction: 'up' | 'down') => {
    const currentIndex = cuentas.findIndex(c => c.id === cuenta.id);
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    
    if (newIndex < 0 || newIndex >= cuentas.length) return;

    const newCuentas = [...cuentas];
    [newCuentas[currentIndex], newCuentas[newIndex]] = [newCuentas[newIndex], newCuentas[currentIndex]];

    // Update orden for both accounts
    await Promise.all([
      supabase.from('cuentas').update({ orden: newIndex }).eq('id', cuenta.id),
      supabase.from('cuentas').update({ orden: currentIndex }).eq('id', newCuentas[currentIndex].id)
    ]);

    setCuentas(newCuentas);
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
        {accounts.map((cuenta, index) => (
          <div
            key={cuenta.id}
            className={cn(
              "flex items-center justify-between p-4 rounded-lg border",
              !cuenta.activa && "opacity-50"
            )}
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
                {cuenta.tipo === 'monedero' && cuenta.monedero_config && (
                  <span className="text-xs text-muted-foreground">
                    Recarga: {cuenta.monedero_config.recarga_mensual}€/mes
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex flex-col">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  disabled={index === 0}
                  onClick={() => handleReorder(cuenta, 'up')}
                >
                  <ChevronUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  disabled={index === accounts.length - 1}
                  onClick={() => handleReorder(cuenta, 'down')}
                >
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </div>
              
              <Switch
                checked={cuenta.activa}
                onCheckedChange={() => handleToggleActive(cuenta)}
              />
              
              {profile?.cuenta_default_id !== cuenta.id && cuenta.activa && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleSetDefault(cuenta)}
                  title="Establecer como predeterminada"
                >
                  <Star className="h-4 w-4" />
                </Button>
              )}
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleEdit(cuenta)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <ProtectedRoute>
      <MainLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Link to="/configuracion">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Gestión de Cuentas</h1>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Mis Cuentas
              </CardTitle>
              <Button onClick={handleCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva Cuenta
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

          <Dialog open={modalOpen} onOpenChange={setModalOpen}>
            <DialogContent>
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
                onSubmit={handleSave}
                onCancel={() => setModalOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
}
