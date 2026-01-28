import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { TrendingUp, ArrowRight, ArrowLeft, Plus, Trash2, Loader2 } from 'lucide-react';
import { CuentaTipo } from '@/types/database';

interface CuentaInput {
  id: string;
  nombre: string;
  tipo: CuentaTipo;
  saldo_inicial: number;
  recarga_mensual?: number;
  is_default: boolean;
}

interface GastoRecurrenteInput {
  id: string;
  concepto: string;
  cantidad: number;
  selected: boolean;
}

const DEFAULT_GASTOS_RECURRENTES: GastoRecurrenteInput[] = [
  { id: '1', concepto: 'Alquiler', cantidad: -900, selected: false },
  { id: '2', concepto: 'Gimnasio', cantidad: -50, selected: false },
  { id: '3', concepto: 'Netflix', cantidad: -12, selected: false },
  { id: '4', concepto: 'Spotify', cantidad: -10, selected: false },
  { id: '5', concepto: 'Internet', cantidad: -40, selected: false },
  { id: '6', concepto: 'Móvil', cantidad: -25, selected: false }
];

export default function Onboarding() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  
  // Step 1: Currency
  const [divisa, setDivisa] = useState('EUR');
  
  // Step 2: Accounts
  const [cuentas, setCuentas] = useState<CuentaInput[]>([
    { id: crypto.randomUUID(), nombre: '', tipo: 'corriente', saldo_inicial: 0, is_default: true }
  ]);
  
  // Step 3: Recurring expenses
  const [gastosRecurrentes, setGastosRecurrentes] = useState<GastoRecurrenteInput[]>(DEFAULT_GASTOS_RECURRENTES);
  const [customGasto, setCustomGasto] = useState({ concepto: '', cantidad: '' });

  const addCuenta = () => {
    setCuentas([
      ...cuentas,
      { id: crypto.randomUUID(), nombre: '', tipo: 'corriente', saldo_inicial: 0, is_default: false }
    ]);
  };

  const removeCuenta = (id: string) => {
    if (cuentas.length > 1) {
      const wasDefault = cuentas.find(c => c.id === id)?.is_default;
      const newCuentas = cuentas.filter(c => c.id !== id);
      if (wasDefault && newCuentas.length > 0) {
        newCuentas[0].is_default = true;
      }
      setCuentas(newCuentas);
    }
  };

  const updateCuenta = (id: string, field: keyof CuentaInput, value: string | number | boolean) => {
    setCuentas(cuentas.map(c => {
      if (c.id === id) {
        if (field === 'is_default' && value === true) {
          return { ...c, [field]: value };
        }
        return { ...c, [field]: value };
      }
      if (field === 'is_default' && value === true) {
        return { ...c, is_default: false };
      }
      return c;
    }));
  };

  const toggleGastoRecurrente = (id: string) => {
    setGastosRecurrentes(gastosRecurrentes.map(g => 
      g.id === id ? { ...g, selected: !g.selected } : g
    ));
  };

  const addCustomGasto = () => {
    if (customGasto.concepto && customGasto.cantidad) {
      setGastosRecurrentes([
        ...gastosRecurrentes,
        {
          id: crypto.randomUUID(),
          concepto: customGasto.concepto,
          cantidad: -Math.abs(parseFloat(customGasto.cantidad)),
          selected: true
        }
      ]);
      setCustomGasto({ concepto: '', cantidad: '' });
    }
  };

  const validateStep2 = () => {
    const validCuentas = cuentas.filter(c => c.nombre.trim() !== '');
    if (validCuentas.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Debes añadir al menos una cuenta con nombre'
      });
      return false;
    }
    const hasDefault = validCuentas.some(c => c.is_default);
    if (!hasDefault) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Debes marcar una cuenta como predeterminada'
      });
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 2 && !validateStep2()) return;
    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleFinish = async () => {
    if (!user) return;
    
    setIsLoading(true);
    
    try {
      // Create default categories
      const defaultCategories: Array<{ nombre: string; tipo: 'ingreso' | 'gasto' | 'inversion'; parent_id: null }> = [
        // Ingresos
        { nombre: 'Nómina', tipo: 'ingreso', parent_id: null },
        { nombre: 'Freelance', tipo: 'ingreso', parent_id: null },
        { nombre: 'Otros ingresos', tipo: 'ingreso', parent_id: null },
        // Gastos
        { nombre: 'Alimentación', tipo: 'gasto', parent_id: null },
        { nombre: 'Vivienda', tipo: 'gasto', parent_id: null },
        { nombre: 'Transporte', tipo: 'gasto', parent_id: null },
        { nombre: 'Ocio', tipo: 'gasto', parent_id: null },
        { nombre: 'Salud', tipo: 'gasto', parent_id: null },
        { nombre: 'Suscripciones', tipo: 'gasto', parent_id: null },
        { nombre: 'Otros gastos', tipo: 'gasto', parent_id: null },
        // Inversiones
        { nombre: 'Fondo indexado', tipo: 'inversion', parent_id: null }
      ];

      const { data: createdCategories, error: catError } = await supabase
        .from('categorias')
        .insert(defaultCategories.map(c => ({ ...c, user_id: user.id })))
        .select();

      if (catError) throw catError;

      // Find the "Otros gastos" category for recurring expenses
      const otrosGastosCategory = createdCategories?.find(c => c.nombre === 'Otros gastos');

      // Create accounts
      const validCuentas = cuentas.filter(c => c.nombre.trim() !== '');
      const defaultCuenta = validCuentas.find(c => c.is_default);

      const { data: createdCuentas, error: cuentasError } = await supabase
        .from('cuentas')
        .insert(validCuentas.map((c, index) => ({
          user_id: user.id,
          nombre: c.nombre,
          tipo: c.tipo,
          saldo_inicial: c.saldo_inicial,
          divisa,
          orden: index
        })))
        .select();

      if (cuentasError) throw cuentasError;

      // Create monedero config if needed
      for (const cuenta of validCuentas) {
        if (cuenta.tipo === 'monedero' && cuenta.recarga_mensual) {
          const createdCuenta = createdCuentas?.find(c => c.nombre === cuenta.nombre);
          if (createdCuenta) {
            await supabase.from('cuentas_monedero_config').insert({
              user_id: user.id,
              cuenta_id: createdCuenta.id,
              recarga_mensual: cuenta.recarga_mensual
            });
          }
        }
      }

      // Get the created default account
      const createdDefaultCuenta = createdCuentas?.find(c => c.nombre === defaultCuenta?.nombre);

      // Create selected recurring expenses
      if (otrosGastosCategory && createdDefaultCuenta) {
        const selectedGastos = gastosRecurrentes.filter(g => g.selected);
        if (selectedGastos.length > 0) {
          await supabase.from('gastos_recurrentes').insert(
            selectedGastos.map(g => ({
              user_id: user.id,
              concepto: g.concepto,
              cantidad: g.cantidad,
              dia_del_mes: 1,
              cuenta_id: createdDefaultCuenta.id,
              categoria_id: otrosGastosCategory.id
            }))
          );
        }
      }

      // Update profile
      await supabase
        .from('profiles')
        .update({
          divisa_principal: divisa,
          cuenta_default_id: createdDefaultCuenta?.id,
          onboarding_completed: true
        })
        .eq('id', user.id);

      await refreshProfile();
      
      toast({
        title: '¡Configuración completada!',
        description: 'Bienvenido a PocketPal'
      });
      
      navigate('/movimientos');
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Onboarding error:', error);
      }
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo completar la configuración'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = async () => {
    await handleFinish();
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <TrendingUp className="h-8 w-8 text-primary" />
          <span className="text-2xl font-bold">PocketPal</span>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 rounded-full transition-all ${
                s === step
                  ? 'w-8 bg-primary'
                  : s < step
                  ? 'w-8 bg-primary/50'
                  : 'w-8 bg-muted'
              }`}
            />
          ))}
        </div>

        {/* Step 1: Currency */}
        {step === 1 && (
          <Card>
            <CardHeader className="text-center">
              <CardTitle>¿Cuál es tu divisa principal?</CardTitle>
              <CardDescription>
                Podrás cambiarla más adelante en la configuración
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                {['EUR', 'USD', 'GBP'].map((d) => (
                  <Button
                    key={d}
                    variant={divisa === d ? 'default' : 'outline'}
                    size="lg"
                    className="h-20 text-xl"
                    onClick={() => setDivisa(d)}
                  >
                    {d === 'EUR' ? '€ EUR' : d === 'USD' ? '$ USD' : '£ GBP'}
                  </Button>
                ))}
              </div>

              <div className="flex justify-end">
                <Button onClick={handleNext}>
                  Siguiente
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Accounts */}
        {step === 2 && (
          <Card>
            <CardHeader className="text-center">
              <CardTitle>Configura tus cuentas</CardTitle>
              <CardDescription>
                Añade las cuentas donde gestionas tu dinero
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {cuentas.map((cuenta, index) => (
                  <div
                    key={cuenta.id}
                    className="p-4 border rounded-lg space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Cuenta {index + 1}</span>
                      {cuentas.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeCuenta(cuenta.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                    
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Nombre *</Label>
                        <Input
                          placeholder="Ej: Caixa Principal"
                          value={cuenta.nombre}
                          onChange={(e) => updateCuenta(cuenta.id, 'nombre', e.target.value)}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Tipo *</Label>
                        <Select
                          value={cuenta.tipo}
                          onValueChange={(v) => updateCuenta(cuenta.id, 'tipo', v as CuentaTipo)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="corriente">Corriente</SelectItem>
                            <SelectItem value="inversion">Inversión</SelectItem>
                            <SelectItem value="monedero">Monedero</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Saldo inicial</Label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={cuenta.saldo_inicial || ''}
                          onChange={(e) => updateCuenta(cuenta.id, 'saldo_inicial', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      
                      {cuenta.tipo === 'monedero' && (
                        <div className="space-y-2">
                          <Label>Recarga mensual</Label>
                          <Input
                            type="number"
                            placeholder="200"
                            value={cuenta.recarga_mensual || ''}
                            onChange={(e) => updateCuenta(cuenta.id, 'recarga_mensual', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`default-${cuenta.id}`}
                        checked={cuenta.is_default}
                        onCheckedChange={(checked) => updateCuenta(cuenta.id, 'is_default', checked as boolean)}
                      />
                      <Label htmlFor={`default-${cuenta.id}`} className="text-sm cursor-pointer">
                        Cuenta por defecto
                      </Label>
                    </div>
                  </div>
                ))}
              </div>

              <Button variant="outline" onClick={addCuenta} className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                Añadir otra cuenta
              </Button>

              <div className="flex justify-between">
                <Button variant="ghost" onClick={handleBack}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Atrás
                </Button>
                <Button onClick={handleNext}>
                  Siguiente
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Recurring expenses */}
        {step === 3 && (
          <Card>
            <CardHeader className="text-center">
              <CardTitle>Gastos recurrentes</CardTitle>
              <CardDescription>
                Selecciona los gastos que se repiten cada mes (opcional)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-2">
                {gastosRecurrentes.map((gasto) => (
                  <div
                    key={gasto.id}
                    className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                      gasto.selected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                    }`}
                    onClick={() => toggleGastoRecurrente(gasto.id)}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox checked={gasto.selected} />
                      <span>{gasto.concepto}</span>
                    </div>
                    <span className="text-destructive font-medium">
                      {gasto.cantidad}€
                    </span>
                  </div>
                ))}
              </div>

              {/* Custom expense */}
              <div className="p-4 border rounded-lg space-y-4">
                <Label>Añadir personalizado</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Concepto"
                    value={customGasto.concepto}
                    onChange={(e) => setCustomGasto({ ...customGasto, concepto: e.target.value })}
                  />
                  <Input
                    type="number"
                    placeholder="Cantidad"
                    className="w-32"
                    value={customGasto.cantidad}
                    onChange={(e) => setCustomGasto({ ...customGasto, cantidad: e.target.value })}
                  />
                  <Button variant="outline" onClick={addCustomGasto}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="ghost" onClick={handleBack}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Atrás
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleSkip} disabled={isLoading}>
                    Saltar
                  </Button>
                  <Button onClick={handleFinish} disabled={isLoading}>
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Finalizar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
