import { useState, type ReactNode } from 'react';
import { Ban, Check, Loader2, Plus, Undo2 } from 'lucide-react';
import { Command, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import type { Categoria } from '@/types/database';

/** Sin tildes ni mayúsculas: "cafe" encuentra "Café". */
const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function ChipCategoria({ categoria, className }: { categoria: Categoria | undefined; className?: string }) {
  if (!categoria) return null;
  return (
    <span
      className={cn('px-1.5 py-0.5 rounded text-xs font-medium', className)}
      style={{ backgroundColor: `${categoria.color}25`, color: categoria.color, filter: 'brightness(0.85)' }}
    >
      {categoria.nombre}
    </span>
  );
}

interface SelectorCategoriaProps {
  categorias: Categoria[];
  categoriaId: string | null;
  subcategoriaId: string | null;
  incluir: boolean;
  onElegir: (categoriaId: string, subcategoriaId: string | null) => void;
  onIncluir: (incluir: boolean) => void;
  onCrear: (nombre: string, padre: Categoria | null) => Promise<string | null>;
  /** El botón que abre el selector. */
  children: ReactNode;
}

/**
 * Categoría y subcategoría en un solo buscador: "super" encuentra Supermercado dentro de
 * Comida y deja las dos puestas. Si no existe, se crea desde aquí mismo.
 */
export function SelectorCategoria({
  categorias, categoriaId, subcategoriaId, incluir, onElegir, onIncluir, onCrear, children,
}: SelectorCategoriaProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [creando, setCreando] = useState(false);

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) setBusqueda('');
  };
  const elegir = (cat: string, sub: string | null) => {
    onElegir(cat, sub);
    handleOpenChange(false);
  };

  const principales = categorias.filter((c) => !c.parent_id);
  const actual = categorias.find((c) => c.id === categoriaId) ?? null;
  const nombre = busqueda.trim();
  const existe = (padre: Categoria | null) =>
    categorias.some((c) => (c.parent_id ?? null) === (padre?.id ?? null) && normalizar(c.nombre) === normalizar(nombre));

  const crear = async (padre: Categoria | null) => {
    setCreando(true);
    try {
      const id = await onCrear(nombre, padre);
      if (id) elegir(padre ? padre.id : id, padre ? id : null);
    } finally {
      setCreando(false);
    }
  };

  const contenido = (
    <Command
      loop
      filter={(_value, search, keywords) => (normalizar((keywords ?? []).join(' ')).includes(normalizar(search)) ? 1 : 0)}
      className={cn(isMobile && 'flex-1 min-h-0')}
    >
      <CommandInput
        value={busqueda}
        onValueChange={setBusqueda}
        placeholder="Buscar o crear categoría…"
        autoFocus={!isMobile}
        className={cn(isMobile && 'text-base')}
      />
      <CommandList className={cn(isMobile ? 'max-h-none flex-1 overflow-y-auto pb-6' : 'max-h-[320px]')}>
        <CommandGroup>
          {principales.map((cat) => [
            <CommandItem
              key={cat.id}
              value={cat.id}
              keywords={[cat.nombre]}
              onSelect={() => elegir(cat.id, null)}
              className="py-2.5 sm:py-1.5"
            >
              <Check className={cn('mr-2 h-4 w-4 shrink-0', categoriaId === cat.id && !subcategoriaId ? 'opacity-100' : 'opacity-0')} />
              <ChipCategoria categoria={cat} />
            </CommandItem>,
            ...categorias
              .filter((sub) => sub.parent_id === cat.id)
              .map((sub) => (
                <CommandItem
                  key={sub.id}
                  value={sub.id}
                  keywords={[sub.nombre, cat.nombre]}
                  onSelect={() => elegir(cat.id, sub.id)}
                  className="py-2.5 sm:py-1.5 pl-8"
                >
                  <Check className={cn('mr-2 h-4 w-4 shrink-0', subcategoriaId === sub.id ? 'opacity-100' : 'opacity-0')} />
                  <ChipCategoria categoria={sub} />
                  <span className="ml-2 text-xs text-muted-foreground truncate">{cat.nombre}</span>
                </CommandItem>
              )),
          ])}
        </CommandGroup>

        {nombre.length >= 2 && (
          <CommandGroup forceMount>
            {!existe(null) && (
              <CommandItem forceMount value="__crear" disabled={creando} onSelect={() => crear(null)} className="py-2.5 sm:py-1.5 text-primary">
                {creando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Crear la categoría «{nombre}»
              </CommandItem>
            )}
            {actual && !existe(actual) && (
              <CommandItem forceMount value="__crear_sub" disabled={creando} onSelect={() => crear(actual)} className="py-2.5 sm:py-1.5 text-primary">
                {creando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Crear «{nombre}» dentro de {actual.nombre}
              </CommandItem>
            )}
          </CommandGroup>
        )}

        <CommandSeparator alwaysRender />
        <CommandGroup forceMount>
          <CommandItem
            forceMount
            value="__incluir"
            onSelect={() => {
              onIncluir(!incluir);
              handleOpenChange(false);
            }}
            className="py-2.5 sm:py-1.5 text-muted-foreground"
          >
            {incluir ? <Ban className="mr-2 h-4 w-4" /> : <Undo2 className="mr-2 h-4 w-4" />}
            {incluir ? 'No importar este movimiento' : 'Volver a importarlo'}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange} shouldScaleBackground={false} repositionInputs={false}>
        <DrawerTrigger asChild>{children}</DrawerTrigger>
        <DrawerContent className="h-[85dvh]">
          <DrawerHeader className="text-left px-4 pt-4 pb-0">
            <DrawerTitle>Categoría</DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 min-h-0 flex flex-col px-2" data-vaul-no-drag>
            {contenido}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="p-0 w-80" align="start">
        {contenido}
      </PopoverContent>
    </Popover>
  );
}
