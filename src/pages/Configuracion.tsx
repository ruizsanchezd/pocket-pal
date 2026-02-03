import { MainLayout } from '@/components/layout/MainLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { ProfileSection } from '@/components/configuracion/ProfileSection';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, Tags, CreditCard, Download } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Configuracion() {
  return (
    <ProtectedRoute>
      <MainLayout>
        <div className="space-y-6">
          <h1 className="text-2xl font-bold">Configuración</h1>

          {/* Profile Section */}
          <ProfileSection />

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Link to="/configuracion/cuentas">
              <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="h-5 w-5" />
                    Cuentas
                  </CardTitle>
                  <CardDescription>
                    Gestiona tus cuentas bancarias, inversiones y monederos
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link to="/configuracion/categorias">
              <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Tags className="h-5 w-5" />
                    Categorías
                  </CardTitle>
                  <CardDescription>
                    Organiza tus ingresos y gastos por categorías
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link to="/configuracion/recurrentes">
              <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Gastos Recurrentes
                  </CardTitle>
                  <CardDescription>
                    Configura tus gastos que se repiten cada mes
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link to="/configuracion/exportar">
              <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5" />
                    Exportar Datos
                  </CardTitle>
                  <CardDescription>
                    Descarga tus datos en formato CSV o backup completo
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </div>
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
}
