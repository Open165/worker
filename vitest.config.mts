import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.jsonc' },
        // Required for testing Workflows.
        isolatedStorage: false,
        // Use a single worker to prevent re-initializing stateful resources like Workflows.
        singleWorker: true,
      },
    },
  },
});
