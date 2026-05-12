import { useEffect, useState } from 'react';
import { fetchPriceHistory } from '../api';
import type { PriceHistoryPoint, Sailing } from '../types';

const CABIN_KEYS = ['interior', 'oceanview', 'balcony', 'suite'] as const;
type CabinKey = typeof CABIN_KEYS[number];
const CABIN_LABELS: Record<CabinKey, string> = {
  interior: 'Interior', oceanview: 'Oceanview', balcony: 'Balcony', suite: 'Suite',
};

interface ShipSpec {
  class: string; year: number; guests: number; crew: number;
  tonnage: number; godmother: string; amenities: string[];
}

const SHIP_SPECS: Record<string, ShipSpec> = {
  EG: { class: 'Edge', year: 2018, guests: 2918, crew: 1320, tonnage: 130818, godmother: 'Malala Yousafzai', amenities: ['Eden', 'The Retreat', 'Magic Carpet', 'Le Grand Bistro', 'Rooftop Garden', 'Fine Cut Steakhouse'] },
  AX: { class: 'Edge', year: 2020, guests: 2910, crew: 1316, tonnage: 130818, godmother: 'Simone Ashley', amenities: ['Eden', 'The Retreat', 'Magic Carpet', 'Le Grand Bistro', 'Rooftop Garden', 'Fine Cut Steakhouse'] },
  BY: { class: 'Edge', year: 2022, guests: 3260, crew: 1400, tonnage: 140600, godmother: 'Gwyneth Paltrow', amenities: ['Eden', 'The Retreat', 'Magic Carpet', 'Le Grand Bistro', 'Rooftop Garden', 'Fine Cut Steakhouse'] },
  AT: { class: 'Edge', year: 2023, guests: 3260, crew: 1400, tonnage: 140600, godmother: 'Katy Perry', amenities: ['Eden', 'The Retreat', 'Magic Carpet', 'Le Grand Bistro', 'Rooftop Garden', 'The Retreat Sundeck'] },
  EQ: { class: 'Solstice', year: 2009, guests: 2852, crew: 1253, tonnage: 122000, godmother: 'Ellen DeGeneres', amenities: ['The Lawn Club', 'Blu', 'Murano', 'The Retreat', 'Qsine', 'The Lawn Club Grill'] },
  EC: { class: 'Solstice', year: 2010, guests: 2852, crew: 1253, tonnage: 122000, godmother: 'Hayley Westenra', amenities: ['The Lawn Club', 'Blu', 'Murano', 'The Retreat', 'Qsine', 'The Lawn Club Grill'] },
  SI: { class: 'Solstice', year: 2011, guests: 2886, crew: 1253, tonnage: 122400, godmother: 'Sofia Milos', amenities: ['The Lawn Club', 'Blu', 'Murano', 'The Retreat', 'Qsine', 'The Lawn Club Grill'] },
  RF: { class: 'Solstice', year: 2012, guests: 3046, crew: 1253, tonnage: 126000, godmother: 'Kristin Chenoweth', amenities: ['The Lawn Club', 'Blu', 'Murano', 'The Retreat', 'Qsine', 'Rooftop Terrace'] },
  ML: { class: 'Millennium', year: 2000, guests: 2218, crew: 999, tonnage: 91000, godmother: 'Lady Mary Fagan', amenities: ['Olympic Restaurant', 'Aqua Spa', 'The Retreat', 'Tuscan Grille', 'Lawn Club'] },
  SM: { class: 'Millennium', year: 2001, guests: 2218, crew: 999, tonnage: 91000, godmother: 'Eleanor Mondale', amenities: ['Olympic Restaurant', 'Aqua Spa', 'The Retreat', 'Tuscan Grille', 'Lawn Club'] },
  CS: { class: 'Millennium', year: 2002, guests: 2218, crew: 999, tonnage: 91000, godmother: 'Countess of Wessex', amenities: ['Olympic Restaurant', 'Aqua Spa', 'The Retreat', 'Tuscan Grille', 'Lawn Club'] },
  IN: { class: 'Millennium', year: 2001, guests: 2218, crew: 999, tonnage: 91000, godmother: 'Christy Brinkley', amenities: ['Olympic Restaurant', 'Aqua Spa', 'The Retreat', 'Tuscan Grille', 'Lawn Club'] },
  RB: { class: 'Millennium', year: 2004, guests: 2218, crew: 999, tonnage: 91000, godmother: '—', amenities: ['Olympic Restaurant', 'Aqua Spa', 'The Retreat', 'Tuscan Grille', 'Lawn Club'] },
  RC: { class: 'Millennium', year: 2004, guests: 2218, crew: 999, tonnage: 91000, godmother: '—', amenities: ['Olympic Restaurant', 'Aqua Spa', 'The Retreat', 'Tuscan Grille', 'Lawn Club'] },
  FL: { class: 'Galapagos', year: 2019, guests: 100, crew: 65, tonnage: 5739, godmother: 'Yolanda Caicedo', amenities: ['Dining Room', 'Observation Lounge', 'Sundeck', 'Zodiac Excursions'] },
};
const DEFAULT_SPEC: ShipSpec = { class: 'Celebrity', year: 2020, guests: 2800, crew: 1200, tonnage: 120000, godmother: '—', amenities: ['The Retreat', 'Main Dining Room', 'Specialty Dining', 'Spa', 'Fitness Center'] };

