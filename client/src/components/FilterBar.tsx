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
}

function getMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [{ value: '', label: 'Any month' }];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    options.push({ value, label });
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
  { value: 'any', label: 'Any length' },
  { value: '3-5', label: '3–5 nights' },
  { value: '7', label: '7 nights' },
  { value: '10-14', label: '10–14 nights' },
  { value: '15+', label: '15+ nights' },
];

function summarizeFilters(filters: Filters, ships: Ship[]): string {
  const parts: string[] = [];
  if (filters.month) {
    const m = MONTH_OPTIONS.find((o) => o.value === filters.month);
    if (m) parts.push(m.label);
  }
  if (filters.cabinCategories.length) {
    parts.push(filters.cabinCategories.map((c) => c[0].toUpperCase() + c.slice(1)).join(' + '));
  }
  if (filters.suiteSubcategories.length) {
    parts.push(filters.suiteSubcategories.join(', '));
  }
  if (filters.nightsPreset !== 'any') {
    const l = NIGHTS_OPTIONS.find((o) => o.value === filters.nightsPreset);
    if (l) parts.push(l.label);
  }
  if (filters.shipCode) {
    const s = ships.find((s) => s.code === filters.shipCode);
    if (s) parts.push(s.name.replace('Celebrity ', ''));
  }
  return parts.length ? parts.join(' · ') : 'All sailings · sorted by departure';
}

function SelectField({ label, value, onChange, options, grow }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  grow?: boolean;
}) {
  return (
    <div className={`cc-field${grow ? ' cc-field-grow' : ''}`}>
      <div className="cc-field-label">{label}</div>
      <div className="cc-select-wrap">
        <select className="cc-select" value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <svg className="cc-select-caret" width="10" height="6" viewBox="0 0 10 6">
          <path d="M1 1l4 4 4-4" stroke="currentColor" fill="none" strokeWidth="1.4" />
        </svg>
      </div>
    </div>
  );
}

export function FilterBar({
  filters, ships, suiteSubcategoryOptions, onChange,
  collapsed, onToggleCollapsed, viewMode, onViewModeChange, resultCount,
}: Props) {
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

        <div className="cc-filter-row">
          <SelectField
            label="Month"
            value={filters.month}
            onChange={(v) => onChange({ ...filters, month: v })}
            options={MONTH_OPTIONS}
          />

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

          <SelectField
            label="Cruise Length"
            value={filters.nightsPreset}
            onChange={(v) => onChange({ ...filters, nightsPreset: v as NightsPreset })}
            options={NIGHTS_OPTIONS}
          />

          <SelectField
            label="Ship"
            value={filters.shipCode}
            onChange={(v) => onChange({ ...filters, shipCode: v })}
            options={[
              { value: '', label: 'Any ship' },
              ...ships.map((s) => ({ value: s.code, label: s.name })),
            ]}
          />

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
        </div>
      </div>
    </div>
  );
}
