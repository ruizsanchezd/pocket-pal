import { describe, it, expect } from 'vitest';
import { planificarRecurrentes, type PlantillaRecurrente } from '@/lib/recurrentes';

const USER = 'user-1';

function plantilla(overrides: Partial<PlantillaRecurrente> = {}): PlantillaRecurrente {
  return {
    id: 'tpl-netflix',
    concepto: 'Netflix',
    cantidad: -12.99,
    dia_del_mes: 5,
    cuenta_id: 'caixa',
    categoria_id: 'ocio',
    subcategoria_id: null,
    notas: null,
    is_transfer: false,
    destination_account_id: null,
    ...overrides,
  };
}

describe('planificarRecurrentes', () => {
  it('genera la plantilla cuyo día ya ha llegado, con la fecha y el mes correctos', () => {
    const res = planificarRecurrentes([plantilla()], [], '2026-09', new Date(2026, 8, 10), USER);
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({
      fecha: '2026-09-05',
      mes_referencia: '2026-09',
      cantidad: -12.99,
      recurrente_template_id: 'tpl-netflix',
      es_recurrente: true,
      user_id: USER,
    });
  });

  it('no genera la plantilla cuyo día aún no ha llegado', () => {
    const res = planificarRecurrentes([plantilla({ dia_del_mes: 20 })], [], '2026-09', new Date(2026, 8, 10), USER);
    expect(res).toEqual([]);
  });

  it('el día 31 cae el último día de febrero y se genera ese día', () => {
    const tpl = plantilla({ dia_del_mes: 31 });
    expect(planificarRecurrentes([tpl], [], '2026-02', new Date(2026, 1, 27), USER)).toEqual([]);
    const res = planificarRecurrentes([tpl], [], '2026-02', new Date(2026, 1, 28), USER);
    expect(res.map(m => m.fecha)).toEqual(['2026-02-28']);
  });

  it('sin dia_del_mes se trata como día 1', () => {
    const res = planificarRecurrentes([plantilla({ dia_del_mes: null })], [], '2026-09', new Date(2026, 8, 1), USER);
    expect(res.map(m => m.fecha)).toEqual(['2026-09-01']);
  });

  it('no duplica si ya existe un movimiento con ese template_id en el mes', () => {
    const existentes = [{ recurrente_template_id: 'tpl-netflix', concepto: 'Netflix editado', cuenta_id: 'caixa' }];
    expect(planificarRecurrentes([plantilla()], existentes, '2026-09', new Date(2026, 8, 10), USER)).toEqual([]);
  });

  it('no duplica si la plantilla se borró y recreó (huérfano con mismo concepto y cuenta)', () => {
    const recreada = plantilla({ id: 'tpl-netflix-nueva' });
    const existentes = [{ recurrente_template_id: null, concepto: 'Netflix', cuenta_id: 'caixa' }];
    expect(planificarRecurrentes([recreada], existentes, '2026-09', new Date(2026, 8, 10), USER)).toEqual([]);
  });

  it('un huérfano en otra cuenta no bloquea la plantilla', () => {
    const existentes = [{ recurrente_template_id: null, concepto: 'Netflix', cuenta_id: 'revolut' }];
    expect(planificarRecurrentes([plantilla()], existentes, '2026-09', new Date(2026, 8, 10), USER)).toHaveLength(1);
  });

  it('una transferencia genera salida negativa en origen y entrada positiva en destino', () => {
    const tpl = plantilla({
      id: 'tpl-ahorro',
      concepto: 'Ahorro mensual',
      cantidad: 300, // el signo guardado en la plantilla no importa para transferencias
      is_transfer: true,
      destination_account_id: 'indexa',
      notas: 'Aportación',
    });
    const res = planificarRecurrentes([tpl], [], '2026-09', new Date(2026, 8, 10), USER);
    expect(res).toHaveLength(2);
    expect(res[0]).toMatchObject({ cuenta_id: 'caixa', cantidad: -300, recurrente_template_id: 'tpl-ahorro', notas: 'Aportación' });
    expect(res[1]).toMatchObject({ cuenta_id: 'indexa', cantidad: 300, recurrente_template_id: 'tpl-ahorro', notas: 'Aportación (transferencia)' });
  });

  it('una transferencia sin notas marca la entrada como transferencia entre cuentas', () => {
    const tpl = plantilla({ cantidad: -50, is_transfer: true, destination_account_id: 'indexa' });
    const res = planificarRecurrentes([tpl], [], '2026-09', new Date(2026, 8, 10), USER);
    expect(res.map(m => m.cantidad)).toEqual([-50, 50]);
    expect(res[1].notas).toBe('Transferencia entre cuentas');
  });

  it('respeta el signo de las plantillas que no son transferencia (ingresos positivos)', () => {
    const nomina = plantilla({ id: 'tpl-nomina', concepto: 'Nómina', cantidad: 2500, dia_del_mes: 1 });
    const res = planificarRecurrentes([nomina], [], '2026-09', new Date(2026, 8, 10), USER);
    expect(res[0].cantidad).toBe(2500);
  });
});
