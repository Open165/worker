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
