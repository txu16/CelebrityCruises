import type { CabinCategory, Filters, NightsPreset, Ship, SortBy } from '../types';

interface Props {
  filters: Filters;
  ships: Ship[];
  suiteSubcategoryOptions: { code: string; name: string }[];
  onChange: (f: Filters) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  viewMode: 'cards' | 'table';
  onViewModeChange: (v: 'cards' | 'table') => void;
  resultCount: number;
  lastSynced?: string | null;
}

function getMonthOptions(): { value: string; label: string; short: string }[] {
  const options: { value: string; label: string; short: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const short = d.toLocaleDateString('en-US', { month: 'short' }) + " '" + String(d.getFullYear()).slice(2);
    options.push({ value, label, short });
  }
  return options;
}

const MONTH_OPTIONS = getMonthOptions();

const CABIN_OPTIONS: { key: CabinCategory; label: string }[] = [
  { key: 'interior', label: 'Interior' },
  { key: 'oceanview', label: 'Oceanview' },
  { key: 'balcony', label: 'Balcony' },
  { key: 'suite', label: 'Suite' },
];

const NIGHTS_OPTIONS: { value: NightsPreset; label: string }[] = [
  { value: '3-5', label: '3–5 nights' },
  { value: '7', label: '7 nights' },
  { value: '10-14', label: '10–14 nights' },
  { value: '15+', label: '15+ nights' },
];

function shipShortName(name: string) {
  return name.replace(/^Celebrity\s+/i, '');
}

function summarizeFilters(filters: Filters, ships: Ship[]): string {
  const parts: string[] = [];
  if (filters.months.length === 1) {
    const m = MONTH_OPTIONS.find((o) => o.value === filters.months[0]);
    if (m) parts.push(m.label);
  } else if (filters.months.length > 1) {
    parts.push(`${filters.months.length} months`);
  }
  if (filters.cabinCategories.length) {
    parts.push(filters.cabinCategories.map((c) => c[0].toUpperCase() + c.slice(1)).join(' + '));
  }
  if (filters.suiteSubcategories.length) {
    parts.push(filters.suiteSubcategories.join(', '));
  }
  if (filters.nightsPresets.length === 1) {
    const l = NIGHTS_OPTIONS.find((o) => o.value === filters.nightsPresets[0]);
    if (l) parts.push(l.label);
  } else if (filters.nightsPresets.length > 1) {
    parts.push(`${filters.nightsPresets.length} lengths`);
  }
  if (filters.shipCodes.length === 1) {
    const s = ships.find((s) => s.code === filters.shipCodes[0]);
    if (s) parts.push(shipShortName(s.name));
  } else if (filters.shipCodes.length > 1) {
    parts.push(`${filters.shipCodes.length} ships`);
  }
  return parts.length ? parts.join(' · ') : 'All sailings · sorted by departure';
}

function fmtSyncTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
}

