import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { CreatableSelect } from '@/components/ui/creatable-select';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSwipeDownToDismiss } from '@/hooks/use-drawer-swipe-dismiss';
import { formatCurrency } from '@/lib/format';
import type { EstadoNueva } from '@/hooks/useImportador';
import type { FilaImportacion } from '@/lib/importador/planificar';
import type { Categoria } from '@/types/database';

interface EditorFilaProps {
  fila: (FilaImportacion & { tipo: 'nueva' }) | null;
  estado: EstadoNueva | null;
  categorias: Categoria[];
  currency: string;
  onChange: (cambios: Partial<EstadoNueva>) => void;
  onCrearCategoria: (nombre: string, padre: Categoria | null) => Promise<string | null>;
  onClose: () => void;
}

/** Corregir una fila nueva: concepto, fecha, categoría o no importarla. Los cambios se aplican al momento. */
export function EditorFila({ fila, estado, categorias, currency, onChange, onCrearCategoria, onClose }: EditorFilaProps) {
  const isMobile = useIsMobile();
  const swipeDismiss = useSwipeDownToDismiss(onClose);
  const open = !!fila && !!estado;

  const contenido = fila && estado && (
    <div className="space-y-4">
      <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
        <div className="flex justify-between gap-3">
          <span className="font-medium truncate">{fila.linea.concepto}</span>
          <span className="shrink-0 tabular-nums">{formatCurrency(fila.linea.importe, currency, true)}</span>
        </div>
        {fila.linea.mas_datos && fila.linea.mas_datos !== 'BIZUM' && (
          <p className="text-xs text-muted-foreground truncate">{fila.linea.mas_datos}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">{estado.motivo}</p>
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="incluir">Importar este movimiento</Label>
        <Switch id="incluir" checked={estado.incluir} onCheckedChange={(incluir) => onChange({ incluir })} />
      </div>

      {estado.incluir && (
        <>
          <div className="space-y-2">
            <Label htmlFor="concepto">Concepto</Label>
            <Input id="concepto" value={estado.concepto} onChange={(e) => onChange({ concepto: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fecha">Fecha</Label>
            <Input
              id="fecha"
              type="date"
              value={estado.fecha}
              onChange={(e) => e.target.value && onChange({ fecha: e.target.value })}
            />
            {estado.fecha !== fila.linea.fecha && (
              <p className="text-xs text-muted-foreground">En el banco: {fila.linea.fecha.split('-').reverse().join('/')}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Categoría</Label>
            <CreatableSelect
              options={categorias.filter((c) => !c.parent_id).map((c) => ({ value: c.id, label: c.nombre, color: c.color }))}
              value={estado.categoria_id ?? ''}
              onValueChange={(categoria_id) => onChange({ categoria_id, subcategoria_id: null })}
              onCreate={(nombre) => onCrearCategoria(nombre, null)}
              placeholder="Selecciona una categoría"
              createLabel="Crear categoría"
            />
          </div>

          {estado.categoria_id && (
            <div className="space-y-2">
              <Label>Subcategoría</Label>
              <CreatableSelect
                options={categorias
                  .filter((c) => c.parent_id === estado.categoria_id)
                  .map((c) => ({ value: c.id, label: c.nombre, color: c.color }))}
                value={estado.subcategoria_id ?? ''}
                onValueChange={(v) => onChange({ subcategoria_id: v || null })}
                onCreate={(nombre) => onCrearCategoria(nombre, categorias.find((c) => c.id === estado.categoria_id) ?? null)}
                placeholder="Selecciona una subcategoría (opcional)"
                createLabel="Crear subcategoría"
                allowNone
              />
            </div>
          )}
        </>
      )}

      <Button className="w-full" onClick={onClose}>Listo</Button>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={(v) => !v && onClose()} shouldScaleBackground={false} repositionInputs={false}>
        <DrawerContent className="flex flex-col max-h-[92dvh]">
          <DrawerHeader className="text-left px-6 pt-4 pb-2 shrink-0">
            <DrawerTitle>Revisar movimiento</DrawerTitle>
          </DrawerHeader>
          <div ref={swipeDismiss} className="flex-1 overflow-y-auto px-6 pb-6" data-vaul-no-drag>
            {contenido}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md w-full">
        <DialogHeader>
          <DialogTitle>Revisar movimiento</DialogTitle>
          <DialogDescription>Los cambios se aplican al momento.</DialogDescription>
        </DialogHeader>
        {contenido}
      </DialogContent>
    </Dialog>
  );
}
