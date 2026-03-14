import { useState, useRef } from 'react';
import { format } from 'date-fns';
import { MainLayout } from '@/components/layout/MainLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
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
import { MovimientoForm } from '@/components/movimientos/MovimientoForm';
import { SwipeableRow } from '@/components/movimientos/SwipeableRow';
import { RecurrenteBanner } from '@/components/movimientos/RecurrenteBanner';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSwipeDownToDismiss } from '@/hooks/use-drawer-swipe-dismiss';
import { useMovimientos } from '@/hooks/useMovimientos';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Receipt,
  Loader2,
  Check,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';

export default function Movimientos() {
  const {
    cuentas,
    categorias,
    loading,
    showRecurrenteBanner,
    formattedMonth,
    categoriasParent,
    todasSubcategorias,
    subcategoriasFiltradas,
    filteredMovimientos,
    totals,
    currency,
    filtroCategoria,
    filtroSubcategoria,
    setFiltroCategoria,
    setFiltroSubcategoria,
    modalOpen,
    setModalOpen,
    editingMovimiento,
    deleteConfirm,
    setDeleteConfirm,
    setShowRecurrenteBanner,
    navigateMonth,
    handleCreateMovimiento,
    handleEditMovimiento,
    handleDeleteMovimiento,
    handleSwipeDelete,
    handleSaveMovimiento,
    handleGenerateRecurrentes,
    addCategoria,
    haptic,
    profile,
    movimientos,
  } = useMovimientos();

  const isMobile = useIsMobile();

  // Drawer presentation state (UI-only)
  const [drawerCategoriaOpen, setDrawerCategoriaOpen] = useState(false);
  const [drawerCategoriaExpanded, setDrawerCategoriaExpanded] = useState(false);
  const collapseTimerCategoria = useRef<ReturnType<typeof setTimeout>>();
  const [drawerSubcategoriaOpen, setDrawerSubcategoriaOpen] = useState(false);
  const [drawerSubcategoriaExpanded, setDrawerSubcategoriaExpanded] = useState(false);
  const collapseTimerSubcategoria = useRef<ReturnType<typeof setTimeout>>();
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  const handleScrollCategoria = (e: React.UIEvent<HTMLDivElement>) => {
    if (e.currentTarget.scrollTop > 0) {
      clearTimeout(collapseTimerCategoria.current);
      setDrawerCategoriaExpanded(true);
    } else {
      collapseTimerCategoria.current = setTimeout(() => setDrawerCategoriaExpanded(false), 80);
    }
  };

  const handleScrollSubcategoria = (e: React.UIEvent<HTMLDivElement>) => {
    if (e.currentTarget.scrollTop > 0) {
      clearTimeout(collapseTimerSubcategoria.current);
      setDrawerSubcategoriaExpanded(true);
    } else {
      collapseTimerSubcategoria.current = setTimeout(() => setDrawerSubcategoriaExpanded(false), 80);
    }
  };

  const swipeDismissCategoria = useSwipeDownToDismiss(() => setDrawerCategoriaOpen(false));
  const swipeDismissSubcategoria = useSwipeDownToDismiss(() => setDrawerSubcategoriaOpen(false));
  const swipeDismissMovimiento = useSwipeDownToDismiss(() => setModalOpen(false));

  return (
    <ProtectedRoute>
      {/* Input oculto para mantener el contexto de teclado iOS durante la animación del Drawer */}
      <input
        ref={hiddenInputRef}
        type="text"
        aria-hidden="true"
        tabIndex={-1}
        style={{ position: 'fixed', top: 0, left: 0, width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
      />
      <MainLayout>
        <div className="space-y-3 sm:space-y-6 pb-24 sm:pb-0">
          {/* Header */}
          <div className="flex sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigateMonth('prev')}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-base font-semibold md:text-lg capitalize text-center">
                {formattedMonth}
              </h1>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigateMonth('next')}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
            <div className="hidden sm:flex gap-2 shrink-0">
              <Button onClick={handleCreateMovimiento}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Movimiento
              </Button>
            </div>
          </div>

          {/* Recurrent expenses banner */}
          <RecurrenteBanner
            show={showRecurrenteBanner}
            onDismiss={() => setShowRecurrenteBanner(false)}
            onGenerate={handleGenerateRecurrentes}
          />

          {/* Movements table */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-5">
                <CardTitle className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-muted"><Receipt className="h-4 w-4 text-muted-foreground" /></div>
                  Movimientos
                </CardTitle>

                {/* Filtros */}
                {movimientos.length > 0 && (
                  <div className="flex flex-row gap-2 w-full sm:w-auto items-center">
                    {isMobile ? (
                      <>
                        {/* Mobile: Drawer para categoría */}
                        <button
                          type="button"
                          className="flex-1 flex items-center justify-between rounded-md border border-input bg-background px-3 h-10 text-sm"
                          onClick={() => setDrawerCategoriaOpen(true)}
                        >
                          {filtroCategoria === '__all__' ? (
                            <span className="text-muted-foreground">Categoría</span>
                          ) : (() => {
                            const cat = categoriasParent.find(c => c.id === filtroCategoria);
                            return cat ? (
                              <span
                                className="px-2 py-0.5 rounded text-xs font-medium"
                                style={{ backgroundColor: `${cat.color}25`, color: cat.color, filter: 'brightness(0.85)' }}
                              >
                                {cat.nombre}
                              </span>
                            ) : <span className="text-muted-foreground">Categoría</span>;
                          })()}
                          <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
                        </button>
                        <Drawer open={drawerCategoriaOpen} onOpenChange={(v) => { setDrawerCategoriaOpen(v); if (!v) setDrawerCategoriaExpanded(false); }} shouldScaleBackground={false}>
                          <DrawerContent
                            className={cn(drawerCategoriaExpanded && "rounded-t-none")}
                            style={{
                              height: drawerCategoriaExpanded ? '100dvh' : '85dvh',
                              maxHeight: drawerCategoriaExpanded ? '100dvh' : '85dvh',
                              transition: 'height 180ms ease-in-out, max-height 180ms ease-in-out, border-top-left-radius 180ms ease-in-out, border-top-right-radius 180ms ease-in-out',
                            }}
                          >
                            <DrawerHeader>
                              <DrawerTitle>Categoría</DrawerTitle>
                            </DrawerHeader>
                            <div ref={swipeDismissCategoria} className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-4 pb-8" data-vaul-no-drag onScroll={handleScrollCategoria}>
                              <button
                                className="w-full text-left py-3 px-2 rounded-lg flex items-center gap-3 active:bg-accent"
                                onClick={() => { setFiltroCategoria('__all__'); setFiltroSubcategoria('__all__'); setDrawerCategoriaOpen(false); }}
                              >
                                <Check className={cn("h-4 w-4 shrink-0", filtroCategoria === '__all__' ? "opacity-100" : "opacity-0")} />
                                <span className="text-base text-muted-foreground italic">Todas</span>
                              </button>
                              {categoriasParent.map(cat => (
                                <button
                                  key={cat.id}
                                  className="w-full text-left py-3 px-2 rounded-lg flex items-center gap-3 active:bg-accent"
                                  onClick={() => { setFiltroCategoria(cat.id); setFiltroSubcategoria('__all__'); setDrawerCategoriaOpen(false); }}
                                >
                                  <Check className={cn("h-4 w-4 shrink-0", filtroCategoria === cat.id ? "opacity-100" : "opacity-0")} />
                                  <span
                                    className="px-2 py-0.5 rounded text-sm font-medium"
                                    style={{ backgroundColor: `${cat.color}25`, color: cat.color, filter: 'brightness(0.85)' }}
                                  >
                                    {cat.nombre}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </DrawerContent>
                        </Drawer>

                        {/* Mobile: Drawer para subcategoría */}
                        <button
                          type="button"
                          className="flex-1 flex items-center justify-between rounded-md border border-input bg-background px-3 h-10 text-sm"
                          onClick={() => setDrawerSubcategoriaOpen(true)}
                        >
                          {filtroSubcategoria === '__all__' ? (
                            <span className="text-muted-foreground">Subcategoría</span>
                          ) : (() => {
                            const sub = todasSubcategorias.find(s => s.id === filtroSubcategoria);
                            return sub ? (
                              <span
                                className="px-2 py-0.5 rounded text-xs font-medium"
                                style={{ backgroundColor: `${sub.color}25`, color: sub.color, filter: 'brightness(0.85)' }}
                              >
                                {sub.nombre}
                              </span>
                            ) : <span className="text-muted-foreground">Subcategoría</span>;
                          })()}
                          <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
                        </button>
                        <Drawer open={drawerSubcategoriaOpen} onOpenChange={(v) => { setDrawerSubcategoriaOpen(v); if (!v) setDrawerSubcategoriaExpanded(false); }} shouldScaleBackground={false}>
                          <DrawerContent
                            className={cn(drawerSubcategoriaExpanded && "rounded-t-none")}
                            style={{
                              height: drawerSubcategoriaExpanded ? '100dvh' : '85dvh',
                              maxHeight: drawerSubcategoriaExpanded ? '100dvh' : '85dvh',
                              transition: 'height 180ms ease-in-out, max-height 180ms ease-in-out, border-top-left-radius 180ms ease-in-out, border-top-right-radius 180ms ease-in-out',
                            }}
                          >
                            <DrawerHeader>
                              <DrawerTitle>Subcategoría</DrawerTitle>
                            </DrawerHeader>
                            <div ref={swipeDismissSubcategoria} className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-4 pb-8" data-vaul-no-drag onScroll={handleScrollSubcategoria}>
                              <button
                                className="w-full text-left py-3 px-2 rounded-lg flex items-center gap-3 active:bg-accent"
                                onClick={() => { setFiltroSubcategoria('__all__'); setDrawerSubcategoriaOpen(false); }}
                              >
                                <Check className={cn("h-4 w-4 shrink-0", filtroSubcategoria === '__all__' ? "opacity-100" : "opacity-0")} />
                                <span className="text-base text-muted-foreground italic">Todas</span>
                              </button>
                              {filtroCategoria !== '__all__' ? (
                                subcategoriasFiltradas.map(sub => (
                                  <button
                                    key={sub.id}
                                    className="w-full text-left py-3 px-2 rounded-lg flex items-center gap-3 active:bg-accent"
                                    onClick={() => { setFiltroSubcategoria(sub.id); setDrawerSubcategoriaOpen(false); }}
                                  >
                                    <Check className={cn("h-4 w-4 shrink-0", filtroSubcategoria === sub.id ? "opacity-100" : "opacity-0")} />
                                    <span
                                      className="px-2 py-0.5 rounded text-sm font-medium"
                                      style={{ backgroundColor: `${sub.color}25`, color: sub.color, filter: 'brightness(0.85)' }}
                                    >
                                      {sub.nombre}
                                    </span>
                                  </button>
                                ))
                              ) : (
                                categoriasParent.map(parent => {
                                  const hijas = todasSubcategorias.filter(s => s.parent_id === parent.id);
                                  if (hijas.length === 0) return null;
                                  return (
                                    <div key={parent.id} className="mt-2 first:mt-0">
                                      <p className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">{parent.nombre}</p>
                                      {hijas.map(sub => (
                                        <button
                                          key={sub.id}
                                          className="w-full text-left py-3 px-2 rounded-lg flex items-center gap-3 active:bg-accent"
                                          onClick={() => {
                                            setFiltroSubcategoria(sub.id);
                                            setFiltroCategoria(sub.parent_id!);
                                            setDrawerSubcategoriaOpen(false);
                                          }}
                                        >
                                          <Check className={cn("h-4 w-4 shrink-0", filtroSubcategoria === sub.id ? "opacity-100" : "opacity-0")} />
                                          <span
                                            className="px-2 py-0.5 rounded text-sm font-medium"
                                            style={{ backgroundColor: `${sub.color}25`, color: sub.color, filter: 'brightness(0.85)' }}
                                          >
                                            {sub.nombre}
                                          </span>
                                        </button>
                                      ))}
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </DrawerContent>
                        </Drawer>
                      </>
                    ) : (
                      <>
                        {/* Desktop: Select estándar para categoría */}
                        <Select value={filtroCategoria} onValueChange={(v) => { setFiltroCategoria(v); setFiltroSubcategoria('__all__'); }}>
                          <SelectTrigger className="flex-1 sm:w-[150px]">
                            <SelectValue>
                              {filtroCategoria === '__all__' ? (
                                'Categoría'
                              ) : (() => {
                                const cat = categoriasParent.find(c => c.id === filtroCategoria);
                                return cat ? (
                                  <span
                                    className="px-2 py-0.5 rounded text-xs font-medium"
                                    style={{ backgroundColor: `${cat.color}25`, color: cat.color, filter: 'brightness(0.85)' }}
                                  >
                                    {cat.nombre}
                                  </span>
                                ) : null;
                              })()}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__all__">Todas</SelectItem>
                            {categoriasParent.map(cat => (
                              <SelectItem key={cat.id} value={cat.id}>
                                <span
                                  className="px-2 py-0.5 rounded text-xs font-medium"
                                  style={{ backgroundColor: `${cat.color}25`, color: cat.color, filter: 'brightness(0.85)' }}
                                >
                                  {cat.nombre}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {/* Desktop: Select estándar para subcategoría */}
                        <Select value={filtroSubcategoria} onValueChange={(v) => {
                          setFiltroSubcategoria(v);
                          if (v !== '__all__' && filtroCategoria === '__all__') {
                            const sub = todasSubcategorias.find(s => s.id === v);
                            if (sub?.parent_id) setFiltroCategoria(sub.parent_id);
                          }
                        }}>
                          <SelectTrigger className="flex-1 sm:w-[150px]">
                            <SelectValue>
                              {filtroSubcategoria === '__all__' ? (
                                'Subcategoría'
                              ) : (() => {
                                const sub = todasSubcategorias.find(s => s.id === filtroSubcategoria);
                                return sub ? (
                                  <span
                                    className="px-2 py-0.5 rounded text-xs font-medium"
                                    style={{ backgroundColor: `${sub.color}25`, color: sub.color, filter: 'brightness(0.85)' }}
                                  >
                                    {sub.nombre}
                                  </span>
                                ) : null;
                              })()}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__all__">Todas</SelectItem>
                            {filtroCategoria !== '__all__' ? (
                              subcategoriasFiltradas.map(sub => (
                                <SelectItem key={sub.id} value={sub.id}>
                                  <span
                                    className="px-2 py-0.5 rounded text-xs font-medium"
                                    style={{ backgroundColor: `${sub.color}25`, color: sub.color, filter: 'brightness(0.85)' }}
                                  >
                                    {sub.nombre}
                                  </span>
                                </SelectItem>
                              ))
                            ) : (
                              categoriasParent.map(parent => {
                                const hijas = todasSubcategorias.filter(s => s.parent_id === parent.id);
                                if (hijas.length === 0) return null;
                                return (
                                  <SelectGroup key={parent.id} className="mt-2 first:mt-0">
                                    <SelectLabel className="text-xs text-muted-foreground">{parent.nombre}</SelectLabel>
                                    {hijas.map(sub => (
                                      <SelectItem key={sub.id} value={sub.id}>
                                        <span
                                          className="px-2 py-0.5 rounded text-xs font-medium"
                                          style={{ backgroundColor: `${sub.color}25`, color: sub.color, filter: 'brightness(0.85)' }}
                                        >
                                          {sub.nombre}
                                        </span>
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                );
                              })
                            )}
                          </SelectContent>
                        </Select>
                      </>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : movimientos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                  <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">No hay movimientos este mes</p>
                  <p className="text-muted-foreground mb-4">Empieza añadiendo tu primer movimiento</p>
                  <Button onClick={handleCreateMovimiento}>
                    <Plus className="mr-2 h-4 w-4" />
                    Añadir primer movimiento
                  </Button>
                </div>
              ) : (
                <>
                  {/* Mobile: card list */}
                  <div className="md:hidden divide-y -mx-6">
                    {filteredMovimientos.map((movimiento) => (
                      <SwipeableRow
                        key={movimiento.id}
                        onDelete={() => handleSwipeDelete(movimiento)}
                        onThresholdReached={() => haptic.trigger('warning')}
                      >
                        <div
                          className="flex items-center justify-between px-6 py-3 cursor-pointer active:bg-muted/40 transition-colors"
                          onClick={() => handleEditMovimiento(movimiento)}
                        >
                          <div className="flex-1 min-w-0 pr-3">
                            <p className="font-medium text-sm truncate">{movimiento.concepto}</p>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              {movimiento.categoria && (
                                <span
                                  className="px-1.5 py-0.5 rounded text-xs font-medium"
                                  style={{ backgroundColor: `${movimiento.categoria.color}25`, color: movimiento.categoria.color, filter: 'brightness(0.85)' }}
                                >
                                  {movimiento.categoria.nombre}
                                </span>
                              )}
                              {movimiento.subcategoria && (
                                <span
                                  className="px-1.5 py-0.5 rounded text-xs font-medium"
                                  style={{ backgroundColor: `${movimiento.subcategoria.color}25`, color: movimiento.subcategoria.color, filter: 'brightness(0.85)' }}
                                >
                                  {movimiento.subcategoria.nombre}
                                </span>
                              )}
                              {movimiento.es_recurrente && (
                                <span className="text-xs text-muted-foreground">· Recurrente</span>
                              )}
                            </div>
                          </div>
                          <span className={cn(
                            "font-semibold text-sm shrink-0",
                            movimiento.cantidad > 0 ? "text-green-600" : "text-destructive"
                          )}>
                            {formatCurrency(Number(movimiento.cantidad), currency, true)}
                          </span>
                        </div>
                      </SwipeableRow>
                    ))}
                  </div>
                  {/* Desktop: table */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[100px]">Fecha</TableHead>
                          <TableHead className="text-right pr-8">Cantidad</TableHead>
                          <TableHead>Concepto</TableHead>
                          <TableHead className="hidden md:table-cell">Cuenta</TableHead>
                          <TableHead className="hidden md:table-cell">Categoría</TableHead>
                          <TableHead className="hidden md:table-cell">Subcategoría</TableHead>
                          <TableHead className="w-[80px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredMovimientos.map((movimiento) => (
                        <TableRow key={movimiento.id} className="group cursor-pointer" onClick={() => handleEditMovimiento(movimiento)}>
                          <TableCell className="font-medium">
                            {format(new Date(movimiento.fecha), 'dd/MM')}
                          </TableCell>
                          <TableCell className={cn(
                            "text-right font-medium pr-8",
                            movimiento.cantidad > 0 ? "text-green-600" : "text-destructive"
                          )}>
                            {formatCurrency(Number(movimiento.cantidad), currency, true)}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span>{movimiento.concepto}</span>
                              {movimiento.es_recurrente && (
                                <span className="text-xs text-muted-foreground">
                                  Recurrente
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <div className="flex items-center gap-1.5">
                              <div
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: movimiento.cuenta?.color }}
                              />
                              <span className="text-sm">{movimiento.cuenta?.nombre}</span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {movimiento.categoria && (
                              <span
                                className="px-2 py-1 rounded text-xs font-medium"
                                style={{ backgroundColor: `${movimiento.categoria.color}25`, color: movimiento.categoria.color, filter: 'brightness(0.85)' }}
                              >
                                {movimiento.categoria.nombre}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {movimiento.subcategoria && (
                              <span
                                className="px-2 py-1 rounded text-xs font-medium"
                                style={{ backgroundColor: `${movimiento.subcategoria.color}25`, color: movimiento.subcategoria.color, filter: 'brightness(0.85)' }}
                              >
                                {movimiento.subcategoria.nombre}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={(e) => { e.stopPropagation(); setDeleteConfirm(movimiento.id); }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Totals */}
          {filteredMovimientos.length > 0 && (
            <div className="rounded-lg bg-muted/50 px-4 py-3">
              <div className="flex flex-wrap justify-center gap-6 text-center">
                <div>
                  <p className="text-xs md:text-sm text-muted-foreground">Ingresos</p>
                  <p className="text-sm md:text-base font-semibold text-green-600">
                    +{totals.ingresos.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€
                  </p>
                </div>
                <div className="border-l pl-6">
                  <p className="text-xs md:text-sm text-muted-foreground">Gastos</p>
                  <p className="text-sm md:text-base font-semibold text-destructive">
                    -{totals.gastos.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€
                  </p>
                </div>
                <div className="border-l pl-6">
                  <p className="text-xs md:text-sm text-muted-foreground">Balance</p>
                  <p className={cn(
                    "text-sm md:text-base font-semibold",
                    totals.balance >= 0 ? "text-green-600" : "text-destructive"
                  )}>
                    {totals.balance >= 0 ? '+' : ''}{totals.balance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Create/Edit Modal */}
          {isMobile ? (
            <Drawer open={modalOpen} onOpenChange={setModalOpen} shouldScaleBackground={false} repositionInputs={false}>
              <DrawerContent
                className="flex flex-col max-h-none"
                onOpenAutoFocus={(e) => {
                  e.preventDefault();
                  if (!editingMovimiento) {
                    hiddenInputRef.current?.focus({ preventScroll: true });
                  }
                }}
              >
                <DrawerHeader className="text-left px-6 pt-4 pb-4 shrink-0">
                  <DrawerTitle>{editingMovimiento ? 'Editar movimiento' : 'Nuevo movimiento'}</DrawerTitle>
                </DrawerHeader>
                <div ref={swipeDismissMovimiento} className="flex-1 overflow-y-auto px-6 pb-6" data-vaul-no-drag>
                  <MovimientoForm
                    cuentas={cuentas}
                    categorias={categorias}
                    defaultCuentaId={profile?.cuenta_default_id || undefined}
                    initialData={editingMovimiento || undefined}
                    onSubmit={handleSaveMovimiento}
                    onCancel={() => setModalOpen(false)}
                    onCategoriaCreated={addCategoria}
                    disableAutoFocus
                  />
                </div>
              </DrawerContent>
            </Drawer>
          ) : (
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
              <DialogContent className="sm:max-w-md w-full">
                <DialogHeader>
                  <DialogTitle>
                    {editingMovimiento ? 'Editar Movimiento' : 'Nuevo Movimiento'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingMovimiento
                      ? 'Modifica los datos del movimiento'
                      : 'Añade un nuevo ingreso o gasto'}
                  </DialogDescription>
                </DialogHeader>
                <MovimientoForm
                  cuentas={cuentas}
                  categorias={categorias}
                  defaultCuentaId={profile?.cuenta_default_id || undefined}
                  initialData={editingMovimiento || undefined}
                  onSubmit={handleSaveMovimiento}
                  onCancel={() => setModalOpen(false)}
                  onCategoriaCreated={addCategoria}
                />
              </DialogContent>
            </Dialog>
          )}

          {/* Delete confirmation */}
          <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>¿Eliminar movimiento?</DialogTitle>
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
                  onClick={() => deleteConfirm && handleDeleteMovimiento(deleteConfirm)}
                >
                  Eliminar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Mobile sticky bottom bar */}
        <div className="sm:hidden fixed bottom-0 left-0 right-0 z-20 bg-background border-t px-4 py-3">
          <Button className="w-full h-12 text-base" onClick={handleCreateMovimiento}>
            <Plus className="mr-2 h-5 w-5" />
            Nuevo Movimiento
          </Button>
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
}