export function FilterBar({
  filters, ships, suiteSubcategoryOptions, onChange,
  collapsed, onToggleCollapsed, viewMode, onViewModeChange, resultCount, lastSynced,
}: Props) {
  function toggleMonth(val: string) {
    const next = filters.months.includes(val)
      ? filters.months.filter((m) => m !== val)
      : [...filters.months, val];
    onChange({ ...filters, months: next });
  }

  function toggleNights(val: NightsPreset) {
    const next = filters.nightsPresets.includes(val)
      ? filters.nightsPresets.filter((n) => n !== val)
      : [...filters.nightsPresets, val];
    onChange({ ...filters, nightsPresets: next });
  }

  function toggleShip(code: string) {
    const next = filters.shipCodes.includes(code)
      ? filters.shipCodes.filter((c) => c !== code)
      : [...filters.shipCodes, code];
    onChange({ ...filters, shipCodes: next });
  }

  function toggleCabin(cat: CabinCategory) {
    const next = filters.cabinCategories.includes(cat)
      ? filters.cabinCategories.filter((c) => c !== cat)
      : [...filters.cabinCategories, cat];
    const suiteSubcategories = next.includes('suite') ? filters.suiteSubcategories : [];
    onChange({ ...filters, cabinCategories: next, suiteSubcategories });
  }

  function toggleSuiteSub(code: string) {
    const next = filters.suiteSubcategories.includes(code)
      ? filters.suiteSubcategories.filter((c) => c !== code)
      : [...filters.suiteSubcategories, code];
    onChange({ ...filters, suiteSubcategories: next });
  }

  const suiteSelected = filters.cabinCategories.includes('suite');

  if (collapsed) {
    return (
      <div className="cc-filterbar cc-filterbar-collapsed">
        <div className="cc-filter-collapsed-inner">
          <button className="cc-filter-collapsed-btn" onClick={onToggleCollapsed} aria-expanded="false">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M2 4h12M4 8h8M6 12h4" />
            </svg>
            Filters
          </button>
          <div className="cc-filter-collapsed-summary">{summarizeFilters(filters, ships)}</div>
          <div className="cc-filter-collapsed-count">{resultCount.toLocaleString()} sailings</div>
        </div>
      </div>
    );
  }

  return (
    <div className="cc-filterbar">
      <div className="cc-filter-inner">
        <div className="cc-filter-collapsetop">
          <div className="cc-view-toggle" role="group" aria-label="View mode">
            <button
              className={`cc-view-opt${viewMode === 'cards' ? ' is-on' : ''}`}
              onClick={() => onViewModeChange('cards')}
              title="Card view"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="2" width="5" height="5" /><rect x="9" y="2" width="5" height="5" />
                <rect x="2" y="9" width="5" height="5" /><rect x="9" y="9" width="5" height="5" />
              </svg>
              Cards
            </button>
            <button
              className={`cc-view-opt${viewMode === 'table' ? ' is-on' : ''}`}
              onClick={() => onViewModeChange('table')}
              title="Table view"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 4h12M2 8h12M2 12h12" />
              </svg>
              Table
            </button>
          </div>
          <button className="cc-filter-collapsetop-btn" onClick={onToggleCollapsed} title="Collapse filters">
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M3 10l5-5 5 5" />
            </svg>
            Hide filters
          </button>
        </div>

        {/* Row 1: Month */}
        <div className="cc-filter-section">
          <div className="cc-filter-section-label">
            Month
            {filters.months.length > 0 && (
              <button className="cc-filter-clear-inline" onClick={() => onChange({ ...filters, months: [] })}>
                Clear
              </button>
            )}
          </div>
          <div className="cc-chip-scroll">
            {MONTH_OPTIONS.map((o) => (
              <button
                key={o.value}
                className={`cc-chip cc-chip-sm${filters.months.includes(o.value) ? ' is-on' : ''}`}
                onClick={() => toggleMonth(o.value)}
                type="button"
                title={o.label}
              >
                {o.short}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Cabin + Nights + Sort */}
        <div className="cc-filter-row">
          <div className="cc-field cc-field-grow">
            <div className="cc-field-label">Cabin Category</div>
            <div className="cc-chip-row">
              {CABIN_OPTIONS.map((o) => (
                <button
                  key={o.key}
                  className={`cc-chip${filters.cabinCategories.includes(o.key) ? ' is-on' : ''}`}
                  onClick={() => toggleCabin(o.key)}
                  type="button"
                >
                  <span className={`cc-chip-dot cc-dot-${o.key}`} />
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="cc-field">
            <div className="cc-field-label">
              Cruise Length
              {filters.nightsPresets.length > 0 && (
                <button className="cc-filter-clear-inline" onClick={() => onChange({ ...filters, nightsPresets: [] })}>
                  Clear
                </button>
              )}
            </div>
            <div className="cc-chip-row">
              {NIGHTS_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  className={`cc-chip${filters.nightsPresets.includes(o.value) ? ' is-on' : ''}`}
                  onClick={() => toggleNights(o.value)}
                  type="button"
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="cc-field">
            <div className="cc-field-label">Sort</div>
            <div className="cc-sort">
              <button
                className={`cc-sort-opt${filters.sortBy === 'date' ? ' is-on' : ''}`}
                onClick={() => onChange({ ...filters, sortBy: 'date' as SortBy })}
              >
                Departure
              </button>
              <button
                className={`cc-sort-opt${filters.sortBy === 'price' ? ' is-on' : ''}`}
                onClick={() => onChange({ ...filters, sortBy: 'price' as SortBy })}
              >
                Lowest Price
              </button>
            </div>
          </div>
        </div>

        {/* Row 3: Ship */}
        {ships.length > 0 && (
          <div className="cc-filter-section">
            <div className="cc-filter-section-label">
              Ship
              {filters.shipCodes.length > 0 && (
                <button className="cc-filter-clear-inline" onClick={() => onChange({ ...filters, shipCodes: [] })}>
                  Clear
                </button>
              )}
            </div>
            <div className="cc-chip-scroll">
              {ships.map((s) => (
                <button
                  key={s.code}
                  className={`cc-chip cc-chip-sm${filters.shipCodes.includes(s.code) ? ' is-on' : ''}`}
                  onClick={() => toggleShip(s.code)}
                  type="button"
                >
                  {shipShortName(s.name)}
                </button>
              ))}
            </div>
          </div>
        )}

        {suiteSelected && suiteSubcategoryOptions.length > 0 && (
          <div className="cc-subfilter-row">
            <div className="cc-subfilter-label">
              <span className="cc-subfilter-rule" />
              Suite type
            </div>
            <div className="cc-chip-row">
              {suiteSubcategoryOptions.map((o) => (
                <button
                  key={o.code}
                  className={`cc-chip cc-chip-suite${filters.suiteSubcategories.includes(o.code) ? ' is-on' : ''}`}
                  onClick={() => toggleSuiteSub(o.code)}
                  type="button"
                >
                  {o.name}
                </button>
              ))}
              {filters.suiteSubcategories.length > 0 && (
                <button
                  className="cc-chip-clear"
                  onClick={() => onChange({ ...filters, suiteSubcategories: [] })}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}

        <div className="cc-result-meta">
          <span className="cc-result-count">{resultCount.toLocaleString()} sailings</span>
          <span className="cc-result-sep">·</span>
          <span className="cc-result-fine">Prices per person, double occupancy, taxes &amp; fees included</span>
          {lastSynced && (
            <>
              <span className="cc-result-sep">·</span>
              <span className="cc-result-fine" title="Prices are synced daily at 2am UTC from Celebrity's website">
                Prices as of {fmtSyncTime(lastSynced)}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
