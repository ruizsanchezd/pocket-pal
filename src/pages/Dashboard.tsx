import { useState, useEffect, useMemo } from 'react';
import { format, subMonths, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Cuenta, CuentaConSaldo } from '@/types/database';
import { Loader2, TrendingUp, TrendingDown, Wallet, PiggyBank, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

interface PatrimonioData {
  mes: string;
  patrimonio: number;
}

export default function Dashboard() {
  const { user, profile } = useAuth();
  
  const [cuentas, setCuentas] = useState<CuentaConSaldo[]>([]);
  const [loading, setLoading] = useState(true);
  const [patrimonioData, setPatrimonioData] = useState<PatrimonioData[]>([]);
  const [mesAnteriorPatrimonio, setMesAnteriorPatrimonio] = useState(0);
  const [currentMonthTotals, setCurrentMonthTotals] = useState({
    ingresos: 0,
    gastos: 0
  });

  // Calculate metrics
  const metrics = useMemo(() => {
    const patrimonioTotal = cuentas.reduce((sum, c) => sum + c.saldo_actual, 0);
    const balanceMes = currentMonthTotals.ingresos - currentMonthTotals.gastos;
    const variacion = patrimonioTotal - mesAnteriorPatrimonio;
    const tasaAhorro = currentMonthTotals.ingresos > 0 
      ? (balanceMes / currentMonthTotals.ingresos) * 100 
      : 0;

    return {
      patrimonioTotal,
      balanceMes,
      variacion,
      tasaAhorro
    };
  }, [cuentas, currentMonthTotals, mesAnteriorPatrimonio]);

  // Fetch data
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setLoading(true);

      // Fetch accounts with calculated balance
      const { data: cuentasData } = await supabase
        .from('cuentas')
        .select('*')
        .eq('user_id', user.id)
        .eq('activa', true)
        .order('orden');

      if (cuentasData) {
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

            return {
              ...cuenta,
              saldo_actual: Number(cuenta.saldo_inicial) + sumaMovimientos,
              gastos_mes: gastosMes
            } as CuentaConSaldo;
          })
        );

        setCuentas(cuentasConSaldo);
      }

      // Fetch current month totals
      const currentMonth = format(new Date(), 'yyyy-MM');
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

      // Calculate patrimonio for last 6 months
      const patrimonioHistory: PatrimonioData[] = [];
      const now = new Date();
      
      for (let i = 5; i >= 0; i--) {
        const monthDate = startOfMonth(subMonths(now, i));
        const monthEnd = startOfMonth(subMonths(now, i - 1));
        const monthStr = format(monthDate, 'yyyy-MM');
        const monthLabel = format(monthDate, 'MMM', { locale: es });

        // Calculate patrimonio at end of month
        let patrimonio = 0;
        
        if (cuentasData) {
          for (const cuenta of cuentasData) {
            const { data: movimientos } = await supabase
              .from('movimientos')
              .select('cantidad')
              .eq('cuenta_id', cuenta.id)
              .lt('fecha', format(monthEnd, 'yyyy-MM-dd'));

            const sumaMovimientos = movimientos?.reduce(
              (sum, m) => sum + Number(m.cantidad),
              0
            ) || 0;

            patrimonio += Number(cuenta.saldo_inicial) + sumaMovimientos;
          }
        }

        patrimonioHistory.push({
          mes: monthLabel,
          patrimonio
        });

        // Store previous month patrimonio
        if (i === 1) {
          setMesAnteriorPatrimonio(patrimonio);
        }
      }

      setPatrimonioData(patrimonioHistory);
      setLoading(false);
    };

    fetchData();
  }, [user]);

  const formatCurrency = (amount: number) => {
    const symbol = profile?.divisa_principal === 'USD' ? '$' : 
                   profile?.divisa_principal === 'GBP' ? '£' : '€';
    return `${amount.toLocaleString('es-ES', { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    })}${symbol}`;
  };

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
        <div className="space-y-6">
          <h1 className="text-2xl font-bold">Dashboard</h1>

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
                  {formatCurrency(metrics.patrimonioTotal)}
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
                <div className={cn(
                  "text-2xl font-bold",
                  metrics.balanceMes >= 0 ? "text-green-600" : "text-destructive"
                )}>
                  {metrics.balanceMes >= 0 ? '+' : ''}{formatCurrency(metrics.balanceMes)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Vs Mes Anterior
                </CardTitle>
                {metrics.variacion >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-destructive" />
                )}
              </CardHeader>
              <CardContent>
                <div className={cn(
                  "text-2xl font-bold",
                  metrics.variacion >= 0 ? "text-green-600" : "text-destructive"
                )}>
                  {metrics.variacion >= 0 ? '+' : ''}{formatCurrency(metrics.variacion)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Tasa de Ahorro
                </CardTitle>
                <PiggyBank className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={cn(
                  "text-2xl font-bold",
                  metrics.tasaAhorro >= 0 ? "text-green-600" : "text-destructive"
                )}>
                  {metrics.tasaAhorro.toFixed(0)}%
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Accounts list */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
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
                            {formatCurrency(cuenta.saldo_actual)}
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
                            {formatCurrency(cuenta.saldo_actual)}
                          </span>
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
                              {formatCurrency(cuenta.saldo_actual)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 ml-6">
                            Gastado este mes: {formatCurrency(cuenta.gastos_mes || 0)}
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
                      {formatCurrency(metrics.patrimonioTotal)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Patrimonio chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
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
                      />
                      <Tooltip 
                        formatter={(value: number) => [formatCurrency(value), 'Patrimonio']}
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
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
}
