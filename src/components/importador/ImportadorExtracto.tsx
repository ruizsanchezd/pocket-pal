import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, Plane, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ToastAction } from '@/components/ui/toast';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { useCategorias, useCuentas } from '@/hooks/useStaticData';
import { crearCategoria, deshacerImportacion, guardarImportacion, useDatosImportador, type EstadoNueva } from '@/hooks/useImportador';
import { filasDelViaje, idCategoriaViajes, planificarImportacion, type FilaImportacion } from '@/lib/importador/planificar';
import { cn } from '@/lib/utils';
import type { Categoria } from '@/types/database';
import { DESCRIPCION_PASO_ARCHIVO, PasoArchivo, type ExtractoLeido } from './PasoArchivo';
import { FilaRevision, Semaforo } from './FilaRevision';
import { DialogoViaje } from './DialogoViaje';

type FilaNueva = FilaImportacion & { tipo: 'nueva' };

function estadosIniciales(filas: FilaImportacion[]): Record<number, EstadoNueva> {
  const estados: Record<number, EstadoNueva> = {};
  for (const f of filas) {
    if (f.tipo !== 'nueva') continue;
    const { concepto, fecha, categoria_id, subcategoria_id, recurrente_template_id, nivel, motivo, sigueA } = f.propuesta;
    estados[f.pos] = { incluir: true, concepto, fecha, categoria_id, subcategoria_id, recurrente_template_id, nivel, motivo, sigueA, tocado: false };
  }
  return estados;
}

interface ImportadorExtractoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Tras importar o deshacer, para que la lista de movimientos se refresque. */
  onCambios: () => void;
}

/**
 * Importar un extracto en una sola ventana: primero el archivo, luego la revisión, que se
 * corrige ahí mismo (concepto y categoría) antes de importar.
 */
