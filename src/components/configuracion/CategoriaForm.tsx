import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { categoriaSchema, type CategoriaFormData } from '@/lib/validations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import { EmojiPicker } from '@/components/ui/emoji-picker';
import { Loader2 } from 'lucide-react';
import { Categoria, CategoriaTipo } from '@/types/database';
import { useState } from 'react';

interface CategoriaFormProps {
  initialData?: Categoria;
  tipo: CategoriaTipo;
  isSubcategoria?: boolean;
  onSubmit: (data: CategoriaFormData) => Promise<void>;
  onCancel: () => void;
}

const COLORS = [
  '#6B7280', '#EF4444', '#F59E0B', '#10B981', 
  '#3B82F6', '#8B5CF6', '#EC4899', '#06B6D4'
];

export function CategoriaForm({ 
  initialData, 
  tipo,
  isSubcategoria = false,
  onSubmit, 
  onCancel 
}: CategoriaFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CategoriaFormData>({
    resolver: zodResolver(categoriaSchema),
    defaultValues: {
      nombre: initialData?.nombre || '',
      tipo: initialData?.tipo || tipo,
      color: initialData?.color || '#6B7280',
      icono: initialData?.icono || ''
    }
  });

  const handleSubmit = async (data: CategoriaFormData) => {
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
          name="nombre"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre *</FormLabel>
              <FormControl>
                <Input 
                  placeholder={isSubcategoria ? "Ej: Restaurantes" : "Ej: Alimentación"} 
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="color"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Color</FormLabel>
              <FormControl>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        field.value === color 
                          ? 'border-foreground scale-110' 
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => field.onChange(color)}
                    />
                  ))}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="icono"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Icono (emoji opcional)</FormLabel>
              <FormControl>
                <EmojiPicker
                  value={field.value || ''}
                  onChange={field.onChange}
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
