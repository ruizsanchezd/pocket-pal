import type { PostgrestError } from '@supabase/supabase-js';

/**
 * Tamaño de página. Coincide con el `max_rows` por defecto de la API de Supabase: PostgREST
 * corta cada respuesta en ese número de filas **sin devolver error**, así que una query que
 * suma o exporta "todos los movimientos" da un resultado incompleto en cuanto hay más.
 */
export const PAGE_SIZE = 1000;

type PageResult<T> = PromiseLike<{ data: T[] | null; error: PostgrestError | null }>;

/**
 * Trae todas las filas de una query paginando con `.range()`.
 *
 * `buildQuery` recibe el rango y debe devolver la query completa, **con un `.order()` que
 * sea total** (acabar en `id` o en una columna única): sin orden estable, PostgREST puede
 * devolver filas repetidas o saltarse filas entre páginas.
 *
 * Lanza el error de Supabase en vez de devolver datos parciales.
 */
export async function fetchAll<T>(buildQuery: (from: number, to: number) => PageResult<T>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}
