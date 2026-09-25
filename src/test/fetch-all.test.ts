import { describe, it, expect, vi } from 'vitest';
import { fetchAll, PAGE_SIZE } from '@/lib/fetch-all';

/** Simula PostgREST: devuelve como mucho PAGE_SIZE filas del rango pedido. */
function fakeTable(total: number) {
  const rows = Array.from({ length: total }, (_, i) => ({ id: i }));
  return vi.fn(async (from: number, to: number) => ({
    data: rows.slice(from, Math.min(to + 1, from + PAGE_SIZE)),
    error: null,
  }));
}

describe('fetchAll', () => {
  it('trae todas las filas cuando hay más de una página', async () => {
    const query = fakeTable(2500);
    const rows = await fetchAll(query);
    expect(rows).toHaveLength(2500);
    expect(rows[2499]).toEqual({ id: 2499 });
    expect(query).toHaveBeenCalledTimes(3);
    expect(query).toHaveBeenNthCalledWith(2, 1000, 1999);
  });

  it('con menos de una página hace una sola petición', async () => {
    const query = fakeTable(10);
    expect(await fetchAll(query)).toHaveLength(10);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('con exactamente una página pide la siguiente para confirmar que no hay más', async () => {
    const query = fakeTable(PAGE_SIZE);
    expect(await fetchAll(query)).toHaveLength(PAGE_SIZE);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('lanza el error en vez de devolver datos parciales', async () => {
    const error = { message: 'boom', details: '', hint: '', code: '500' };
    const query = vi
      .fn()
      .mockResolvedValueOnce({ data: Array.from({ length: PAGE_SIZE }, (_, i) => ({ id: i })), error: null })
      .mockResolvedValueOnce({ data: null, error });
    await expect(fetchAll(query)).rejects.toBe(error);
  });
});
