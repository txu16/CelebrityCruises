import type { CabinCategory, Filters, Sailing } from '../types';
import { useLowestEver } from '../hooks/useLowestEver';
import { SailingCard } from './SailingCard';
import { SailingTable } from './SailingTable';

interface Props {
  filters: Filters;
  viewMode: 'cards' | 'table';
  onSelectSailing: (s: Sailing) => void;
}

function StarSpark() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 1l1.5 5L14 7.5 9.5 9 8 14 6.5 9 2 7.5 6.5 6z" fill="currentColor" />
    </svg>
  );
}

export function LowestEverView({ filters, viewMode, onSelectSailing }: Props) {
  const { sailings, total, loading, error, requiresCabinFilter } = useLowestEver(filters);

  if (requiresCabinFilter) {
    return (
      <div className="cc-empty">
        <svg width="150" height="110" viewBox="0 0 150 110" aria-hidden="true">
          <circle cx="75" cy="55" r="38" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.4" />
          <path d="M75 30 L80 50 L100 55 L80 60 L75 80 L70 60 L50 55 L70 50 Z" fill="var(--cc-gold)" />
        </svg>
        <div className="cc-empty-title">Select a cabin type to see lowest-ever rates</div>
        <div className="cc-empty-body">
          Pick Interior, Oceanview, Balcony or Suite above and we'll surface every sailing currently at its all-time low.
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="cc-empty">
        <div className="cc-empty-title">Failed to load data</div>
        <div className="cc-empty-body">{error}</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="cc-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <article key={i} className="cc-card cc-card-skel">
            <header className="cc-card-head">
              <div style={{ flex: 1 }}>
                <div className="sk sk-line w70" />
                <div className="sk sk-line w50" />
              </div>
              <div className="sk sk-pill" />
            </header>
            <div className="sk sk-line w40" />
            <div className="cc-card-prices">
              {[0, 1, 2, 3].map((j) => (
                <div key={j} className="cc-price">
                  <div className="sk sk-line w60" />
                  <div className="sk sk-line w80 tall" />
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    );
  }

  if (sailings.length === 0) {
    return (
      <div className="cc-empty">
        <div className="cc-empty-title">No sailings at their lowest ever rate</div>
        <div className="cc-empty-body">
          This view improves as more price data accumulates. Check back after the tracker has been running for a few days.
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="cc-banner">
        <span className="cc-banner-mark"><StarSpark /></span>
        <span><b>Lowest Ever</b> badges mark cabins at their all-time lowest recorded rate across our tracked history.</span>
        <span className="cc-banner-meta">{total.toLocaleString()} sailing{total !== 1 ? 's' : ''} at lowest ever rate</span>
      </div>
      {viewMode === 'table' ? (
        <SailingTable sailings={sailings} filters={filters} onSelectSailing={onSelectSailing} />
      ) : (
        <div className="cc-grid">
          {sailings.map((s) => (
            <SailingCard
              key={s.id}
              sailing={s}
              showLowest
              highlightCategories={filters.cabinCategories as CabinCategory[]}
              onOpen={() => onSelectSailing(s)}
            />
          ))}
        </div>
      )}
    </>
  );
}
