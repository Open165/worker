/**
 * Main entrypoint - routes requests to their handlers
 */
import { screenshotHandler } from './handlers/screenshot';
import { whoisHandler } from './handlers/whois';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const { pathname } = new URL(request.url);
    switch (pathname) {
      case '/screenshot':
        return screenshotHandler(request, env, ctx);
      case '/whois':
        return whoisHandler(request, env, ctx);
      default:
        return new Response('Not found', { status: 404 });
    }
  }
} satisfies ExportedHandler<Env>;
