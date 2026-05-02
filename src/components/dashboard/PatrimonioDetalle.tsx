import { useEffect, useRef, useState } from 'react';
import { format, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { useSwipeDownToDismiss } from '@/hooks/use-drawer-swipe-dismiss';

export interface CuentaDetalle {
  cuentaId: string;
  nombre: string;
  tipo: 'corriente' | 'inversion' | 'monedero';
  color: string | null;
  saldo: number;
  tipoSnapshot: 'manual' | 'auto' | 'live';
  orden: number;
}

interface PatrimonioDetalleProps {
  mesKey: string;
  patrimonio: number;
  detalle: CuentaDetalle[];
  currency: string;
  position: { x: number; y: number } | null;
  isMobile: boolean;
  onClose: () => void;
}

const TIPO_LABEL: Record<string, string> = {
  corriente: 'Corriente',
  inversion: 'Inversión',
  monedero: 'Monedero',
};

const TIPO_ORDER: Record<string, number> = {
  corriente: 0,
  inversion: 1,
  monedero: 2,
};

const SNAPSHOT_LABEL: Record<CuentaDetalle['tipoSnapshot'], string> = {
  manual: 'manual',
  auto: 'calculado',
  live: 'en vivo',
};

function DetalleContent({
  mesKey,
  patrimonio,
  detalle,
  currency,
}: Pick<PatrimonioDetalleProps, 'mesKey' | 'patrimonio' | 'detalle' | 'currency'>) {
  const mesLabel = format(parse(mesKey, 'yyyy-MM', new Date()), 'MMMM yyyy', { locale: es });
  const mesLabelCap = mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{mesLabelCap}</p>
        <p className="text-sm font-semibold">{formatCurrency(patrimonio, currency)}</p>
      </div>

      {detalle.length > 0 && (
        <>
          <div className="border-t" />
          <div className="space-y-2.5">
            {[...detalle]
              .sort((a, b) => {
                const ta = TIPO_ORDER[a.tipo] ?? 3;
                const tb = TIPO_ORDER[b.tipo] ?? 3;
                if (ta !== tb) return ta - tb;
                return a.orden - b.orden;
              })
              .map((cuenta) => {
                // Auto-snapshots with negative balance = missing/invalid data, show dash
                const sinDatos = cuenta.tipoSnapshot === 'auto' && cuenta.saldo < 0;
                return (
                  <div key={cuenta.cuentaId} className="flex items-center gap-2.5">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0 mt-0.5"
                      style={{ backgroundColor: cuenta.color ?? 'hsl(var(--muted-foreground))' }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-tight truncate">{cuenta.nombre}</p>
                      <p className="text-xs text-muted-foreground leading-tight">{TIPO_LABEL[cuenta.tipo]}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={cn('text-sm font-medium leading-tight', sinDatos && 'text-muted-foreground')}>
                        {sinDatos ? '—' : formatCurrency(cuenta.saldo, currency)}
                      </p>
                      <p className={cn(
                        'text-xs leading-tight',
                        cuenta.tipoSnapshot === 'live' ? 'text-primary/70' : 'text-muted-foreground'
                      )}>
                        {sinDatos ? 'sin datos' : SNAPSHOT_LABEL[cuenta.tipoSnapshot]}
                      </p>
                    </div>
                  </div>
                );
              })}
          </div>
        </>
      )}
    </div>
  );
}

export function PatrimonioDetalle({
  mesKey,
  patrimonio,
  detalle,
  currency,
  position,
  isMobile,
  onClose,
}: PatrimonioDetalleProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(true);
  const swipeDismiss = useSwipeDownToDismiss(() => setOpen(false));

  // After the Vaul close animation completes, unmount via parent.
  useEffect(() => {
    if (open) return;
    const t = window.setTimeout(onClose, 500);
    return () => window.clearTimeout(t);
  }, [open, onClose]);

  // Close on click outside (desktop)
  useEffect(() => {
    if (isMobile) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => document.addEventListener('mousedown', handleMouseDown), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [isMobile, onClose]);

  // Close on ESC (desktop)
  useEffect(() => {
    if (isMobile) return;
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMobile, onClose]);

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader className="pb-0">
            <DrawerTitle>Desglose de patrimonio</DrawerTitle>
          </DrawerHeader>
          <div ref={swipeDismiss} className="px-4 pb-8 pt-3 overflow-y-auto">
            <DetalleContent mesKey={mesKey} patrimonio={patrimonio} detalle={detalle} currency={currency} />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  if (!position) return null;

  // Smart positioning: avoid going off screen
  const panelWidth = 256;
  const approxHeight = 80 + detalle.length * 52;
  const offset = 14;

  let left = position.x + offset;
  if (left + panelWidth > window.innerWidth - 16) {
    left = position.x - panelWidth - offset;
  }

  let top = position.y - approxHeight / 2;
  top = Math.max(16, Math.min(top, window.innerHeight - approxHeight - 16));

  return (
    <div
      ref={panelRef}
      className="fixed z-50 rounded-lg border bg-background shadow-lg p-4"
      style={{ left, top, width: panelWidth }}
    >
      <DetalleContent mesKey={mesKey} patrimonio={patrimonio} detalle={detalle} currency={currency} />
    </div>
  );
}
