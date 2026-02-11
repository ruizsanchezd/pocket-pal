import { useState, useEffect, useMemo } from 'react';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MovimientoForm } from '@/components/movimientos/MovimientoForm';
import { useToast } from '@/hooks/use-toast';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Receipt,
  Loader2,
  AlertCircle,
  Download,
  LayoutDashboard
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { MovimientoConRelaciones, Cuenta, Categoria } from '@/types/database';
import { cn } from '@/lib/utils';
import { downloadFile, generateMovimientosCSV } from '@/lib/export';

export default function Movimientos() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  
  const [currentMonth, setCurrentMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [movimientos, setMovimientos] = useState<MovimientoConRelaciones[]>([]);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMovimiento, setEditingMovimiento] = useState<MovimientoConRelaciones | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showRecurrenteBanner, setShowRecurrenteBanner] = useState(false);

  // Format month for display
  const formattedMonth = useMemo(() => {
    const date = parse(currentMonth, 'yyyy-MM', new Date());
    return format(date, 'MMMM yyyy', { locale: es });
  }, [currentMonth]);

  // Calculate totals
  const totals = useMemo(() => {
    const ingresos = movimientos
      .filter(m => m.cantidad > 0)
      .reduce((sum, m) => sum + Number(m.cantidad), 0);
    const gastos = movimientos
      .filter(m => m.cantidad < 0)
      .reduce((sum, m) => sum + Math.abs(Number(m.cantidad)), 0);
    return {
      ingresos,
      gastos,
      balance: ingresos - gastos
    };
  }, [movimientos]);

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
        .order('fecha', { ascending: true });

      if (movimientosData) {
        // Map accounts and categories to movements
        const movimientosConRelaciones = movimientosData.map(m => ({
          ...m,
          cuenta: cuentasData?.find(c => c.id === m.cuenta_id),
          categoria: categoriasData?.find(c => c.id === m.categoria_id),
          subcategoria: m.subcategoria_id 
            ? categoriasData?.find(c => c.id === m.subcategoria_id) 
            : null
        })) as MovimientoConRelaciones[];
        
        setMovimientos(movimientosConRelaciones);

        // Check if we should show recurrente banner
        const hasRecurrentes = movimientosData.some(m => m.es_recurrente);
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
      }
      
      setLoading(false);
    };

    fetchData();
  }, [user, currentMonth]);

  const navigateMonth = (direction: 'prev' | 'next') => {
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
      setMovimientos(movimientos.filter(m => m.id !== id));
      toast({
        title: 'Movimiento eliminado'
      });
    }
    setDeleteConfirm(null);
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
    const movimientosToCreate = templates.map(t => ({
      user_id: user.id,
      fecha: format(new Date(date.getFullYear(), date.getMonth(), t.dia_del_mes || 1), 'yyyy-MM-dd'),
      concepto: t.concepto,
      cantidad: t.cantidad,
      cuenta_id: t.cuenta_id,
      categoria_id: t.categoria_id,
      subcategoria_id: t.subcategoria_id,
      notas: t.notas,
      es_recurrente: true,
      recurrente_template_id: t.id,
      mes_referencia: currentMonth
    }));

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
      description: `Se crearon ${templates.length} movimientos`
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
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigateMonth('prev')}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-2xl font-bold capitalize min-w-[200px] text-center">
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
            <div className="flex gap-2">
              <Button
                variant="outline"
                asChild
              >
                <Link to="/dashboard">
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Dashboard</span>
                </Link>
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  const csv = generateMovimientosCSV(movimientos);
                  downloadFile(csv, `movimientos_${currentMonth}.csv`);
                  toast({
                    title: 'CSV exportado',
                    description: `Exportados ${movimientos.length} movimientos de ${formattedMonth}`
                  });
                }}
                disabled={movimientos.length === 0}
                title="Exportar mes a CSV"
              >
                <Download className="h-4 w-4" />
              </Button>
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
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Movimientos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : movimientos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">No hay movimientos este mes</p>
                  <p className="text-muted-foreground mb-4">
                    Empieza añadiendo tu primer movimiento
                  </p>
                  <Button onClick={handleCreateMovimiento}>
                    <Plus className="mr-2 h-4 w-4" />
                    Añadir primer movimiento
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Fecha</TableHead>
                      <TableHead>Concepto</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead className="hidden md:table-cell">Cuenta</TableHead>
                      <TableHead className="hidden md:table-cell">Categoría</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movimientos.map((movimiento) => (
                      <TableRow key={movimiento.id} className="group">
                        <TableCell className="font-medium">
                          {format(new Date(movimiento.fecha), 'dd/MM')}
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
                        <TableCell className={cn(
                          "text-right font-medium",
                          movimiento.cantidad > 0 ? "text-green-600" : "text-destructive"
                        )}>
                          {formatCurrency(Number(movimiento.cantidad))}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span 
                            className="px-2 py-1 rounded text-xs"
                            style={{ backgroundColor: `${movimiento.cuenta?.color}20` }}
                          >
                            {movimiento.cuenta?.nombre}
                          </span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {movimiento.categoria?.nombre}
                          {movimiento.subcategoria && (
                            <span className="text-muted-foreground">
                              {' > '}{movimiento.subcategoria.nombre}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleEditMovimiento(movimiento)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => setDeleteConfirm(movimiento.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Totals */}
          {movimientos.length > 0 && (
            <Card>
              <CardContent className="py-4">
                <div className="flex flex-wrap justify-center gap-6 text-center">
                  <div>
                    <p className="text-sm text-muted-foreground">Ingresos</p>
                    <p className="text-xl font-bold text-green-600">
                      +{totals.ingresos.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€
                    </p>
                  </div>
                  <div className="border-l pl-6">
                    <p className="text-sm text-muted-foreground">Gastos</p>
                    <p className="text-xl font-bold text-destructive">
                      -{totals.gastos.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€
                    </p>
                  </div>
                  <div className="border-l pl-6">
                    <p className="text-sm text-muted-foreground">Balance</p>
                    <p className={cn(
                      "text-xl font-bold",
                      totals.balance >= 0 ? "text-green-600" : "text-destructive"
                    )}>
                      {totals.balance >= 0 ? '+' : ''}{totals.balance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Create/Edit Modal */}
          <Dialog open={modalOpen} onOpenChange={setModalOpen}>
            <DialogContent className="max-w-md">
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
      </MainLayout>
    </ProtectedRoute>
  );
}
