import { test, expect, describe, afterAll } from 'vitest';
import { env } from 'cloudflare:test';

declare module 'cloudflare:test' {
  // Extend the Cloudflare Env interface to include bindings
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ProvidedEnv extends Cloudflare.Env {}
}

const TEST_TIMEOUT = 60 * 1000; // 60 seconds

// FIXME: Setup database after we move DB schema to here
// TODO: also test another workflow
describe.skip('Integration Test: Sync Site Record Workflow', () => {
  afterAll(async () => {
    // Clean up the database after all tests in this file
    await env.DB.exec('DELETE FROM ScamSiteRecord');
  });

  test(
    'should create a workflow, which then fetches real data and inserts it into D1',
    async () => {
      // 1. Create a workflow instance directly using the binding
      await env.SYNC_SITE_RECORD.create({
        id: crypto.randomUUID(),
        params: {
          submitToUrlscan: false,
        },
      });

      // 2. Wait for the asynchronous workflow to complete by polling the database.
      await pollForDbRecords(1, 20 * 1000);

      // 3. Verify the result directly using the D1 binding
      const { results } = await env.DB.prepare('SELECT * FROM ScamSiteRecord').all();
      expect(results.length).toBeGreaterThan(0);
    },
    TEST_TIMEOUT
  );
});

async function pollForDbRecords(expectedCount: number, timeout: number) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const res = await env.DB.prepare(`SELECT COUNT(*) as count FROM ScamSiteRecord`).first<{ count: number }>();
    if (res?.count !== undefined && res.count >= expectedCount) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Polling for DB records timed out after ${timeout / 1000}s`);
}
