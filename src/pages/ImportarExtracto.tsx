import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { FileUp, Loader2, Plane, Upload } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { MobileSubpageHeader } from '@/components/configuracion/MobileSubpageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DrawerSelect } from '@/components/ui/drawer-select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { FilaRevision, Semaforo } from '@/components/importador/FilaRevision';
import { EditorFila } from '@/components/importador/EditorFila';
import { DialogoViaje } from '@/components/importador/DialogoViaje';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useCategorias, useCuentas } from '@/hooks/useStaticData';
import { crearCategoria, deshacerImportacion, guardarImportacion, useDatosImportador, type EstadoNueva } from '@/hooks/useImportador';
import { ToastAction } from '@/components/ui/toast';
import { parsearExtractoCaixaBank } from '@/lib/importador/extracto-caixabank';
import { filasDelViaje, idCategoriaViajes, planificarImportacion, type FilaImportacion } from '@/lib/importador/planificar';
import type { Categoria, LineaExtracto } from '@/types/database';

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

export default function ImportarExtracto() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: cuentas = [] } = useCuentas();
  const { data: categorias = [] } = useCategorias();
  const { data: datos, isLoading: cargandoDatos } = useDatosImportador();
  const currency = profile?.divisa_principal || 'EUR';
  const inputRef = useRef<HTMLInputElement>(null);

  const [cuentaElegida, setCuentaElegida] = useState<string | null>(null);
  const [lineas, setLineas] = useState<LineaExtracto[] | null>(null);
  const [filas, setFilas] = useState<FilaImportacion[] | null>(null);
  const [estados, setEstados] = useState<Record<number, EstadoNueva>>({});
  const [editando, setEditando] = useState<number | null>(null);
  const [soloPorRevisar, setSoloPorRevisar] = useState(false);
  const [viajeOpen, setViajeOpen] = useState(false);
  const [guardando, setGuardando] = useState(false);

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

  const viajes = useMemo(() => {
    const id = idCategoriaViajes(categorias);
    return categorias.find((c) => c.id === id) ?? null;
  }, [categorias]);

  const planificar = (lineasExtracto: LineaExtracto[], cuenta: string) => {
    if (!datos) return;
    const plan = planificarImportacion({
      lineas: lineasExtracto,
      cuentaId: cuenta,
      conocidos: datos.conocidos,
      categorias,
      plantillas: datos.plantillas,
    });
    setFilas(plan);
    setEstados(estadosIniciales(plan));
  };

  const handleArchivo = async (file: File | undefined) => {
    if (!file || !cuentaId) return;
    try {
      const leidas = parsearExtractoCaixaBank(await file.text());
      setLineas(leidas);
      planificar(leidas, cuentaId);
    } catch (e) {
      toast({ variant: 'destructive', title: 'No se pudo leer el extracto', description: (e as Error).message });
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleCuenta = (id: string) => {
    setCuentaElegida(id);
    if (lineas) planificar(lineas, id);
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

  const handleCrearCategoria = async (nombre: string, padre: Categoria | null) => {
    if (!user) return null;
    const editada = editando !== null ? filas?.find((f) => f.pos === editando) : null;
    const creada = await crearCategoria(user.id, nombre, padre, editada && editada.linea.importe > 0 ? 'ingreso' : 'gasto');
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

  const handleImportar = async () => {
    if (!user || !cuentaId || !filas) return;
    setGuardando(true);
    try {
      const { creados, enlazados, errores } = await guardarImportacion(user.id, cuentaId, filas, estados);
      await queryClient.invalidateQueries();
      const deshacer = async () => {
        if (await deshacerImportacion(creados, enlazados)) {
          // La lista de Movimientos guarda su propio estado: se recarga para verlo.
          window.location.reload();
        } else {
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
      navigate('/movimientos');
    } catch (e) {
      if (import.meta.env.DEV) console.error('Error importando extracto:', e);
      toast({ variant: 'destructive', title: 'No se pudo importar', description: 'No se ha guardado nada. Inténtalo de nuevo.' });
    } finally {
      setGuardando(false);
    }
  };

  const filaEditando = editando !== null ? nuevas.find((f) => f.pos === editando) ?? null : null;
  const nadaQueHacer = !!filas && resumen.importar === 0 && resumen.apuntadas === 0;
  const puedeImportar = !!filas && !nadaQueHacer && resumen.sinCategoria === 0 && !guardando;
  const textoBoton = resumen.importar
    ? `Importar ${resumen.importar} movimiento${resumen.importar === 1 ? '' : 's'}`
    : `Enlazar ${resumen.apuntadas} que ya tenías`;

  const botonImportar = (
    <div className="space-y-1">
      <Button className="w-full h-12 text-base md:h-10 md:text-sm" disabled={!puedeImportar} onClick={handleImportar}>
        {guardando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
        {textoBoton}
      </Button>
      <p className="text-xs text-center text-muted-foreground">
        {resumen.sinCategoria
          ? `Faltan ${resumen.sinCategoria} por categorizar`
          : resumen.apuntadas && resumen.importar
            ? `Y se enlazarán ${resumen.apuntadas} que ya tenías`
            : ' '}
      </p>
    </div>
  );

  return (
    <ProtectedRoute>
      <MainLayout>
        <div className="space-y-4 md:space-y-6 pb-32 md:pb-0">
          <MobileSubpageHeader title="Importar extracto" backHref="/movimientos" />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-muted"><FileUp className="h-4 w-4 text-muted-foreground" /></div>
                Extracto del banco
              </CardTitle>
              <CardDescription>
                De momento, el CSV de movimientos de CaixaBank. Lo que ya tengas apuntado no se duplica.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Cuenta</Label>
                <DrawerSelect
                  options={cuentas.map((c) => ({ value: c.id, label: c.nombre, color: c.color }))}
                  value={cuentaId ?? ''}
                  onValueChange={handleCuenta}
                  placeholder="Elige la cuenta"
                />
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => handleArchivo(e.target.files?.[0])}
              />
              <Button
                variant={filas ? 'outline' : 'default'}
                className="w-full"
                disabled={!cuentaId || cargandoDatos}
                onClick={() => inputRef.current?.click()}
              >
                {cargandoDatos ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
                {filas ? 'Elegir otro archivo' : 'Elegir archivo CSV'}
              </Button>
            </CardContent>
          </Card>

          {filas && (
            <Card>
              <CardHeader className="pb-3 space-y-3">
                <CardTitle className="text-base">
                  {nadaQueHacer ? 'Nada nuevo' : 'Revisa antes de importar'}
                </CardTitle>
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
              </CardHeader>
              {!nadaQueHacer && (
                <CardContent className="px-0 pb-2">
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
                            onClick={f.tipo === 'nueva' ? () => setEditando(f.pos) : undefined}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="hidden md:block px-6 pt-4">{botonImportar}</div>
                </CardContent>
              )}
            </Card>
          )}
        </div>

        {filas && !nadaQueHacer && (
          <div
            className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-background border-t px-4 pt-3"
            style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
          >
            {botonImportar}
          </div>
        )}

        <EditorFila
          fila={filaEditando}
          estado={editando !== null ? estados[editando] ?? null : null}
          categorias={categorias}
          currency={currency}
          onChange={(cambios) => editando !== null && cambiar(editando, cambios)}
          onCrearCategoria={handleCrearCategoria}
          onClose={() => setEditando(null)}
        />

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
            onCrearCategoria={handleCrearCategoria}
          />
        )}
      </MainLayout>
    </ProtectedRoute>
  );
}
