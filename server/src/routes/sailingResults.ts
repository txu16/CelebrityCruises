const ALL_CATS = ['interior', 'oceanview', 'balcony', 'suite'] as const;
type CabinCategory = typeof ALL_CATS[number];
type SortBy = 'date' | 'price' | string | undefined;

export interface RawSailingRow {
  id: string;
  ship_code: string;
  ship_name: string;
  departure_date: string;
  return_date: string;
  nights: number;
  destination: string;
  embarkation_port: string;
  itinerary_ports: string[] | null;
}

export interface RawPriceRow {
  sailing_id: string;
  cabin_category: string;
  cabin_subcategory: string | null;
  cabin_subcategory_name: string | null;
  current_price: number;
}

export interface RawLowestRow {
  sailing_id: string;
  cabin_category: string;
  cabin_subcategory: string | null;
  lowest_ever_price: number;
  first_tracked_at: string;
}

interface PagedQuery<T> {
  range(from: number, to: number): PromiseLike<{ data: T[] | null; error: { message: string } | null }>;
}

interface PriceCell {
  current: number | null;
  lowestEver?: number | null;
  isAtLowestEver?: boolean;
  trackedSince?: string | null;
  subcategories?: { code: string; name: string; price: number }[];
}

export interface SailingResult {
  id: string;
  shipCode: string;
  shipName: string;
  departureDate: string;
  returnDate: string;
  nights: number;
  destination: string;
  embarkationPort: string;
  itineraryPorts: string[];
  prices: Record<CabinCategory, PriceCell>;
}

export function parseList(value: string | undefined): string[] {
  return value ? value.split(',').map((item) => item.trim()).filter(Boolean) : [];
}

export function parsePagination(limit: string | undefined, offset: string | undefined): { limit: number; offset: number } {
  const parsedLimit = Number(limit);
  const parsedOffset = Number(offset);
  return {
    limit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 200) : 50,
    offset: Number.isFinite(parsedOffset) && parsedOffset > 0 ? parsedOffset : 0,
  };
}

export async function fetchAllRows<T>(createQuery: () => PagedQuery<T>, pageSize = 1000): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await createQuery().range(from, to);
    if (error) throw new Error(error.message);

    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

export async function fetchRowsForIdChunks<T>(
  ids: string[],
  createQuery: (ids: string[]) => PagedQuery<T>,
  chunkSize = 500,
  pageSize = 1000
): Promise<T[]> {
  const rows: T[] = [];

  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    rows.push(...await fetchAllRows(() => createQuery(chunk), pageSize));
  }

  return rows;
}

