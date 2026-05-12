import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';

import { checkConnection } from './lib/supabase';
import { runFullSync } from './lib/priceSync';
import { startDailySync } from './cron/dailySync';

import sailingsRouter  from './routes/sailings';
import lowestEverRouter from './routes/lowestEver';
import shipsRouter     from './routes/ships';
import syncRouter      from './routes/sync';

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

app.use(cors());
app.use(express.json());

// API routes
app.use('/api/sailings',    sailingsRouter);
app.use('/api/lowest-ever', lowestEverRouter);
app.use('/api/ships',       shipsRouter);
app.use('/api/sync',        syncRouter);

app.get('/api/health', async (_req, res) => {
  const dbConnected = await checkConnection();
  res.json({ ok: true, dbConnected });
});

// Serve built client in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.listen(PORT, async () => {
  console.log(`[server] Listening on http://localhost:${PORT}`);

  const dbOk = await checkConnection();
  console.log(`[server] Supabase: ${dbOk ? 'connected' : 'NOT connected (check env vars)'}`);

  startDailySync();

  if (process.env.SYNC_ON_STARTUP === 'true') {
    console.log('[server] SYNC_ON_STARTUP=true — running initial sync...');
    runFullSync().catch(console.error);
  }
});