export function ImportadorExtracto({ open, onOpenChange, onCambios }: ImportadorExtractoProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { data: cuentas = [] } = useCuentas();
  const { data: categorias = [] } = useCategorias();
  const { data: datos } = useDatosImportador();
  const currency = profile?.divisa_principal || 'EUR';

  const [extracto, setExtracto] = useState<ExtractoLeido | null>(null);
  const [filas, setFilas] = useState<FilaImportacion[] | null>(null);
  const [estados, setEstados] = useState<Record<number, EstadoNueva>>({});
  const [soloPorRevisar, setSoloPorRevisar] = useState(false);
  const [viajeOpen, setViajeOpen] = useState(false);
  const [guardando, setGuardando] = useState(false);
  /** Qué hacer si se confirma descartar lo revisado (cerrar o elegir otro extracto). */
  const [descartar, setDescartar] = useState<(() => void) | null>(null);

  // Cada vez que se abre, se empieza de cero.
  useEffect(() => {
    if (!open) return;
    setExtracto(null);
    setFilas(null);
    setEstados({});
    setSoloPorRevisar(false);
  }, [open]);

  const viajes = useMemo(() => {
    const id = idCategoriaViajes(categorias);
    return categorias.find((c) => c.id === id) ?? null;
  }, [categorias]);

  // El paso del archivo no deja elegir nada hasta que `datos` ha cargado.
  const handleLeido = (leido: ExtractoLeido) => {
    if (!datos) return;
    const plan = planificarImportacion({
      lineas: leido.lineas,
      cuentaId: leido.cuentaId,
      conocidos: datos.conocidos,
      categorias,
      plantillas: datos.plantillas,
    });
    setExtracto(leido);
    setFilas(plan);
    setEstados(estadosIniciales(plan));
    setSoloPorRevisar(false);
  };

  /** Aplica cambios a una fila. Los Bizum que la siguen copian su categoría si no se han tocado. */
  const cambiar = (pos: number, cambios: Partial<EstadoNueva>) => {
    setEstados((prev) => {
      const next = { ...prev, [pos]: { ...prev[pos], ...cambios, tocado: true } };
      if ('categoria_id' in cambios || 'subcategoria_id' in cambios) {
        for (const [p, e] of Object.entries(next)) {
          if (e.sigueA === pos && !e.tocado) {
            next[Number(p)] = {
              ...e,
              categoria_id: next[pos].categoria_id,
              subcategoria_id: next[pos].subcategoria_id,
              nivel: next[pos].categoria_id ? 'amarillo' : 'rojo',
              motivo: `¿Te devuelven parte de «${next[pos].concepto}»? Copia su categoría.`,
            };
          }
        }
      }
      return next;
    });
  };

  const handleCrearCategoria = (pos: number | null) => async (nombre: string, padre: Categoria | null) => {
    if (!user) return null;
    const fila = pos !== null ? filas?.find((f) => f.pos === pos) : null;
    const creada = await crearCategoria(user.id, nombre, padre, fila && fila.linea.importe > 0 ? 'ingreso' : 'gasto');
    if (!creada) return null;
    queryClient.setQueryData<Categoria[]>(['categorias', user.id], (old) => (old ? [...old, creada] : [creada]));
    return creada.id;
  };

  const nuevas = useMemo(() => (filas ?? []).filter((f): f is FilaNueva => f.tipo === 'nueva'), [filas]);
  const candidatasViaje = (desde: string, hasta: string) =>
    filasDelViaje(
      nuevas
        .filter((f) => estados[f.pos]?.incluir)
        .map((f) => ({ pos: f.pos, linea: f.linea, ...estados[f.pos] })),
      desde,
      hasta,
      categorias
    );

  const aplicarViaje = (desde: string, hasta: string, subcategoriaId: string) => {
    if (!viajes) return;
    const posiciones = candidatasViaje(desde, hasta);
    const nombre = categorias.find((c) => c.id === subcategoriaId)?.nombre ?? 'viaje';
    setEstados((prev) => {
      const next = { ...prev };
      for (const pos of posiciones) {
        next[pos] = { ...next[pos], categoria_id: viajes.id, subcategoria_id: subcategoriaId, tocado: true, motivo: `Viaje: ${nombre}` };
      }
      return next;
    });
    toast({ title: `${posiciones.length} movimientos pasados a ${nombre}` });
  };

  const resumen = useMemo(() => {
    const incluidas = nuevas.filter((f) => estados[f.pos]?.incluir);
    return {
      importar: incluidas.length,
      verdes: incluidas.filter((f) => estados[f.pos].nivel === 'verde' && !estados[f.pos].tocado).length,
      porRevisar: incluidas.filter((f) => estados[f.pos].nivel !== 'verde' && !estados[f.pos].tocado && estados[f.pos].categoria_id).length,
      sinCategoria: incluidas.filter((f) => !estados[f.pos].categoria_id).length,
      apuntadas: (filas ?? []).filter((f) => f.tipo === 'apuntada').length,
      anuladas: (filas ?? []).filter((f) => f.tipo === 'anulada').length,
      anteriores: (filas ?? []).filter((f) => f.tipo === 'anterior').length,
    };
  }, [nuevas, estados, filas]);

  const visibles = useMemo(() => {
    const lista = (filas ?? []).filter((f) => f.tipo !== 'anterior');
    if (!soloPorRevisar) return lista;
    return lista.filter((f) => {
      const e = f.tipo === 'nueva' ? estados[f.pos] : null;
      return !!e && e.incluir && (!e.categoria_id || (e.nivel !== 'verde' && !e.tocado));
    });
  }, [filas, estados, soloPorRevisar]);

  // Agrupadas por día, en el orden del extracto.
  const porDia = useMemo(() => {
    const grupos: { fecha: string; filas: FilaImportacion[] }[] = [];
    for (const f of visibles) {
      const ultimo = grupos[grupos.length - 1];
      if (ultimo?.fecha === f.linea.fecha) ultimo.filas.push(f);
      else grupos.push({ fecha: f.linea.fecha, filas: [f] });
    }
    return grupos;
  }, [visibles]);

  const rangoNuevas = useMemo(() => {
    const fechas = nuevas.map((f) => f.linea.fecha).sort();
    return { desde: fechas[0] ?? '', hasta: fechas[fechas.length - 1] ?? '' };
  }, [nuevas]);

  const cuenta = cuentas.find((c) => c.id === extracto?.cuentaId) ?? null;
  const descripcionExtracto = useMemo(() => {
    const fechas = (extracto?.lineas ?? []).map((l) => l.fecha).sort();
    if (!fechas.length) return 'Sin movimientos';
    const dia = (f: string) => format(parseISO(f), 'd MMM', { locale: es });
    const n = fechas.length;
    const rango = fechas[0] === fechas[n - 1] ? `del ${dia(fechas[0])}` : `del ${dia(fechas[0])} al ${dia(fechas[n - 1])}`;
    return `${n} línea${n === 1 ? '' : 's'} ${rango}`;
  }, [extracto]);

  const hayCambios = Object.values(estados).some((e) => e.tocado);
  /** Cerrar o cambiar de extracto pide confirmación si se ha corregido algo. */
  const siNoSePierdeNada = (accion: () => void) => (hayCambios ? setDescartar(() => accion) : accion());
  const cerrar = () => siNoSePierdeNada(() => onOpenChange(false));
  const handleOpenChange = (v: boolean) => (v ? onOpenChange(true) : cerrar());
  const otroExtracto = () =>
    siNoSePierdeNada(() => {
      setExtracto(null);
      setFilas(null);
      setEstados({});
    });

  const handleImportar = async () => {
    if (!user || !extracto || !filas) return;
    setGuardando(true);
    try {
      const { creados, enlazados, errores } = await guardarImportacion(user.id, extracto.cuentaId, filas, estados);
      await queryClient.invalidateQueries();
      onCambios();
      const deshacer = async () => {
        const ok = await deshacerImportacion(creados, enlazados);
        await queryClient.invalidateQueries();
        onCambios();
        if (!ok) {
          toast({ variant: 'destructive', title: 'No se pudo deshacer del todo', description: 'Revisa los movimientos de estas fechas.' });
        }
      };
      toast({
        variant: errores ? 'destructive' : 'default',
        title: `Importados ${creados.length} movimientos`,
        description: errores
          ? `No se pudieron enlazar ${errores} que ya tenías. Los nuevos sí se han guardado.`
          : enlazados.length ? `${enlazados.length} ya los tenías y se han enlazado con el banco.` : undefined,
        // Margen para echar un vistazo a la lista antes de decidir.
        duration: 30000,
        action: <ToastAction altText="Deshacer la importación" onClick={deshacer}>Deshacer</ToastAction>,
      });
      onOpenChange(false);
    } catch (e) {
      if (import.meta.env.DEV) console.error('Error importando extracto:', e);
      toast({ variant: 'destructive', title: 'No se pudo importar', description: 'No se ha guardado nada. Inténtalo de nuevo.' });
    } finally {
      setGuardando(false);
    }
  };

  const nadaQueHacer = !!filas && resumen.importar === 0 && resumen.apuntadas === 0;
  const puedeImportar = !!filas && !nadaQueHacer && resumen.sinCategoria === 0 && !guardando;
  const textoBoton = resumen.importar
    ? `Importar ${resumen.importar} movimiento${resumen.importar === 1 ? '' : 's'}`
    : `Enlazar ${resumen.apuntadas} que ya tenías`;

  const enRevision = !!filas;
  const conLista = enRevision && !nadaQueHacer;
  const titulo = enRevision ? (nadaQueHacer ? 'Nada nuevo' : 'Revisa antes de importar') : 'Importar extracto';
  const subtitulo: ReactNode = enRevision ? (
    <span className="flex flex-wrap items-center gap-x-2">
      <span>{cuenta?.nombre} · {descripcionExtracto}</span>
      <button type="button" className="text-primary hover:underline" onClick={otroExtracto}>Otro extracto</button>
    </span>
  ) : DESCRIPCION_PASO_ARCHIVO;

  const revision = filas && (
    <>
      <div className="space-y-3 px-4 md:px-6 pb-3 border-b">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {resumen.verdes > 0 && <span className="flex items-center gap-1.5"><Semaforo nivel="verde" tocado={false} /> {resumen.verdes} seguros</span>}
          {resumen.porRevisar > 0 && <span className="flex items-center gap-1.5"><Semaforo nivel="amarillo" tocado={false} /> {resumen.porRevisar} por revisar</span>}
          {resumen.sinCategoria > 0 && <span className="flex items-center gap-1.5"><Semaforo nivel="rojo" tocado={false} /> {resumen.sinCategoria} sin categoría</span>}
          {resumen.apuntadas > 0 && <span>{resumen.apuntadas} ya los tenías</span>}
          {resumen.anuladas > 0 && <span>{resumen.anuladas} se anulan</span>}
          {resumen.anteriores > 0 && <span>{resumen.anteriores} ya importados antes</span>}
        </div>
        {nadaQueHacer ? (
          <p className="text-sm text-muted-foreground">Todo lo de este extracto ya está en PocketPal.</p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Switch id="solo-revisar" checked={soloPorRevisar} onCheckedChange={setSoloPorRevisar} />
              <Label htmlFor="solo-revisar" className="text-sm font-normal">Solo lo que falta revisar</Label>
            </div>
            {viajes && nuevas.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setViajeOpen(true)}>
                <Plane className="mr-2 h-4 w-4" />
                Estuve de viaje
              </Button>
            )}
          </div>
        )}
      </div>

      {!nadaQueHacer && (
        <>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-2" data-vaul-no-drag>
            {porDia.length === 0 && (
              <p className="px-6 py-6 text-sm text-center text-muted-foreground">Todo revisado.</p>
            )}
            {porDia.map((grupo) => (
              <div key={grupo.fecha}>
                <p className="px-4 pt-3 pb-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {format(parseISO(grupo.fecha), "EEEE d 'de' MMMM", { locale: es })}
                </p>
                <div className="divide-y">
                  {grupo.filas.map((f) => (
                    <FilaRevision
                      key={f.pos}
                      fila={f}
                      estado={estados[f.pos]}
                      categorias={categorias}
                      currency={currency}
                      onCambiar={(cambios) => cambiar(f.pos, cambios)}
                      onCrearCategoria={handleCrearCategoria(f.pos)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div
            className="border-t px-4 md:px-6 pt-3 space-y-1"
            style={{ paddingBottom: isMobile ? 'max(0.75rem, env(safe-area-inset-bottom))' : '1rem' }}
          >
            <Button className="w-full h-12 text-base md:h-10 md:text-sm" disabled={!puedeImportar} onClick={handleImportar}>
              {guardando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {textoBoton}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              {resumen.sinCategoria
                ? `Faltan ${resumen.sinCategoria} por categorizar`
                : resumen.apuntadas && resumen.importar
                  ? `Y se enlazarán ${resumen.apuntadas} que ya tenías`
                  : ' '}
            </p>
          </div>
        </>
      )}
    </>
  );

  const pasoArchivo = <PasoArchivo activo={open && !enRevision} onLeido={handleLeido} />;

  const extras = (
    <>
      {viajes && (
        <DialogoViaje
          open={viajeOpen}
          onOpenChange={setViajeOpen}
          viajes={viajes}
          categorias={categorias}
          desdeInicial={rangoNuevas.desde}
          hastaInicial={rangoNuevas.hasta}
          contar={(desde, hasta) => candidatasViaje(desde, hasta).length}
          onAplicar={aplicarViaje}
          onCrearCategoria={handleCrearCategoria(null)}
        />
      )}
      <AlertDialog open={!!descartar} onOpenChange={(v) => !v && setDescartar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar lo revisado?</AlertDialogTitle>
            <AlertDialogDescription>Las correcciones que has hecho en este extracto se perderán.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir revisando</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                descartar?.();
                setDescartar(null);
              }}
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  if (isMobile) {
    return (
      <>
        {/* Con correcciones hechas no se cierra deslizando: solo con la X, que pide confirmación. */}
        <Drawer open={open} onOpenChange={handleOpenChange} dismissible={!hayCambios} shouldScaleBackground={false} repositionInputs={false}>
          <DrawerContent className={cn('flex flex-col', conLista && 'h-[95dvh] max-h-[95dvh]')}>
            <DrawerHeader className="text-left px-4 pt-4 pb-3 flex items-start gap-3 space-y-0">
              <div className="flex-1 min-w-0 space-y-1">
                <DrawerTitle>{titulo}</DrawerTitle>
                <DrawerDescription asChild><div>{subtitulo}</div></DrawerDescription>
              </div>
              {enRevision && (
                <Button variant="ghost" size="icon" className="-mr-2 -mt-1 shrink-0" onClick={cerrar} aria-label="Cerrar">
                  <X className="h-5 w-5" />
                </Button>
              )}
            </DrawerHeader>
            {revision ?? <div className="px-6 pb-6">{pasoArchivo}</div>}
          </DrawerContent>
        </Drawer>
        {extras}
      </>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className={cn('w-full', enRevision ? cn('sm:max-w-2xl flex flex-col gap-0 p-0', conLista && 'h-[85vh]') : 'sm:max-w-md')}
          // Esc dentro de un concepto solo deshace lo escrito; no cierra la ventana.
          onEscapeKeyDown={(e) => (e.target as HTMLElement | null)?.tagName === 'INPUT' && e.preventDefault()}
        >
          <DialogHeader className={cn(enRevision && 'px-6 pt-6 pb-3')}>
            <DialogTitle>{titulo}</DialogTitle>
            <DialogDescription asChild><div>{subtitulo}</div></DialogDescription>
          </DialogHeader>
          {revision ?? pasoArchivo}
        </DialogContent>
      </Dialog>
      {extras}
    </>
  );
}
