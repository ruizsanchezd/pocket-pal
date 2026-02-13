import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Movimientos from "./pages/Movimientos";
import Configuracion from "./pages/Configuracion";
import ConfigCuentas from "./pages/configuracion/Cuentas";
import ConfigCategorias from "./pages/configuracion/Categorias";
import ConfigRecurrentes from "./pages/configuracion/Recurrentes";
import ConfigExportData from "./pages/configuracion/ExportData";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/movimientos" replace />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/explorar" element={<Navigate to="/dashboard" replace />} />
            <Route path="/movimientos" element={<ProtectedRoute><Movimientos /></ProtectedRoute>} />
            <Route path="/configuracion" element={<ProtectedRoute><Configuracion /></ProtectedRoute>} />
            <Route path="/configuracion/cuentas" element={<ProtectedRoute><ConfigCuentas /></ProtectedRoute>} />
            <Route path="/configuracion/categorias" element={<ProtectedRoute><ConfigCategorias /></ProtectedRoute>} />
            <Route path="/configuracion/recurrentes" element={<ProtectedRoute><ConfigRecurrentes /></ProtectedRoute>} />
            <Route path="/configuracion/exportar" element={<ProtectedRoute><ConfigExportData /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
