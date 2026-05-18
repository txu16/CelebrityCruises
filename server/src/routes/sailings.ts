import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import {
  buildSailingResults,
  fetchAllRows,
  fetchRowsForIdChunks,
  paginateResults,
  parseList,
  parsePagination,
  sortResults,
  type RawPriceRow,
  type RawSailingRow,
} from './sailingResults';

const router = Router();

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
  try {
    const {
      months: monthsParam, cabinCategory, nightsPresets: nightsPresetsParam,
      shipCodes: shipCodesParam, suiteSubcategory, sortBy,
      limit = '50', offset = '0',
    } = req.query as Record<string, string>;

    const today = new Date().toISOString().split('T')[0];
    const { limit: parsedLimit, offset: parsedOffset } = parsePagination(limit, offset);
    const selectedCats = parseList(cabinCategory);
    const suiteSubcategories = parseList(suiteSubcategory);
    const months = parseList(monthsParam);
    const nightsPresets = parseList(nightsPresetsParam);
    const shipCodes = parseList(shipCodesParam);
    const filterArgs = { months, nightsPresets, shipCodes, today };

    // Fetch the full filtered sailing set first. Price and cabin filters are applied
    // after joining current prices so totals and pagination match what users see.
    const sailingRows = await fetchAllRows<RawSailingRow>(() => applyBaseFilters(
      supabase
        .from('sailings')
        .select('id, ship_code, ship_name, departure_date, return_date, nights, destination, embarkation_port, itinerary_ports')
        .order('departure_date', { ascending: true }),
      filterArgs
    ));
    if (!sailingRows.length) { res.json({ sailings: [], total: 0 }); return; }

    const sailingIds = sailingRows.map((s) => s.id);
    const [priceRows, { data: syncData }] = await Promise.all([
      fetchRowsForIdChunks<RawPriceRow>(sailingIds, (ids) => {
        let priceQ = supabase
          .from('current_prices')
          .select('sailing_id, cabin_category, cabin_subcategory, cabin_subcategory_name, current_price, last_updated')
          .in('sailing_id', ids);
        if (selectedCats.length > 0) priceQ = priceQ.in('cabin_category', selectedCats);
        if (suiteSubcategories.length > 0) priceQ = priceQ.in('cabin_subcategory', suiteSubcategories);
        return priceQ;
      }),
      supabase.from('current_prices').select('last_updated').order('last_updated', { ascending: false }).limit(1),
    ]);
    const lastSynced = (syncData as { last_updated: string }[] | null)?.[0]?.last_updated ?? null;

    const results = sortResults(
      buildSailingResults({
        sailingRows,
        priceRows,
        selectedCats,
        suiteSubcategories,
      }),
      sortBy,
      selectedCats
    );

    res.json({
      sailings: paginateResults(results, parsedOffset, parsedLimit),
      total: results.length,
      lastSynced,
    });
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
