import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Movimientos from "./pages/Movimientos";
import Configuracion from "./pages/Configuracion";
import ConfigCuentas from "./pages/configuracion/Cuentas";
import ConfigCategorias from "./pages/configuracion/Categorias";
import ConfigRecurrentes from "./pages/configuracion/Recurrentes";
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
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/movimientos" element={<Movimientos />} />
            <Route path="/configuracion" element={<Configuracion />} />
            <Route path="/configuracion/cuentas" element={<ConfigCuentas />} />
            <Route path="/configuracion/categorias" element={<ConfigCategorias />} />
            <Route path="/configuracion/recurrentes" element={<ConfigRecurrentes />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
