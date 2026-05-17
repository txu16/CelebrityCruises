import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';

const router = Router();

const ALL_CATS = ['interior', 'oceanview', 'balcony', 'suite'] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyBaseFilters(q: any, { months, nightsPresets, shipCodes, today }: {
  months?: string[]; nightsPresets?: string[]; shipCodes?: string[]; today: string;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
}): any {
  q = q.gte('departure_date', today);

  if (months && months.length > 0) {
    const ranges = months
      .map((m) => {
        const [year, mon] = m.split('-').map(Number);
        if (!year || !mon) return null;
        const start = `${year}-${String(mon).padStart(2, '0')}-01`;
        const end = new Date(year, mon, 1).toISOString().split('T')[0];
        return `and(departure_date.gte.${start},departure_date.lt.${end})`;
      })
      .filter(Boolean) as string[];
    if (ranges.length > 0) q = q.or(ranges.join(','));
  }

  if (nightsPresets && nightsPresets.length > 0) {
    const rangeFilters = nightsPresets.map((preset) => {
      switch (preset) {
        case '3-5':   return 'and(nights.gte.3,nights.lte.5)';
        case '7':     return 'nights.eq.7';
        case '10-14': return 'and(nights.gte.10,nights.lte.14)';
        case '15+':   return 'nights.gte.15';
        default:      return null;
      }
    }).filter(Boolean) as string[];
    if (rangeFilters.length > 0) q = q.or(rangeFilters.join(','));
  }

  if (shipCodes && shipCodes.length > 0) q = q.in('ship_code', shipCodes);

  return q;
}

router.get('/', async (req: Request, res: Response) => {
  const {
    months: monthsParam, cabinCategory, nightsPresets: nightsPresetsParam,
    shipCodes: shipCodesParam, sortBy,
    limit = '50', offset = '0',
  } = req.query as Record<string, string>;

  if (!cabinCategory) {
    res.json({ sailings: [], total: 0, requiresCabinFilter: true });
    return;
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    const selectedCats = cabinCategory.split(',').map((c) => c.trim()).filter(Boolean);
    const parsedLimit = Math.min(Number(limit) || 50, 200);
    const parsedOffset = Number(offset) || 0;
    const months = monthsParam ? monthsParam.split(',').map((m) => m.trim()).filter(Boolean) : [];
    const nightsPresets = nightsPresetsParam ? nightsPresetsParam.split(',').map((n) => n.trim()).filter(Boolean) : [];
    const shipCodes = shipCodesParam ? shipCodesParam.split(',').map((s) => s.trim()).filter(Boolean) : [];
    const filterArgs = { months, nightsPresets, shipCodes, today };

    // Step 1: fetch a batch of future sailings matching non-cabin filters
    const { data: sailingRows, error: sailErr } = await applyBaseFilters(
      supabase
        .from('sailings')
        .select('id, ship_code, ship_name, departure_date, return_date, nights, destination, embarkation_port, itinerary_ports')
        .order('departure_date', { ascending: true })
        .limit(500),
      filterArgs
    );
    if (sailErr) { res.status(500).json({ error: sailErr.message }); return; }
    if (!sailingRows?.length) {
      res.json({ sailings: [], total: 0, requiresCabinFilter: false });
      return;
    }

    const sailingIds = (sailingRows as { id: string }[]).map((s) => s.id);

    // Step 2: fetch current prices, lowest-ever prices, and last sync time in parallel
    const [{ data: priceRows, error: priceErr }, { data: lowestRows, error: lowestErr }, { data: syncData }] =
      await Promise.all([
        supabase
          .from('current_prices')
          .select('sailing_id, cabin_category, current_price')
          .in('sailing_id', sailingIds)
          .in('cabin_category', selectedCats),
        supabase
          .from('lowest_ever_prices')
          .select('sailing_id, cabin_category, lowest_ever_price, first_tracked_at')
          .in('sailing_id', sailingIds)
          .in('cabin_category', selectedCats),
        supabase.from('current_prices').select('last_updated').order('last_updated', { ascending: false }).limit(1),
      ]);
    const lastSynced = (syncData as { last_updated: string }[] | null)?.[0]?.last_updated ?? null;

    if (priceErr)  { res.status(500).json({ error: priceErr.message }); return; }
    if (lowestErr) { res.status(500).json({ error: lowestErr.message }); return; }

    // Build lookup maps
    const currentMap = new Map<string, Map<string, number>>();
    for (const p of (priceRows ?? []) as { sailing_id: string; cabin_category: string; current_price: number }[]) {
      if (!currentMap.has(p.sailing_id)) currentMap.set(p.sailing_id, new Map());
      const catMap = currentMap.get(p.sailing_id)!;
      const prev = catMap.get(p.cabin_category);
      if (prev === undefined || p.current_price < prev) catMap.set(p.cabin_category, p.current_price);
    }

    const lowestMap = new Map<string, Map<string, number>>();
    const trackedSinceMap = new Map<string, Map<string, string>>();
    for (const l of (lowestRows ?? []) as { sailing_id: string; cabin_category: string; lowest_ever_price: number; first_tracked_at: string }[]) {
      if (!lowestMap.has(l.sailing_id)) lowestMap.set(l.sailing_id, new Map());
      lowestMap.get(l.sailing_id)!.set(l.cabin_category, l.lowest_ever_price);
      if (!trackedSinceMap.has(l.sailing_id)) trackedSinceMap.set(l.sailing_id, new Map());
      trackedSinceMap.get(l.sailing_id)!.set(l.cabin_category, l.first_tracked_at);
    }

    // Build results — only sailings where ≥1 selected category is at its lowest ever
    const results = (sailingRows as {
      id: string; ship_code: string; ship_name: string;
      departure_date: string; return_date: string; nights: number;
      destination: string; embarkation_port: string; itinerary_ports: string[] | null;
    }[])
      .map((s) => {
        const current = currentMap.get(s.id) ?? new Map<string, number>();
        const lowest  = lowestMap.get(s.id)  ?? new Map<string, number>();
        return {
          id:              s.id,
          shipCode:        s.ship_code,
          shipName:        s.ship_name,
          departureDate:   s.departure_date,
          returnDate:      s.return_date,
          nights:          s.nights,
          destination:     s.destination,
          embarkationPort: s.embarkation_port,
          itineraryPorts:  s.itinerary_ports ?? [],
          prices: Object.fromEntries(
            ALL_CATS.map((cat) => {
              const cur   = current.get(cat) ?? null;
              const low   = lowest.get(cat)  ?? null;
              const since = trackedSinceMap.get(s.id)?.get(cat) ?? null;
              return [cat, {
                current:        cur,
                lowestEver:     low,
                isAtLowestEver: cur !== null && low !== null && cur <= low,
                trackedSince:   since,
              }];
            })
          ),
        };
      })
      .filter((s) =>
        selectedCats.some((cat) => (s.prices as Record<string, { isAtLowestEver: boolean }>)[cat]?.isAtLowestEver === true)
      );

    if (sortBy === 'price') {
      results.sort((a, b) => {
        const minPrice = (r: typeof a) =>
          Math.min(...selectedCats.map((cat) => (r.prices as Record<string, { current: number | null }>)[cat]?.current ?? Infinity));
        return minPrice(a) - minPrice(b);
      });
    }

    const total = results.length;
    res.json({
      sailings: results.slice(parsedOffset, parsedOffset + parsedLimit),
      total,
      lastSynced,
      requiresCabinFilter: false,
    });
  } catch (e) {
    console.error('[/api/lowest-ever]', e);
    res.status(500).json({ error: String(e) });
  }
});

export default router;
