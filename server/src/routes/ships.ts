import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const { data, error } = await supabase
    .from('sailings')
    .select('ship_code, ship_name')
    .order('ship_name');

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  // Deduplicate by ship_code
  const seen = new Set<string>();
  const ships = (data ?? [])
    .filter((row) => {
      if (seen.has(row.ship_code)) return false;
      seen.add(row.ship_code);
      return true;
    })
    .map((row) => ({ code: row.ship_code, name: row.ship_name }));

  res.json({ ships });
});

export default router;
