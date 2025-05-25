# Open165 Worker

Integrations and workflows for Open165.

## First-time setup

```bash
npm i
```

## Start server

```bash
npm run dev
```

## Deploy

Deploy to Cloudflare workers using:

```bash
npm run deploy
```

## Linting and Formatting

This project uses ESLint for linting and Prettier for code formatting.

To check for linting issues and automatically fix them (including formatting), run:

```bash
npm run lint -- --fix
```

To perform a TypeScript type check, run:

```bash
npm run typecheck
```

## Updating bindings

After adding new bindings to `wrangler.jsonc`, run the following command to update the bindings:

```bash
npm run cf-typegen
```

## Workflows

This project includes Cloudflare Workflows for syncing scam site data from 165 open data:

1. `SyncSiteRecordWorkflow` - Syncs scam site records from 165 open data
2. `SyncSiteAnnouncementWorkflow` - Syncs announcements from 165 API

### Scheduled Execution

The workflows are scheduled to run every weekday at 20:00 UTC+8 (12:00 UTC) via the cron trigger in `wrangler.jsonc`.

### Manual Execution

You can manually trigger workflows using the Wrangler CLI:

```bash
# Trigger site record sync
npx wrangler workflow invoke sync-site-record '{"submitToUrlscan": true}'

# Trigger site announcement sync
npx wrangler workflow invoke sync-site-announcement '{}'

# Get workflow status (replace INSTANCE_ID with the ID returned from invoke)
npx wrangler workflow status INSTANCE_ID
```

### Local vs. Remote Execution

When running workflows locally with `wrangler dev`:

- By default, workflows will use a local D1 database
- To use the remote D1 database, add the `--remote` flag:

```bash
# Use remote D1 when running locally
npx wrangler dev --remote

# Trigger workflow against remote database
npx wrangler workflow invoke sync-site-record '{"submitToUrlscan": true}' --remote
```

Without the `--remote` flag, workflows will write to the local D1 database, which is useful for testing without affecting production data.
