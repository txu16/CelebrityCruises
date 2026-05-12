interface FilterParams {
  month?: string;
  cabinCategory?: string;
  suiteSubcategory?: string;
  nightsMin?: string;
  nightsMax?: string;
  shipCode?: string;
}

// Applies shared filter params to a Supabase query builder.
// Returns the same builder (with filters applied) for chaining.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildSailingsQuery<T extends { gte: any; lte: any; eq: any; in: any; lt: any }>(
  query: T,
  filters: FilterParams
): T {
  const { month, cabinCategory, suiteSubcategory, nightsMin, nightsMax, shipCode } = filters;

  if (month) {
    // month is YYYY-MM — filter sailings departing in that calendar month
    const [year, mon] = month.split('-').map(Number);
    if (year && mon) {
      const start = `${year}-${String(mon).padStart(2, '0')}-01`;
      const endDate = new Date(year, mon, 1); // first day of next month
      const end = endDate.toISOString().split('T')[0];
      query = query.gte('departure_date', start).lt('departure_date', end);
    }
  }

  if (nightsMin) query = query.gte('nights', Number(nightsMin));
  if (nightsMax) query = query.lte('nights', Number(nightsMax));
  if (shipCode)  query = query.eq('ship_code', shipCode);

  if (cabinCategory) {
    const cats = cabinCategory.split(',').map((c) => c.trim()).filter(Boolean);
    if (cats.length > 0) {
      query = query.in('current_prices.cabin_category', cats);
    }
  }

  if (suiteSubcategory) {
    const subs = suiteSubcategory.split(',').map((s) => s.trim()).filter(Boolean);
    if (subs.length > 0) {
      query = query.in('current_prices.cabin_subcategory', subs);
    }
  }

  return query;
}

// Row shape returned by Supabase join
interface RawRow {
  id: string;
  ship_code: string;
  ship_name: string;
  departure_date: string;
  return_date: string;
  nights: number;
  destination: string;
  embarkation_port: string;
  itinerary_ports: string[] | null;
  current_prices: RawPrice | RawPrice[] | null;
  lowest_ever_prices?: RawLowest | RawLowest[] | null;
}

interface RawPrice {
  cabin_category: string;
  cabin_subcategory: string | null;
  cabin_subcategory_name: string | null;
  current_price: number;
  last_updated: string;
}

interface RawLowest {
  cabin_category: string;
  lowest_ever_price: number;
}

interface PriceCell {
  current: number | null;
  lowestEver?: number | null;
  isAtLowestEver?: boolean;
  subcategories?: { code: string; name: string; price: number }[];
}

interface SailingResult {
  id: string;
  shipCode: string;
  shipName: string;
  departureDate: string;
  returnDate: string;
  nights: number;
  destination: string;
  embarkationPort: string;
  itineraryPorts: string[];
  prices: {
    interior: PriceCell;
    oceanview: PriceCell;
    balcony: PriceCell;
    suite: PriceCell;
  };
}

export function pivotPrices(rows: unknown[], includeLowest: boolean): SailingResult[] {
  // Group rows by sailing id first
  const map = new Map<string, SailingResult>();

  for (const rawRow of rows) {
    const row = rawRow as RawRow;
    let sailing = map.get(row.id);
    if (!sailing) {
      sailing = {
        id:               row.id,
        shipCode:         row.ship_code,
        shipName:         row.ship_name,
        departureDate:    row.departure_date,
        returnDate:       row.return_date,
        nights:           row.nights,
        destination:      row.destination,
        embarkationPort:  row.embarkation_port,
        itineraryPorts:   row.itinerary_ports ?? [],
        prices: {
          interior:  { current: null },
          oceanview: { current: null },
          balcony:   { current: null },
          suite:     { current: null },
        },
      };
      map.set(row.id, sailing);
    }

    // current_prices can be an array (Supabase join) or single object
    const currentPrices = Array.isArray(row.current_prices)
      ? row.current_prices
      : row.current_prices ? [row.current_prices] : [];

    for (const cp of currentPrices) {
      const cat = cp.cabin_category as keyof typeof sailing.prices;
      if (!(cat in sailing.prices)) continue;
      const cell = sailing.prices[cat];

      // Set the lowest current price per category
      if (cell.current === null || cp.current_price < cell.current) {
        cell.current = cp.current_price;
      }

      // Track suite subcategories
      if (cat === 'suite' && cp.cabin_subcategory) {
        if (!cell.subcategories) cell.subcategories = [];
        const existing = cell.subcategories.find((s) => s.code === cp.cabin_subcategory);
        if (!existing) {
          cell.subcategories.push({
            code:  cp.cabin_subcategory,
            name:  cp.cabin_subcategory_name ?? cp.cabin_subcategory,
            price: cp.current_price,
          });
        }
      }
    }

    if (includeLowest) {
      const lowestPrices = Array.isArray(row.lowest_ever_prices)
        ? row.lowest_ever_prices
        : row.lowest_ever_prices ? [row.lowest_ever_prices] : [];

      for (const lp of lowestPrices) {
        const cat = lp.cabin_category as keyof typeof sailing.prices;
        if (!(cat in sailing.prices)) continue;
        const cell = sailing.prices[cat];
        cell.lowestEver = lp.lowest_ever_price;
        cell.isAtLowestEver = cell.current !== null && cell.current <= lp.lowest_ever_price;
      }
    }
  }

  return Array.from(map.values());
}
