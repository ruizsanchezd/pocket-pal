import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CreatableSelect } from '@/components/ui/creatable-select';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import type { Categoria } from '@/types/database';

interface DialogoViajeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viajes: Categoria;
  categorias: Categoria[];
  /** Fechas del extracto, para proponer el rango. */
  desdeInicial: string;
  hastaInicial: string;
  /** Cuántas filas pasarían al viaje con este rango (para enseñarlo antes de aplicar). */
  contar: (desde: string, hasta: string) => number;
  onAplicar: (desde: string, hasta: string, subcategoriaId: string) => void;
  onCrearCategoria: (nombre: string, padre: Categoria | null) => Promise<string | null>;
}

/**
 * "Estos días estuve de viaje": pasa a una subcategoría de Viajes todo lo nuevo de esas
 * fechas, salvo recurrentes y tabaco. El nombre del comercio no dice si era un viaje; las
 * fechas sí.
 */
export function DialogoViaje({
  open, onOpenChange, viajes, categorias, desdeInicial, hastaInicial, contar, onAplicar, onCrearCategoria,
}: DialogoViajeProps) {
  const isMobile = useIsMobile();
  const [desde, setDesde] = useState(desdeInicial);
  const [hasta, setHasta] = useState(hastaInicial);
  const [viaje, setViaje] = useState('');

  useEffect(() => {
    if (open) {
      setDesde(desdeInicial);
      setHasta(hastaInicial);
    }
  }, [open, desdeInicial, hastaInicial]);

  const opciones = categorias
    .filter((c) => c.parent_id === viajes.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((c) => ({ value: c.id, label: c.nombre, color: c.color }));
  const valido = !!viaje && !!desde && !!hasta && desde <= hasta;
  const cuantas = valido ? contar(desde, hasta) : 0;

  const contenido = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="viaje-desde">Desde</Label>
          <Input id="viaje-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="viaje-hasta">Hasta</Label>
          <Input id="viaje-hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Viaje</Label>
        <CreatableSelect
          options={opciones}
          value={viaje}
          onValueChange={setViaje}
          onCreate={(nombre) => onCrearCategoria(nombre, viajes)}
          placeholder="Elige o crea el viaje"
          createLabel="Crear viaje"
        />
      </div>
      <p className="text-sm text-muted-foreground">
        {valido
          ? `Se pasarán ${cuantas} movimientos al viaje. El tabaco y los recurrentes se quedan como están.`
          : 'Elige las fechas y el viaje.'}
      </p>
      <Button
        className="w-full"
        disabled={!valido || cuantas === 0}
        onClick={() => {
          onAplicar(desde, hasta, viaje);
          onOpenChange(false);
        }}
      >
        Pasar al viaje
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false} repositionInputs={false}>
        <DrawerContent className="flex flex-col">
          <DrawerHeader className="text-left px-6 pt-4 pb-2">
            <DrawerTitle>Estuve de viaje</DrawerTitle>
          </DrawerHeader>
          <div className="px-6 pb-6">{contenido}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-full">
        <DialogHeader>
          <DialogTitle>Estuve de viaje</DialogTitle>
          <DialogDescription>Todo lo de esas fechas pasa al viaje.</DialogDescription>
        </DialogHeader>
        {contenido}
      </DialogContent>
    </Dialog>
  );
}
