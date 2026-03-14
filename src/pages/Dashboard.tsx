import { useState, useEffect, useMemo } from 'react';
import { format, subMonths, startOfMonth, differenceInMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Cuenta, CuentaConSaldo } from '@/types/database';
import { Loader2, TrendingUp, TrendingDown, Wallet, PiggyBank, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';
// NOTE: useAccountBalances is not used here because Dashboard's balance computation
// is intertwined with inversion-specific logic: it needs the raw movimientos array
// (not just the sum) to separate `depositos` (positive movements) from the total,
// which is required to compute `invertido` and `rendimiento` for each inversion account.
// Extracting only the sum would force a second movimientos fetch for those accounts.
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { DistribucionSection } from '@/components/dashboard/DistribucionSection';
import { useAutoSnapshot } from '@/hooks/useAutoSnapshot';

interface PatrimonioData {
  mes: string;
  patrimonio: number;
}

export default function Dashboard() {
  const { user, profile } = useAuth();

  // Auto-generate snapshots for previous month if needed
  useAutoSnapshot(user?.id);

  const [cuentas, setCuentas] = useState<CuentaConSaldo[]>([]);
  const [loading, setLoading] = useState(true);
  const [patrimonioData, setPatrimonioData] = useState<PatrimonioData[]>([]);
  const [mesAnteriorPatrimonio, setMesAnteriorPatrimonio] = useState(0);
  const [hasMesAnteriorData, setHasMesAnteriorData] = useState(false);
  const [currentMonthTotals, setCurrentMonthTotals] = useState({
    ingresos: 0,
    gastos: 0
  });

  // Calculate metrics
  const metrics = useMemo(() => {
    const patrimonioTotal = cuentas.reduce((sum, c) => sum + c.saldo_actual, 0);
    const balanceMes = currentMonthTotals.ingresos - currentMonthTotals.gastos;
    const variacion = hasMesAnteriorData ? patrimonioTotal - mesAnteriorPatrimonio : null;
    const tasaAhorro = currentMonthTotals.ingresos > 0
      ? (balanceMes / currentMonthTotals.ingresos) * 100
      : null;

    // Ahorro 6 meses: variación de patrimonio entre el primer y último punto del gráfico
    const firstMonth = patrimonioData.find(d => d.patrimonio !== 0);
    const lastMonth = patrimonioData[patrimonioData.length - 1];
    const ahorro6Meses = firstMonth && lastMonth && firstMonth !== lastMonth
      ? lastMonth.patrimonio - firstMonth.patrimonio
      : null;

    return {
      patrimonioTotal,
      balanceMes,
      variacion,
      tasaAhorro,
      ahorro6Meses
    };
  }, [cuentas, currentMonthTotals, mesAnteriorPatrimonio, hasMesAnteriorData, patrimonioData]);

  // Fetch data
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setLoading(true);

      // Fetch accounts with calculated balance
      const { data: cuentasData } = await supabase
        .from('cuentas')
        .select('id, nombre, tipo, saldo_inicial, color, created_at, capital_inicial_invertido, divisa, activa')
        .eq('user_id', user.id)
        .eq('activa', true)
        .order('orden');

      // Fetch monedero configs for recarga mensual calculation
      const { data: monederoConfigs } = await supabase
        .from('cuentas_monedero_config')
        .select('cuenta_id, recarga_mensual')
        .eq('user_id', user.id);

      if (cuentasData) {
        const now = new Date();

        // For each account, calculate current balance
        const cuentasConSaldo: CuentaConSaldo[] = await Promise.all(
          cuentasData.map(async (cuenta) => {
            const { data: movimientos } = await supabase
              .from('movimientos')
              .select('cantidad')
              .eq('cuenta_id', cuenta.id);

            const sumaMovimientos = movimientos?.reduce(
              (sum, m) => sum + Number(m.cantidad),
              0
            ) || 0;

            // For monedero type, get monthly expenses
            let gastosMes = 0;
            if (cuenta.tipo === 'monedero') {
              const currentMonth = format(new Date(), 'yyyy-MM');
              const { data: gastosMesData } = await supabase
                .from('movimientos')
                .select('cantidad')
                .eq('cuenta_id', cuenta.id)
                .eq('mes_referencia', currentMonth)
                .lt('cantidad', 0);
              
              gastosMes = gastosMesData?.reduce(
                (sum, m) => sum + Math.abs(Number(m.cantidad)),
                0
              ) || 0;
            }

            // For inversion type, calculate invested (deposits) and returns
            let invertido = 0;
            let rendimiento = 0;
            if (cuenta.tipo === 'inversion') {
              // Capital inicial + sum of all positive movements (deposits)
              const capitalInicial = Number(cuenta.capital_inicial_invertido) || 0;
              const depositos = movimientos
                ?.filter(m => Number(m.cantidad) > 0)
                .reduce((sum, m) => sum + Number(m.cantidad), 0) || 0;

              invertido = capitalInicial + depositos;
              const saldoActual = Number(cuenta.saldo_inicial) + sumaMovimientos;
              rendimiento = saldoActual - invertido;
            }

            // For monedero type, add accumulated monthly recargas
            let recargaAcumulada = 0;
            if (cuenta.tipo === 'monedero') {
              const config = monederoConfigs?.find(c => c.cuenta_id === cuenta.id);
              if (config && cuenta.created_at) {
                // Count months from start of creation month to start of current month
                // dia_recarga is always 1, so each month's recarga has already happened if we're past day 1
                const meses = differenceInMonths(
                  startOfMonth(now),
                  startOfMonth(new Date(cuenta.created_at))
                );
                recargaAcumulada = config.recarga_mensual * meses;
              }
            }

            return {
              ...cuenta,
              saldo_actual: Number(cuenta.saldo_inicial) + sumaMovimientos + recargaAcumulada,
              gastos_mes: gastosMes,
              invertido,
              rendimiento
            } as CuentaConSaldo;
          })
        );

        setCuentas(cuentasConSaldo);

        // Calculate patrimonio for last 6 months using snapshots
        const currentMonth = format(now, 'yyyy-MM');
        const sixMonthsAgo = format(subMonths(now, 5), 'yyyy-MM');

        // Fetch snapshots for last 6 months
        const { data: snapshots } = await supabase
          .from('snapshots_patrimonio')
          .select('*')
          .eq('user_id', user.id)
          .gte('mes', sixMonthsAgo)
          .order('mes');

        // Group by month and sum balances
        const patrimonioByMonth = new Map<string, number>();

        snapshots?.forEach(snap => {
          const balance = snap.saldo_registrado ?? snap.saldo_calculado ?? 0;
          const current = patrimonioByMonth.get(snap.mes) || 0;
          patrimonioByMonth.set(snap.mes, current + Number(balance));
        });

        // Add current month with live calculated balance
        const currentMonthPatrimonio = cuentasConSaldo.reduce(
          (sum, c) => sum + c.saldo_actual,
          0
        );
        patrimonioByMonth.set(currentMonth, currentMonthPatrimonio);

        // Calculate previous month patrimonio before building the chart array
        const prevMonthStr = format(startOfMonth(subMonths(now, 1)), 'yyyy-MM');
        const prevMonthPatrimonio = patrimonioByMonth.get(prevMonthStr) || 0;
        const prevMonthHasData = patrimonioByMonth.has(prevMonthStr);

        // Build chart data for last 6 months
        const patrimonioHistory: PatrimonioData[] = [];
        for (let i = 5; i >= 0; i--) {
          const monthDate = startOfMonth(subMonths(now, i));
          const monthStr = format(monthDate, 'yyyy-MM');
          const monthLabel = format(monthDate, 'MMM', { locale: es });
          const patrimonio = patrimonioByMonth.get(monthStr) || 0;

          patrimonioHistory.push({
            mes: monthLabel,
            patrimonio
          });
        }

        setMesAnteriorPatrimonio(prevMonthPatrimonio);
        setHasMesAnteriorData(prevMonthHasData);
        setPatrimonioData(patrimonioHistory);

        // Fetch current month totals
        const { data: currentMonthMovimientos } = await supabase
          .from('movimientos')
          .select('cantidad')
          .eq('user_id', user.id)
          .eq('mes_referencia', currentMonth);

        if (currentMonthMovimientos) {
          const ingresos = currentMonthMovimientos
            .filter(m => Number(m.cantidad) > 0)
            .reduce((sum, m) => sum + Number(m.cantidad), 0);
          const gastos = currentMonthMovimientos
            .filter(m => Number(m.cantidad) < 0)
            .reduce((sum, m) => sum + Math.abs(Number(m.cantidad)), 0);

          setCurrentMonthTotals({ ingresos, gastos });
        }
      }

      setLoading(false);
    };

    fetchData();
  }, [user]);

  const currency = profile?.divisa_principal || 'EUR';

  // Group accounts by type
  const accountsByType = useMemo(() => {
    const groups: Record<string, CuentaConSaldo[]> = {
      corriente: [],
      inversion: [],
      monedero: []
    };
    
    cuentas.forEach(cuenta => {
      if (groups[cuenta.tipo]) {
        groups[cuenta.tipo].push(cuenta);
      }
    });
    
    return groups;
  }, [cuentas]);

  if (loading) {
    return (
      <ProtectedRoute>
        <MainLayout>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </MainLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <MainLayout>
        <div className="space-y-4 md:space-y-6">
          <h1 className="text-2xl font-semibold">Dashboard</h1>

          {/* Metrics cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Patrimonio Total
                </CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(metrics.patrimonioTotal, currency)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Balance Mes Actual
                </CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <div className={cn(
                    "text-2xl font-bold",
                    metrics.balanceMes >= 0 ? "text-green-600" : "text-destructive"
                  )}>
                    {metrics.balanceMes >= 0 ? '+' : ''}{formatCurrency(metrics.balanceMes, currency)}
                  </div>
                  {metrics.tasaAhorro !== null && (
                    <span className={cn(
                      "text-sm font-medium",
                      metrics.tasaAhorro >= 0 ? "text-green-600" : "text-destructive"
                    )}>
                      {metrics.tasaAhorro.toFixed(0)}%
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Patrimonio vs mes anterior
                </CardTitle>
                {metrics.variacion === null ? (
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                ) : metrics.variacion >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-destructive" />
                )}
              </CardHeader>
              <CardContent>
                {metrics.variacion === null ? (
                  <div className="text-2xl font-bold text-muted-foreground">--</div>
                ) : (
                  <div className={cn(
                    "text-2xl font-bold",
                    metrics.variacion >= 0 ? "text-green-600" : "text-destructive"
                  )}>
                    {metrics.variacion >= 0 ? '+' : ''}{formatCurrency(metrics.variacion, currency)}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Ahorro últimos 6 meses
                </CardTitle>
                <PiggyBank className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {metrics.ahorro6Meses === null ? (
                  <div className="text-2xl font-bold text-muted-foreground">--</div>
                ) : (
                  <div className={cn(
                    "text-2xl font-bold",
                    metrics.ahorro6Meses >= 0 ? "text-green-600" : "text-destructive"
                  )}>
                    {metrics.ahorro6Meses >= 0 ? '+' : ''}{formatCurrency(metrics.ahorro6Meses, currency)}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Accounts list */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-muted"><Wallet className="h-4 w-4 text-muted-foreground" /></div>
                  Mis Cuentas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Corriente accounts */}
                {accountsByType.corriente.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">
                      Cuentas Corrientes
                    </h3>
                    <div className="space-y-2">
                      {accountsByType.corriente.map((cuenta) => (
                        <div 
                          key={cuenta.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                        >
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: cuenta.color }}
                            />
                            <span>{cuenta.nombre}</span>
                          </div>
                          <span className="font-medium">
                            {formatCurrency(cuenta.saldo_actual, currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Investment accounts */}
                {accountsByType.inversion.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">
                      Inversiones
                    </h3>
                    <div className="space-y-2">
                      {accountsByType.inversion.map((cuenta) => (
                        <div
                          key={cuenta.id}
                          className="p-3 rounded-lg bg-muted/50"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: cuenta.color }}
                              />
                              <span>{cuenta.nombre}</span>
                            </div>
                            <span className="font-medium">
                              {formatCurrency(cuenta.saldo_actual, currency)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 ml-6">
                            Invertido: {formatCurrency(cuenta.invertido || 0, currency)}
                            {' • '}
                            Rendimiento: <span className={cn(
                              cuenta.rendimiento && cuenta.rendimiento >= 0 ? 'text-green-600' : 'text-destructive'
                            )}>
                              {cuenta.rendimiento && cuenta.rendimiento >= 0 ? '+' : ''}
                              {formatCurrency(cuenta.rendimiento || 0, currency)}
                            </span>
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Wallet accounts */}
                {accountsByType.monedero.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">
                      Monederos
                    </h3>
                    <div className="space-y-2">
                      {accountsByType.monedero.map((cuenta) => (
                        <div 
                          key={cuenta.id}
                          className="p-3 rounded-lg bg-muted/50"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: cuenta.color }}
                              />
                              <span>{cuenta.nombre}</span>
                            </div>
                            <span className="font-medium">
                              {formatCurrency(cuenta.saldo_actual, currency)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 ml-6">
                            Gastado este mes: {formatCurrency(cuenta.gastos_mes || 0, currency)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Total */}
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">TOTAL PATRIMONIO</span>
                    <span className="text-xl font-bold">
                      {formatCurrency(metrics.patrimonioTotal, currency)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Patrimonio chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-muted"><TrendingUp className="h-4 w-4 text-muted-foreground" /></div>
                  Evolución Patrimonio
                </CardTitle>
                <CardDescription>Últimos 6 meses</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={patrimonioData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="mes" 
                        className="text-xs"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <YAxis
                        className="text-xs"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                        width={28}
                      />
                      <Tooltip 
                        formatter={(value: number) => [formatCurrency(value, currency), 'Patrimonio']}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="patrimonio"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ fill: 'hsl(var(--primary))' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Distribution Section */}
          <DistribucionSection />
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
}
