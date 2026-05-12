import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';

const router = Router();

const ALL_CATS = ['interior', 'oceanview', 'balcony', 'suite'] as const;

function applyBaseFilters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  q: any,
  { month, nightsMin, nightsMax, shipCode, today }: {
    month?: string; nightsMin?: string; nightsMax?: string; shipCode?: string; today: string;
  }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  q = q.gte('departure_date', today);
  if (month) {
    const [year, mon] = month.split('-').map(Number);
    if (year && mon) {
      const start = `${year}-${String(mon).padStart(2, '0')}-01`;
      const end = new Date(year, mon, 1).toISOString().split('T')[0];
      q = q.gte('departure_date', start).lt('departure_date', end);
    }
  }
  if (nightsMin) q = q.gte('nights', Number(nightsMin));
  if (nightsMax) q = q.lte('nights', Number(nightsMax));
  if (shipCode)  q = q.eq('ship_code', shipCode);
  return q;
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      month, cabinCategory, nightsMin, nightsMax, shipCode, sortBy,
      limit = '50', offset = '0',
    } = req.query as Record<string, string>;

    const today = new Date().toISOString().split('T')[0];
    const parsedLimit = Math.min(Number(limit) || 50, 200);
    const parsedOffset = Number(offset) || 0;
    const selectedCats = cabinCategory
      ? cabinCategory.split(',').map((c) => c.trim()).filter(Boolean)
      : null;
    const filterArgs = { month, nightsMin, nightsMax, shipCode, today };

    // For price sort, fetch a large batch and sort in JS; for date sort paginate at DB
    const sortByPrice = sortBy === 'price';
    const dbLimit  = sortByPrice ? 500 : parsedLimit;
    const dbOffset = sortByPrice ? 0   : parsedOffset;

    // Step 1a: total count (non-cabin filters only)
    const { count, error: countErr } = await applyBaseFilters(
      supabase.from('sailings').select('id', { count: 'exact', head: true }),
      filterArgs
    );
    if (countErr) { res.status(500).json({ error: countErr.message }); return; }

    // Step 1b: fetch the page of sailings ordered by date
    const { data: sailingRows, error: sailErr } = await applyBaseFilters(
      supabase
        .from('sailings')
        .select('id, ship_code, ship_name, departure_date, return_date, nights, destination, embarkation_port, itinerary_ports')
        .order('departure_date', { ascending: true })
        .range(dbOffset, dbOffset + dbLimit - 1),
      filterArgs
    );
    if (sailErr) { res.status(500).json({ error: sailErr.message }); return; }
    if (!sailingRows?.length) { res.json({ sailings: [], total: count ?? 0 }); return; }

    // Step 2: fetch current prices for just these sailings (max ~500 IDs at a time)
    const sailingIds = (sailingRows as { id: string }[]).map((s) => s.id);
    let priceQ = supabase
      .from('current_prices')
      .select('sailing_id, cabin_category, current_price')
      .in('sailing_id', sailingIds);
    if (selectedCats) priceQ = priceQ.in('cabin_category', selectedCats);

    const { data: priceRows, error: priceErr } = await priceQ;
    if (priceErr) { res.status(500).json({ error: priceErr.message }); return; }

    // Step 3: build per-sailing price map (cheapest per category)
    const priceMap = new Map<string, Map<string, number>>();
    for (const p of (priceRows ?? []) as { sailing_id: string; cabin_category: string; current_price: number }[]) {
      if (!priceMap.has(p.sailing_id)) priceMap.set(p.sailing_id, new Map());
      const catMap = priceMap.get(p.sailing_id)!;
      const prev = catMap.get(p.cabin_category);
      if (prev === undefined || p.current_price < prev) catMap.set(p.cabin_category, p.current_price);
    }

    // Step 4: build result objects, filter by cabin presence if category filter set
    let results = (sailingRows as {
      id: string; ship_code: string; ship_name: string;
      departure_date: string; return_date: string; nights: number;
      destination: string; embarkation_port: string; itinerary_ports: string[] | null;
    }[])
      .filter((s) => {
        if (!selectedCats) return true;
        const cats = priceMap.get(s.id);
        return cats !== undefined && selectedCats.some((c) => cats.has(c));
      })
      .map((s) => {
        const cats = priceMap.get(s.id) ?? new Map<string, number>();
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
            ALL_CATS.map((cat) => [cat, { current: cats.get(cat) ?? null }])
          ),
        };
      });

    // Step 5: sort by price if requested, then JS-paginate
    if (sortByPrice) {
      results.sort((a, b) => {
        const minPrice = (r: typeof results[0]) =>
          Math.min(...ALL_CATS.map((c) => (r.prices as Record<string, { current: number | null }>)[c]?.current ?? Infinity));
        return minPrice(a) - minPrice(b);
      });
      results = results.slice(parsedOffset, parsedOffset + parsedLimit);
    }

    res.json({ sailings: results, total: count ?? results.length });
  } catch (e) {
    console.error('[/api/sailings]', e);
    res.status(500).json({ error: String(e) });
  }
});

router.get('/:id/history', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from('price_snapshots')
    .select('cabin_category, price_per_person, captured_at')
    .eq('sailing_id', id)
    .order('captured_at', { ascending: true });

  if (error) { res.status(500).json({ error: error.message }); return; }

  const grouped: Record<string, { date: string; price: number }[]> = {};
  for (const row of (data ?? []) as { cabin_category: string; price_per_person: number; captured_at: string }[]) {
    if (!grouped[row.cabin_category]) grouped[row.cabin_category] = [];
    grouped[row.cabin_category].push({ date: row.captured_at, price: Number(row.price_per_person) });
  }

  res.json({ history: grouped });
});

export default router;