function fmtMoney(n: number | null) {
  return n == null ? 'N/A' : '$' + n.toLocaleString();
}
function fmtDateLong(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function PriceHistoryChart({ points, cabin }: { points: PriceHistoryPoint[]; cabin: CabinKey }) {
  if (points.length < 2) {
    return <div className="cc-d-empty-cell">Not enough history yet — check back after the next sync.</div>;
  }
  const W = 720, H = 180, PAD = 12;
  const vals = points.map((p) => p.price);
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = Math.max(1, max - min);
  const x = (i: number) => PAD + (i / (points.length - 1)) * (W - PAD * 2);
  const y = (v: number) => PAD + (1 - (v - min) / range) * (H - PAD * 2);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(p.price).toFixed(1)}`).join(' ');
  const area = path + ` L${x(points.length - 1).toFixed(1)} ${H - PAD} L${x(0).toFixed(1)} ${H - PAD} Z`;
  const minIdx = vals.indexOf(min), maxIdx = vals.indexOf(max);
  const dates = points.map((p) => new Date(p.date));
  const fmtAxisDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  void cabin;
  return (
    <div className="cc-d-chart">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="cc-d-chart-svg">
        <defs>
          <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--cc-accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--cc-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((t) => (
          <line key={t} x1={PAD} x2={W - PAD}
            y1={PAD + t * (H - PAD * 2)} y2={PAD + t * (H - PAD * 2)}
            stroke="var(--cc-line)" strokeDasharray="2 4" />
        ))}
        <path d={area} fill="url(#chartFill)" />
        <path d={path} fill="none" stroke="var(--cc-accent)" strokeWidth="1.6" />
        <circle cx={x(minIdx)} cy={y(min)} r="4" fill="var(--cc-gold)" stroke="var(--cc-surface)" strokeWidth="2" />
        <circle cx={x(maxIdx)} cy={y(max)} r="3" fill="var(--cc-ink-soft)" stroke="var(--cc-surface)" strokeWidth="2" />
        <circle cx={x(points.length - 1)} cy={y(vals[vals.length - 1])} r="4" fill="var(--cc-accent)" stroke="var(--cc-surface)" strokeWidth="2" />
      </svg>
      <div className="cc-d-chart-axis">
        <span>{fmtAxisDate(dates[0])}</span>
        <span>{fmtAxisDate(dates[Math.floor(dates.length * 0.33)])}</span>
        <span>{fmtAxisDate(dates[Math.floor(dates.length * 0.66)])}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

function HistorySummary({ points, cur }: { points: PriceHistoryPoint[]; cur: number | null }) {
  if (points.length < 2 || cur == null) return null;
  const vals = points.map((p) => p.price);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const first = points[0].price;
  const delta = cur - first;
  const dpct = first > 0 ? Math.round((delta / first) * 100) : 0;
  return (
    <div className="cc-d-hist-summary">
      <div className="cc-d-stat is-accent">
        <div className="cc-d-stat-label">Current</div>
        <div className="cc-d-stat-value">{fmtMoney(cur)}</div>
      </div>
      <div className="cc-d-stat is-gold">
        <div className="cc-d-stat-label">All-time low</div>
        <div className="cc-d-stat-value">{fmtMoney(lo)}</div>
      </div>
      <div className="cc-d-stat">
        <div className="cc-d-stat-label">All-time high</div>
        <div className="cc-d-stat-value">{fmtMoney(hi)}</div>
      </div>
      <div className="cc-d-stat">
        <div className="cc-d-stat-label">vs. first tracked</div>
        <div className={`cc-d-stat-value ${dpct < 0 ? 'is-down' : dpct > 0 ? 'is-up' : ''}`}>
          {(dpct >= 0 ? '+' : '') + dpct + '%'}
        </div>
      </div>
    </div>
  );
}

function PriceBreakdownTable({ sailing, cabin }: { sailing: Sailing; cabin: CabinKey }) {
  const p = sailing.prices[cabin]?.current;
  if (p == null) {
    return <div className="cc-d-empty-cell">No price available for {CABIN_LABELS[cabin]} on this sailing.</div>;
  }
  const taxesPct = 0.13;
  const grats = sailing.nights * 18;
  const port = sailing.nights * 11;
  const taxes = Math.round(p * taxesPct);
  const cruise = p - taxes - port;
  const total = p + grats;
  return (
    <div className="cc-d-breakdown">
      <table className="cc-d-table">
        <tbody>
          <tr><td>Cruise fare</td><td>{fmtMoney(cruise)}</td></tr>
          <tr><td>Port fees</td><td>{fmtMoney(port)}</td></tr>
          <tr><td>Government taxes</td><td>{fmtMoney(taxes)}</td></tr>
          <tr className="cc-d-table-row-sub"><td>Subtotal (advertised)</td><td>{fmtMoney(p)}</td></tr>
          <tr><td>Gratuities <span className="cc-d-table-fine">${(grats / sailing.nights).toFixed(0)}/night</span></td><td>{fmtMoney(grats)}</td></tr>
          <tr className="cc-d-table-row-total"><td>All-in total per person</td><td>{fmtMoney(total)}</td></tr>
        </tbody>
      </table>
      <div className="cc-d-breakdown-aside">
        <div className="cc-d-aside-line"><span>Per night</span><span>{fmtMoney(Math.round(total / sailing.nights))}</span></div>
        <div className="cc-d-aside-line"><span>Double-occupancy total</span><span>{fmtMoney(total * 2)}</span></div>
        <div className="cc-d-aside-fine">Gratuities estimated at $18/night and can be prepaid or charged onboard. Beverage and Wi-Fi packages sold separately.</div>
      </div>
    </div>
  );
}

function ShipPlaceholder() {
  return (
    <svg viewBox="0 0 320 140" className="cc-d-ship-svg" aria-hidden="true">
      <defs>
        <pattern id="shipStripe" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="var(--cc-accent)" strokeOpacity="0.18" strokeWidth="1" />
        </pattern>
      </defs>
      <rect x="0" y="0" width="320" height="140" fill="url(#shipStripe)" />
      <path d="M20 95 L300 95 L280 115 L40 115 Z" fill="var(--cc-ink)" opacity="0.85" />
      <rect x="60" y="60" width="220" height="35" fill="var(--cc-surface)" stroke="var(--cc-ink)" strokeWidth="1" />
      <rect x="120" y="35" width="100" height="25" fill="var(--cc-surface)" stroke="var(--cc-ink)" strokeWidth="1" />
      <circle cx="155" cy="48" r="3" fill="var(--cc-gold)" />
      <circle cx="185" cy="48" r="3" fill="var(--cc-gold)" />
      {[80, 100, 120, 140, 160, 180, 200, 220, 240, 260].map((px) => (
        <rect key={px} x={px} y="72" width="6" height="6" fill="var(--cc-accent)" opacity="0.7" />
      ))}
    </svg>
  );
}

interface Props {
  sailing: Sailing;
  onBack: () => void;
}

export function SailingDetail({ sailing, onBack }: Props) {
  const [cabin, setCabin] = useState<CabinKey>(() => {
    return CABIN_KEYS.find((k) => sailing.prices[k]?.current != null) ?? 'interior';
  });
  const [history, setHistory] = useState<Record<string, PriceHistoryPoint[]>>({});

  const spec = SHIP_SPECS[sailing.shipCode] ?? DEFAULT_SPEC;

  const CABIN_URL_CODE: Record<string, string> = {
    interior: 'INTERIOR', oceanview: 'OCEAN_VIEW', balcony: 'BALCONY', suite: 'SUITE',
  };
  const cruiseParams = new URLSearchParams({
    sailDate: sailing.departureDate,
    shipCode: sailing.shipCode,
    packageCode: sailing.id.replace(/_\d{4}-\d{2}-\d{2}$/, ''),
    selectedCurrencyCode: 'USD',
    country: 'USA',
    roomIndex: '0',
    r0a: '2', r0c: '0',
    r0b: 'n', r0r: 'n', r0s: 'n', r0q: 'n', r0t: 'n',
    r0d: CABIN_URL_CODE[cabin] ?? 'INTERIOR',
    r0D: 'y',
  });
  const cruiseUrl = `https://www.celebritycruises.com/room-selection/rooms-and-guests?${cruiseParams}`;

  useEffect(() => {
    fetchPriceHistory(sailing.id).then(setHistory).catch(console.error);
  }, [sailing.id]);

  const historyPoints = history[cabin] ?? [];
  const currentPrice = sailing.prices[cabin]?.current ?? null;

  return (
    <div className="cc-detail">
      <div className="cc-detail-top">
        <button className="cc-back" onClick={onBack}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M10 13L5 8l5-5" />
          </svg>
          All sailings
        </button>
        <div className="cc-detail-crumb">
          <span>{sailing.shipName}</span>
          <span className="cc-detail-crumb-sep">/</span>
          <span>{sailing.destination}</span>
          <span className="cc-detail-crumb-sep">/</span>
          <span>{fmtDateLong(sailing.departureDate)}</span>
        </div>
      </div>

      <section className="cc-d-hero">
        <div className="cc-d-hero-text">
          <div className="cc-d-eyebrow">{sailing.nights}-night sailing · {spec.class}-class</div>
          <h1 className="cc-d-title">{sailing.destination}</h1>
          <div className="cc-d-sub">
            aboard <em>{sailing.shipName}</em> · {fmtDateLong(sailing.departureDate)} — {fmtDateLong(sailing.returnDate)}
          </div>
          <div className="cc-d-meta">
            <span>
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
                <circle cx="8" cy="6" r="2.4" /><path d="M8 8.5V14M3 14h10" />
              </svg>
              {sailing.embarkationPort}
            </span>
            <span className="cc-d-meta-dot">·</span>
            <span>{spec.guests.toLocaleString()} guests</span>
            <span className="cc-d-meta-dot">·</span>
            <span>{sailing.nights} nights</span>
          </div>
          <div className="cc-d-actions">
            <a className="cc-d-cta" href={cruiseUrl} target="_blank" rel="noopener noreferrer">
              Book on Celebrity Cruises
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M6 3h7v7M13 3L4 12" />
              </svg>
            </a>
            <button className="cc-d-track">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9z" /><path d="M10 21a2 2 0 0 0 4 0" />
              </svg>
              Track price
            </button>
          </div>
        </div>
        <div className="cc-d-hero-art">
          <ShipPlaceholder />
        </div>
      </section>

      {sailing.itineraryPorts.length > 0 && (
        <section className="cc-d-section">
          <div className="cc-d-section-head">
            <h2 className="cc-d-section-title">Itinerary</h2>
            <div className="cc-d-section-fine">{sailing.itineraryPorts.length} ports of call</div>
          </div>
          <div className="cc-d-itin-ports">
            {sailing.itineraryPorts.map((port, i) => (
              <div key={i} className="cc-d-itin-port-chip">
                {i === 0 && <span className="cc-d-itin-embark">Departs</span>}
                {port}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="cc-d-section">
        <div className="cc-d-section-head">
          <h2 className="cc-d-section-title">Price breakdown</h2>
          <div className="cc-d-section-fine">Per person, double occupancy. Taxes &amp; port fees included.</div>
        </div>
        <div className="cc-d-prices">
          {CABIN_KEYS.map((k) => {
            const cell = sailing.prices[k];
            const p    = cell?.current;
            const isLE = cell?.isAtLowestEver === true;
            const since = cell?.trackedSince
              ? new Date(cell.trackedSince).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : null;
            return (
              <button
                key={k}
                disabled={p == null}
                onClick={() => setCabin(k)}
                className={`cc-d-price${cabin === k ? ' is-on' : ''}${isLE ? ' is-le' : ''}`}
              >
                <div className="cc-d-price-label">{CABIN_LABELS[k]}</div>
                <div className="cc-d-price-val">{fmtMoney(p ?? null)}</div>
                {p != null && (
                  <div className="cc-d-price-per-night">{fmtMoney(Math.round(p / sailing.nights))}/night per person</div>
                )}
                {isLE && (
                  <div
                    className="cc-d-le"
                    title={since ? `Lowest price since tracking began ${since}` : undefined}
                  >
                    <svg width="10" height="10" viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M8 1l1.5 5L14 7.5 9.5 9 8 14 6.5 9 2 7.5 6.5 6z" fill="currentColor" />
                    </svg>
                    Lowest ever
                  </div>
                )}
              </button>
            );
          })}
        </div>
        <PriceBreakdownTable sailing={sailing} cabin={cabin} />
      </section>

      <section className="cc-d-section">
        <div className="cc-d-section-head">
          <h2 className="cc-d-section-title">Price history</h2>
          <div className="cc-d-section-fine">{CABIN_LABELS[cabin]} — all recorded snapshots</div>
        </div>
        <PriceHistoryChart points={historyPoints} cabin={cabin} />
        <HistorySummary points={historyPoints} cur={currentPrice} />
      </section>

      <section className="cc-d-section">
        <div className="cc-d-section-head">
          <h2 className="cc-d-section-title">The ship</h2>
          <div className="cc-d-section-fine">{sailing.shipName} · {spec.class}-class · {spec.year}</div>
        </div>
        <div className="cc-d-ship">
          <div className="cc-d-ship-art">
            <ShipPlaceholder />
            <div className="cc-d-ship-art-label">Ship illustration</div>
          </div>
          <div className="cc-d-ship-body">
            <div className="cc-d-ship-name">{sailing.shipName}</div>
            <div className="cc-d-ship-class">{spec.class}-class · launched {spec.year}</div>
            <div className="cc-d-ship-grid">
              {[
                { label: 'Guests', value: spec.guests.toLocaleString() },
                { label: 'Crew', value: spec.crew.toLocaleString() },
                { label: 'Tonnage', value: spec.tonnage.toLocaleString() + ' GT' },
                { label: 'Godparent', value: spec.godmother },
              ].map(({ label, value }) => (
                <div key={label} className="cc-d-spec">
                  <div className="cc-d-spec-label">{label}</div>
                  <div className="cc-d-spec-value">{value}</div>
                </div>
              ))}
            </div>
            <div className="cc-d-amen-head">Amenities &amp; venues</div>
            <ul className="cc-d-amen-list">
              {spec.amenities.map((a) => <li key={a}>{a}</li>)}
            </ul>
          </div>
        </div>
      </section>

      <footer className="cc-d-foot">
        <div className="cc-d-foot-meta">Prices tracked since first sync · Updated daily at 2 AM UTC</div>
        <a className="cc-d-foot-link" href={cruiseUrl} target="_blank" rel="noopener noreferrer">
          View this sailing on celebritycruises.com →
        </a>
      </footer>
    </div>
  );
}
