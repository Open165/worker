# Open165 Worker

Integrations and workflows for Open165.

## First-time setup

```bash
npm i
```

### Local Environment Variables

For local development, create a `.dev.vars` file in the project root (don't commit this file):

```bash
# Copy the sample file
cp .dev.vars.sample .dev.vars

# Edit with your actual values
# URLSCAN_API_KEY="your-api-key-here"
```


## Start server

For local development with scheduled tasks enabled:

```bash
npm run dev
```

This will start a local server with:
- Local D1 database simulation
- Local workflow simulation
- Scheduled task testing endpoint at `http://localhost:8787/__scheduled`

### Testing Scheduled Workflows Locally

You can trigger the scheduled workflows with:

```bash
# Trigger a scheduled event using curl
curl -X POST http://localhost:8787/__scheduled -H "Content-Type: application/json" -d '{"cron":"* * * * *"}'
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
# Trigger site record sync (remote only)
npx wrangler workflows trigger sync-site-record '{"submitToUrlscan": true}'

# Trigger site announcement sync (remote only)
npx wrangler workflows trigger sync-site-announcement '{}'

# Get workflow status (replace INSTANCE_ID with the ID returned from trigger)
npx wrangler workflows instances describe sync-site-record INSTANCE_ID
npx wrangler workflows instances describe sync-site-announcement INSTANCE_ID
```

Note: The `workflows trigger` command only works with remote deployments, not for local development. For local testing, use the `/__scheduled` endpoint as described above.
