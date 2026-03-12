import { useState, useEffect, useRef } from 'react';
import { useWebHaptics } from 'web-haptics/react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CategoriaForm } from '@/components/configuracion/CategoriaForm';
import { Loader2, Plus, Trash2, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Categoria, CategoriaConHijos, CategoriaFormData } from '@/types/database';

const EDIT_FORM_ID = 'categoria-edit-form';

interface Props {
  categoria: CategoriaConHijos | null;
  onUpdateCategoria: (id: string, data: CategoriaFormData) => Promise<void>;
  onSubcategoriasChange: (parentId: string, updated: Categoria[]) => void;
  onClose: () => void;
  userId: string;
}

export function CategoriaDetalleSheet({
  categoria,
  onUpdateCategoria,
  onSubcategoriasChange,
  onClose,
  userId,
}: Props) {
  const { toast } = useToast();
  const haptic = useWebHaptics();
  const isMobile = useIsMobile();

  const [subcategorias, setSubcategorias] = useState<Categoria[]>([]);
  const [editingSubcat, setEditingSubcat] = useState<Categoria | null>(null);
  const [subcatModalOpen, setSubcatModalOpen] = useState(false);
  const [deleteSubcatConfirm, setDeleteSubcatConfirm] = useState<Categoria | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [drawerExpanded, setDrawerExpanded] = useState(false);
  const collapseTimer = useRef<ReturnType<typeof setTimeout>>();
  const touchStartY = useRef(0);

  const handleContentTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleContentTouchMove = (e: React.TouchEvent) => {
    const delta = touchStartY.current - e.touches[0].clientY; // positivo = dedo sube
    if (!drawerExpanded && delta > 10) {
      setDrawerExpanded(true);
    } else if (drawerExpanded && delta < -10 && (e.currentTarget as HTMLDivElement).scrollTop === 0) {
      clearTimeout(collapseTimer.current);
      setDrawerExpanded(false);
    }
  };

  const handleContentScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!drawerExpanded) return;
    clearTimeout(collapseTimer.current);
    if (e.currentTarget.scrollTop === 0) {
      collapseTimer.current = setTimeout(() => setDrawerExpanded(false), 150);
    }
  };

  useEffect(() => {
    setSubcategorias(categoria?.children ?? []);
  }, [categoria]);

  const handleSaveSubcat = async (data: CategoriaFormData) => {
    if (!categoria) return;

    try {
      if (editingSubcat) {
        const { error } = await supabase
          .from('categorias')
          .update({ nombre: data.nombre, color: data.color, icono: null })
          .eq('id', editingSubcat.id);

        if (error) throw error;

        const updated = subcategorias.map(s =>
          s.id === editingSubcat.id ? { ...s, nombre: data.nombre, color: data.color } : s
        );
        setSubcategorias(updated);
        onSubcategoriasChange(categoria.id, updated);
        haptic.trigger('success');
        toast({ title: 'Subcategoría actualizada' });
      } else {
        const { data: newSubcat, error } = await supabase
          .from('categorias')
          .insert({
            user_id: userId,
            nombre: data.nombre,
            tipo: categoria.tipo,
            parent_id: categoria.id,
            color: data.color,
            icono: null,
            orden: subcategorias.length,
          })
          .select()
          .single();

        if (error) throw error;

        const updated = [...subcategorias, newSubcat as Categoria];
        setSubcategorias(updated);
        onSubcategoriasChange(categoria.id, updated);
        haptic.trigger('success');
        toast({ title: 'Subcategoría creada' });
      }

      setSubcatModalOpen(false);
      setEditingSubcat(null);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error saving subcategoria:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar la subcategoría' });
    }
  };

  const handleDeleteSubcat = async (subcat: Categoria) => {
    const { count } = await supabase
      .from('movimientos')
      .select('*', { count: 'exact', head: true })
      .eq('subcategoria_id', subcat.id);

    if (count && count > 0) {
      toast({
        variant: 'destructive',
        title: 'No se puede eliminar',
        description: `Esta subcategoría tiene ${count} movimientos asociados`,
      });
      setDeleteSubcatConfirm(null);
      return;
    }

    const { error } = await supabase
      .from('categorias')
      .delete()
      .eq('id', subcat.id);

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar la subcategoría' });
    } else {
      const updated = subcategorias.filter(s => s.id !== subcat.id);
      setSubcategorias(updated);
      onSubcategoriasChange(categoria!.id, updated);
      haptic.trigger('success');
      toast({ title: 'Subcategoría eliminada' });
    }

    setDeleteSubcatConfirm(null);
  };

  // Shared scrollable body (used in both Sheet and Drawer)
  const bodyContent = categoria ? (
    <>
      <CategoriaForm
        key={categoria.id}
        id={EDIT_FORM_ID}
        initialData={categoria}
        tipo={categoria.tipo}
        hideActions
        onSubmit={async (data) => {
          setIsSaving(true);
          try {
            await onUpdateCategoria(categoria.id, data);
          } finally {
            setIsSaving(false);
          }
        }}
        onCancel={onClose}
      />

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Subcategorías</h3>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => { setEditingSubcat(null); setSubcatModalOpen(true); }}
          >
            <Plus className="h-4 w-4 mr-1" />
            Añadir
          </Button>
        </div>

        {subcategorias.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin subcategorías</p>
        ) : (
          <div className="flex flex-col gap-2">
            {subcategorias.map(subcat => (
              <div
                key={subcat.id}
                className="flex items-center justify-between p-2 rounded-lg border hover:bg-muted/50 cursor-pointer"
                onClick={() => { setEditingSubcat(subcat); setSubcatModalOpen(true); }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: subcat.color }}
                  />
                  <span className="text-sm">{subcat.nombre}</span>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="p-1 rounded hover:bg-muted outline-none">
                      <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => setDeleteSubcatConfirm(subcat)}
                        className="py-2.5 px-4 text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  ) : null;

  // Shared footer
  const footer = (
    <div className="border-t px-6 py-4 flex justify-end gap-2 shrink-0">
      <Button type="button" variant="outline" onClick={onClose}>
        Cancelar
      </Button>
      <Button type="submit" form={EDIT_FORM_ID} disabled={isSaving}>
        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Guardar
      </Button>
    </div>
  );

  return (
    <>
      {isMobile ? (
        <Drawer open={!!categoria} onOpenChange={(open) => { if (!open) { onClose(); setDrawerExpanded(false); } }} shouldScaleBackground={false}>
          <DrawerContent
            className={cn("flex flex-col", drawerExpanded && "rounded-t-none")}
            style={{
              height: drawerExpanded ? '100dvh' : '85dvh',
              maxHeight: drawerExpanded ? '100dvh' : '85dvh',
              transition: 'height 220ms ease-out, max-height 220ms ease-out',
            }}
          >
            {categoria && (
              <>
                <DrawerHeader className="text-left px-6 pt-4 pb-4 shrink-0">
                  <DrawerTitle className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: categoria.color }} />
                    {categoria.nombre}
                  </DrawerTitle>
                </DrawerHeader>
                <div
                  className="flex-1 overflow-y-auto px-6 pb-4 flex flex-col gap-6"
                  data-vaul-no-drag
                  onTouchStart={handleContentTouchStart}
                  onTouchMove={handleContentTouchMove}
                  onScroll={handleContentScroll}
                >
                  {bodyContent}
                </div>
                {footer}
              </>
            )}
          </DrawerContent>
        </Drawer>
      ) : (
        <Sheet open={!!categoria} onOpenChange={(open) => { if (!open) onClose(); }}>
          <SheetContent
            side="right"
            className="max-w-md w-full flex flex-col p-0"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            {categoria && (
              <>
                <div className="flex-1 overflow-y-auto px-6 pt-6 pb-4 flex flex-col gap-6">
                  <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: categoria.color }} />
                      {categoria.nombre}
                    </SheetTitle>
                  </SheetHeader>
                  {bodyContent}
                </div>
                {footer}
              </>
            )}
          </SheetContent>
        </Sheet>
      )}

      {/* Modal crear/editar subcategoría */}
      {isMobile ? (
        <Drawer
          open={subcatModalOpen}
          onOpenChange={(open) => { if (!open) { setSubcatModalOpen(false); setEditingSubcat(null); } }}
          repositionInputs={false}
        >
          <DrawerContent className="flex flex-col px-6 pb-6 pt-2">
            <DrawerHeader className="text-left px-0 pb-4">
              <DrawerTitle>{editingSubcat ? 'Editar subcategoría' : 'Nueva subcategoría'}</DrawerTitle>
            </DrawerHeader>
            {categoria && (
              <div data-vaul-no-drag>
                <CategoriaForm
                  key={editingSubcat?.id ?? 'new-subcat'}
                  initialData={editingSubcat || undefined}
                  tipo={categoria.tipo}
                  isSubcategoria={true}
                  autoFocusNombre
                  onSubmit={handleSaveSubcat}
                  onCancel={() => { setSubcatModalOpen(false); setEditingSubcat(null); }}
                />
              </div>
            )}
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog
          open={subcatModalOpen}
          onOpenChange={(open) => { if (!open) { setSubcatModalOpen(false); setEditingSubcat(null); } }}
        >
          <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>{editingSubcat ? 'Editar subcategoría' : 'Nueva subcategoría'}</DialogTitle>
              <DialogDescription>
                {editingSubcat ? 'Modifica los datos de la subcategoría' : 'Añade una nueva subcategoría'}
              </DialogDescription>
            </DialogHeader>
            {categoria && (
              <CategoriaForm
                key={editingSubcat?.id ?? 'new-subcat'}
                initialData={editingSubcat || undefined}
                tipo={categoria.tipo}
                isSubcategoria={true}
                onSubmit={handleSaveSubcat}
                onCancel={() => { setSubcatModalOpen(false); setEditingSubcat(null); }}
              />
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog confirmar borrado subcategoría */}
      <Dialog
        open={!!deleteSubcatConfirm}
        onOpenChange={() => setDeleteSubcatConfirm(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Eliminar subcategoría?</DialogTitle>
            <DialogDescription>Esta acción no se puede deshacer.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteSubcatConfirm(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteSubcatConfirm && handleDeleteSubcat(deleteSubcatConfirm)}
            >
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
