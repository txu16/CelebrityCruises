import { useEffect, useMemo, useState } from 'react';
import { fetchShips } from './api';
import { useSailings } from './hooks/useSailings';
import type { ActiveTab, Filters, Sailing, Ship } from './types';
import { FilterBar } from './components/FilterBar';
import { BrowseView } from './components/BrowseView';
import { LowestEverView } from './components/LowestEverView';
import { SailingDetail } from './components/SailingDetail';
import { SavedSearchesPopover, loadSavedCount } from './components/SavedSearchesPopover';
import './App.css';

const DEFAULT_FILTERS: Filters = {
  month: '',
  cabinCategories: [],
  suiteSubcategories: [],
  nightsPreset: 'any',
  shipCode: '',
  sortBy: 'date',
};

function CompassMark() {
  return (
    <svg width="34" height="34" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="18.5" fill="none" stroke="currentColor" strokeWidth="1" />
      <circle cx="20" cy="20" r="13" fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.5" />
      <path d="M20 5 L23 20 L20 35 L17 20 Z" fill="var(--cc-gold)" />
      <path d="M5 20 L20 17 L35 20 L20 23 Z" fill="currentColor" opacity="0.85" />
      <circle cx="20" cy="20" r="2" fill="var(--cc-bg)" />
    </svg>
  );
}

export default function App() {
  const [tab, setTab] = useState<ActiveTab>('browse');
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [ships, setShips] = useState<Ship[]>([]);
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [selectedSailing, setSelectedSailing] = useState<Sailing | null>(null);
  const [savedOpen, setSavedOpen] = useState(false);
  const [savedCount, setSavedCount] = useState(() => loadSavedCount());

  useEffect(() => {
    fetchShips().then(setShips).catch(console.error);
  }, []);

  const { sailings: browseSailings, total } = useSailings(filters);
  const suiteSubcategoryOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of browseSailings) {
      for (const sub of s.prices.suite.subcategories ?? []) {
        if (!map.has(sub.code)) map.set(sub.code, sub.name);
      }
    }
    return Array.from(map.entries()).map(([code, name]) => ({ code, name }));
  }, [browseSailings]);

  const handleTabChange = (t: ActiveTab) => {
    setTab(t);
    setSelectedSailing(null);
  };

  if (selectedSailing) {
    return (
      <div className="cc-root">
        <header className="cc-header">
          <div className="cc-header-inner">
            <div className="cc-brand">
              <CompassMark />
              <div className="cc-brand-text">
                <div className="cc-brand-name">Celebrity Cruises</div>
                <div className="cc-brand-sub">Price Tracker</div>
              </div>
            </div>
            <nav className="cc-tabs" role="tablist">
              <button role="tab" aria-selected={tab === 'browse'} className={`cc-tab ${tab === 'browse' ? 'is-active' : ''}`} onClick={() => handleTabChange('browse')}>Browse</button>
              <button role="tab" aria-selected={tab === 'lowest-ever'} className={`cc-tab ${tab === 'lowest-ever' ? 'is-active' : ''}`} onClick={() => handleTabChange('lowest-ever')}>Lowest Ever Rate</button>
            </nav>
            <div className="cc-header-right">
              <div className="cc-avatar">CC</div>
            </div>
          </div>
        </header>
        <main className="cc-main cc-main-detail">
          <SailingDetail sailing={selectedSailing} onBack={() => setSelectedSailing(null)} />
        </main>
      </div>
    );
  }

  return (
    <div className="cc-root">
      <header className="cc-header">
        <div className="cc-header-inner">
          <div className="cc-brand">
            <CompassMark />
            <div className="cc-brand-text">
              <div className="cc-brand-name">Celebrity Cruises</div>
              <div className="cc-brand-sub">Price Tracker</div>
            </div>
          </div>
          <nav className="cc-tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'browse'} className={`cc-tab ${tab === 'browse' ? 'is-active' : ''}`} onClick={() => setTab('browse')}>Browse</button>
            <button role="tab" aria-selected={tab === 'lowest-ever'} className={`cc-tab ${tab === 'lowest-ever' ? 'is-active' : ''}`} onClick={() => setTab('lowest-ever')}>Lowest Ever Rate</button>
          </nav>
          <div className="cc-header-right">
            <button
              className={`cc-icon-btn${savedOpen ? ' is-on' : ''}`}
              title="Saved searches"
              onClick={() => setSavedOpen((v) => !v)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M6 3h12v18l-6-4-6 4z" />
              </svg>
              {savedCount > 0 && <span className="cc-icon-badge">{savedCount}</span>}
            </button>
            <div className="cc-avatar">CC</div>
          </div>
        </div>
      </header>

      {savedOpen && (
        <SavedSearchesPopover
          filters={filters}
          onClose={() => setSavedOpen(false)}
          onApply={(f) => { setFilters(f); setSavedOpen(false); }}
          onCountChange={setSavedCount}
        />
      )}

      <FilterBar
        filters={filters}
        ships={ships}
        suiteSubcategoryOptions={suiteSubcategoryOptions}
        onChange={(f: Filters) => setFilters(f)}
        collapsed={filtersCollapsed}
        onToggleCollapsed={() => setFiltersCollapsed((v) => !v)}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        resultCount={total}
      />

      <main className="cc-main">
        {tab === 'browse'
          ? <BrowseView filters={filters} viewMode={viewMode} onResetFilters={() => setFilters(DEFAULT_FILTERS)} onSelectSailing={setSelectedSailing} />
          : <LowestEverView filters={filters} viewMode={viewMode} onSelectSailing={setSelectedSailing} />
        }
      </main>
    </div>
  );
}
