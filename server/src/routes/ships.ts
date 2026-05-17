import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const { data, error } = await supabase.rpc('get_distinct_ships');

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const ships = (data ?? [])
    .map((row: { ship_code: string; ship_name: string }) => ({ code: row.ship_code, name: row.ship_name }))
    .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));

  res.json({ ships });
});

export default router;
