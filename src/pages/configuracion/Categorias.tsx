import { useState, useEffect, useMemo } from 'react';
import { useWebHaptics } from 'web-haptics/react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSwipeDownToDismiss } from '@/hooks/use-drawer-swipe-dismiss';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CategoriaForm } from '@/components/configuracion/CategoriaForm';
import { CategoriaDetalleSheet } from '@/components/configuracion/CategoriaDetalleSheet';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  Trash2,
  Tags,
  Loader2,
  MoreHorizontal,
} from 'lucide-react';
import { Categoria, CategoriaConHijos, CategoriaFormData, CategoriaTipo } from '@/types/database';
import { MobileSubpageHeader } from '@/components/configuracion/MobileSubpageHeader';

export default function ConfigCategorias() {
  const { user } = useAuth();
  const { toast } = useToast();
  const haptic = useWebHaptics();
  const isMobile = useIsMobile();
  const swipeDismissCategoria = useSwipeDownToDismiss(() => setModalOpen(false));

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategoria, setEditingCategoria] = useState<Categoria | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Categoria | null>(null);
  const [activeTab, setActiveTab] = useState<CategoriaTipo>('gasto');
  const [selectedCategoria, setSelectedCategoria] = useState<CategoriaConHijos | null>(null);

  // Fetch categories
  useEffect(() => {
    if (!user) return;

    const fetchCategorias = async () => {
      setLoading(true);

      const { data } = await supabase
        .from('categorias')
        .select('*')
        .eq('user_id', user.id)
        .order('orden');

      if (data) {
        setCategorias(data as Categoria[]);
      }

      setLoading(false);
    };

    fetchCategorias();
  }, [user]);

  // Build tree structure
  const categoriaTree = useMemo(() => {
    const filtered = categorias.filter(c => c.tipo === activeTab);
    const rootCategorias = filtered.filter(c => !c.parent_id);

    const buildTree = (parent: Categoria): CategoriaConHijos => {
      const children = filtered.filter(c => c.parent_id === parent.id);
      return {
        ...parent,
        children: children.map(buildTree)
      };
    };

    return rootCategorias.map(buildTree);
  }, [categorias, activeTab]);

  // Keep sheetCategoria fresh from tree
  const sheetCategoria = useMemo(
    () => categoriaTree.find(c => c.id === selectedCategoria?.id) ?? null,
    [categoriaTree, selectedCategoria]
  );

  const handleCreate = () => {
    setEditingCategoria(null);
    setModalOpen(true);
  };

  const handleSave = async (data: CategoriaFormData) => {
    if (!user) return;

    try {
      const { data: newCategoria, error } = await supabase
        .from('categorias')
        .insert({
          user_id: user.id,
          nombre: data.nombre,
          tipo: activeTab,
          parent_id: null,
          color: data.color,
          icono: null,
          orden: categorias.filter(c => c.tipo === activeTab).length
        })
        .select()
        .single();

      if (error) throw error;

      setCategorias([...categorias, newCategoria as Categoria]);
      haptic.trigger('success');
      toast({ title: 'Categoría creada' });
      setModalOpen(false);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error saving categoria:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo guardar la categoría'
      });
    }
  };

  const handleUpdateCategoria = async (id: string, data: CategoriaFormData) => {
    const { error } = await supabase
      .from('categorias')
      .update({ nombre: data.nombre, color: data.color, icono: null })
      .eq('id', id);

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar la categoría' });
      throw error;
    }

    setCategorias(categorias.map(c =>
      c.id === id ? { ...c, nombre: data.nombre, color: data.color, icono: null } : c
    ));
    haptic.trigger('success');
    toast({ title: 'Categoría actualizada' });
  };

  const handleSubcategoriasChange = (parentId: string, updatedSubcats: Categoria[]) => {
    setCategorias(prev => [
      ...prev.filter(c => c.parent_id !== parentId && c.id !== parentId),
      prev.find(c => c.id === parentId)!,
      ...updatedSubcats
    ]);
  };

  const handleDelete = async (categoria: Categoria) => {
    const { count } = await supabase
      .from('movimientos')
      .select('*', { count: 'exact', head: true })
      .or(`categoria_id.eq.${categoria.id},subcategoria_id.eq.${categoria.id}`);

    if (count && count > 0) {
      toast({
        variant: 'destructive',
        title: 'No se puede eliminar',
        description: `Esta categoría tiene ${count} movimientos asociados`
      });
      setDeleteConfirm(null);
      return;
    }

    const subcategorias = categorias.filter(c => c.parent_id === categoria.id);
    if (subcategorias.length > 0) {
      toast({
        variant: 'destructive',
        title: 'No se puede eliminar',
        description: 'Esta categoría tiene subcategorías. Elimínalas primero.'
      });
      setDeleteConfirm(null);
      return;
    }

    const { error } = await supabase
      .from('categorias')
      .delete()
      .eq('id', categoria.id);

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar la categoría' });
    } else {
      haptic.trigger('success');
      setCategorias(categorias.filter(c => c.id !== categoria.id));
      toast({ title: 'Categoría eliminada' });
    }

    setDeleteConfirm(null);
  };

  const renderCategoria = (categoria: CategoriaConHijos) => (
    <div
      key={categoria.id}
      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
      onClick={() => setSelectedCategoria(categoria)}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: categoria.color }} />
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 min-w-0">
          <span className="font-medium truncate">
            {categoria.icono && <span className="mr-1">{categoria.icono}</span>}
            {categoria.nombre}
          </span>
          {(categoria.children?.length ?? 0) > 0 && (
            <span className="text-xs text-muted-foreground">
              {categoria.children!.length} subcategorías
            </span>
          )}
        </div>
      </div>
      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger className="p-1 rounded hover:bg-muted outline-none">
            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => setDeleteConfirm(categoria)}
              className="py-2.5 px-4 text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return (
    <ProtectedRoute>
      <MainLayout>
        <div className="space-y-4 md:space-y-6">
          <MobileSubpageHeader title="Gestión de Categorías" backHref="/configuracion" />

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-muted"><Tags className="h-4 w-4 text-muted-foreground" /></div>
                Categorías
              </CardTitle>
              <Button onClick={handleCreate} className="shrink-0 h-7 w-7 p-0 sm:h-9 sm:w-auto sm:px-4">
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Nueva Categoría</span>
              </Button>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={(v) => { haptic.trigger('selection'); setActiveTab(v as CategoriaTipo); }}>
                <TabsList className="mb-4 w-full sm:w-auto">
                  <TabsTrigger value="gasto" className="flex-1 sm:flex-none">Gastos</TabsTrigger>
                  <TabsTrigger value="ingreso" className="flex-1 sm:flex-none">Ingresos</TabsTrigger>
                  <TabsTrigger value="inversion" className="flex-1 sm:flex-none">Inversiones</TabsTrigger>
                </TabsList>

                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : categoriaTree.length === 0 ? (
                  <div className="text-center py-8">
                    <Tags className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg font-medium">No hay categorías de {activeTab}</p>
                    <p className="text-muted-foreground mb-4">
                      Añade tu primera categoría
                    </p>
                    <Button onClick={handleCreate}>
                      <Plus className="mr-2 h-4 w-4" />
                      Añadir categoría
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {categoriaTree.map(cat => renderCategoria(cat))}
                  </div>
                )}
              </Tabs>
            </CardContent>
          </Card>

          <CategoriaDetalleSheet
            categoria={sheetCategoria}
            onUpdateCategoria={handleUpdateCategoria}
            onSubcategoriasChange={handleSubcategoriasChange}
            onClose={() => setSelectedCategoria(null)}
            userId={user!.id}
          />

          {/* Create Modal */}
          {isMobile ? (
            <Drawer open={modalOpen} onOpenChange={setModalOpen} shouldScaleBackground={false} repositionInputs={false}>
              <DrawerContent
                className="flex flex-col px-6 pb-6 pt-2"
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <DrawerHeader className="text-left px-0 pb-2 shrink-0">
                  <DrawerTitle>Nueva Categoría</DrawerTitle>
                </DrawerHeader>
                <div ref={swipeDismissCategoria} data-vaul-no-drag>
                  <CategoriaForm
                    tipo={activeTab}
                    onSubmit={handleSave}
                    onCancel={() => setModalOpen(false)}
                  />
                </div>
              </DrawerContent>
            </Drawer>
          ) : (
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
              <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
                <DialogHeader>
                  <DialogTitle>Nueva Categoría</DialogTitle>
                  <DialogDescription>Añade una nueva categoría</DialogDescription>
                </DialogHeader>
                <CategoriaForm
                  tipo={activeTab}
                  onSubmit={handleSave}
                  onCancel={() => setModalOpen(false)}
                />
              </DialogContent>
            </Dialog>
          )}

          {/* Delete confirmation */}
          <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>¿Eliminar categoría?</DialogTitle>
                <DialogDescription>
                  Esta acción no se puede deshacer.
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
                >
                  Eliminar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
}
