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
          <h1 className="text-xl font-bold md:text-2xl">Configuración</h1>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Left: configurable sections */}
            <div className="grid gap-4 content-start">
              <Link to="/configuracion/cuentas">
                <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <div className="p-1.5 rounded-md bg-muted"><Wallet className="h-4 w-4 text-muted-foreground" /></div>
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
                      <div className="p-1.5 rounded-md bg-muted"><Tags className="h-4 w-4 text-muted-foreground" /></div>
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
                      <div className="p-1.5 rounded-md bg-muted"><CreditCard className="h-4 w-4 text-muted-foreground" /></div>
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
                      <div className="p-1.5 rounded-md bg-muted"><Download className="h-4 w-4 text-muted-foreground" /></div>
                      Exportar Datos
                    </CardTitle>
                    <CardDescription>
                      Descarga tus datos en formato CSV o backup completo
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            </div>

            {/* Right: profile */}
            <div>
              <ProfileSection />
            </div>
          </div>
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
}
