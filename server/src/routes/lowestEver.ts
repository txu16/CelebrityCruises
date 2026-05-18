import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import {
  buildSailingResults,
  buildCurrentRowsFromSnapshots,
  fetchAllRows,
  fetchRowsForIdChunks,
  filterLowestEverResults,
  paginateResults,
  parseList,
  parsePagination,
  sortResults,
  type RawLowestRow,
  type RawPriceRow,
  type RawPriceSnapshotRow,
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
  const {
    months: monthsParam, cabinCategory, nightsPresets: nightsPresetsParam,
    shipCodes: shipCodesParam, suiteSubcategory, sortBy,
    limit = '50', offset = '0',
  } = req.query as Record<string, string>;

  if (!cabinCategory) {
    res.json({ sailings: [], total: 0, requiresCabinFilter: true });
    return;
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    const selectedCats = parseList(cabinCategory);
    const suiteSubcategories = parseList(suiteSubcategory);
    const { limit: parsedLimit, offset: parsedOffset } = parsePagination(limit, offset);
    const months = parseList(monthsParam);
    const nightsPresets = parseList(nightsPresetsParam);
    const shipCodes = parseList(shipCodesParam);
    const filterArgs = { months, nightsPresets, shipCodes, today };

    const sailingRows = await fetchAllRows<RawSailingRow>(() => applyBaseFilters(
      supabase
        .from('sailings')
        .select('id, ship_code, ship_name, departure_date, return_date, nights, destination, embarkation_port, itinerary_ports')
        .order('departure_date', { ascending: true }),
      filterArgs
    ));
    if (!sailingRows.length) {
      res.json({ sailings: [], total: 0, requiresCabinFilter: false });
      return;
    }

    const sailingIds = sailingRows.map((s) => s.id);

    const [priceRows, snapshotRows, { data: syncData }] =
      await Promise.all([
        fetchCurrentPriceRows(sailingIds, selectedCats, suiteSubcategories),
        fetchRowsForIdChunks<RawPriceSnapshotRow>(sailingIds, (ids) => {
          let snapshotQ = supabase
            .from('price_snapshots')
            .select('sailing_id, cabin_category, cabin_subcategory, price_per_person, captured_at')
            .in('sailing_id', ids)
            .in('cabin_category', selectedCats);
          if (suiteSubcategories.length > 0) snapshotQ = snapshotQ.in('cabin_subcategory', suiteSubcategories);
          return snapshotQ;
        }),
        supabase.from('current_prices').select('last_updated').order('last_updated', { ascending: false }).limit(1),
      ]);
    const lastSynced = (syncData as { last_updated: string }[] | null)?.[0]?.last_updated ?? null;

    const results = sortResults(
      filterLowestEverResults(
        buildSailingResults({
          sailingRows,
          priceRows,
          selectedCats,
          suiteSubcategories,
          lowestRows: buildLowestRows(snapshotRows, suiteSubcategories.length > 0),
        }),
        selectedCats
      ),
      sortBy,
      selectedCats
    );

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

function fetchCurrentPriceRows(
  sailingIds: string[],
  selectedCats: string[],
  suiteSubcategories: string[]
): Promise<RawPriceRow[]> {
  if (suiteSubcategories.length > 0) {
    return fetchRowsForIdChunks<RawPriceSnapshotRow>(sailingIds, (ids) => {
      let snapshotQ = supabase
        .from('price_snapshots')
        .select('sailing_id, cabin_category, cabin_subcategory, cabin_subcategory_name, price_per_person, captured_at')
        .in('sailing_id', ids)
        .in('cabin_category', selectedCats);
      snapshotQ = snapshotQ.in('cabin_subcategory', suiteSubcategories);
      return snapshotQ;
    }).then(buildCurrentRowsFromSnapshots);
  }

  return fetchRowsForIdChunks<RawPriceRow>(sailingIds, (ids) => supabase
    .from('current_prices')
    .select('sailing_id, cabin_category, current_price')
    .in('sailing_id', ids)
    .in('cabin_category', selectedCats));
}

function buildLowestRows(rows: RawPriceSnapshotRow[], includeSuiteSubcategory: boolean): RawLowestRow[] {
  const lowest = new Map<string, RawLowestRow>();

  for (const row of rows) {
    const subcategory = includeSuiteSubcategory && row.cabin_category === 'suite' ? row.cabin_subcategory : null;
    const key = [row.sailing_id, row.cabin_category, subcategory ?? ''].join('|');
    const existing = lowest.get(key);
    if (!existing || row.price_per_person < existing.lowest_ever_price) {
      lowest.set(key, {
        sailing_id: row.sailing_id,
        cabin_category: row.cabin_category,
        cabin_subcategory: subcategory,
        lowest_ever_price: row.price_per_person,
        first_tracked_at: row.captured_at,
      });
    }
  }

  return Array.from(lowest.values());
}
