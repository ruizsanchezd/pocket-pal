import { useEffect, useMemo, useRef, useState } from 'react';
import { FileUp, Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { DrawerSelect } from '@/components/ui/drawer-select';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useCuentas } from '@/hooks/useStaticData';
import { useDatosImportador } from '@/hooks/useImportador';
import { FORMATOS_EXTRACTO, leerExtracto } from '@/lib/importador/leer-extracto';
import { cn } from '@/lib/utils';
import type { LineaExtracto } from '@/types/database';

const EXTENSIONES = ['.csv', '.xls', '.xlsx', '.pdf'];

/** El extracto ya leído, tal como viaja a la página de revisión al navegar. */
export interface ExtractoLeido {
  lineas: LineaExtracto[];
  cuentaId: string;
}

export const DESCRIPCION_PASO_ARCHIVO =
  'Imprime la página de movimientos en PDF o descarga el Excel. Lo que ya tengas apuntado no se duplica.';

interface PasoArchivoProps {
  /** Mientras está activo, se puede soltar el archivo en cualquier parte de la ventana. */
  activo: boolean;
  onLeido: (extracto: ExtractoLeido) => void;
}

/** Primer paso del importador: elegir la cuenta y soltar (o elegir) el extracto. */
export function PasoArchivo({ activo, onLeido }: PasoArchivoProps) {
  const isMobile = useIsMobile();
  const { profile } = useAuth();
  const { data: cuentas = [] } = useCuentas();
  const { data: datos, isLoading: cargandoDatos } = useDatosImportador();
  const inputRef = useRef<HTMLInputElement>(null);

  const [cuentaElegida, setCuentaElegida] = useState<string | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Por defecto, la cuenta de la que ya se han importado extractos.
  const cuentaPorDefecto = useMemo(() => {
    const veces = new Map<string, number>();
    for (const m of datos?.conocidos ?? []) {
      if (m.lineas_extracto) veces.set(m.cuenta_id, (veces.get(m.cuenta_id) ?? 0) + 1);
    }
    const masUsada = [...veces.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    return masUsada ?? profile?.cuenta_default_id ?? cuentas.find((c) => c.tipo === 'corriente')?.id ?? null;
  }, [datos, profile, cuentas]);
  const cuentaId = cuentaElegida ?? cuentaPorDefecto;
  const listo = !!cuentaId && !cargandoDatos && !leyendo;

  const handleArchivo = async (file: File | undefined) => {
    if (!file || !cuentaId || !listo) return;
    if (!EXTENSIONES.some((ext) => file.name.toLowerCase().endsWith(ext))) {
      setError('Ese archivo no es un extracto. Usa el PDF, el Excel o el CSV de CaixaBank.');
      return;
    }
    setError(null);
    setLeyendo(true);
    try {
      onLeido({ lineas: await leerExtracto(file), cuentaId });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLeyendo(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  // Soltar el archivo en cualquier parte de la ventana, no solo en la caja. Así además el
  // navegador no abre el PDF si se suelta fuera por error.
  const handleArchivoRef = useRef(handleArchivo);
  handleArchivoRef.current = handleArchivo;
  useEffect(() => {
    if (!activo) return;
    let dentro = 0;
    const esArchivo = (e: DragEvent) => e.dataTransfer?.types.includes('Files') ?? false;
    const enter = (e: DragEvent) => {
      if (!esArchivo(e)) return;
      dentro++;
      setArrastrando(true);
    };
    const leave = (e: DragEvent) => {
      if (!esArchivo(e)) return;
      dentro = Math.max(0, dentro - 1);
      if (dentro === 0) setArrastrando(false);
    };
    const over = (e: DragEvent) => {
      if (esArchivo(e)) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      if (!esArchivo(e)) return;
      e.preventDefault();
      dentro = 0;
      setArrastrando(false);
      handleArchivoRef.current(e.dataTransfer?.files[0]);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
      setArrastrando(false);
    };
  }, [activo]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Cuenta</Label>
        <DrawerSelect
          options={cuentas.map((c) => ({ value: c.id, label: c.nombre, color: c.color }))}
          value={cuentaId ?? ''}
          onValueChange={setCuentaElegida}
          placeholder="Elige la cuenta"
        />
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={FORMATOS_EXTRACTO}
        className="hidden"
        onChange={(e) => handleArchivo(e.target.files?.[0])}
      />
      <button
        type="button"
        disabled={!listo}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'w-full rounded-lg border-2 border-dashed px-4 py-10 flex flex-col items-center gap-3 text-center transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60',
          arrastrando ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/50'
        )}
      >
        <div className={cn('p-3 rounded-full', arrastrando ? 'bg-primary/10' : 'bg-muted')}>
          {leyendo || cargandoDatos ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : (
            <FileUp className={cn('h-6 w-6', arrastrando ? 'text-primary' : 'text-muted-foreground')} />
          )}
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">
            {leyendo
              ? 'Leyendo el extracto…'
              : arrastrando
                ? 'Suéltalo aquí'
                : isMobile
                  ? 'Toca para elegir el archivo'
                  : 'Arrastra aquí el extracto o haz clic para elegirlo'}
          </p>
          <p className="text-xs text-muted-foreground">PDF, Excel o CSV de CaixaBank</p>
        </div>
      </button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
