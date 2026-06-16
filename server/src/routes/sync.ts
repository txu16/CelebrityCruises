import type { Request, Response } from 'express';
import { Router } from 'express';
import { runFullSync } from '../lib/priceSync';
import { fetchShips, fetchAllSailingsWithPrices } from '../lib/celebrityApi';
import { expressAdminAuth } from './adminAuth';

const router = Router();

router.use(expressAdminAuth);

// Manual full sync trigger — responds immediately, runs sync in background
// (sync takes 2-5 min; Railway's proxy timeout would cut it off if we awaited)
router.post('/', (_req: Request, res: Response) => {
  res.json({ ok: true, message: 'Sync started' });
  runFullSync().catch((e) => console.error('[/api/sync] background sync failed:', e));
});

// Debug route: test API connectivity and return first 5 sailings with prices
router.post('/test-api', async (_req: Request, res: Response) => {
  try {
    console.log('[test-api] Fetching ships...');
    const ships = await fetchShips();
    console.log('[test-api] Ships:', ships.map((s) => `${s.code}:${s.name}`).join(', '));

    console.log('[test-api] Fetching first page of sailings with prices...');
    const all = await fetchAllSailingsWithPrices();
    console.log(`[test-api] Total sailings: ${all.length}`);

    res.json({
      shipCount: ships.length,
      ships: ships.slice(0, 5),
      sailingCount: all.length,
      sampleSailings: all.slice(0, 5).map((r) => ({ voyage: r.voyage, prices: r.prices })),
    });
  } catch (e) {
    console.error('[test-api] Error:', e);
    res.status(500).json({ error: String(e) });
  }
});

export default router;
