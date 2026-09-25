import { Check, Link2, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';
import type { FilaImportacion, Nivel } from '@/lib/importador/planificar';
import type { EstadoNueva } from '@/hooks/useImportador';
import type { Categoria } from '@/types/database';

const COLOR_NIVEL: Record<Nivel, string> = {
  verde: 'bg-green-500',
  amarillo: 'bg-amber-400',
  rojo: 'bg-red-500',
};

export function Semaforo({ nivel, tocado }: { nivel: Nivel; tocado: boolean }) {
  if (tocado) return <Check className="h-3.5 w-3.5 text-primary shrink-0" aria-label="Revisado" />;
  return <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', COLOR_NIVEL[nivel])} aria-label={nivel} />;
}

function Chip({ categoria }: { categoria: Categoria | undefined }) {
  if (!categoria) return null;
  return (
    <span
      className="px-1.5 py-0.5 rounded text-xs font-medium"
      style={{ backgroundColor: `${categoria.color}25`, color: categoria.color, filter: 'brightness(0.85)' }}
    >
      {categoria.nombre}
    </span>
  );
}

interface FilaRevisionProps {
  fila: FilaImportacion;
  estado?: EstadoNueva;
  categorias: Categoria[];
  currency: string;
  onClick?: () => void;
}

/** Una línea del extracto en la revisión: lo que dice el banco y lo que se hará con ella. */
export function FilaRevision({ fila, estado, categorias, currency, onClick }: FilaRevisionProps) {
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

  if (fila.tipo !== 'nueva' || !estado) return null;
  const categoria = categorias.find((c) => c.id === estado.categoria_id);
  const subcategoria = categorias.find((c) => c.id === estado.subcategoria_id);
  const porRevisar = !estado.tocado && estado.nivel !== 'verde';

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left flex items-start gap-3 px-4 py-3 active:bg-muted/40 hover:bg-muted/30 transition-colors',
        !estado.incluir && 'opacity-50'
      )}
    >
      <span className="mt-1.5 flex w-3.5 justify-center">
        <Semaforo nivel={estado.nivel} tocado={estado.tocado} />
      </span>
      <div className="flex-1 min-w-0">
        <p className={cn('font-medium text-sm truncate', !estado.incluir && 'line-through')}>{estado.concepto}</p>
        {banco}
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {!estado.incluir ? (
            <span className="text-xs text-muted-foreground">No se importará</span>
          ) : categoria ? (
            <>
              <Chip categoria={categoria} />
              <Chip categoria={subcategoria} />
              {estado.recurrente_template_id && <span className="text-xs text-muted-foreground">· Recurrente</span>}
              {estado.fecha !== fila.linea.fecha && (
                <span className="text-xs text-muted-foreground">· Se apunta el {formatearDia(estado.fecha)}</span>
              )}
            </>
          ) : (
            <span className="text-xs font-medium text-red-600">Sin categoría</span>
          )}
        </div>
        {porRevisar && estado.incluir && <p className="text-xs text-muted-foreground mt-1">{estado.motivo}</p>}
      </div>
      {importe}
    </button>
  );
}

function formatearDia(fecha: string): string {
  const [, m, d] = fecha.split('-');
  return `${Number(d)}/${Number(m)}`;
}
