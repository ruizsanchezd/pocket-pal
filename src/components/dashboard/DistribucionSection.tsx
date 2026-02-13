import { useState, useEffect, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { Movimiento, Categoria } from '@/types/database';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

type TipoPeriodo = 'mes' | 'trimestre' | 'anio';
type TipoMovimiento = 'gastos' | 'ingresos' | 'todos';

export function DistribucionSection() {
  const { user, profile } = useAuth();

  // Filter state
  const [tipoPeriodo, setTipoPeriodo] = useState<TipoPeriodo>('mes');
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [trimestre, setTrimestre] = useState(Math.floor(new Date().getMonth() / 3) + 1);
  const [tipoMovimiento, setTipoMovimiento] = useState<TipoMovimiento>('gastos');

  // Data state
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);

  // Generate year options (current year ± 5 years)
  const anios = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);
  }, []);

  // Compute date range based on filters
  const dateRange = useMemo(() => {
    let fechaDesde: Date;
    let fechaHasta: Date;

    if (tipoPeriodo === 'mes') {
      const date = new Date(anio, mes - 1, 1);
      fechaDesde = startOfMonth(date);
      fechaHasta = endOfMonth(date);
    } else if (tipoPeriodo === 'trimestre') {
      const date = new Date(anio, (trimestre - 1) * 3, 1);
      fechaDesde = startOfQuarter(date);
      fechaHasta = endOfQuarter(date);
    } else {
      const date = new Date(anio, 0, 1);
      fechaDesde = startOfYear(date);
      fechaHasta = endOfYear(date);
    }

    return {
      fechaDesde: format(fechaDesde, 'yyyy-MM-dd'),
      fechaHasta: format(fechaHasta, 'yyyy-MM-dd')
    };
  }, [tipoPeriodo, anio, mes, trimestre]);

  // Fetch data
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch categories
        const { data: categoriasData } = await supabase
          .from('categorias')
          .select('*')
          .eq('user_id', user.id)
          .order('orden');

        if (categoriasData) setCategorias(categoriasData as Categoria[]);

        // Build query for movements
        let query = supabase
          .from('movimientos')
          .select('*')
          .eq('user_id', user.id)
          .gte('fecha', dateRange.fechaDesde)
          .lte('fecha', dateRange.fechaHasta);

        // Apply type filter
        if (tipoMovimiento === 'gastos') {
          query = query.lt('cantidad', 0);
        } else if (tipoMovimiento === 'ingresos') {
          query = query.gt('cantidad', 0);
        }

        const { data: movimientosData } = await query;

        if (movimientosData) {
          setMovimientos(movimientosData as Movimiento[]);
        }
      } catch (err) {
        if (import.meta.env.DEV) console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, dateRange, tipoMovimiento]);

  // Distribution by category
  const categoriaData = useMemo(() => {
    if (movimientos.length === 0) return [];

    const categoryTotals = new Map<string, { name: string; total: number }>();

    movimientos.forEach(m => {
      const categoria = categorias.find(c => c.id === m.categoria_id);
      if (!categoria || categoria.parent_id) return; // Skip subcategories

      const existing = categoryTotals.get(categoria.id) || { name: categoria.nombre, total: 0 };
      existing.total += Number(m.cantidad);
      categoryTotals.set(categoria.id, existing);
    });

    // Sort by absolute value descending
    const sorted = Array.from(categoryTotals.values()).sort((a, b) => Math.abs(b.total) - Math.abs(a.total));

    return sorted;
  }, [movimientos, categorias]);

  // Distribution by subcategory
  const subcategoriaData = useMemo(() => {
    if (movimientos.length === 0) return [];

    const subcategoryTotals = new Map<string, { name: string; total: number }>();

    movimientos.forEach(m => {
      if (m.subcategoria_id) {
        const subcategoria = categorias.find(c => c.id === m.subcategoria_id);
        if (!subcategoria) return;

        const existing = subcategoryTotals.get(subcategoria.id) || { name: subcategoria.nombre, total: 0 };
        existing.total += Number(m.cantidad);
        subcategoryTotals.set(subcategoria.id, existing);
      } else {
        // Movements without subcategory
        const existing = subcategoryTotals.get('none') || { name: 'Sin subcategoría', total: 0 };
        existing.total += Number(m.cantidad);
        subcategoryTotals.set('none', existing);
      }
    });

    // Sort by absolute value descending
    const sorted = Array.from(subcategoryTotals.values()).sort((a, b) => Math.abs(b.total) - Math.abs(a.total));

    return sorted;
  }, [movimientos, categorias]);

  const formatCurrency = (amount: number) => {
    const symbol = profile?.divisa_principal === 'USD' ? '$' :
                   profile?.divisa_principal === 'GBP' ? '£' : '€';
    return `${amount >= 0 ? '+' : ''}${amount.toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}${symbol}`;
  };

  // Get color for bar based on value
  const getBarColor = (value: number) => {
    return value >= 0 ? '#10b981' : '#ef4444';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Distribución</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {/* Period Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Periodo</label>
            <Select value={tipoPeriodo} onValueChange={(value) => setTipoPeriodo(value as TipoPeriodo)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mes">Mes</SelectItem>
                <SelectItem value="trimestre">Trimestre</SelectItem>
                <SelectItem value="anio">Año</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Year */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Año</label>
            <Select value={anio.toString()} onValueChange={(value) => setAnio(parseInt(value))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {anios.map(y => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Month or Quarter */}
          {tipoPeriodo === 'mes' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Mes</label>
              <Select value={mes.toString()} onValueChange={(value) => setMes(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <SelectItem key={m} value={m.toString()}>
                      {format(new Date(2000, m - 1, 1), 'MMMM', { locale: es })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {tipoPeriodo === 'trimestre' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Trimestre</label>
              <Select value={trimestre.toString()} onValueChange={(value) => setTrimestre(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Q1 (Ene-Mar)</SelectItem>
                  <SelectItem value="2">Q2 (Abr-Jun)</SelectItem>
                  <SelectItem value="3">Q3 (Jul-Sep)</SelectItem>
                  <SelectItem value="4">Q4 (Oct-Dic)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Type Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Tipo</label>
            <Select value={tipoMovimiento} onValueChange={(value) => setTipoMovimiento(value as TipoMovimiento)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gastos">Gastos</SelectItem>
                <SelectItem value="ingresos">Ingresos</SelectItem>
                <SelectItem value="todos">Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Charts */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Por categoría</CardTitle>
              </CardHeader>
              <CardContent>
                {categoriaData.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No hay datos para mostrar
                  </p>
                ) : (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={categoriaData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                          dataKey="name"
                          className="text-xs"
                          tick={{ fill: 'hsl(var(--muted-foreground))' }}
                          angle={-45}
                          textAnchor="end"
                          height={80}
                        />
                        <YAxis
                          className="text-xs"
                          tick={{ fill: 'hsl(var(--muted-foreground))' }}
                          tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                          formatter={(value: number) => [formatCurrency(value), 'Total']}
                          contentStyle={{
                            backgroundColor: 'hsl(var(--background))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                          {categoriaData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={getBarColor(entry.total)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Subcategory Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Por subcategoría</CardTitle>
              </CardHeader>
              <CardContent>
                {subcategoriaData.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No hay datos para mostrar
                  </p>
                ) : (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={subcategoriaData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                          dataKey="name"
                          className="text-xs"
                          tick={{ fill: 'hsl(var(--muted-foreground))' }}
                          angle={-45}
                          textAnchor="end"
                          height={80}
                        />
                        <YAxis
                          className="text-xs"
                          tick={{ fill: 'hsl(var(--muted-foreground))' }}
                          tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                          formatter={(value: number) => [formatCurrency(value), 'Total']}
                          contentStyle={{
                            backgroundColor: 'hsl(var(--background))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                          {subcategoriaData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={getBarColor(entry.total)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
