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
import { GastoRecurrenteForm } from '@/components/configuracion/GastoRecurrenteForm';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  Pencil, 
  Trash2,
  CreditCard,
  Loader2,
  ArrowLeft
} from 'lucide-react';
import { GastoRecurrente, Cuenta, Categoria } from '@/types/database';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

interface GastoRecurrenteConRelaciones extends GastoRecurrente {
  cuenta?: Cuenta;
  categoria?: Categoria;
  subcategoria?: Categoria | null;
}

export default function ConfigRecurrentes() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  
  const [gastos, setGastos] = useState<GastoRecurrenteConRelaciones[]>([]);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGasto, setEditingGasto] = useState<GastoRecurrenteConRelaciones | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

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

      // Fetch recurring expenses
      const { data: gastosData } = await supabase
        .from('gastos_recurrentes')
        .select('*')
        .eq('user_id', user.id)
        .order('concepto');

      if (gastosData) {
        const gastosConRelaciones = gastosData.map(g => ({
          ...g,
          cuenta: cuentasData?.find(c => c.id === g.cuenta_id),
          categoria: categoriasData?.find(c => c.id === g.categoria_id),
          subcategoria: g.subcategoria_id 
            ? categoriasData?.find(c => c.id === g.subcategoria_id)
            : null
        })) as GastoRecurrenteConRelaciones[];
        
        setGastos(gastosConRelaciones);
      }
      
      setLoading(false);
    };

    fetchData();
  }, [user]);

  const handleCreate = () => {
    setEditingGasto(null);
    setModalOpen(true);
  };

  const handleEdit = (gasto: GastoRecurrenteConRelaciones) => {
    setEditingGasto(gasto);
    setModalOpen(true);
  };

  const handleSave = async (data: any) => {
    if (!user) return;

    try {
      if (editingGasto) {
        // Update
        const { error } = await supabase
          .from('gastos_recurrentes')
          .update({
            concepto: data.concepto,
            cantidad: data.cantidad,
            dia_del_mes: data.dia_del_mes,
            cuenta_id: data.cuenta_id,
            categoria_id: data.categoria_id,
            subcategoria_id: data.subcategoria_id || null,
            notas: data.notas || null
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

        toast({ title: 'Gasto recurrente actualizado' });
      } else {
        // Create
        const { data: newGasto, error } = await supabase
          .from('gastos_recurrentes')
          .insert({
            user_id: user.id,
            concepto: data.concepto,
            cantidad: data.cantidad,
            dia_del_mes: data.dia_del_mes,
            cuenta_id: data.cuenta_id,
            categoria_id: data.categoria_id,
            subcategoria_id: data.subcategoria_id || null,
            notas: data.notas || null
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
        toast({ title: 'Gasto recurrente creado' });
      }

      setModalOpen(false);
      setEditingGasto(null);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error saving gasto recurrente:', error);
      }
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo guardar el gasto recurrente'
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
        description: 'No se pudo eliminar el gasto recurrente'
      });
    } else {
      setGastos(gastos.filter(g => g.id !== id));
      toast({ title: 'Gasto recurrente eliminado' });
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
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Link to="/configuracion">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Gastos Recurrentes</h1>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Plantillas de Gastos
              </CardTitle>
              <Button onClick={handleCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Recurrente
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
                  <p className="text-lg font-medium">No hay gastos recurrentes</p>
                  <p className="text-muted-foreground mb-4">
                    Configura tus gastos que se repiten cada mes
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
                        "flex items-center justify-between p-4 rounded-lg border",
                        !gasto.activo && "opacity-50"
                      )}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <span className="font-medium">{gasto.concepto}</span>
                          <span className={cn(
                            "font-bold",
                            gasto.cantidad >= 0 ? "text-green-600" : "text-destructive"
                          )}>
                            {formatCurrency(Number(gasto.cantidad))}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          {gasto.dia_del_mes && (
                            <span>Día {gasto.dia_del_mes}</span>
                          )}
                          <span>•</span>
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

                      <div className="flex items-center gap-2">
                        <Switch
                          checked={gasto.activo}
                          onCheckedChange={() => handleToggleActive(gasto)}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(gasto)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteConfirm(gasto.id)}
                          className="text-destructive"
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
          <Dialog open={modalOpen} onOpenChange={setModalOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingGasto ? 'Editar Gasto Recurrente' : 'Nuevo Gasto Recurrente'}
                </DialogTitle>
                <DialogDescription>
                  {editingGasto 
                    ? 'Modifica los datos del gasto recurrente' 
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
              />
            </DialogContent>
          </Dialog>

          {/* Delete confirmation */}
          <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>¿Eliminar gasto recurrente?</DialogTitle>
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
