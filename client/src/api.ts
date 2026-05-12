import type { Filters, NightsPreset, PriceHistoryPoint, Sailing, Ship } from './types';

function nightsParams(preset: NightsPreset): Record<string, string> {
  switch (preset) {
    case '3-5':  return { nightsMin: '3', nightsMax: '5' };
    case '7':    return { nightsMin: '7', nightsMax: '7' };
    case '10-14': return { nightsMin: '10', nightsMax: '14' };
    case '15+':  return { nightsMin: '15', nightsMax: '999' };
    default:     return {};
  }
}

function filtersToParams(filters: Filters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.month) params.set('month', filters.month);
  if (filters.cabinCategories.length > 0) params.set('cabinCategory', filters.cabinCategories.join(','));
  if (filters.suiteSubcategories.length > 0) params.set('suiteSubcategory', filters.suiteSubcategories.join(','));
  if (filters.shipCode) params.set('shipCode', filters.shipCode);
  params.set('sortBy', filters.sortBy);

  const nights = nightsParams(filters.nightsPreset);
  Object.entries(nights).forEach(([k, v]) => params.set(k, v));
  return params;
}

export async function fetchSailings(filters: Filters): Promise<{ sailings: Sailing[]; total: number }> {
  const params = filtersToParams(filters);
  const res = await fetch(`/api/sailings?${params}`);
  if (!res.ok) throw new Error(`fetchSailings: ${res.status}`);
  return res.json() as Promise<{ sailings: Sailing[]; total: number }>;
}

export async function fetchLowestEver(filters: Filters): Promise<{ sailings: Sailing[]; total: number; requiresCabinFilter: boolean }> {
  const params = filtersToParams(filters);
  const res = await fetch(`/api/lowest-ever?${params}`);
  if (!res.ok) throw new Error(`fetchLowestEver: ${res.status}`);
  return res.json() as Promise<{ sailings: Sailing[]; total: number; requiresCabinFilter: boolean }>;
}

export async function fetchPriceHistory(id: string): Promise<Record<string, PriceHistoryPoint[]>> {
  const res = await fetch(`/api/sailings/${encodeURIComponent(id)}/history`);
  if (!res.ok) throw new Error(`fetchPriceHistory: ${res.status}`);
  const data = await res.json() as { history: Record<string, PriceHistoryPoint[]> };
  return data.history;
}

export async function fetchShips(): Promise<Ship[]> {
  const res = await fetch('/api/ships');
  if (!res.ok) throw new Error(`fetchShips: ${res.status}`);
  const data = await res.json() as { ships: Ship[] };
  return data.ships;
}
