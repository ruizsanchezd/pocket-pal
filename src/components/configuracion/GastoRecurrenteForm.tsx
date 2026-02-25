import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { gastoRecurrenteSchema, type GastoRecurrenteFormData } from '@/lib/validations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { Cuenta, Categoria, GastoRecurrente } from '@/types/database';
import { useState, useMemo } from 'react';
import { CreatableSelect } from '@/components/ui/creatable-select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface GastoRecurrenteFormProps {
  cuentas: Cuenta[];
  categorias: Categoria[];
  defaultCuentaId?: string;
  initialData?: GastoRecurrente;
  onSubmit: (data: GastoRecurrenteFormData) => Promise<void>;
  onCancel: () => void;
  onCategoriaCreated?: (categoria: Categoria) => void;
}

export function GastoRecurrenteForm({
  cuentas,
  categorias,
  defaultCuentaId,
  initialData,
  onSubmit,
  onCancel,
  onCategoriaCreated
}: GastoRecurrenteFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();

  const form = useForm<GastoRecurrenteFormData>({
    resolver: zodResolver(gastoRecurrenteSchema),
    defaultValues: {
      concepto: initialData?.concepto || '',
      cantidad: initialData?.cantidad ? Number(initialData.cantidad) : undefined,
      dia_del_mes: initialData?.dia_del_mes || 1,
      cuenta_id: initialData?.cuenta_id || defaultCuentaId || '',
      categoria_id: initialData?.categoria_id || '',
      subcategoria_id: initialData?.subcategoria_id || undefined,
      notas: initialData?.notas || '',
      is_transfer: initialData?.is_transfer || false,
      destination_account_id: initialData?.destination_account_id || null
    }
  });

  const categoriaId = form.watch('categoria_id');
  const isTransfer = form.watch('is_transfer');
  const cuentaId = form.watch('cuenta_id');

  // Filter categories (only gastos for recurring expenses, unless it's a transfer)
  const filteredCategorias = useMemo(() => {
    if (isTransfer) {
      return categorias.filter(c => !c.parent_id); // Show all parent categories for transfers
    }
    return categorias.filter(c => !c.parent_id && c.tipo === 'gasto');
  }, [categorias, isTransfer]);

  // Get subcategories for selected category
  const subcategorias = useMemo(() => {
    if (!categoriaId) return [];
    return categorias.filter(c => c.parent_id === categoriaId);
  }, [categorias, categoriaId]);

  const handleSubmit = async (data: GastoRecurrenteFormData) => {
    setIsSubmitting(true);
    try {
      await onSubmit(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="concepto"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Concepto *</FormLabel>
              <FormControl>
                <Input placeholder="Ej: Alquiler" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="cantidad"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {isTransfer ? 'Cantidad a transferir *' : 'Cantidad * (negativo = gasto)'}
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder={isTransfer ? '200' : '-900'}
                    {...field}
                    onChange={(e) => {
                      const value = e.target.value;
                      field.onChange(value ? parseFloat(value) : undefined);
                    }}
                    value={field.value ?? ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="dia_del_mes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Día del mes</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

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
          name="is_transfer"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <FormLabel>Transferencia entre cuentas</FormLabel>
                <FormDescription className="text-xs">
                  Mueve dinero de una cuenta a otra
                </FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        {isTransfer && (
          <FormField
            control={form.control}
            name="destination_account_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cuenta destino *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ''}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona cuenta destino" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {cuentas
                      .filter(c => c.id !== cuentaId)
                      .map((cuenta) => (
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
        )}

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
                    label: cat.nombre
                  }))}
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value);
                    form.setValue('subcategoria_id', undefined);
                  }}
                  onCreate={async (nombre: string) => {
                    if (!user) return null;

                    // Recurring expenses are always 'gasto' type
                    const { data, error } = await supabase
                      .from('categorias')
                      .insert({
                        user_id: user.id,
                        nombre,
                        parent_id: null,
                        tipo: 'gasto',
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
                  createLabel="+ Crear categoría"
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
                      label: sub.nombre
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
                    createLabel="+ Crear subcategoría"
                    allowNone
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="notas"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notas</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Notas adicionales (opcional)"
                  className="resize-none"
                  rows={2}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
