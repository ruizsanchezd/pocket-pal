import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { ScrollToTop } from "@/components/layout/ScrollToTop";

// Cada página en su propio chunk: recharts (Dashboard) y jszip (Exportar) no se descargan
// hasta que hacen falta.
const loadMovimientos = () => import("./pages/Movimientos");
const loadDashboard = () => import("./pages/Dashboard");
const loadConfiguracion = () => import("./pages/Configuracion");

const Auth = lazy(() => import("./pages/Auth"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Dashboard = lazy(loadDashboard);
const Movimientos = lazy(loadMovimientos);
const Configuracion = lazy(loadConfiguracion);
const ConfigCuentas = lazy(() => import("./pages/configuracion/Cuentas"));
const ConfigCategorias = lazy(() => import("./pages/configuracion/Categorias"));
const ConfigRecurrentes = lazy(() => import("./pages/configuracion/Recurrentes"));
const ConfigExportData = lazy(() => import("./pages/configuracion/ExportData"));
const ImportarExtracto = lazy(() => import("./pages/ImportarExtracto"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Sin staleTime: las páginas de configuración no invalidan ['cuentas'] / ['categorias'] al
// guardar, así que la frescura depende de que se vuelva a pedir al montar.
const queryClient = new QueryClient();

const PageFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <div className="animate-pulse text-muted-foreground">Cargando...</div>
  </div>
);

/** Precarga las tres pestañas de la barra de navegación cuando el navegador está libre. */
function usePrefetchMainRoutes() {
  useEffect(() => {
    const prefetch = () => {
      loadMovimientos();
      loadDashboard();
      loadConfiguracion();
    };
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(prefetch, { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(prefetch, 1500);
    return () => clearTimeout(id);
  }, []);
}

const App = () => {
  usePrefetchMainRoutes();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ScrollToTop />
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/" element={<Navigate to="/movimientos" replace />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/explorar" element={<Navigate to="/dashboard" replace />} />
                <Route path="/movimientos" element={<ProtectedRoute><Movimientos /></ProtectedRoute>} />
                <Route path="/movimientos/importar" element={<ProtectedRoute><ImportarExtracto /></ProtectedRoute>} />
                <Route path="/configuracion" element={<ProtectedRoute><Configuracion /></ProtectedRoute>} />
                <Route path="/configuracion/cuentas" element={<ProtectedRoute><ConfigCuentas /></ProtectedRoute>} />
                <Route path="/configuracion/categorias" element={<ProtectedRoute><ConfigCategorias /></ProtectedRoute>} />
                <Route path="/configuracion/recurrentes" element={<ProtectedRoute><ConfigRecurrentes /></ProtectedRoute>} />
                <Route path="/configuracion/exportar" element={<ProtectedRoute><ConfigExportData /></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
