/**
 * Duración de un puesto a partir de "AAAA-MM", contando el mes de inicio y el de fin.
 * Un año o más se da en años completos; menos de un año, en meses.
 */
export function duration(start: string, end?: string, now = new Date()) {
  const toMonths = (value: string) => {
    const [year, month] = value.split('-').map(Number);
    return year * 12 + month;
  };
  const last = end ? toMonths(end) : now.getFullYear() * 12 + now.getMonth() + 1;
  const months = last - toMonths(start) + 1;
  return months >= 12
    ? { n: Math.floor(months / 12), unit: 'years' as const }
    : { n: months, unit: 'months' as const };
}
