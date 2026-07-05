export const CATEGORIA_COLORS = [
  // Neutros
  '#6B7280', '#374151', '#9CA3AF',
  // Rojos y naranjas
  '#EF4444', '#DC2626', '#F97316', '#EA580C',
  // Amarillos
  '#F59E0B', '#D97706', '#EAB308',
  // Verdes
  '#10B981', '#059669', '#22C55E', '#16A34A', '#84CC16',
  // Azules y cyan
  '#3B82F6', '#2563EB', '#06B6D4', '#0891B2', '#0EA5E9',
  // Púrpuras y violetas
  '#8B5CF6', '#7C3AED', '#A855F7', '#6366F1',
  // Rosas
  '#EC4899', '#DB2777', '#F43F5E', '#E11D48',
  // Marrones y tierra
  '#92400E', '#78350F', '#A16207',
];

export function randomCategoriaColor(): string {
  return CATEGORIA_COLORS[Math.floor(Math.random() * CATEGORIA_COLORS.length)];
}
