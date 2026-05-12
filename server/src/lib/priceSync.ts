import { supabase } from './supabase';
import { fetchAllSailingsWithPrices } from './celebrityApi';
import type { CelebPrices, CelebVoyage, SyncResult } from '../types';

export async function runFullSync(): Promise<SyncResult> {
  const start = Date.now();
  let voyagesSynced = 0;
  let snapshotsInserted = 0;
  let errors = 0;

  console.log('[priceSync] Starting full sync...');

  try {
    const all = await fetchAllSailingsWithPrices();

    const voyages = all.map((r) => r.voyage);
    const priceMap = new Map(all.map((r) => [r.voyage.voyageCode, r.prices]));

    await upsertSailings(voyages);
    voyagesSynced = voyages.length;

    for (const { voyage, prices } of all) {
      try {
        const inserted = await insertPriceSnapshots(voyage.voyageCode, prices);
        snapshotsInserted += inserted;
      } catch (e) {
        console.error(`[priceSync] snapshot insert failed for ${voyage.voyageCode}:`, e);
        errors++;
      }
    }

    void priceMap; // suppress unused warning
  } catch (e) {
    console.error('[priceSync] Fatal sync error:', e);
    errors++;
  }

  const durationMs = Date.now() - start;
  console.log(`[priceSync] Done. voyages=${voyagesSynced} snapshots=${snapshotsInserted} errors=${errors} duration=${durationMs}ms`);

  return { ok: errors === 0, voyagesSynced, snapshotsInserted, errors, durationMs };
}

async function upsertSailings(voyages: CelebVoyage[]): Promise<void> {
  if (voyages.length === 0) return;

  const rows = voyages.map((v) => ({
    id:               v.voyageCode,
    ship_code:        v.shipCode,
    ship_name:        v.shipName,
    departure_date:   v.departureDate,
    return_date:      v.returnDate,
    nights:           v.nights,
    destination:      v.destination,
    embarkation_port: v.embarkationPort,
    itinerary_ports:  v.ports,
    updated_at:       new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('sailings')
    .upsert(rows, { onConflict: 'id' });

  if (error) throw new Error(`upsertSailings failed: ${error.message}`);
  console.log(`[priceSync] Upserted ${rows.length} sailings`);
}

async function insertPriceSnapshots(voyageCode: string, prices: CelebPrices): Promise<number> {
  if (prices.cabins.length === 0) return 0;

  const capturedAt = new Date().toISOString();
  const rows = prices.cabins
    .filter((c) => c.pricePerPerson > 0)
    .map((c) => ({
      sailing_id:            voyageCode,
      cabin_category:        c.category,
      cabin_subcategory:     c.subcategoryCode,
      cabin_subcategory_name: c.subcategoryName,
      price_per_person:      c.pricePerPerson,
      captured_at:           capturedAt,
    }));

  if (rows.length === 0) return 0;

  const { error } = await supabase.from('price_snapshots').insert(rows);
  if (error) throw new Error(`insertPriceSnapshots failed: ${error.message}`);

  return rows.length;
}