export function buildSailingResults({
  sailingRows,
  priceRows,
  selectedCats,
  suiteSubcategories,
  lowestRows = [],
}: {
  sailingRows: RawSailingRow[];
  priceRows: RawPriceRow[];
  selectedCats: string[];
  suiteSubcategories: string[];
  lowestRows?: RawLowestRow[];
}): SailingResult[] {
  const selectedCatSet = new Set(selectedCats);
  const suiteSubSet = new Set(suiteSubcategories);
  const hasCabinFilter = selectedCatSet.size > 0;

  const pricesBySailing = new Map<string, RawPriceRow[]>();
  for (const row of priceRows) {
    if (hasCabinFilter && !selectedCatSet.has(row.cabin_category)) continue;
    if (suiteSubSet.size > 0 && row.cabin_category === 'suite' && !suiteSubSet.has(row.cabin_subcategory ?? '')) continue;
    if (!pricesBySailing.has(row.sailing_id)) pricesBySailing.set(row.sailing_id, []);
    pricesBySailing.get(row.sailing_id)!.push(row);
  }

  const useSuiteSubcategoryLows = suiteSubSet.size > 0;
  const lowestBySailing = new Map<string, Map<string, RawLowestRow>>();
  for (const row of lowestRows) {
    if (useSuiteSubcategoryLows && row.cabin_category === 'suite' && !suiteSubSet.has(row.cabin_subcategory ?? '')) continue;
    if (!lowestBySailing.has(row.sailing_id)) lowestBySailing.set(row.sailing_id, new Map());
    lowestBySailing.get(row.sailing_id)!.set(lowestKey(row.cabin_category, useSuiteSubcategoryLows ? row.cabin_subcategory : null), row);
  }

  return sailingRows
    .filter((sailing) => {
      if (!hasCabinFilter) return true;
      const prices = pricesBySailing.get(sailing.id) ?? [];
      return selectedCats.some((cat) => prices.some((price) => price.cabin_category === cat));
    })
    .map((sailing) => {
      const result: SailingResult = {
        id: sailing.id,
        shipCode: sailing.ship_code,
        shipName: sailing.ship_name,
        departureDate: sailing.departure_date,
        returnDate: sailing.return_date,
        nights: sailing.nights,
        destination: sailing.destination,
        embarkationPort: sailing.embarkation_port,
        itineraryPorts: sailing.itinerary_ports ?? [],
        prices: {
          interior: { current: null },
          oceanview: { current: null },
          balcony: { current: null },
          suite: { current: null },
        },
      };

      for (const price of pricesBySailing.get(sailing.id) ?? []) {
        if (!isCabinCategory(price.cabin_category)) continue;
        const cell = result.prices[price.cabin_category];
        if (cell.current === null || price.current_price < cell.current) {
          cell.current = price.current_price;
        }

        if (price.cabin_category === 'suite' && price.cabin_subcategory) {
          if (!cell.subcategories) cell.subcategories = [];
          const existing = cell.subcategories.find((sub) => sub.code === price.cabin_subcategory);
          if (!existing) {
            cell.subcategories.push({
              code: price.cabin_subcategory,
              name: price.cabin_subcategory_name ?? price.cabin_subcategory,
              price: price.current_price,
            });
          } else if (price.current_price < existing.price) {
            existing.price = price.current_price;
          }
        }
      }

      const lowestForSailing = lowestBySailing.get(sailing.id);
      if (lowestForSailing) {
        for (const cat of ALL_CATS) {
          const lowest = lowestForSailing.get(lowestKey(cat, cat === 'suite' && useSuiteSubcategoryLows ? result.prices.suite.subcategories?.[0]?.code ?? null : null));
          if (!lowest) continue;
          const cell = result.prices[cat];
          cell.lowestEver = lowest.lowest_ever_price;
          cell.trackedSince = lowest.first_tracked_at;
          cell.isAtLowestEver = cell.current !== null && cell.current <= lowest.lowest_ever_price;
        }
      }

      return result;
    });
}

export function sortResults(results: SailingResult[], sortBy: SortBy, selectedCats: string[]): SailingResult[] {
  const sorted = [...results];
  if (sortBy === 'price') {
    const cats = selectedCats.filter(isCabinCategory);
    const sortCats = cats.length > 0 ? cats : [...ALL_CATS];
    sorted.sort((a, b) => minPrice(a, sortCats) - minPrice(b, sortCats));
  } else {
    sorted.sort((a, b) => a.departureDate.localeCompare(b.departureDate));
  }
  return sorted;
}

export function paginateResults<T>(results: T[], offset: number, limit: number): T[] {
  return results.slice(offset, offset + limit);
}

export function filterLowestEverResults(results: SailingResult[], selectedCats: string[]): SailingResult[] {
  return results.filter((sailing) =>
    selectedCats.some((cat) => isCabinCategory(cat) && sailing.prices[cat].isAtLowestEver === true)
  );
}

function minPrice(result: SailingResult, cats: CabinCategory[]): number {
  return Math.min(...cats.map((cat) => result.prices[cat].current ?? Infinity));
}

function isCabinCategory(value: string): value is CabinCategory {
  return (ALL_CATS as readonly string[]).includes(value);
}

function lowestKey(category: string, subcategory: string | null): string {
  return subcategory ? `${category}:${subcategory}` : category;
}
