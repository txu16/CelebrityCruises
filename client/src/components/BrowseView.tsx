import type { Filters, Sailing } from '../types';
import { useSailings } from '../hooks/useSailings';
import { SailingCard } from './SailingCard';
import { SailingTable } from './SailingTable';

interface Props {
  filters: Filters;
  viewMode: 'cards' | 'table';
  onResetFilters: () => void;
  onSelectSailing: (s: Sailing) => void;
}

function SkeletonCard() {
  return (
    <article className="cc-card cc-card-skel">
      <header className="cc-card-head">
        <div style={{ flex: 1 }}>
          <div className="sk sk-line w70" />
          <div className="sk sk-line w50" />
        </div>
        <div className="sk sk-pill" />
      </header>
      <div className="sk sk-line w40" />
      <div className="cc-card-prices">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="cc-price">
            <div className="sk sk-line w60" />
            <div className="sk sk-line w80 tall" />
          </div>
        ))}
      </div>
      <footer className="cc-card-foot">
        <div className="sk sk-btn" />
        <div className="sk sk-btn sm" />
      </footer>
    </article>
  );
}

export function BrowseView({ filters, viewMode, onResetFilters, onSelectSailing }: Props) {
  const { sailings, total, loading, error } = useSailings(filters);

  if (error) {
    return (
      <div className="cc-empty">
        <div className="cc-empty-title">Failed to load sailings</div>
        <div className="cc-empty-body">{error}</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="cc-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (sailings.length === 0) {
    return (
      <div className="cc-empty">
        <svg width="170" height="120" viewBox="0 0 170 120" aria-hidden="true">
          <defs>
            <pattern id="emptyStripe" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1" />
            </pattern>
          </defs>
          <path d="M10 88 Q40 78 60 86 T120 84 T160 88 L160 100 L10 100 Z" fill="url(#emptyStripe)" />
          <path d="M10 92 Q40 82 60 90 T120 88 T160 92 L160 104 L10 104 Z" fill="currentColor" opacity="0.08" />
          <path d="M35 88 L60 88 L57 78 L43 78 Z" fill="currentColor" opacity="0.15" />
          <path d="M50 78 L50 58 L72 78 Z" fill="currentColor" opacity="0.4" />
          <line x1="50" y1="58" x2="50" y2="40" stroke="currentColor" strokeWidth="1" />
          <circle cx="120" cy="40" r="14" fill="none" stroke="currentColor" strokeWidth="1" />
          <line x1="130" y1="50" x2="142" y2="62" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <div className="cc-empty-title">No sailings match these filters</div>
        <div className="cc-empty-body">Try widening the month range, adding more ships, or clearing a cabin category.</div>
        <button className="cc-empty-btn" onClick={onResetFilters}>Reset filters</button>
      </div>
    );
  }

  return (
    <>
      {viewMode === 'table' ? (
        <SailingTable sailings={sailings} filters={filters} onSelectSailing={onSelectSailing} />
      ) : (
        <div className="cc-grid">
          {sailings.map((s) => (
            <SailingCard
              key={s.id}
              sailing={s}
              highlightCategories={filters.cabinCategories.length ? filters.cabinCategories : undefined}
              onOpen={() => onSelectSailing(s)}
            />
          ))}
        </div>
      )}
    </>
  );
}
