import { useQuery } from '@tanstack/react-query';
import type { Json } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAll } from '@/lib/fetch-all';
import { randomCategoriaColor } from '@/lib/colors';
import { leerLineasExtracto, type FilaImportacion, type MovimientoConocido, type Nivel } from '@/lib/importador/planificar';
import type { Categoria, LineaExtracto } from '@/types/database';

/** Lo que el usuario decide sobre cada fila nueva en la revisión. */
export interface EstadoNueva {
  incluir: boolean;
  concepto: string;
  fecha: string;
  categoria_id: string | null;
  subcategoria_id: string | null;
  recurrente_template_id: string | null;
  nivel: Nivel;
  motivo: string;
  /** El usuario la ha tocado: ya no está "por revisar" y no copia la categoría de otra. */
  tocado: boolean;
  sigueA?: number;
}

/** Todo lo que el importador aprende y compara: los movimientos de todas las cuentas. */
export function useDatosImportador() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['importador', user?.id],
    queryFn: async () => {
      const [movimientos, plantillas] = await Promise.all([
        fetchAll<Omit<MovimientoConocido, 'lineas_extracto'> & { lineas_extracto: Json | null }>((from, to) =>
          supabase
            .from('movimientos')
            .select('id, fecha, concepto, cantidad, cuenta_id, categoria_id, subcategoria_id, recurrente_template_id, lineas_extracto')
            .eq('user_id', user!.id)
            .order('fecha')
            .order('id')
            .range(from, to)
        ),
        supabase.from('gastos_recurrentes').select('id').eq('user_id', user!.id),
      ]);
      if (plantillas.error) throw plantillas.error;
      const conocidos: MovimientoConocido[] = movimientos.map((m) => ({
        ...m,
        cantidad: Number(m.cantidad),
        lineas_extracto: leerLineasExtracto(m.lineas_extracto),
      }));
      return { conocidos, plantillas: new Set((plantillas.data ?? []).map((p) => p.id)) };
    },
    enabled: !!user,
    // Siempre fresco: lo que se acaba de importar cambia lo que es "nuevo".
    staleTime: 0,
    gcTime: 0,
  });
}

/**
 * Crea los movimientos nuevos y guarda la línea del banco en los que ya estaban.
 *
 * Los nuevos se insertan de una vez con `created_at` decreciente según su posición en el
 * extracto: la lista ordena por `fecha DESC, created_at DESC`, y así dentro de cada día sale
 * en el mismo orden que el banco (con `now()` todas tendrían el mismo instante).
 */
export async function guardarImportacion(
  userId: string,
  cuentaId: string,
  filas: FilaImportacion[],
  estados: Record<number, EstadoNueva>
): Promise<{ creados: string[]; enlazados: string[]; errores: number }> {
  const ahora = Date.now();
  const nuevos = filas.flatMap((f) => {
    const e = estados[f.pos];
    if (f.tipo !== 'nueva' || !e?.incluir || !e.categoria_id) return [];
    const lineas: LineaExtracto[] = [f.linea, ...f.lineasExtra];
    return [{
      user_id: userId,
      fecha: e.fecha,
      concepto: e.concepto.trim() || f.propuesta.concepto,
      cantidad: f.linea.importe,
      cuenta_id: cuentaId,
      categoria_id: e.categoria_id,
      subcategoria_id: e.subcategoria_id,
      mes_referencia: e.fecha.slice(0, 7),
      notas: null,
      es_recurrente: !!e.recurrente_template_id,
      recurrente_template_id: e.recurrente_template_id,
      lineas_extracto: lineas as unknown as Json,
      created_at: new Date(ahora - f.pos * 1000).toISOString(),
    }];
  });

  let creados: string[] = [];
  if (nuevos.length) {
    const { data, error } = await supabase.from('movimientos').insert(nuevos).select('id');
    if (error) throw error;
    creados = (data ?? []).map((m) => m.id);
  }

  const enlaces = filas.flatMap((f) => (f.tipo === 'apuntada' ? [f] : []));
  const resultados = await Promise.all(
    enlaces.map((f) =>
      supabase
        .from('movimientos')
        .update({ lineas_extracto: [f.linea] as unknown as Json })
        .eq('id', f.movimiento.id)
        .is('lineas_extracto', null)
        .select('id')
    )
  );
  const errores = resultados.filter((r) => r.error).length;
  const enlazados = resultados.flatMap((r) => (r.data ?? []).map((m) => m.id));
  if (errores && import.meta.env.DEV) {
    console.error('Error enlazando líneas del extracto:', resultados.map((r) => r.error).filter(Boolean));
  }

  return { creados, enlazados, errores };
}

/** Deshace una importación: borra lo creado y quita la línea del banco a lo enlazado. */
export async function deshacerImportacion(creados: string[], enlazados: string[]): Promise<boolean> {
  const [borrado, desenlazado] = await Promise.all([
    creados.length ? supabase.from('movimientos').delete().in('id', creados) : Promise.resolve({ error: null }),
    enlazados.length
      ? supabase.from('movimientos').update({ lineas_extracto: null }).in('id', enlazados)
      : Promise.resolve({ error: null }),
  ]);
  return !borrado.error && !desenlazado.error;
}

/** Crea una categoría o subcategoría desde la revisión (misma forma que en el formulario). */
export async function crearCategoria(
  userId: string,
  nombre: string,
  padre: Categoria | null,
  tipoSinPadre: Categoria['tipo']
): Promise<Categoria | null> {
  const { data, error } = await supabase
    .from('categorias')
    .insert({
      user_id: userId,
      nombre,
      parent_id: padre?.id ?? null,
      tipo: padre?.tipo ?? tipoSinPadre,
      color: randomCategoriaColor(),
      orden: 999,
    })
    .select()
    .single();
  if (error || !data) {
    if (import.meta.env.DEV) console.error('Error creando categoría:', error);
    return null;
  }
  return data as Categoria;
}
