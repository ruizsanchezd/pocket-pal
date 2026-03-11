import { useState } from 'react';
import { format, subMonths, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import JSZip from 'jszip';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Download, FileArchive, Loader2, Calendar } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MobileSubpageHeader } from '@/components/configuracion/MobileSubpageHeader';
import { 
  downloadFile, 
  generateMovimientosCSV, 
  generateCuentasCSV, 
  generateCategoriasCSV, 
  generateRecurrentesCSV 
} from '@/lib/export';
import { Cuenta, Categoria, GastoRecurrente, MovimientoConRelaciones } from '@/types/database';

// Generate list of last 24 months (most recent first)
function getLast24Months() {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = subMonths(startOfMonth(now), i);
    months.push({
      value: format(d, 'yyyy-MM'),
      label: format(d, 'MMMM yyyy', { locale: es })
    });
  }
  return months;
}

export default function ExportData() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const months = getLast24Months();

  const handleFullBackup = async () => {
    if (!user) return;
    
    setLoading(true);
    
    try {
      // Fetch all data in parallel
      const [
        { data: movimientosData },
        { data: cuentasData },
        { data: categoriasData },
        { data: recurrentesData }
      ] = await Promise.all([
        supabase
          .from('movimientos')
          .select('*')
          .eq('user_id', user.id)
          .order('fecha', { ascending: true }),
        supabase
          .from('cuentas')
          .select('*')
          .eq('user_id', user.id)
          .order('orden'),
        supabase
          .from('categorias')
          .select('*')
          .eq('user_id', user.id)
          .order('orden'),
        supabase
          .from('gastos_recurrentes')
          .select('*')
          .eq('user_id', user.id)
          .order('concepto')
      ]);

      const cuentas = (cuentasData || []) as Cuenta[];
      const categorias = (categoriasData || []) as Categoria[];
      const recurrentes = (recurrentesData || []) as GastoRecurrente[];

      // Map movements with relations
      const movimientos: MovimientoConRelaciones[] = (movimientosData || []).map(m => ({
        ...m,
        cuenta: cuentas.find(c => c.id === m.cuenta_id),
        categoria: categorias.find(c => c.id === m.categoria_id),
        subcategoria: m.subcategoria_id ? categorias.find(c => c.id === m.subcategoria_id) : null
      })) as MovimientoConRelaciones[];

      // Generate CSVs
      const movimientosCSV = generateMovimientosCSV(movimientos);
      const cuentasCSV = generateCuentasCSV(cuentas);
      const categoriasCSV = generateCategoriasCSV(categorias, categorias);
      const recurrentesCSV = generateRecurrentesCSV(recurrentes, cuentas, categorias);

      // Create ZIP
      const zip = new JSZip();
      zip.file('movimientos.csv', movimientosCSV);
      zip.file('cuentas.csv', cuentasCSV);
      zip.file('categorias.csv', categoriasCSV);
      zip.file('gastos_recurrentes.csv', recurrentesCSV);

      // Generate and download
      const blob = await zip.generateAsync({ type: 'blob' });
      const filename = `pocketpal_backup_${format(new Date(), 'yyyy-MM-dd')}.zip`;
      downloadFile(blob, filename);

      toast({
        title: 'Backup descargado',
        description: `Se han exportado ${movimientos.length} movimientos, ${cuentas.length} cuentas, ${categorias.length} categorías y ${recurrentes.length} gastos recurrentes.`
      });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Export error:', error);
      }
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo generar el backup'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMonthExport = async () => {
    if (!user) return;

    setLoadingMonth(true);

    try {
      const [
        { data: movimientosData },
        { data: cuentasData },
        { data: categoriasData }
      ] = await Promise.all([
        supabase
          .from('movimientos')
          .select('*')
          .eq('user_id', user.id)
          .eq('mes_referencia', selectedMonth)
          .order('fecha', { ascending: true }),
        supabase
          .from('cuentas')
          .select('*')
          .eq('user_id', user.id)
          .order('orden'),
        supabase
          .from('categorias')
          .select('*')
          .eq('user_id', user.id)
          .order('orden')
      ]);

      const cuentas = (cuentasData || []) as Cuenta[];
      const categorias = (categoriasData || []) as Categoria[];

      const movimientos: MovimientoConRelaciones[] = (movimientosData || []).map(m => ({
        ...m,
        cuenta: cuentas.find(c => c.id === m.cuenta_id),
        categoria: categorias.find(c => c.id === m.categoria_id),
        subcategoria: m.subcategoria_id ? categorias.find(c => c.id === m.subcategoria_id) : null
      })) as MovimientoConRelaciones[];

      const csv = generateMovimientosCSV(movimientos);
      downloadFile(csv, `movimientos_${selectedMonth}.csv`);

      toast({
        title: 'CSV exportado',
        description: `Exportados ${movimientos.length} movimientos de ${months.find(m => m.value === selectedMonth)?.label}`
      });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Export error:', error);
      }
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo exportar el CSV'
      });
    } finally {
      setLoadingMonth(false);
    }
  };

  return (
    <ProtectedRoute>
      <MainLayout>
        <div className="space-y-4 md:space-y-6">
          <MobileSubpageHeader title="Exportar Datos" backHref="/configuracion" />

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-muted"><FileArchive className="h-4 w-4 text-muted-foreground" /></div>
                  Backup Completo
                </CardTitle>
                <CardDescription>
                  Descarga todos tus datos en un archivo ZIP que contiene:
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• movimientos.csv - Todos tus movimientos</li>
                  <li>• cuentas.csv - Todas tus cuentas</li>
                  <li>• categorias.csv - Todas tus categorías</li>
                  <li>• gastos_recurrentes.csv - Tus gastos recurrentes</li>
                </ul>
                <Button 
                  onClick={handleFullBackup} 
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generando backup...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Descargar Backup Completo
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-muted"><Calendar className="h-4 w-4 text-muted-foreground" /></div>
                  Exportación Mensual
                </CardTitle>
                <CardDescription>
                  Descarga los movimientos de un mes concreto en formato CSV.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-full capitalize">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map(m => (
                      <SelectItem key={m.value} value={m.value} className="capitalize">
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleMonthExport}
                  disabled={loadingMonth}
                  variant="outline"
                  className="w-full"
                >
                  {loadingMonth ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Exportando...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Descargar CSV
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
}
