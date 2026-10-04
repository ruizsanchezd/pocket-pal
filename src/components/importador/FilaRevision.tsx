import { useEffect, useRef, useState } from 'react';
import { Check, Link2, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';
import type { FilaImportacion, Nivel } from '@/lib/importador/planificar';
import type { EstadoNueva } from '@/hooks/useImportador';
import type { Categoria } from '@/types/database';
import { ChipCategoria, SelectorCategoria } from './SelectorCategoria';

const COLOR_NIVEL: Record<Nivel, string> = {
  verde: 'bg-green-500',
  amarillo: 'bg-amber-400',
  rojo: 'bg-red-500',
};

export function Semaforo({ nivel, tocado }: { nivel: Nivel; tocado: boolean }) {
  if (tocado) return <Check className="h-3.5 w-3.5 text-primary shrink-0" aria-label="Revisado" />;
  return <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', COLOR_NIVEL[nivel])} aria-label={nivel} />;
}

/** El concepto se corrige ahí mismo: se guarda al salir del campo o con Enter; Esc lo deja como estaba. */
function ConceptoEditable({ valor, tachado, onCambiar }: { valor: string; tachado: boolean; onCambiar: (v: string) => void }) {
  const [borrador, setBorrador] = useState(valor);
  const cancelado = useRef(false);
  useEffect(() => setBorrador(valor), [valor]);

  return (
    <input
      value={borrador}
      aria-label="Concepto"
      onChange={(e) => setBorrador(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={() => {
        const nuevo = borrador.trim();
        if (cancelado.current || !nuevo) setBorrador(valor);
        else if (nuevo !== valor) onCambiar(nuevo);
        cancelado.current = false;
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          cancelado.current = true;
          e.currentTarget.blur();
        }
      }}
      className={cn(
        'w-full min-w-0 bg-transparent font-medium text-base md:text-sm truncate rounded px-1 -mx-1 py-0.5',
        'border border-transparent hover:border-input focus:border-ring focus:outline-none focus:bg-background',
        tachado && 'line-through text-muted-foreground'
      )}
    />
  );
}

interface FilaRevisionProps {
  fila: FilaImportacion;
  estado?: EstadoNueva;
  categorias: Categoria[];
  currency: string;
  onCambiar?: (cambios: Partial<EstadoNueva>) => void;
  onCrearCategoria?: (nombre: string, padre: Categoria | null) => Promise<string | null>;
}

/** Una línea del extracto en la revisión: lo que dice el banco y lo que se hará con ella. */
export function FilaRevision({ fila, estado, categorias, currency, onCambiar, onCrearCategoria }: FilaRevisionProps) {
  const importe = (
    <span className={cn(
      'font-semibold text-sm shrink-0 tabular-nums',
      fila.linea.importe > 0 ? 'text-green-600' : 'text-destructive',
      fila.tipo === 'anulada' && 'line-through text-muted-foreground'
    )}>
      {formatCurrency(fila.linea.importe, currency, true)}
    </span>
  );
  const banco = (
    <p className="text-xs text-muted-foreground truncate">
      {fila.linea.concepto}{fila.linea.mas_datos && fila.linea.mas_datos !== 'BIZUM' ? ` · ${fila.linea.mas_datos}` : ''}
    </p>
  );

  if (fila.tipo === 'apuntada') {
    return (
      <div className="flex items-start gap-3 px-4 py-3 opacity-70">
        <Link2 className="h-3.5 w-3.5 mt-1 text-muted-foreground shrink-0" aria-label="Ya en PocketPal" />
        <div className="flex-1 min-w-0">
          <p className="text-sm truncate">
            <span className="text-muted-foreground">Ya lo tienes:</span> {fila.movimiento.concepto}
          </p>
          {banco}
          {fila.aviso && <p className="text-xs text-amber-600 mt-1">{fila.aviso} Lo corriges tú.</p>}
        </div>
        {importe}
      </div>
    );
  }

  if (fila.tipo === 'anulada') {
    return (
      <div className="flex items-start gap-3 px-4 py-3 opacity-60">
        <Ban className="h-3.5 w-3.5 mt-1 text-muted-foreground shrink-0" aria-label="Se anula" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-muted-foreground">
            {fila.linea.importe > 0 ? 'Devolución' : 'Retención'} que se anula: no se importa
          </p>
          {banco}
        </div>
        {importe}
      </div>
    );
  }

  if (fila.tipo !== 'nueva' || !estado || !onCambiar || !onCrearCategoria) return null;
  const categoria = categorias.find((c) => c.id === estado.categoria_id);
  const subcategoria = categorias.find((c) => c.id === estado.subcategoria_id);
  const porRevisar = !estado.tocado && estado.nivel !== 'verde';

  return (
    <div className={cn('flex items-start gap-3 px-4 py-3', !estado.incluir && 'opacity-60')}>
      <span className="mt-2 flex w-3.5 justify-center">
        <Semaforo nivel={estado.nivel} tocado={estado.tocado} />
      </span>
      <div className="flex-1 min-w-0">
        <ConceptoEditable valor={estado.concepto} tachado={!estado.incluir} onCambiar={(concepto) => onCambiar({ concepto })} />
        {banco}
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <SelectorCategoria
            categorias={categorias}
            categoriaId={estado.categoria_id}
            subcategoriaId={estado.subcategoria_id}
            incluir={estado.incluir}
            onElegir={(categoria_id, subcategoria_id) => onCambiar({ categoria_id, subcategoria_id, incluir: true })}
            onIncluir={(incluir) => onCambiar({ incluir })}
            onCrear={onCrearCategoria}
          >
            <button
              type="button"
              className={cn(
                'flex items-center gap-1 rounded-md -mx-1 px-1 py-0.5 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                !estado.incluir || !categoria ? 'text-xs' : ''
              )}
            >
              {!estado.incluir ? (
                <span className="text-muted-foreground">No se importará</span>
              ) : categoria ? (
                <>
                  <ChipCategoria categoria={categoria} />
                  <ChipCategoria categoria={subcategoria} />
                </>
              ) : (
                <span className="font-medium text-red-600">Elegir categoría</span>
              )}
            </button>
          </SelectorCategoria>
          {estado.incluir && estado.recurrente_template_id && <span className="text-xs text-muted-foreground">· Recurrente</span>}
          {estado.incluir && estado.fecha !== fila.linea.fecha && (
            <span className="text-xs text-muted-foreground">· Se apunta el {formatearDia(estado.fecha)}</span>
          )}
        </div>
        {porRevisar && estado.incluir && <p className="text-xs text-muted-foreground mt-1">{estado.motivo}</p>}
      </div>
      <span className="mt-0.5">{importe}</span>
    </div>
  );
}

function formatearDia(fecha: string): string {
  const [, m, d] = fecha.split('-');
  return `${Number(d)}/${Number(m)}`;
}
