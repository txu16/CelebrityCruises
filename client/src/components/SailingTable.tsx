import type { CabinCategory, Filters, Sailing } from '../types';

interface Props {
  sailings: Sailing[];
  filters: Filters;
  onSelectSailing: (s: Sailing) => void;
}

const CABIN_COLS: { key: CabinCategory; label: string }[] = [
  { key: 'interior', label: 'Interior' },
  { key: 'oceanview', label: 'Oceanview' },
  { key: 'balcony', label: 'Balcony' },
  { key: 'suite', label: 'Suite' },
];

function fmtMoney(n: number | null): string {
  if (n == null) return '—';
  return '$' + n.toLocaleString();
}

function fmtDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function SailingTable({ sailings, filters, onSelectSailing }: Props) {
  const activeCabins = filters.cabinCategories.length
    ? filters.cabinCategories
    : (CABIN_COLS.map((c) => c.key) as CabinCategory[]);

  return (
    <div className="cc-table-wrap">
      <table className="cc-table">
        <thead>
          <tr>
            <th className="cc-th">Destination</th>
            <th className="cc-th">Ship</th>
            <th className="cc-th">Departure</th>
            <th className="cc-th cc-th-num">Nights</th>
            {CABIN_COLS.filter((c) => activeCabins.includes(c.key)).map((c) => (
              <th key={c.key} className="cc-th cc-th-price">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sailings.map((s) => (
            <tr key={s.id} className="cc-tr" style={{ cursor: 'pointer' }} onClick={() => onSelectSailing(s)}>
              <td className="cc-td cc-td-dest">
                <div className="cc-td-dest-name">{s.destination}</div>
                <div className="cc-td-port">{s.embarkationPort}</div>
              </td>
              <td className="cc-td">{s.shipName}</td>
              <td className="cc-td">{fmtDate(s.departureDate)}</td>
              <td className="cc-td cc-td-num">{s.nights}</td>
              {CABIN_COLS.filter((c) => activeCabins.includes(c.key)).map(({ key }) => {
                const cell = s.prices[key];
                const perNight = cell?.current != null ? Math.round(cell.current / s.nights) : null;
                return (
                  <td key={key} className={`cc-td cc-td-price${cell?.isAtLowestEver ? ' is-lowest' : ''}`}>
                    {fmtMoney(cell?.current ?? null)}
                    {cell?.isAtLowestEver && <span className="cc-le-dot" title="Lowest Ever" />}
                    {perNight != null && <div className="cc-td-price-per-night">{fmtMoney(perNight)}/nt pp</div>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
