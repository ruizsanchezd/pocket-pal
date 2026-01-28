import { useState } from 'react';
import { format } from 'date-fns';
import JSZip from 'jszip';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Download, FileArchive, Loader2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { 
  downloadFile, 
  generateMovimientosCSV, 
  generateCuentasCSV, 
  generateCategoriasCSV, 
  generateRecurrentesCSV 
} from '@/lib/export';
import { Cuenta, Categoria, GastoRecurrente, MovimientoConRelaciones } from '@/types/database';

export default function ExportData() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

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
      const filename = `financeflow_backup_${format(new Date(), 'yyyy-MM-dd')}.zip`;
      downloadFile(blob, filename);

      toast({
        title: 'Backup descargado',
        description: `Se han exportado ${movimientos.length} movimientos, ${cuentas.length} cuentas, ${categorias.length} categorías y ${recurrentes.length} gastos recurrentes.`
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo generar el backup'
      });
    } finally {
      setLoading(false);
    }
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
            <h1 className="text-2xl font-bold">Exportar Datos</h1>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileArchive className="h-5 w-5" />
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
                  <Download className="h-5 w-5" />
                  Exportación Mensual
                </CardTitle>
                <CardDescription>
                  Para exportar los movimientos de un mes específico, ve a la página de Movimientos y usa el botón de descarga en la cabecera.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to="/movimientos">
                  <Button variant="outline" className="w-full">
                    Ir a Movimientos
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
}
