import type { Filters, PriceHistoryPoint, Sailing, Ship } from './types';

function filtersToParams(filters: Filters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.months.length > 0) params.set('months', filters.months.join(','));
  if (filters.cabinCategories.length > 0) params.set('cabinCategory', filters.cabinCategories.join(','));
  if (filters.suiteSubcategories.length > 0) params.set('suiteSubcategory', filters.suiteSubcategories.join(','));
  if (filters.shipCodes.length > 0) params.set('shipCodes', filters.shipCodes.join(','));
  if (filters.nightsPresets.length > 0) params.set('nightsPresets', filters.nightsPresets.join(','));
  params.set('sortBy', filters.sortBy);
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
