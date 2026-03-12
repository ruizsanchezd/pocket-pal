import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { movimientoSchema, type MovimientoFormData } from '@/lib/validations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { Cuenta, Categoria, MovimientoConRelaciones } from '@/types/database';
import { cn } from '@/lib/utils';
import { useState, useMemo, useRef, useEffect } from 'react';
import { useWebHaptics } from 'web-haptics/react';
import { CreatableSelect } from '@/components/ui/creatable-select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';

interface MovimientoFormProps {
  cuentas: Cuenta[];
  categorias: Categoria[];
  defaultCuentaId?: string;
  initialData?: MovimientoConRelaciones;
  onSubmit: (data: MovimientoFormData) => Promise<void>;
  onCancel: () => void;
  onCategoriaCreated?: (categoria: Categoria) => void;
  disableAutoFocus?: boolean;
}

export function MovimientoForm({
  cuentas,
  categorias,
  defaultCuentaId,
  initialData,
  onSubmit,
  onCancel,
  onCategoriaCreated,
  disableAutoFocus = false,
}: MovimientoFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();
  const haptic = useWebHaptics();
  const isMobile = useIsMobile();
  const prevSignRef = useRef<1 | -1>(1);
  const [sign, setSign] = useState<1 | -1>(() => {
    if (initialData?.cantidad !== undefined) return Number(initialData.cantidad) >= 0 ? 1 : -1;
    return -1;
  });

  const form = useForm<MovimientoFormData>({
    resolver: zodResolver(movimientoSchema),
    defaultValues: {
      fecha: initialData ? new Date(initialData.fecha) : new Date(),
      concepto: initialData?.concepto || '',
      cantidad: initialData?.cantidad ? Number(initialData.cantidad) : undefined,
      cuenta_id: initialData?.cuenta_id || defaultCuentaId || cuentas[0]?.id || '',
      categoria_id: initialData?.categoria_id || '',
      subcategoria_id: initialData?.subcategoria_id || undefined
    }
  });

  useEffect(() => {
    if (!disableAutoFocus || initialData) return; // solo nuevo movimiento en mobile
    const timer = setTimeout(() => {
      form.setFocus('concepto');
      const onViewportResize = () => {
        window.visualViewport?.removeEventListener('resize', onViewportResize);
        setTimeout(() => {
          const el = document.activeElement as HTMLElement | null;
          el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }, 50);
      };
      window.visualViewport?.addEventListener('resize', onViewportResize);
    }, 500);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cantidad = form.watch('cantidad');
  const categoriaId = form.watch('categoria_id');

  const handleSignToggle = () => {
    const newSign: 1 | -1 = sign === 1 ? -1 : 1;
    setSign(newSign);
    const current = form.getValues('cantidad');
    if (current !== undefined) {
      form.setValue('cantidad', Math.abs(Number(current)) * newSign, { shouldValidate: true });
    }
    form.setValue('categoria_id', '');
    form.setValue('subcategoria_id', undefined);
  };

  const filteredCategorias = useMemo(() => {
    return categorias.filter(c => !c.parent_id);
  }, [categorias]);

  // Get subcategories for selected category
  const subcategorias = useMemo(() => {
    if (!categoriaId) return [];
    return categorias.filter(c => c.parent_id === categoriaId);
  }, [categorias, categoriaId]);

  const handleSubmit = async (data: MovimientoFormData) => {
    haptic.trigger('medium');
    setIsSubmitting(true);
    try {
      await onSubmit(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 min-w-0">
        <FormField
          control={form.control}
          name="fecha"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Fecha *</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full pl-3 text-left font-normal',
                        !field.value && 'text-muted-foreground'
                      )}
                    >
                      {field.value ? (
                        format(field.value, 'dd/MM/yyyy')
                      ) : (
                        <span>Selecciona una fecha</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="concepto"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Concepto *</FormLabel>
              <FormControl>
                <Input placeholder="Ej: Compra supermercado" autoFocus={!initialData && !disableAutoFocus} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="cantidad"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cantidad *</FormLabel>
              <FormControl>
                {isMobile ? (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className={cn(
                        "shrink-0 font-bold text-base",
                        sign === 1 ? "text-green-600" : "text-destructive"
                      )}
                      onClick={handleSignToggle}
                    >
                      {sign === 1 ? '+' : '−'}
                    </Button>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      placeholder="0.00"
                      value={field.value !== undefined ? Math.abs(Number(field.value)) || '' : ''}
                      onChange={(e) => {
                        const absValue = e.target.value ? parseFloat(e.target.value) : undefined;
                        field.onChange(absValue !== undefined ? Math.abs(absValue) * sign : undefined);
                      }}
                    />
                  </div>
                ) : (
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Ej: -20.50 o 1500"
                    value={field.value !== undefined ? field.value : ''}
                    onChange={(e) => {
                      const newValue = e.target.value ? parseFloat(e.target.value) : undefined;
                      const newSign: 1 | -1 = newValue !== undefined && newValue < 0 ? -1 : 1;
                      if (newSign !== prevSignRef.current) {
                        form.setValue('categoria_id', '');
                        form.setValue('subcategoria_id', undefined);
                        prevSignRef.current = newSign;
                      }
                      field.onChange(newValue);
                    }}
                    className={cn(
                      field.value !== undefined && Number(field.value) > 0 && "text-green-600",
                      field.value !== undefined && Number(field.value) < 0 && "text-destructive"
                    )}
                  />
                )}
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="cuenta_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cuenta *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una cuenta" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {cuentas.map((cuenta) => (
                    <SelectItem key={cuenta.id} value={cuenta.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: cuenta.color }}
                        />
                        {cuenta.nombre}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="categoria_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Categoría *</FormLabel>
              <FormControl>
                <CreatableSelect
                  options={filteredCategorias.map((cat) => ({
                    value: cat.id,
                    label: cat.nombre,
                    color: cat.color
                  }))}
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value);
                    // Reset subcategory when category changes
                    form.setValue('subcategoria_id', undefined);
                  }}
                  onCreate={async (nombre: string) => {
                    if (!user) return null;

                    // Determine tipo from cantidad
                    const cantidad = form.getValues('cantidad');
                    const tipo = cantidad === undefined || cantidad === 0
                      ? 'gasto'
                      : cantidad > 0
                        ? 'ingreso'
                        : 'gasto';

                    const { data, error } = await supabase
                      .from('categorias')
                      .insert({
                        user_id: user.id,
                        nombre,
                        parent_id: null,
                        tipo,
                        color: '#6b7280', // Default gray
                        orden: 999
                      })
                      .select()
                      .single();

                    if (error || !data) {
                      console.error('Error creating category:', error);
                      return null;
                    }

                    onCategoriaCreated?.(data);
                    return data.id;
                  }}
                  placeholder="Selecciona una categoría"
                  createLabel="Crear categoría"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {categoriaId && (
          <FormField
            control={form.control}
            name="subcategoria_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Subcategoría</FormLabel>
                <FormControl>
                  <CreatableSelect
                    options={subcategorias.map((sub) => ({
                      value: sub.id,
                      label: sub.nombre,
                      color: sub.color
                    }))}
                    value={field.value || ''}
                    onValueChange={field.onChange}
                    onCreate={async (nombre: string) => {
                      if (!user) return null;

                      // Get tipo from parent category
                      const parentCategoria = categorias.find((c) => c.id === categoriaId);
                      if (!parentCategoria) return null;

                      const { data, error } = await supabase
                        .from('categorias')
                        .insert({
                          user_id: user.id,
                          nombre,
                          parent_id: categoriaId,
                          tipo: parentCategoria.tipo,
                          color: parentCategoria.color,
                          orden: 999
                        })
                        .select()
                        .single();

                      if (error || !data) {
                        console.error('Error creating subcategory:', error);
                        return null;
                      }

                      onCategoriaCreated?.(data);
                      return data.id;
                    }}
                    placeholder="Selecciona una subcategoría (opcional)"
                    createLabel="Crear subcategoría"
                    allowNone
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </div>
      </form>
    </Form>
  );
}
