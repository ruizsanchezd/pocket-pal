import { useState, useEffect, useMemo } from 'react';
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible';
import { CategoriaForm } from '@/components/configuracion/CategoriaForm';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  Trash2,
  Tags,
  Loader2,
  ArrowLeft,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { Categoria, CategoriaConHijos, CategoriaTipo } from '@/types/database';
import { Link } from 'react-router-dom';

export default function ConfigCategorias() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategoria, setEditingCategoria] = useState<Categoria | null>(null);
  const [parentCategoria, setParentCategoria] = useState<Categoria | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Categoria | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<CategoriaTipo>('gasto');

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

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const handleCreate = (parent?: Categoria) => {
    setEditingCategoria(null);
    setParentCategoria(parent || null);
    setModalOpen(true);
  };

  const handleEdit = (categoria: Categoria) => {
    setEditingCategoria(categoria);
    setParentCategoria(null);
    setModalOpen(true);
  };

  const handleSave = async (data: any) => {
    if (!user) return;

    try {
      if (editingCategoria) {
        // Update category
        const { error } = await supabase
          .from('categorias')
          .update({
            nombre: data.nombre,
            color: data.color,
            icono: data.icono
          })
          .eq('id', editingCategoria.id);

        if (error) throw error;

        setCategorias(categorias.map(c => 
          c.id === editingCategoria.id 
            ? { ...c, nombre: data.nombre, color: data.color, icono: data.icono }
            : c
        ));

        toast({ title: 'Categoría actualizada' });
      } else {
        // Create category
        const tipo = parentCategoria?.tipo || activeTab;

        // Guard: prevent sub-subcategories
        if (parentCategoria?.parent_id) {
          toast({
            variant: 'destructive',
            title: 'Error',
            description: 'No se permiten subcategorías anidadas'
          });
          return;
        }

        const { data: newCategoria, error } = await supabase
          .from('categorias')
          .insert({
            user_id: user.id,
            nombre: data.nombre,
            tipo,
            parent_id: parentCategoria?.id || null,
            color: data.color,
            icono: data.icono,
            orden: categorias.filter(c => c.tipo === tipo).length
          })
          .select()
          .single();

        if (error) throw error;

        setCategorias([...categorias, newCategoria as Categoria]);
        toast({ title: 'Categoría creada' });
      }

      setModalOpen(false);
      setEditingCategoria(null);
      setParentCategoria(null);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error saving categoria:', error);
      }
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo guardar la categoría'
      });
    }
  };

  const handleDelete = async (categoria: Categoria) => {
    // Check for movements using this category
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

    // Check for subcategories
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
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo eliminar la categoría'
      });
    } else {
      setCategorias(categorias.filter(c => c.id !== categoria.id));
      toast({ title: 'Categoría eliminada' });
    }

    setDeleteConfirm(null);
  };

  const renderCategoria = (categoria: CategoriaConHijos, level: number = 0) => {
    const hasChildren = categoria.children && categoria.children.length > 0;
    const isExpanded = expandedIds.has(categoria.id);

    return (
      <div key={categoria.id} className="space-y-2">
        <div
          className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
          style={{ marginLeft: `${level * 24}px` }}
          onClick={() => handleEdit(categoria)}
        >
          <div className="flex items-center gap-3">
            {hasChildren ? (
              <button
                onClick={(e) => { e.stopPropagation(); toggleExpanded(categoria.id); }}
                className="p-1 hover:bg-muted rounded"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            ) : (
              <div className="w-6" />
            )}
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: categoria.color }}
            />
            <span className="font-medium">
              {categoria.icono && <span className="mr-1">{categoria.icono}</span>}
              {categoria.nombre}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {level === 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => { e.stopPropagation(); handleCreate(categoria); }}
                title="Añadir subcategoría"
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => { e.stopPropagation(); setDeleteConfirm(categoria); }}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="space-y-2">
            {categoria.children!.map(child => renderCategoria(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <ProtectedRoute>
      <MainLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Link to="/configuracion">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Gestión de Categorías</h1>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Tags className="h-5 w-5" />
                Categorías
              </CardTitle>
              <Button onClick={() => handleCreate()}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva Categoría
              </Button>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as CategoriaTipo)}>
                <TabsList className="mb-4">
                  <TabsTrigger value="gasto">Gastos</TabsTrigger>
                  <TabsTrigger value="ingreso">Ingresos</TabsTrigger>
                  <TabsTrigger value="inversion">Inversiones</TabsTrigger>
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
                    <Button onClick={() => handleCreate()}>
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

          {/* Create/Edit Modal */}
          <Dialog open={modalOpen} onOpenChange={setModalOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingCategoria ? 'Editar Categoría' : 
                   parentCategoria ? `Nueva Subcategoría de ${parentCategoria.nombre}` :
                   'Nueva Categoría'}
                </DialogTitle>
                <DialogDescription>
                  {editingCategoria 
                    ? 'Modifica los datos de la categoría' 
                    : 'Añade una nueva categoría'}
                </DialogDescription>
              </DialogHeader>
              <CategoriaForm
                initialData={editingCategoria || undefined}
                tipo={parentCategoria?.tipo || activeTab}
                isSubcategoria={!!parentCategoria}
                onSubmit={handleSave}
                onCancel={() => setModalOpen(false)}
              />
            </DialogContent>
          </Dialog>

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
