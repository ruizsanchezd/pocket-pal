import { useState, useEffect, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, startOfWeek, addWeeks, isSameMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
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
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { MovimientoConRelaciones, Cuenta, Categoria } from '@/types/database';
import { cn } from '@/lib/utils';
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

export default function Explorar() {
  const { user, profile } = useAuth();

  // Filter state
  const [tipoPeriodo, setTipoPeriodo] = useState<TipoPeriodo>('mes');
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [trimestre, setTrimestre] = useState(Math.floor(new Date().getMonth() / 3) + 1);
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('');
  const [subcategoriaFiltro, setSubcategoriaFiltro] = useState<string>('');

  // Data state
  const [movimientos, setMovimientos] = useState<MovimientoConRelaciones[]>([]);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Generate year options (current year ± 5 years)
  const anios = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);
  }, []);

  // Get parent categories (non-subcategories)
  const categoriasParent = useMemo(() => {
    return categorias.filter(c => !c.parent_id);
  }, [categorias]);

  // Get subcategories for filtered category
  const subcategorias = useMemo(() => {
    if (!categoriaFiltro) return [];
    return categorias.filter(c => c.parent_id === categoriaFiltro);
  }, [categorias, categoriaFiltro]);

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

      // Build query for movements
      let query = supabase
        .from('movimientos')
        .select('*')
        .eq('user_id', user.id)
        .gte('fecha', dateRange.fechaDesde)
        .lte('fecha', dateRange.fechaHasta)
        .order('fecha', { ascending: false });

      // Apply category filter
      if (categoriaFiltro) {
        query = query.eq('categoria_id', categoriaFiltro);
      }

      // Apply subcategory filter
      if (subcategoriaFiltro) {
        query = query.eq('subcategoria_id', subcategoriaFiltro);
      }

      const { data: movimientosData } = await query;

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
      }

      setLoading(false);
    };

    fetchData();
  }, [user, dateRange, categoriaFiltro, subcategoriaFiltro]);

  // Calculate summary
  const summary = useMemo(() => {
    const total = movimientos.reduce((sum, m) => sum + Number(m.cantidad), 0);
    const count = movimientos.length;
    return { total, count };
  }, [movimientos]);

  // Temporal evolution chart data
  const temporalData = useMemo(() => {
    if (movimientos.length === 0) return [];

    if (tipoPeriodo === 'anio') {
      // Group by month
      const monthlyData = Array.from({ length: 12 }, (_, i) => {
        const monthStr = format(new Date(anio, i, 1), 'MMM', { locale: es });
        const monthMovs = movimientos.filter(m => {
          const movDate = new Date(m.fecha);
          return movDate.getMonth() === i;
        });
        const total = monthMovs.reduce((sum, m) => sum + Number(m.cantidad), 0);
        return { name: monthStr, total };
      });
      return monthlyData;
    } else if (tipoPeriodo === 'trimestre') {
      // Group by month within quarter
      const quarterMonths = Array.from({ length: 3 }, (_, i) => {
        const monthIndex = (trimestre - 1) * 3 + i;
        const monthStr = format(new Date(anio, monthIndex, 1), 'MMM', { locale: es });
        const monthMovs = movimientos.filter(m => {
          const movDate = new Date(m.fecha);
          return movDate.getMonth() === monthIndex;
        });
        const total = monthMovs.reduce((sum, m) => sum + Number(m.cantidad), 0);
        return { name: monthStr, total };
      });
      return quarterMonths;
    } else {
      // Group by week
      const monthStart = new Date(anio, mes - 1, 1);
      const weeks: { name: string; total: number }[] = [];
      let currentWeekStart = startOfWeek(monthStart, { weekStartsOn: 1 });
      let weekNum = 1;

      while (isSameMonth(currentWeekStart, monthStart) || weekNum === 1) {
        const weekEnd = addWeeks(currentWeekStart, 1);
        const weekMovs = movimientos.filter(m => {
          const movDate = new Date(m.fecha);
          return movDate >= currentWeekStart && movDate < weekEnd;
        });
        const total = weekMovs.reduce((sum, m) => sum + Number(m.cantidad), 0);
        weeks.push({ name: `S${weekNum}`, total });

        currentWeekStart = weekEnd;
        weekNum++;

        if (weekNum > 5) break; // Max 5 weeks
      }
      return weeks;
    }
  }, [movimientos, tipoPeriodo, anio, mes, trimestre]);

  // Distribution chart data
  const distributionData = useMemo(() => {
    if (movimientos.length === 0) return [];

    if (!categoriaFiltro) {
      // Group by category
      const categoryTotals = new Map<string, { name: string; total: number }>();

      movimientos.forEach(m => {
        if (!m.categoria) return;
        const existing = categoryTotals.get(m.categoria.id) || { name: m.categoria.nombre, total: 0 };
        existing.total += Math.abs(Number(m.cantidad));
        categoryTotals.set(m.categoria.id, existing);
      });

      // Sort and take top 5
      const sorted = Array.from(categoryTotals.values()).sort((a, b) => b.total - a.total);
      const top5 = sorted.slice(0, 5);
      const otros = sorted.slice(5).reduce((sum, item) => sum + item.total, 0);

      if (otros > 0) {
        top5.push({ name: 'Otros', total: otros });
      }

      return top5;
    } else {
      // Group by subcategory
      const subcategoryTotals = new Map<string, { name: string; total: number }>();

      movimientos.forEach(m => {
        if (m.subcategoria) {
          const existing = subcategoryTotals.get(m.subcategoria.id) || { name: m.subcategoria.nombre, total: 0 };
          existing.total += Math.abs(Number(m.cantidad));
          subcategoryTotals.set(m.subcategoria.id, existing);
        } else {
          // Movements without subcategory
          const existing = subcategoryTotals.get('none') || { name: 'Sin subcategoría', total: 0 };
          existing.total += Math.abs(Number(m.cantidad));
          subcategoryTotals.set('none', existing);
        }
      });

      // Sort and take top 5
      const sorted = Array.from(subcategoryTotals.values()).sort((a, b) => b.total - a.total);
      const top5 = sorted.slice(0, 5);
      const otros = sorted.slice(5).reduce((sum, item) => sum + item.total, 0);

      if (otros > 0) {
        top5.push({ name: 'Otros', total: otros });
      }

      return top5;
    }
  }, [movimientos, categoriaFiltro]);

  // Colors for distribution chart
  const chartColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6b7280'];

  // Pagination
  const paginatedMovimientos = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return movimientos.slice(startIndex, endIndex);
  }, [movimientos, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(movimientos.length / itemsPerPage);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [dateRange, categoriaFiltro, subcategoriaFiltro]);

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
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Explorar</h1>
            <p className="text-muted-foreground mt-2">
              Analiza tus movimientos con filtros y gráficos
            </p>
          </div>

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Filtros</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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

                {/* Category Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Categoría</label>
                  <Select
                    value={categoriaFiltro}
                    onValueChange={(value) => {
                      setCategoriaFiltro(value);
                      setSubcategoriaFiltro(''); // Reset subcategory
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todas</SelectItem>
                      {categoriasParent.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Subcategory Filter */}
                {categoriaFiltro && subcategorias.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Subcategoría</label>
                    <Select value={subcategoriaFiltro} onValueChange={setSubcategoriaFiltro}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Todas</SelectItem>
                        {subcategorias.map(sub => (
                          <SelectItem key={sub.id} value={sub.id}>{sub.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <Card>
                <CardContent className="py-6">
                  <div className="flex flex-wrap justify-center gap-8 text-center">
                    <div>
                      <p className="text-sm text-muted-foreground">Total</p>
                      <p className={`text-2xl font-bold ${summary.total >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                        {formatCurrency(summary.total)}
                      </p>
                    </div>
                    <div className="border-l pl-8">
                      <p className="text-sm text-muted-foreground">Movimientos</p>
                      <p className="text-2xl font-bold">{summary.count}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Temporal Evolution Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>Evolución temporal</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {temporalData.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        No hay datos para mostrar
                      </p>
                    ) : (
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={temporalData}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis
                              dataKey="name"
                              className="text-xs"
                              tick={{ fill: 'hsl(var(--muted-foreground))' }}
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
                            <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Distribution Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>
                      Distribución {categoriaFiltro ? 'por subcategoría' : 'por categoría'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {distributionData.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        No hay datos para mostrar
                      </p>
                    ) : (
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={distributionData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis
                              type="number"
                              className="text-xs"
                              tick={{ fill: 'hsl(var(--muted-foreground))' }}
                              tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                            />
                            <YAxis
                              type="category"
                              dataKey="name"
                              className="text-xs"
                              tick={{ fill: 'hsl(var(--muted-foreground))' }}
                              width={100}
                            />
                            <Tooltip
                              formatter={(value: number) => {
                                const total = distributionData.reduce((sum, d) => sum + d.total, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return [`${formatCurrency(value)} (${percentage}%)`, 'Total'];
                              }}
                              contentStyle={{
                                backgroundColor: 'hsl(var(--background))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px'
                              }}
                            />
                            <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                              {distributionData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Filtered Movements Table */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Movimientos filtrados</CardTitle>
                  {movimientos.length > 0 && (
                    <span className="text-sm text-muted-foreground">
                      {movimientos.length} resultados
                    </span>
                  )}
                </CardHeader>
                <CardContent>
                  {movimientos.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      No hay movimientos que coincidan con los filtros
                    </p>
                  ) : (
                    <>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[100px]">Fecha</TableHead>
                            <TableHead>Concepto</TableHead>
                            <TableHead className="text-right">Cantidad</TableHead>
                            <TableHead className="hidden md:table-cell">Categoría</TableHead>
                            <TableHead className="hidden lg:table-cell">Subcategoría</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedMovimientos.map((movimiento) => (
                            <TableRow key={movimiento.id}>
                              <TableCell className="font-medium">
                                {format(new Date(movimiento.fecha), 'dd/MM/yyyy')}
                              </TableCell>
                              <TableCell>{movimiento.concepto}</TableCell>
                              <TableCell className={cn(
                                "text-right font-medium",
                                movimiento.cantidad > 0 ? "text-green-600" : "text-destructive"
                              )}>
                                {formatCurrency(Number(movimiento.cantidad))}
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                {movimiento.categoria?.nombre || '-'}
                              </TableCell>
                              <TableCell className="hidden lg:table-cell">
                                {movimiento.subcategoria?.nombre || '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>

                      {/* Pagination */}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 mt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                          >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Anterior
                          </Button>
                          <span className="text-sm text-muted-foreground">
                            Página {currentPage} de {totalPages}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                          >
                            Siguiente
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
}
