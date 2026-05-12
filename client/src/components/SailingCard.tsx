import type { Sailing, CabinCategory } from '../types';

interface Props {
  sailing: Sailing;
  showLowest?: boolean;
  highlightCategories?: CabinCategory[];
  cardStyle?: 'ribbon' | 'flat' | 'frame';
  onOpen?: () => void;
}

const CABIN_COLS: { key: CabinCategory; label: string }[] = [
  { key: 'interior', label: 'Interior' },
  { key: 'oceanview', label: 'Oceanview' },
  { key: 'balcony', label: 'Balcony' },
  { key: 'suite', label: 'Suite' },
];

function fmtMoney(n: number | null): string {
  if (n == null) return 'N/A';
  return '$' + n.toLocaleString();
}

function fmtDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtTrackedSince(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function PortIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
      <circle cx="8" cy="6" r="2.4" />
      <path d="M8 8.5V14M3 14h10" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9z" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </svg>
  );
}

function StarSpark() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 1l1.5 5L14 7.5 9.5 9 8 14 6.5 9 2 7.5 6.5 6z" fill="currentColor" />
    </svg>
  );
}

export function SailingCard({ sailing, showLowest = false, highlightCategories, cardStyle = 'ribbon', onOpen }: Props) {
  const cabinFiltered = (key: CabinCategory) =>
    !highlightCategories || highlightCategories.length === 0 || highlightCategories.includes(key);

  return (
    <article className={`cc-card cc-card-${cardStyle}`}>
      <header className="cc-card-head">
        <div className="cc-card-dest">
          <div className="cc-card-dest-name">{sailing.destination}</div>
          <div className="cc-card-port">
            <PortIcon /> {sailing.embarkationPort}
          </div>
        </div>
        <div className="cc-card-nights">
          <span className="cc-nights-n">{sailing.nights}</span>
          <span className="cc-nights-l">nights</span>
        </div>
      </header>

      <div className="cc-card-ship">
        <span className="cc-card-ship-name">{sailing.shipName}</span>
        <span className="cc-card-ship-sep">·</span>
        <span className="cc-card-date">{fmtDate(sailing.departureDate)}</span>
      </div>

      <div className="cc-card-prices">
        {CABIN_COLS.map(({ key, label }) => {
          const cell = sailing.prices[key];
          const isLE = showLowest && cell?.isAtLowestEver;
          const isMuted = !cabinFiltered(key);
          const showSuiteSub = key === 'suite' && highlightCategories?.includes('suite') && cell.current != null;

          return (
            <div
              key={key}
              className={`cc-price${isMuted ? ' is-muted' : ''}${isLE ? ' is-lowest' : ''}`}
            >
              <div className="cc-price-label">{label}</div>
              <div className="cc-price-val">{fmtMoney(cell.current)}</div>
              {cell.current != null && (
                <div className="cc-price-per-night">{fmtMoney(Math.round(cell.current / sailing.nights))}/nt pp</div>
              )}
              {showSuiteSub && cell.subcategories && cell.subcategories.length > 0 && (
                <div className="cc-price-sub">{cell.subcategories[0].name}</div>
              )}
              {isLE && (
                <div
                  className="cc-le-badge"
                  title={cell.trackedSince ? `Lowest price since tracking began ${fmtTrackedSince(cell.trackedSince)}` : undefined}
                >
                  <StarSpark /> Lowest Ever
                </div>
              )}
              {showLowest && !isLE && cell.lowestEver != null && cell.current != null && (
                <div className="cc-price-low-hint">Low: {fmtMoney(cell.lowestEver)}</div>
              )}
            </div>
          );
        })}
      </div>

      <footer className="cc-card-foot">
        <button className="cc-card-action" onClick={onOpen}>View sailing</button>
        <button className="cc-card-track" title="Track price" onClick={(e) => e.stopPropagation()}>
          <BellIcon /> Track
        </button>
      </footer>
    </article>
  );
}
