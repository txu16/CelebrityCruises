import cron from 'node-cron';
import { runFullSync } from '../lib/priceSync';

export function startDailySync(): void {
  const schedule = process.env.SYNC_CRON ?? '0 2 * * *';

  if (!cron.validate(schedule)) {
    console.error(`[cron] Invalid SYNC_CRON expression: "${schedule}". Skipping cron setup.`);
    return;
  }

  cron.schedule(schedule, async () => {
    console.log(`[cron] Daily sync triggered at ${new Date().toISOString()}`);
    await runFullSync();
  });

  console.log(`[cron] Daily sync scheduled: "${schedule}"`);
}
